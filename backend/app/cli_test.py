"""The command line, driven the way a person drives it.

Two things here are not like the other test modules, and both come from the same
cause: the command line runs its own event loop.

The tests are ordinary synchronous functions, not async ones. The command calls
asyncio.run(), which raises if a loop is already running, so an async test could
not invoke it at all.

They run the command in process through Typer's own runner rather than as a
subprocess. The runner feeds the hidden password prompt, which a pipe cannot do
on Windows: click reads the console directly there, so a piped password is
ignored and the command waits for a keypress that never comes.

Database effects are checked through the same standalone factory the command is
pointed at, and the table is emptied after each test.
"""

import asyncio
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from typer.testing import CliRunner, Result

from app import cli
from app.benutzer.dienst import finde_nach_email
from app.models.benutzer import Locale, Rolle, User
from app.security.passwoerter import pruefe_passwort

PASSWORT = "ein gutes langes passwort"

runner = CliRunner()


@pytest.fixture(autouse=True)
def _kommandozeile_auf_die_testdatenbank(
    monkeypatch: pytest.MonkeyPatch,
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    """The command opens its own session, so the test swaps what it opens."""
    monkeypatch.setattr(cli, "session_factory", eigenstaendige_sitzungen)


def _abfragen[T](
    fabrik: async_sessionmaker[AsyncSession], frage: Callable[[AsyncSession], Awaitable[T]]
) -> T:
    """Ask the database something from a synchronous test."""

    async def lauf() -> T:
        async with fabrik() as sitzung:
            return await frage(sitzung)

    return asyncio.run(lauf())


def _anzahl_konten(fabrik: async_sessionmaker[AsyncSession]) -> int:
    async def zaehlen(sitzung: AsyncSession) -> int:
        anzahl = await sitzung.scalar(select(func.count()).select_from(User))
        return int(anzahl or 0)

    return _abfragen(fabrik, zaehlen)


def _konto(fabrik: async_sessionmaker[AsyncSession], email: str) -> User | None:
    return _abfragen(fabrik, lambda sitzung: finde_nach_email(sitzung, email))


def _anlegen(
    *argumente: str, passwort: str = PASSWORT, wiederholung: str | None = None
) -> Result:
    eingaben = f"{passwort}\n{passwort if wiederholung is None else wiederholung}\n"
    return runner.invoke(cli.app, ["benutzer", "anlegen", *argumente], input=eingaben)


def test_konto_wird_angelegt(eigenstaendige_sitzungen: async_sessionmaker[AsyncSession]) -> None:
    ergebnis = runner.invoke(
        cli.app,
        ["benutzer", "anlegen", "--email", "anna@ffs.de", "--rolle", "SUPER_ADMIN"],
        input=f"{PASSWORT}\n{PASSWORT}\n",
    )

    assert ergebnis.exit_code == 0, ergebnis.output
    assert "anna@ffs.de" in ergebnis.output

    angelegt = _konto(eigenstaendige_sitzungen, "anna@ffs.de")
    assert angelegt is not None
    assert angelegt.rollen == [Rolle.SUPER_ADMIN]
    assert angelegt.ist_aktiv is True
    assert angelegt.locale == Locale.DE


def test_passwort_wird_gehasht_gespeichert(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    _anlegen("--email", "anna@ffs.de", "--rolle", "SUPER_ADMIN")

    angelegt = _konto(eigenstaendige_sitzungen, "anna@ffs.de")
    assert angelegt is not None
    assert angelegt.password_hash.startswith("$argon2id$")
    assert pruefe_passwort(PASSWORT, angelegt.password_hash) is True


def test_passwort_steht_in_keiner_ausgabe() -> None:
    """Not in the confirmation, not in an error, not anywhere.

    Terminal output is scrolled back through, copied into tickets and captured
    by CI logs, so anything printed here should be assumed to be kept.
    """
    ergebnis = _anlegen("--email", "anna@ffs.de", "--rolle", "SUPER_ADMIN")
    assert PASSWORT not in ergebnis.output


def test_mehrere_rollen_werden_uebernommen(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    _anlegen("--email", "anna@ffs.de", "--rolle", "REVIEWER", "--rolle", "DATA_STEWARD")

    angelegt = _konto(eigenstaendige_sitzungen, "anna@ffs.de")
    assert angelegt is not None
    assert angelegt.rollen == [Rolle.REVIEWER, Rolle.DATA_STEWARD]


def test_email_wird_normalisiert_gespeichert(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen("--email", "  Anna.Bergmann@FFS.de ", "--rolle", "SUBMITTER")

    assert ergebnis.exit_code == 0
    assert _konto(eigenstaendige_sitzungen, "anna.bergmann@ffs.de") is not None


def test_ungleiche_passwoerter_legen_nichts_an(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen(
        "--email", "anna@ffs.de", "--rolle", "SUBMITTER", wiederholung="etwas anderes langes"
    )

    assert ergebnis.exit_code == 1
    assert "nicht gleich" in ergebnis.output
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_doppelte_email_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    _anlegen("--email", "anna@ffs.de", "--rolle", "SUBMITTER")
    ergebnis = _anlegen("--email", "ANNA@ffs.de", "--rolle", "REVIEWER")

    assert ergebnis.exit_code == 1
    ausgabe = ergebnis.output
    assert "bereits ein Konto" in ausgabe
    # Named, so the reader knows which address, and pointed somewhere useful.
    assert "anna@ffs.de" in ausgabe
    assert "benutzer liste" in ausgabe
    assert _anzahl_konten(eigenstaendige_sitzungen) == 1


def test_ungueltige_email_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen("--email", "anna", "--rolle", "SUBMITTER")

    assert ergebnis.exit_code == 1
    assert "keine E-Mail-Adresse" in ergebnis.output
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_kurzes_passwort_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen("--email", "anna@ffs.de", "--rolle", "SUBMITTER", passwort="kurz")

    assert ergebnis.exit_code == 1
    ausgabe = ergebnis.output
    assert "zu kurz" in ausgabe
    assert "12" in ausgabe
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_unbekannte_rolle_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    """Refused before the database is touched, and the valid roles are listed."""
    ergebnis = _anlegen("--email", "anna@ffs.de", "--rolle", "ADMIN")

    assert ergebnis.exit_code != 0
    assert "SUPER_ADMIN" in ergebnis.output
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_regionales_konto_ohne_nummer_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen("--email", "rp@ffs.de", "--rolle", "REGIERUNGSPRAESIDIUM")

    assert ergebnis.exit_code == 1
    ausgabe = ergebnis.output
    assert "--regierungspraesidium" in ausgabe
    # The four are named, because a bare number means nothing to whoever is
    # setting this up for the first time.
    assert "Tübingen" in ausgabe
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_regionales_konto_mit_nummer_wird_angelegt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen(
        "--email", "rp@ffs.de", "--rolle", "REGIERUNGSPRAESIDIUM", "--regierungspraesidium", "4"
    )

    assert ergebnis.exit_code == 0
    assert "Tübingen" in ergebnis.output

    angelegt = _konto(eigenstaendige_sitzungen, "rp@ffs.de")
    assert angelegt is not None
    assert angelegt.regierungspraesidium == 4


def test_submitter_mit_nummer_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen(
        "--email", "anna@ffs.de", "--rolle", "SUBMITTER", "--regierungspraesidium", "2"
    )

    assert ergebnis.exit_code == 1
    assert "REGIERUNGSPRAESIDIUM" in ergebnis.output
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_nummer_ausserhalb_des_bereichs_wird_abgelehnt(
    eigenstaendige_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    ergebnis = _anlegen(
        "--email", "rp@ffs.de", "--rolle", "REGIERUNGSPRAESIDIUM", "--regierungspraesidium", "7"
    )

    assert ergebnis.exit_code == 1
    assert "kein Regierungspräsidium" in ergebnis.output
    assert _anzahl_konten(eigenstaendige_sitzungen) == 0


def test_jede_absage_sagt_was_zu_tun_ist() -> None:
    """The standard this project set on 2026-09-06, checked in one place.

    A message that names the problem and stops leaves the reader stuck. Each of
    these has to end somewhere they can act: a command to run, an option to add,
    or an instruction to try again.
    """
    faelle: list[tuple[list[str], dict[str, str]]] = [
        (["--email", "anna", "--rolle", "SUBMITTER"], {}),
        (["--email", "anna@ffs.de", "--rolle", "SUBMITTER"], {"passwort": "kurz"}),
        (["--email", "anna@ffs.de", "--rolle", "REGIERUNGSPRAESIDIUM"], {}),
        (["--email", "anna@ffs.de", "--rolle", "SUBMITTER", "--regierungspraesidium", "2"], {}),
        (["--email", "anna@ffs.de", "--rolle", "SUBMITTER"], {"wiederholung": "etwas anderes"}),
    ]
    wege_hinaus = ("befischung", "--rolle", "--regierungspraesidium", "noch einmal", "--email")

    for argumente, optionen in faelle:
        ergebnis = _anlegen(*argumente, **optionen)
        assert ergebnis.exit_code == 1, argumente
        ausgabe = ergebnis.output
        assert any(weg in ausgabe for weg in wege_hinaus), ausgabe


def test_ein_aufruf_nutzt_genau_eine_ereignisschleife(
    monkeypatch: pytest.MonkeyPatch,
    gepoolte_sitzungen: async_sessionmaker[AsyncSession],
) -> None:
    """The regression test for the defect found on 2026-09-07.

    The command had grown a second asyncio.run(), for a reachability check
    before the password prompt. Each asyncio.run() closes its loop at the end,
    and a pooled connection belongs to the loop that opened it, so the second
    one was handed a connection that was already gone. It failed with "Event
    loop is closed" and no useful message.

    This uses a pooling factory rather than the NullPool one the rest of this
    module uses, because a factory that pools nothing cannot reproduce it. That
    difference between fixture and production is precisely what hid the defect
    from the suite until the command was run by hand.
    """
    monkeypatch.setattr(cli, "session_factory", gepoolte_sitzungen)

    ergebnis = _anlegen("--email", "anna@ffs.de", "--rolle", "SUPER_ADMIN")

    assert ergebnis.exit_code == 0, ergebnis.output
    assert "Event loop" not in ergebnis.output
