"""Ported case for case from frontend/src/protokoll/regeln/koordinaten.test.ts."""

from typing import Any

import pytest

from app.protokolle.formregeln.koordinaten import (
    HOCHWERT_AUSSERHALB,
    HOCHWERT_MAX,
    HOCHWERT_MIN,
    KEINE_GANZE_ZAHL,
    RECHTSWERT_AUSSERHALB,
    RECHTSWERT_MAX,
    RECHTSWERT_MIN,
    pruefe_koordinaten,
)

# A real stretch, well inside the state.
GUELTIG = {
    "utm_rw_unten": "512000",
    "utm_hw_unten": "5385000",
    "utm_rw_oben": "512400",
    "utm_hw_oben": "5385300",
}


def mit_koordinaten(**abweichungen: str) -> dict[str, Any]:
    return {"probestrecke": {**GUELTIG, **abweichungen}}


def pfade(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.pfad for verstoss in pruefe_koordinaten(antworten)]


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_koordinaten(antworten)]


class TestWasDurchgeht:
    def test_nimmt_eine_strecke_in_baden_wuerttemberg(self) -> None:
        assert pruefe_koordinaten(mit_koordinaten()) == []

    def test_sagt_nichts_zu_koordinaten_die_niemand_getippt_hat(self) -> None:
        assert pruefe_koordinaten({}) == []
        assert pruefe_koordinaten({"probestrecke": {}}) == []
        assert pruefe_koordinaten(mit_koordinaten(utm_rw_unten="")) == []
        assert pruefe_koordinaten(mit_koordinaten(utm_rw_unten="  ")) == []

    def test_nimmt_einen_wert_genau_auf_der_grenze(self) -> None:
        auf_den_grenzen = {
            "probestrecke": {
                "utm_rw_unten": str(RECHTSWERT_MIN),
                "utm_rw_oben": str(RECHTSWERT_MAX),
                "utm_hw_unten": str(HOCHWERT_MIN),
                "utm_hw_oben": str(HOCHWERT_MAX),
            }
        }
        assert pruefe_koordinaten(auf_den_grenzen) == []


class TestAusserhalb:
    def test_weist_einen_wert_unter_dem_minimum_zurueck(self) -> None:
        zu_weit_westlich = str(RECHTSWERT_MIN - 1)
        assert schluessel(mit_koordinaten(utm_rw_unten=zu_weit_westlich)) == [
            RECHTSWERT_AUSSERHALB
        ]

    def test_weist_einen_wert_ueber_dem_maximum_zurueck(self) -> None:
        zu_weit_noerdlich = str(HOCHWERT_MAX + 1)
        assert schluessel(mit_koordinaten(utm_hw_oben=zu_weit_noerdlich)) == [HOCHWERT_AUSSERHALB]

    def test_faengt_vertauschten_rechtswert_und_hochwert(self) -> None:
        # The mistake the check exists for: a Hochwert typed into the Rechtswert
        # box is an order of magnitude too large and lands far outside the state.
        vertauscht = mit_koordinaten(
            utm_rw_unten=GUELTIG["utm_hw_unten"],
            utm_hw_unten=GUELTIG["utm_rw_unten"],
        )
        assert pfade(vertauscht) == ["probestrecke.utm_rw_unten", "probestrecke.utm_hw_unten"]

    def test_faengt_eine_verlorene_ziffer(self) -> None:
        assert pfade(mit_koordinaten(utm_rw_oben="51240")) == ["probestrecke.utm_rw_oben"]

    @pytest.mark.parametrize("wert", ["9", "3512000"])
    def test_faengt_grad_und_gauss_krueger_werte(self, wert: str) -> None:
        assert len(pfade(mit_koordinaten(utm_rw_unten=wert))) == 1

    def test_behandelt_ein_minus_als_ausserhalb_nicht_als_unlesbar(self) -> None:
        # A negative is a whole number, so telling somebody to type a whole
        # number would be no help. It is a coordinate in the wrong place.
        assert schluessel(mit_koordinaten(utm_rw_unten="-512000")) == [RECHTSWERT_AUSSERHALB]

    def test_prueft_alle_vier_boxen(self) -> None:
        alle_falsch = mit_koordinaten(
            utm_rw_unten="1", utm_hw_unten="1", utm_rw_oben="1", utm_hw_oben="1"
        )
        assert pfade(alle_falsch) == [
            "probestrecke.utm_rw_unten",
            "probestrecke.utm_hw_unten",
            "probestrecke.utm_rw_oben",
            "probestrecke.utm_hw_oben",
        ]


class TestKeineGanzeZahl:
    @pytest.mark.parametrize("wert", ["abc", "512000,5", "512.000", "5,12e5"])
    def test_weist_etwas_zurueck_das_keine_ganze_zahl_ist(self, wert: str) -> None:
        assert schluessel(mit_koordinaten(utm_rw_unten=wert)) == [KEINE_GANZE_ZAHL]

    def test_weist_eine_kommazahl_auch_innerhalb_der_grenzen_zurueck(self) -> None:
        assert schluessel(mit_koordinaten(utm_hw_unten="5385000.4")) == [KEINE_GANZE_ZAHL]
