"""Ported case for case from frontend/src/protokoll/regeln/einfluesse.test.ts."""

from typing import Any

import pytest

from app.formular.felder import formular
from app.protokolle.formregeln.einfluesse import (
    BEIDE_BLANKETT,
    KEINE_EINFLUESSE,
    KEINE_UND_NUTZUNG,
    NUTZUNGEN,
    UNBEKANNT_EINFLUESSE,
    UNBEKANNT_UND_NUTZUNG,
    pruefe_einfluesse,
)

# A checkbox holds "Ja" when ticked and the empty string when not.
JA = "Ja"


def einfluesse(**haken: str) -> dict[str, Any]:
    return {"einfluesse": haken}


def feld(pfad: str) -> str:
    return pfad[len("einfluesse.") :]


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_einfluesse(antworten)]


class TestGegenDasSeed:
    def test_jede_nutzung_gibt_es_im_formular(self) -> None:
        pfade = formular().pfade
        for pfad in (*NUTZUNGEN, KEINE_EINFLUESSE, UNBEKANNT_EINFLUESSE):
            assert pfad in pfade, pfad

    def test_dreizehn_genannte_nutzungen(self) -> None:
        assert len(NUTZUNGEN) == 13


class TestOhneBlankettantwort:
    def test_sagt_nichts_zu_einem_unberuehrten_block(self) -> None:
        assert pruefe_einfluesse({}) == []
        assert pruefe_einfluesse(einfluesse()) == []

    def test_sagt_nichts_zu_genannten_nutzungen_allein(self) -> None:
        assert pruefe_einfluesse(einfluesse(wasserkraft=JA, schifffahrt=JA)) == []

    def test_sagt_nichts_zu_allen_dreizehn_nutzungen(self) -> None:
        alle = einfluesse(**{feld(pfad): JA for pfad in NUTZUNGEN})
        assert pruefe_einfluesse(alle) == []


class TestEineBlankettantwortAllein:
    def test_nimmt_keine_erkennbar_allein(self) -> None:
        assert pruefe_einfluesse(einfluesse(keine_einfluesse=JA)) == []

    def test_nimmt_unbekannt_allein(self) -> None:
        assert pruefe_einfluesse(einfluesse(unbekannt_einfluesse=JA)) == []


class TestBeideBlankettantworten:
    def test_meldet_beide_zugleich(self) -> None:
        # "There are none" and "we do not know" are different claims.
        verstoesse = pruefe_einfluesse(
            einfluesse(keine_einfluesse=JA, unbekannt_einfluesse=JA)
        )
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("widerspruch.einfluesse", BEIDE_BLANKETT)
        ]

    def test_meldet_nur_das_statt_auch_des_widerspruchs_mit_einer_nutzung(self) -> None:
        # Two messages in one line for one confused block would not tell the
        # reader what to do first.
        verwirrt = einfluesse(keine_einfluesse=JA, unbekannt_einfluesse=JA, wasserkraft=JA)
        assert schluessel(verwirrt) == [BEIDE_BLANKETT]


class TestBlankettantwortNebenEinerNutzung:
    @pytest.mark.parametrize("nutzung", [feld(pfad) for pfad in NUTZUNGEN])
    def test_keine_erkennbar_neben_jeder_nutzung(self, nutzung: str) -> None:
        antworten = einfluesse(**{"keine_einfluesse": JA, nutzung: JA})
        assert schluessel(antworten) == [KEINE_UND_NUTZUNG]

    def test_unbekannt_neben_einer_nutzung(self) -> None:
        verstoesse = pruefe_einfluesse(einfluesse(unbekannt_einfluesse=JA, badebetrieb=JA))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("widerspruch.einfluesse", UNBEKANNT_UND_NUTZUNG)
        ]

    def test_meldet_einmal_wie_viele_nutzungen_auch_angehakt_sind(self) -> None:
        viele = einfluesse(keine_einfluesse=JA, wasserkraft=JA, schifffahrt=JA, badebetrieb=JA)
        assert schluessel(viele) == [KEINE_UND_NUTZUNG]

    def test_ein_leerer_haken_zaehlt_nicht_als_angehakt(self) -> None:
        assert pruefe_einfluesse(einfluesse(keine_einfluesse=JA, wasserkraft="")) == []
