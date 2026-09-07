"""Administrative commands, for things that cannot be done through the app.

The first Super Admin is the reason this exists. Creating an account requires
being signed in as a Super Admin, and until somebody runs this there is not one,
so the chicken and egg has to be broken from outside the application. That is the
standard answer to it rather than a workaround.

The commands are German, like the route paths, and so are the messages. This is a
tool for FFS staff and it should read the way the rest of the application does.
The exceptions in fehler.py deliberately carry no wording, so the German lives
here and feature 2b's endpoints can produce their own.

Every refusal below has to name the thing, say why in ordinary words, and say
what to do instead. A message that does only the first is not finished. That is
the standard this project set on 2026-09-06, and it applies here more than
anywhere: whoever runs this is usually setting the system up for the first time
and has the least context of anyone who will ever use it.
"""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Annotated

import typer
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.benutzer.dienst import lege_benutzer_an
from app.benutzer.fehler import (
    EmailBereitsVergeben,
    EmailUngueltig,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
)
from app.benutzer.regeln import (
    normalisiere_email,
    normalisiere_rollen,
    pruefe_regierungspraesidium,
)
from app.db import session_factory
from app.models.benutzer import Locale, Rolle
from app.security.passwoerter import PasswortZuKurz, PasswortZuLang

app = typer.Typer(help="Verwaltung der Anwendung Protokoll E-Befischung.", no_args_is_help=True)
benutzer_app = typer.Typer(help="Konten anlegen und verwalten.", no_args_is_help=True)
app.add_typer(benutzer_app, name="benutzer")

# 1 to 4, named, because "--regierungspraesidium 3" means nothing to somebody
# setting the system up and everything to the person whose account it is.
REGIERUNGSPRAESIDIEN = {
    1: "Stuttgart",
    2: "Karlsruhe",
    3: "Freiburg",
    4: "Tübingen",
}


def _abbrechen(*zeilen: str) -> None:
    """Print the refusal on stderr and stop with a non-zero exit code.

    stderr rather than stdout so that a script piping the output of a listing
    command does not silently swallow the reason it produced nothing. Non-zero
    so a deploy script that ignores output still notices.
    """
    for zeile in zeilen:
        typer.echo(zeile, err=True)
    raise typer.Exit(code=1)


def _ausfuehren[T](arbeit: Callable[[AsyncSession], Awaitable[T]]) -> T:
    """Run a command's whole database work and turn its failures into messages.

    The commands are ordinary synchronous functions and the service layer is
    async, so this is the one place the two meet.

    A command must call this exactly once, with everything it needs to do
    inside, including anything it asks the user between two queries.

    asyncio.run() creates an event loop and closes it again, and a database
    connection belongs to the loop it was opened on. app/db.py keeps a long
    lived pool, so a second call here is handed a connection from the first
    loop, which has already gone, and fails with "Event loop is closed" and no
    useful message.

    Found on 2026-09-07 by running the command for real, after a reachability
    check was added as a separate call. The suite had not caught it: the tests
    replaced the session factory with one that pools nothing, so a fixture more
    forgiving than production hid a defect that only appeared outside it. There
    is now a test using a pooling factory for exactly this reason.
    """

    async def mit_sitzung() -> T:
        async with session_factory() as sitzung:
            return await arbeit(sitzung)

    try:
        return asyncio.run(mit_sitzung())
    except (SQLAlchemyError, OSError) as fehler:
        # The failure whoever sets this up hits first, and the one a raw stack
        # trace explains worst. It is almost never a broken application; it is
        # almost always a database that is not running yet.
        _abbrechen(
            "Die Datenbank ist nicht erreichbar, deshalb wurde nichts geändert.",
            "",
            "Der Stack läuft vermutlich nicht. Im Projektverzeichnis startet ihn:",
            "    docker compose up -d",
            "Danach denselben Befehl noch einmal ausführen.",
            "",
            f"Technische Meldung: {type(fehler).__name__}",
        )
        raise  # unreachable, and mypy cannot know _abbrechen never returns


def _passwort_erfragen() -> str:
    """Ask twice, hidden, and never take it as an argument.

    A password given on the command line lands in the shell history and is
    visible to anyone who can run ps while the command is running, which on a
    shared server is everybody.

    Asked twice rather than once because it is not echoed, so a typo would
    otherwise become an account nobody can sign in to and nobody can diagnose.
    """
    passwort: str = typer.prompt("Passwort", hide_input=True)
    wiederholung: str = typer.prompt("Passwort wiederholen", hide_input=True)
    if passwort != wiederholung:
        _abbrechen(
            "Die beiden Eingaben sind nicht gleich, deshalb wurde kein Konto angelegt.",
            "",
            "Das Passwort wird beim Tippen nicht angezeigt, ein Vertipper fällt also nicht auf.",
            "Bitte den Befehl noch einmal ausführen.",
        )
    return passwort


def _rollen_hinweis() -> str:
    return "Mögliche Rollen: " + ", ".join(rolle.value for rolle in Rolle)


@benutzer_app.command("anlegen")
def anlegen(
    email: Annotated[
        str, typer.Option("--email", help="Die Adresse, mit der sich das Konto anmeldet.")
    ],
    rollen: Annotated[
        list[Rolle],
        typer.Option("--rolle", help="Rolle des Kontos. Mehrfach angeben für mehrere Rollen."),
    ],
    regierungspraesidium: Annotated[
        int | None,
        typer.Option(
            "--regierungspraesidium",
            help="1 Stuttgart, 2 Karlsruhe, 3 Freiburg, 4 Tübingen. Nur für regionale Konten.",
        ),
    ] = None,
    locale: Annotated[
        Locale, typer.Option("--sprache", help="Sprache der Oberfläche.")
    ] = Locale.DE,
) -> None:
    """Ein Konto anlegen. Das Passwort wird abgefragt, nicht als Option übergeben."""
    try:
        # Everything that can be refused without a password is refused before one
        # is asked for. Making somebody type a password twice, blind, and then
        # telling them the database is not running, or that they misspelled the
        # address, is the sort of small rudeness that a first setup is full of.
        email = normalisiere_email(email)
        rollen = normalisiere_rollen(rollen)
        pruefe_regierungspraesidium(rollen, regierungspraesidium)

        async def arbeit(sitzung: AsyncSession) -> str:
            # Touch the database before asking for anything that has to be
            # typed, so an unreachable database is reported now rather than
            # after two blind password entries.
            await sitzung.execute(text("SELECT 1"))
            passwort = _passwort_erfragen()
            angelegt = await lege_benutzer_an(
                sitzung,
                email=email,
                passwort=passwort,
                rollen=rollen,
                regierungspraesidium=regierungspraesidium,
                locale=locale,
            )
            return angelegt.email

        angelegte_email = _ausfuehren(arbeit)
    except EmailUngueltig as fehler:
        _abbrechen(
            f"„{fehler.email}“ ist keine E-Mail-Adresse, deshalb wurde kein Konto angelegt.",
            "",
            "Die Adresse dient zugleich als Anmeldename und muss vollständig sein,",
            "zum Beispiel: --email anna.bergmann@ffs.bwl.de",
        )
    except EmailBereitsVergeben as fehler:
        _abbrechen(
            f"Für {fehler.email} gibt es bereits ein Konto.",
            "",
            "Eine Adresse kann nur zu einem Konto gehören. Möglichkeiten:",
            "  - vorhandene Konten ansehen:   befischung benutzer liste",
            "  - ein gesperrtes Konto wieder freischalten:",
            f"        befischung benutzer aktivieren --email {fehler.email}",
            "  - oder eine andere Adresse verwenden.",
        )
    except RollenLeer:
        _abbrechen(
            "Es wurde keine Rolle angegeben, deshalb wurde kein Konto angelegt.",
            "",
            "Ein Konto ohne Rolle könnte sich anmelden und sonst nichts tun.",
            "Mindestens eine Rolle angeben, zum Beispiel: --rolle SUPER_ADMIN",
            _rollen_hinweis(),
        )
    except RegierungspraesidiumFehlt:
        _abbrechen(
            "Für ein Konto der Rolle REGIERUNGSPRAESIDIUM fehlt die Angabe, welches gemeint ist.",
            "",
            "Ohne diese Angabe würde das Konto alle Regionen sehen, statt nur seiner eigenen.",
            "Bitte ergänzen, zum Beispiel: --regierungspraesidium 4",
            "    " + ", ".join(f"{nr} {ort}" for nr, ort in REGIERUNGSPRAESIDIEN.items()),
        )
    except RegierungspraesidiumUnzulaessig as fehler:
        _abbrechen(
            f"--regierungspraesidium {fehler.regierungspraesidium} wurde angegeben, aber das"
            " Konto hat nicht die Rolle REGIERUNGSPRAESIDIUM.",
            "",
            "Bei allen anderen Rollen hat die Nummer keine Wirkung und wäre nur ein falscher",
            "Wert in der Datenbank. Entweder die Angabe weglassen, oder, wenn es wirklich ein",
            "regionales Konto sein soll, --rolle REGIERUNGSPRAESIDIUM ergänzen.",
        )
    except RegierungspraesidiumAusserhalbBereich as fehler:
        _abbrechen(
            f"{fehler.regierungspraesidium} ist kein Regierungspräsidium.",
            "",
            "In Baden-Württemberg gibt es vier:",
            "    " + ", ".join(f"{nr} {ort}" for nr, ort in REGIERUNGSPRAESIDIEN.items()),
        )
    except PasswortZuKurz as fehler:
        _abbrechen(
            f"Das Passwort ist zu kurz, deshalb wurde kein Konto angelegt."
            f" Es braucht mindestens {fehler.mindestlaenge} Zeichen.",
            "",
            "Es gibt keine Vorgabe zu Ziffern oder Sonderzeichen. Mehrere Wörter",
            "hintereinander sind leichter zu merken und zugleich sicherer als ein",
            "kurzes kompliziertes Passwort.",
            "",
            "Bitte den Befehl noch einmal ausführen und ein längeres Passwort wählen.",
        )
    except PasswortZuLang as fehler:
        _abbrechen(
            f"Das Passwort ist zu lang. Erlaubt sind bis zu {fehler.hoechstlaenge} Zeichen.",
            "",
            "Vermutlich ist versehentlich etwas anderes in die Eingabe geraten.",
            "Bitte den Befehl noch einmal ausführen.",
        )

    typer.echo(f"Konto {angelegte_email} wurde angelegt.")
    typer.echo(f"Rollen: {', '.join(rolle.value for rolle in rollen)}")
    if regierungspraesidium is not None:
        ort = REGIERUNGSPRAESIDIEN[regierungspraesidium]
        typer.echo(f"Regierungspräsidium: {regierungspraesidium} {ort}")


if __name__ == "__main__":
    app()
