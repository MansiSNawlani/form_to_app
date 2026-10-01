"""The demo reset, run the way Mansi runs it: as a command.

Separate from cli_test.py, whose fixtures are about accounts. What matters here
is the path the service tests cannot see: the command's own session factory,
which does not share the web service's settings.
"""

import asyncio
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from typer.testing import CliRunner

from app import cli
from app.anlagen.speicher import DateiSpeicher
from app.config import get_settings
from app.models.protokoll import Submission

runner = CliRunner()


@pytest.fixture(autouse=True)
def _auf_die_testdatenbank(
    monkeypatch: pytest.MonkeyPatch,
    eigene_sessions: async_sessionmaker[AsyncSession],
    tmp_path: Path,
) -> None:
    # The test factory has to behave like the command's own, or this test would
    # pass or fail for reasons that have nothing to do with the command.
    assert cli.session_factory.kw["expire_on_commit"] is False
    eigene_sessions.configure(expire_on_commit=False)
    monkeypatch.setattr(cli, "session_factory", eigene_sessions)
    monkeypatch.setattr(cli, "get_speicher", lambda: DateiSpeicher(tmp_path))


def _anzahl_protokolle(factory: async_sessionmaker[AsyncSession]) -> int:
    async def zaehlen() -> int:
        async with factory() as session:
            return int(await session.scalar(select(func.count()).select_from(Submission)) or 0)

    return asyncio.run(zaehlen())


def test_ohne_demo_modus_verweigert_der_befehl(
    monkeypatch: pytest.MonkeyPatch, eigene_sessions: async_sessionmaker[AsyncSession]
) -> None:
    monkeypatch.setattr(get_settings(), "demo_modus", False)

    ergebnis = runner.invoke(cli.app, ["demo", "zuruecksetzen"])

    assert ergebnis.exit_code == 1
    assert "DEMO_MODUS ist nicht eingeschaltet" in ergebnis.output
    assert _anzahl_protokolle(eigene_sessions) == 0


def test_zweimal_ausgefuehrt_bleiben_es_vier(
    monkeypatch: pytest.MonkeyPatch, eigene_sessions: async_sessionmaker[AsyncSession]
) -> None:
    monkeypatch.setattr(get_settings(), "demo_modus", True)

    erstes = runner.invoke(cli.app, ["demo", "zuruecksetzen"])
    zweites = runner.invoke(cli.app, ["demo", "zuruecksetzen"])

    assert erstes.exit_code == 0, erstes.output
    assert zweites.exit_code == 0, zweites.output
    assert "Entfernte Protokolle: 4" in zweites.output
    assert _anzahl_protokolle(eigene_sessions) == 4
