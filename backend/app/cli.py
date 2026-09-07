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
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.benutzer.dienst import (
    finde_nach_email,
    lege_benutzer_an,
    liste_benutzer,
    setze_aktiv,
)
from app.benutzer.fehler import (
    BenutzerNichtGefunden,
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
from app.config import get_settings
from app.models.benutzer import Locale, Rolle
from app.security.passwoerter import PasswortZuKurz, PasswortZuLang

# The command line gets its own engine rather than app/db.py's.
#
# NullPool is the point: it opens a connection when one is needed and closes it
# again, keeping nothing. app/db.py holds a long lived pool, which is right for a
# web service answering many requests and wrong here, where the process runs one
# command and exits.
#
# It also removes a whole class of defect rather than documenting it. A pooled
# connection belongs to the event loop that opened it, and every asyncio.run()
# closes its loop at the end, so any second one would be handed a connection
# that no longer works. That is the failure found on 2026-09-07, and with
# nothing pooled it cannot happen at all.
_motor = create_async_engine(str(get_settings().database_url), poolclass=NullPool)
session_factory = async_sessionmaker(_motor)

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

    A command should still call this once, with everything it needs to do
    inside, including anything it asks the user between two queries. That is now
    a matter of tidiness rather than correctness: the engine above keeps no pool,
    so a second call opens a fresh connection instead of reaching for one that
    belonged to a loop asyncio.run() has already closed.

    It was not always tidiness. On 2026-09-07 this ran on the pooled engine in
    app/db.py, a reachability check was added as a second call, and the command
    failed with "Event loop is closed" and no useful message. The suite had not
    caught it: the tests replaced the session factory with one that pools
    nothing, so a fixture more forgiving than production hid the defect until
    the command was run by hand. There is now a test using a pooling factory,
    which holds the rule even for a caller that supplies a pooled engine.
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


def _sperrstatus_setzen(email: str, aktiv: bool) -> None:
    """The shared body of aktivieren and deaktivieren.

    Both read the account first, so an account that is already in the wanted
    state can be told apart from one that was changed. Reporting "deaktiviert"
    for an account that was already inactive would be true and useless: whoever
    ran it wanted to know they had had an effect.
    """
    wortlaut = "aktiviert" if aktiv else "deaktiviert"

    async def arbeit(sitzung: AsyncSession) -> tuple[str, bool]:
        vorher = await finde_nach_email(sitzung, email)
        if vorher is None:
            raise BenutzerNichtGefunden(normalisiere_email(email))
        if vorher.ist_aktiv == aktiv:
            return vorher.email, False
        geaendert = await setze_aktiv(sitzung, email, aktiv)
        return geaendert.email, True

    try:
        betroffene_email, geaendert = _ausfuehren(arbeit)
    except EmailUngueltig as fehler:
        _abbrechen(
            f"„{fehler.email}“ ist keine E-Mail-Adresse, deshalb wurde nichts geändert.",
            "",
            "Bitte die vollständige Adresse des Kontos angeben.",
            "Welche es gibt, zeigt: befischung benutzer liste",
        )
    except BenutzerNichtGefunden as fehler:
        _abbrechen(
            f"Für {fehler.email} gibt es kein Konto, deshalb wurde nichts geändert.",
            "",
            "Vielleicht ist die Adresse anders geschrieben als gedacht.",
            "Alle vorhandenen Konten zeigt: befischung benutzer liste",
        )

    if geaendert:
        typer.echo(f"Konto {betroffene_email} wurde {wortlaut}.")
    else:
        typer.echo(f"Konto {betroffene_email} war bereits {wortlaut}. Nichts geändert.")


@benutzer_app.command("aktivieren")
def aktivieren(
    email: Annotated[str, typer.Option("--email", help="Die Adresse des Kontos.")],
) -> None:
    """Ein gesperrtes Konto wieder freischalten."""
    _sperrstatus_setzen(email, aktiv=True)


@benutzer_app.command("deaktivieren")
def deaktivieren(
    email: Annotated[str, typer.Option("--email", help="Die Adresse des Kontos.")],
) -> None:
    """Ein Konto sperren. Es bleibt erhalten und kann wieder freigeschaltet werden."""
    _sperrstatus_setzen(email, aktiv=False)


def _regierungspraesidium_text(nummer: int | None) -> str:
    if nummer is None:
        return "-"
    return f"{nummer} {REGIERUNGSPRAESIDIEN[nummer]}"


@benutzer_app.command("liste")
def liste() -> None:
    """Alle Konten anzeigen."""
    konten = _ausfuehren(liste_benutzer)

    if not konten:
        typer.echo("Es gibt noch kein Konto.")
        typer.echo("")
        typer.echo("Das erste anlegen mit:")
        typer.echo("    befischung benutzer anlegen --email <adresse> --rolle SUPER_ADMIN")
        return

    # Columns sized from the data rather than fixed, because an email address
    # and a list of roles vary enough that any fixed width is wrong somewhere.
    # No password hash in any of them, deliberately: this output is scrolled
    # back through, pasted into tickets and captured by logs.
    zeilen = [
        (
            konto.email,
            ", ".join(rolle.value for rolle in konto.rollen),
            "aktiv" if konto.ist_aktiv else "gesperrt",
            _regierungspraesidium_text(konto.regierungspraesidium),
        )
        for konto in konten
    ]
    kopf = ("E-Mail", "Rollen", "Status", "Regierungspräsidium")
    breiten = [max(len(zeile[spalte]) for zeile in [kopf, *zeilen]) for spalte in range(4)]

    for zeile in [kopf, *zeilen]:
        spalten = zip(zeile, breiten, strict=True)
        typer.echo("  ".join(wert.ljust(breite) for wert, breite in spalten).rstrip())

    typer.echo("")
    typer.echo(f"{len(konten)} Konto" if len(konten) == 1 else f"{len(konten)} Konten")


if __name__ == "__main__":
    app()
