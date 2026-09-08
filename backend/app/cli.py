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
from typing import Annotated, NoReturn

import typer
from sqlalchemy import text
from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.benutzer.dienst import (
    finde_nach_email,
    lege_benutzer_an,
    liste_benutzer,
    setze_aktiv,
)
from app.benutzer.fehler import (
    BenutzerFehler,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
)
from app.benutzer.regeln import (
    REGIERUNGSPRAESIDIEN,
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
_engine = create_async_engine(str(get_settings().database_url), poolclass=NullPool)
session_factory = async_sessionmaker(_engine)

app = typer.Typer(help="Verwaltung der Anwendung Protokoll E-Befischung.", no_args_is_help=True)
benutzer_app = typer.Typer(help="Konten anlegen und verwalten.", no_args_is_help=True)
app.add_typer(benutzer_app, name="benutzer")

def _abbrechen(*lines: str) -> NoReturn:
    """Print the refusal on stderr and stop with a non-zero exit code.

    stderr rather than stdout so that a script piping the output of a listing
    command does not silently swallow the reason it produced nothing. Non-zero
    so a deploy script that ignores output still notices.
    """
    for line in lines:
        typer.echo(line, err=True)
    raise typer.Exit(code=1)


def _ausfuehren[T](work: Callable[[AsyncSession], Awaitable[T]]) -> T:
    """Run a command's whole database work and turn its failures into messages.

    The commands are ordinary synchronous functions and the service layer is
    async, so this is the one place the two meet.

    Call this once per command, with everything the command needs to do inside,
    including anything it asks the user between two queries. asyncio.run() closes
    its event loop at the end and a database connection belongs to the loop that
    opened it, so a second call is only safe because the engine above pools
    nothing. A test with a pooling factory holds the rule.
    """

    async def with_session() -> T:
        async with session_factory() as session:
            return await work(session)

    try:
        return asyncio.run(with_session())
    except (OperationalError, InterfaceError, OSError) as fehler:
        # Could not talk to the database at all. The failure whoever sets this
        # up hits first, and the one a raw stack trace explains worst. It is
        # almost never a broken application; it is almost always a database that
        # is not running yet.
        _abbrechen(
            "Die Datenbank ist nicht erreichbar, deshalb wurde nichts geändert.",
            "",
            "Der Stack läuft vermutlich nicht. Im Projektverzeichnis startet ihn:",
            "    docker compose up -d",
            "Danach denselben Befehl noch einmal ausführen.",
            "",
            f"Technische Meldung: {type(fehler).__name__}",
        )
    except SQLAlchemyError as fehler:
        # Reached the database, and it refused. Every rule a person can break is
        # caught further up and explained in words, so anything arriving here is
        # a rule the application failed to check first. Telling the reader to
        # start a database that is plainly running would send them somewhere
        # there is nothing to find, which is what this branch exists to prevent.
        _abbrechen(
            "Die Datenbank hat den Vorgang abgelehnt, deshalb wurde nichts gespeichert.",
            "",
            "Das ist kein Bedienfehler. Die Anwendung hätte diesen Fall vorher prüfen",
            "müssen und hat es nicht getan, das heißt es ist ein Fehler im Programm.",
            "Bitte die folgende Zeile zusammen mit dem ausgeführten Befehl melden:",
            "",
            f"    {type(fehler).__name__}: {fehler}",
        )


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


def _regierungspraesidien_hinweis() -> str:
    return ", ".join(f"{nr} {ort}" for nr, ort in REGIERUNGSPRAESIDIEN.items())


def _absage_beim_anlegen(fehler: BenutzerFehler) -> tuple[str, ...]:
    """What to say when an account cannot be created, one case at a time.

    Separate from the command because it is wording rather than behaviour, and
    because eight of these inline made the command too long to read in one go.

    Every case here has to name the thing, say why in ordinary words, and end
    somewhere the reader can act. A test checks that last part across all of
    them, which is how the short password case was caught ending without one.
    """
    match fehler:
        case EmailUngueltig():
            return (
                f"„{fehler.email}“ ist keine E-Mail-Adresse, deshalb wurde kein Konto angelegt.",
                "",
                "Die Adresse dient zugleich als Anmeldename und muss vollständig sein,",
                "zum Beispiel: --email anna.bergmann@ffs.bwl.de",
            )
        case EmailBereitsVergeben():
            return (
                f"Für {fehler.email} gibt es bereits ein Konto.",
                "",
                "Eine Adresse kann nur zu einem Konto gehören. Möglichkeiten:",
                "  - vorhandene Konten ansehen:   befischung benutzer liste",
                "  - ein gesperrtes Konto wieder freischalten:",
                f"        befischung benutzer aktivieren --email {fehler.email}",
                "  - oder eine andere Adresse verwenden.",
            )
        case RollenLeer():
            return (
                "Es wurde keine Rolle angegeben, deshalb wurde kein Konto angelegt.",
                "",
                "Ein Konto ohne Rolle könnte sich anmelden und sonst nichts tun.",
                "Mindestens eine Rolle angeben, zum Beispiel: --rolle SUPER_ADMIN",
                _rollen_hinweis(),
            )
        case RegierungspraesidiumFehlt():
            return (
                "Für ein Konto der Rolle REGIERUNGSPRAESIDIUM fehlt die Angabe,"
                " welches gemeint ist.",
                "",
                "Ohne diese Angabe würde das Konto alle Regionen sehen, statt nur seiner eigenen.",
                "Bitte ergänzen, zum Beispiel: --regierungspraesidium 4",
                "    " + _regierungspraesidien_hinweis(),
            )
        case RegierungspraesidiumUnzulaessig():
            return (
                f"--regierungspraesidium {fehler.regierungspraesidium} wurde angegeben, aber das"
                " Konto hat nicht die Rolle REGIERUNGSPRAESIDIUM.",
                "",
                "Bei allen anderen Rollen hat die Nummer keine Wirkung und wäre nur ein falscher",
                "Wert in der Datenbank. Entweder die Angabe weglassen, oder, wenn es wirklich ein",
                "regionales Konto sein soll, --rolle REGIERUNGSPRAESIDIUM ergänzen.",
            )
        case RegierungspraesidiumAusserhalbBereich():
            return (
                f"{fehler.regierungspraesidium} ist kein Regierungspräsidium.",
                "",
                "In Baden-Württemberg gibt es vier:",
                "    " + _regierungspraesidien_hinweis(),
            )
        case PasswortZuKurz():
            return (
                "Das Passwort ist zu kurz, deshalb wurde kein Konto angelegt."
                f" Es braucht mindestens {fehler.mindestlaenge} Zeichen.",
                "",
                "Es gibt keine Vorgabe zu Ziffern oder Sonderzeichen. Mehrere Wörter",
                "hintereinander sind leichter zu merken und zugleich sicherer als ein",
                "kurzes kompliziertes Passwort.",
                "",
                "Bitte den Befehl noch einmal ausführen und ein längeres Passwort wählen.",
            )
        case PasswortZuLang():
            return (
                f"Das Passwort ist zu lang. Erlaubt sind bis zu {fehler.hoechstlaenge} Zeichen.",
                "",
                "Vermutlich ist versehentlich etwas anderes in die Eingabe geraten.",
                "Bitte den Befehl noch einmal ausführen.",
            )
        case _:
            # Every BenutzerFehler this command can raise is handled above. A new
            # one arriving here should say so plainly rather than be swallowed.
            return (
                "Das Konto konnte nicht angelegt werden.",
                "",
                "Für diesen Fall gibt es noch keine erklärende Meldung, das heißt es ist ein",
                "Fehler im Programm. Bitte die folgende Zeile zusammen mit dem ausgeführten",
                "Befehl melden:",
                "",
                f"    {type(fehler).__name__}: {fehler}",
            )


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

        async def work(session: AsyncSession) -> str:
            # Touch the database before asking for anything that has to be
            # typed, so an unreachable database is reported now rather than
            # after two blind password entries.
            await session.execute(text("SELECT 1"))
            passwort = _passwort_erfragen()
            angelegt = await lege_benutzer_an(
                session,
                email=email,
                passwort=passwort,
                rollen=rollen,
                regierungspraesidium=regierungspraesidium,
                locale=locale,
            )
            return angelegt.email

        angelegte_email = _ausfuehren(work)
    except BenutzerFehler as fehler:
        _abbrechen(*_absage_beim_anlegen(fehler))

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
    wording = "aktiviert" if aktiv else "deaktiviert"

    async def work(session: AsyncSession) -> tuple[str, bool]:
        vorher = await finde_nach_email(session, email)
        if vorher is None:
            raise BenutzerNichtGefunden(normalisiere_email(email))
        if vorher.ist_aktiv == aktiv:
            return vorher.email, False
        geaendert = await setze_aktiv(session, email, aktiv)
        return geaendert.email, True

    try:
        betroffene_email, geaendert = _ausfuehren(work)
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
        typer.echo(f"Konto {betroffene_email} wurde {wording}.")
    else:
        typer.echo(f"Konto {betroffene_email} war bereits {wording}. Nichts geändert.")


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
    rows = [
        (
            konto.email,
            ", ".join(rolle.value for rolle in konto.rollen),
            "aktiv" if konto.ist_aktiv else "gesperrt",
            _regierungspraesidium_text(konto.regierungspraesidium),
        )
        for konto in konten
    ]
    kopf = ("E-Mail", "Rollen", "Status", "Regierungspräsidium")
    widths = [max(len(row[column]) for row in [kopf, *rows]) for column in range(4)]

    for row in [kopf, *rows]:
        columns = zip(row, widths, strict=True)
        typer.echo("  ".join(wert.ljust(width) for wert, width in columns).rstrip())

    typer.echo("")
    typer.echo(f"{len(konten)} Konto" if len(konten) == 1 else f"{len(konten)} Konten")


if __name__ == "__main__":
    app()
