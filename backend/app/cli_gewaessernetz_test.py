"""Loading the water body network, run the way an administrator runs it.

Separate from cli_test.py, whose fixtures are about accounts, for the reason
cli_demo_test.py gives. The files are the tiny AWGN-shaped ones from
app/gewaessernetz/beispiele.py.
"""

from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from typer.testing import CliRunner, Result

from app import cli
from app.gewaessernetz.beispiele import fliessgewaesser, stehende

runner = CliRunner()


@pytest.fixture(autouse=True)
def _auf_die_testdatenbank(
    monkeypatch: pytest.MonkeyPatch, eigene_sessions: async_sessionmaker[AsyncSession]
) -> None:
    eigene_sessions.configure(expire_on_commit=False)
    monkeypatch.setattr(cli, "session_factory", eigene_sessions)


@pytest.fixture
def dateien(tmp_path: Path) -> tuple[Path, Path]:
    (tmp_path / "fg").mkdir()
    (tmp_path / "sg").mkdir()
    return (
        fliessgewaesser(tmp_path / "fg", [{}, {"kennzahl": 2381333930000.0}]),
        stehende(tmp_path / "sg", [{}]),
    )


def laden(fg: Path, sg: Path, stand: str = "2025-05-01") -> Result:
    return runner.invoke(
        cli.app,
        [
            "gewaessernetz",
            "laden",
            "--stand",
            stand,
            "--fliessgewaesser",
            str(fg),
            "--stehende",
            str(sg),
        ],
    )


def test_laedt_einen_stand_und_listet_ihn(dateien: tuple[Path, Path]) -> None:
    ergebnis = laden(*dateien)

    assert ergebnis.exit_code == 0, ergebnis.output
    assert "Fließgewässer: 2" in ergebnis.output
    assert "Stehende Gewässer: 1" in ergebnis.output

    liste = runner.invoke(cli.app, ["gewaessernetz", "liste"])
    assert liste.exit_code == 0, liste.output
    assert "2025-05-01" in liste.output


def test_eine_leere_liste_sagt_wie_man_laedt() -> None:
    liste = runner.invoke(cli.app, ["gewaessernetz", "liste"])

    assert liste.exit_code == 0
    assert "befischung gewaessernetz laden" in liste.output


def test_ein_stand_wird_nicht_zweimal_geladen(dateien: tuple[Path, Path]) -> None:
    assert laden(*dateien).exit_code == 0

    ergebnis = laden(*dateien)

    assert ergebnis.exit_code == 1
    assert "bereits geladen" in ergebnis.output


def test_ein_stand_der_nicht_zu_den_dateien_passt(dateien: tuple[Path, Path]) -> None:
    ergebnis = laden(*dateien, stand="2026-05-01")

    assert ergebnis.exit_code == 1
    assert "Mai 2025" in ergebnis.output


def test_ein_anderer_tag_im_selben_monat(dateien: tuple[Path, Path]) -> None:
    ergebnis = laden(*dateien, stand="2025-05-15")

    assert ergebnis.exit_code == 1
    assert "Ersten des Monats" in ergebnis.output


def test_ein_stand_der_kein_datum_ist(dateien: tuple[Path, Path]) -> None:
    ergebnis = laden(*dateien, stand="Mai 2025")

    assert ergebnis.exit_code != 0
    assert "2025-05-01" in ergebnis.output


def test_eine_fehlende_datei(dateien: tuple[Path, Path], tmp_path: Path) -> None:
    ergebnis = laden(tmp_path / "fehlt.zip", dateien[1])

    assert ergebnis.exit_code == 1
    assert "fehlt.zip" in ergebnis.output
    assert "rips-datenlink.lubw.de" in ergebnis.output


def test_vertauschte_dateien(dateien: tuple[Path, Path]) -> None:
    fg, sg = dateien
    ergebnis = laden(sg, fg)

    assert ergebnis.exit_code == 1
    assert "vertauscht" in ergebnis.output
