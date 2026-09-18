"""The connection URL translation.

No database and no network: this is string handling, and it runs everywhere.
"""

from app.db import fuer_asyncpg

NEON = "postgresql+asyncpg://nutzer:geheim@ep-kuehl-1.eu-central-1.aws.neon.tech/befischung"


class TestFuerAsyncpg:
    """Every managed Postgres hands out ?sslmode=require, which is the libpq
    spelling. asyncpg calls it ssl and refuses the other name."""

    def test_benennt_sslmode_in_ssl_um(self) -> None:
        assert fuer_asyncpg(f"{NEON}?sslmode=require") == f"{NEON}?ssl=require"

    def test_laesst_den_wert_unveraendert(self) -> None:
        """The values are the same on both sides, so only the name may change."""
        for wert in ("require", "verify-full", "prefer", "disable"):
            assert fuer_asyncpg(f"{NEON}?sslmode={wert}") == f"{NEON}?ssl={wert}"

    def test_laesst_eine_url_ohne_den_parameter_in_ruhe(self) -> None:
        ohne = "postgresql+asyncpg://befischung:lokal@localhost:5432/befischung"

        assert fuer_asyncpg(ohne) == ohne

    def test_laesst_ein_ausdruecklich_gesetztes_ssl_in_ruhe(self) -> None:
        assert fuer_asyncpg(f"{NEON}?ssl=require") == f"{NEON}?ssl=require"

    def test_behaelt_die_uebrigen_parameter(self) -> None:
        uebersetzt = fuer_asyncpg(f"{NEON}?sslmode=require&application_name=befischung")

        assert "ssl=require" in uebersetzt
        assert "application_name=befischung" in uebersetzt
        assert "sslmode" not in uebersetzt

    def test_wirft_channel_binding_weg(self) -> None:
        """asyncpg has nothing to pass it to and refuses the keyword. It
        negotiates SCRAM channel binding itself over the TLS connection that ssl
        already asks for, so dropping it enforces nothing less."""
        uebersetzt = fuer_asyncpg(f"{NEON}?channel_binding=require")

        assert "channel_binding" not in uebersetzt

    def test_die_zeichenkette_die_neon_wirklich_ausgibt(self) -> None:
        """Both parameters at once, in the order Neon's console prints them.
        This is the string that was pasted in on 2026-09-18 and that asyncpg
        refused twice, once for each parameter."""
        uebersetzt = fuer_asyncpg(f"{NEON}?sslmode=require&channel_binding=require")

        assert uebersetzt == f"{NEON}?ssl=require"
