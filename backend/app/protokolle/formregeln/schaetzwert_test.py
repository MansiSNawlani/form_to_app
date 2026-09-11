"""Ported case for case from frontend/src/protokoll/regeln/schaetzwert.test.ts."""

from typing import Any

import pytest

from app.formular.optionen import optionen
from app.protokolle.formregeln.schaetzwert import (
    AUSSERHALB_BAND,
    BAENDER,
    KEINE_ZAHL,
    OHNE_BAND,
    pruefe_schaetzwerte,
)


def breite(band: str = "", schaetzwert: str = "") -> dict[str, Any]:
    return {"hydrologie": {"breite": band, "breite_schaetzwert": schaetzwert}}


def tiefe(band: str = "", schaetzwert: str = "") -> dict[str, Any]:
    return {"hydrologie": {"tiefe": band, "tiefe_schaetzwert": schaetzwert}}


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_schaetzwerte(antworten)]


class TestDieBaenderUndDieOptionslisten:
    # The bands are transcribed from the two field scripts in the legacy PDF and
    # the option lists are extracted from the same PDF. If the two ever
    # disagree, one band is unreachable and one option can never be checked, so
    # this is a failing test rather than a silent gap. The browser half guards
    # the same join, and so does the extraction script from the other side.
    @pytest.mark.parametrize("feld", ["breite", "tiefe"])
    def test_stimmen_ueberein(self, feld: str) -> None:
        assert set(BAENDER[feld]) == optionen().werte(f"hydrologie.{feld}")


class TestWasNichtGeprueftWird:
    def test_sagt_nichts_zu_einem_unberuehrten_block(self) -> None:
        assert pruefe_schaetzwerte({}) == []
        assert pruefe_schaetzwerte(breite()) == []
        assert pruefe_schaetzwerte(breite("3")) == []

    def test_sagt_nichts_zu_einem_geleerten_schaetzwert(self) -> None:
        assert pruefe_schaetzwerte(breite("3", "")) == []
        assert pruefe_schaetzwerte(breite("3", "   ")) == []


class TestOhneBand:
    def test_will_das_band_vor_dem_schaetzwert(self) -> None:
        assert schluessel(breite("", "4")) == [OHNE_BAND]
        assert schluessel(tiefe("", "0,4")) == [OHNE_BAND]


class TestWelchesFeldGemeldetWird:
    def test_meldet_den_schaetzwert_nicht_das_band(self) -> None:
        verstoesse = pruefe_schaetzwerte(breite("2", "95"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("hydrologie.breite_schaetzwert", AUSSERHALB_BAND)
        ]

    def test_prueft_beide_schaetzwerte_unabhaengig(self) -> None:
        beide = {
            "hydrologie": {
                "breite": "2",
                "breite_schaetzwert": "95",
                "tiefe": "2",
                "tiefe_schaetzwert": "0,2",
            }
        }
        assert schluessel(beide) == [AUSSERHALB_BAND]


class TestDieZahlLesen:
    @pytest.mark.parametrize("eingabe", ["1,5", "1.5"])
    def test_nimmt_komma_und_punkt(self, eingabe: str) -> None:
        assert pruefe_schaetzwerte(breite("2", eingabe)) == []

    @pytest.mark.parametrize("eingabe", ["ungefähr 2", "1,5,5", "2 m", "1e3", "1 000"])
    def test_sagt_das_ist_keine_zahl(self, eingabe: str) -> None:
        # Rejected rather than guessed at. float("2 m") raises and an empty
        # field read as a number would be a real zero.
        assert schluessel(breite("2", eingabe)) == [KEINE_ZAHL]

    def test_behandelt_ein_minus_als_ausserhalb_des_bandes(self) -> None:
        assert schluessel(breite("2", "-1")) == [AUSSERHALB_BAND]


class TestDieGrenzenJedesBandes:
    # Every boundary of every band, from both sides. Lower inclusive, upper
    # exclusive, which is what the printed labels say.
    @pytest.mark.parametrize(
        ("band", "wert", "gueltig"),
        [
            ("1", "0", True),
            ("1", "0,9", True),
            ("1", "1", False),
            ("2", "1", True),
            ("2", "1,9", True),
            ("2", "0,9", False),
            ("2", "2", False),
            ("3", "2", True),
            ("3", "4,9", True),
            ("3", "5", False),
            ("4", "14,9", True),
            ("4", "15", False),
            ("5", "15", True),
            ("5", "49,9", True),
            ("5", "50", False),
            ("6", "99,9", True),
            ("6", "100", False),
            ("7", "100", True),
            ("7", "2500", True),
            ("7", "99,9", False),
        ],
    )
    def test_die_breite_in_metern(self, band: str, wert: str, gueltig: bool) -> None:
        assert schluessel(breite(band, wert)) == ([] if gueltig else [AUSSERHALB_BAND])

    @pytest.mark.parametrize(
        ("band", "wert", "gueltig"),
        [
            ("1", "0", True),
            ("1", "0,09", True),
            ("1", "0,1", False),
            ("2", "0,1", True),
            ("2", "0,29", True),
            ("2", "0,3", False),
            ("3", "0,49", True),
            ("3", "0,5", False),
            ("4", "0,5", True),
            ("4", "1", False),
            ("5", "1,9", True),
            ("5", "2", False),
            ("6", "3,9", True),
            ("6", "4", False),
            ("7", "4", True),
            ("7", "300", True),
            ("7", "3,9", False),
        ],
    )
    def test_die_tiefe_in_metern(self, band: str, wert: str, gueltig: bool) -> None:
        assert schluessel(tiefe(band, wert)) == ([] if gueltig else [AUSSERHALB_BAND])


class TestAmStillgewaesser:
    def test_nimmt_die_markierung_unter_der_markierung(self) -> None:
        # Both the band and the estimate say the section does not apply.
        assert pruefe_schaetzwerte(breite("0", "0")) == []

    def test_weist_eine_echte_breite_unter_der_markierung_zurueck(self) -> None:
        assert schluessel(breite("0", "3,5")) == [AUSSERHALB_BAND]
