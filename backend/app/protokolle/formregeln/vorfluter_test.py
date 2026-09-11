"""Ported case for case from frontend/src/protokoll/regeln/vorfluter.test.ts."""

from typing import Any

import pytest

from app.protokolle.formregeln.vorfluter import (
    KEIN_ENDPUNKT,
    LUECKE,
    NACH_ENDPUNKT,
    pruefe_vorfluterkette,
)


def kette(*namen: str) -> dict[str, Any]:
    """The chain as five boxes, so a test reads the way the form does."""
    gewaesser = {f"vorfluter{nummer}": name for nummer, name in enumerate(namen, start=1)}
    return {"probestrecke": {"gewaesser": gewaesser}}


def pfade(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.pfad for verstoss in pruefe_vorfluterkette(antworten)]


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_vorfluterkette(antworten)]


class TestEineKetteDieStimmt:
    def test_sagt_nichts_zu_einer_unberuehrten_kette(self) -> None:
        assert pruefe_vorfluterkette(kette()) == []
        assert pruefe_vorfluterkette({}) == []
        assert pruefe_vorfluterkette(kette("", "  ", "")) == []

    def test_nimmt_eine_kette_bis_zur_donau(self) -> None:
        assert pruefe_vorfluterkette(kette("Argen", "Donau")) == []

    def test_nimmt_eine_kette_die_nur_der_rhein_ist(self) -> None:
        assert pruefe_vorfluterkette(kette("Rhein")) == []

    def test_nimmt_alle_fuenf_boxen_wenn_die_letzte_endet(self) -> None:
        voll = kette("Tobelbach", "Untere Argen", "Argen", "Schussen", "Rhein")
        assert pruefe_vorfluterkette(voll) == []

    def test_ignoriert_gross_und_kleinschreibung_und_leerzeichen(self) -> None:
        # Defect 2: the legacy form lowercases every water body name, so
        # multi-word names never matched reliably. Compare loosely, store
        # exactly what was typed.
        assert pruefe_vorfluterkette(kette("Argen", "  DONAU  ")) == []
        assert pruefe_vorfluterkette(kette("argen", "rhein")) == []

    @pytest.mark.parametrize("name", ["Alte Donau", "Oberrhein", "Hochrhein"])
    def test_nimmt_einen_namen_der_auf_rhein_oder_donau_endet(self, name: str) -> None:
        # The last part of a German compound is what the thing is.
        assert pruefe_vorfluterkette(kette("Brettach", name)) == []


class TestEineKetteOhneEnde:
    @pytest.mark.parametrize(
        "name", ["Donaubach", "Donaut", "Rheinbach", "Rheinau", "Donaukanal"]
    )
    def test_laesst_diesen_namen_keine_kette_beenden(self, name: str) -> None:
        assert schluessel(kette("Argen", name)) == [KEIN_ENDPUNKT]

    def test_verlangt_ein_ende_auf_der_letzten_gefuellten_box(self) -> None:
        assert pfade(kette("Argen", "Schussen")) == ["probestrecke.gewaesser.vorfluter2"]
        assert schluessel(kette("Argen", "Schussen")) == [KEIN_ENDPUNKT]

    def test_verlangt_ein_ende_auch_bei_fuenf_boxen(self) -> None:
        assert pfade(kette("a", "b", "c", "d", "e")) == ["probestrecke.gewaesser.vorfluter5"]


class TestLuecken:
    def test_meldet_eine_luecke(self) -> None:
        assert pfade(kette("Argen", "", "Rhein")) == ["probestrecke.gewaesser.vorfluter2"]
        assert schluessel(kette("Argen", "", "Rhein")) == [LUECKE]

    def test_meldet_jede_luecke_vor_dem_ende(self) -> None:
        assert pfade(kette("Argen", "", "", "Rhein")) == [
            "probestrecke.gewaesser.vorfluter2",
            "probestrecke.gewaesser.vorfluter3",
        ]

    def test_meldet_eine_luecke_in_einer_kette_ohne_ende(self) -> None:
        assert pfade(kette("Argen", "", "Schussen")) == [
            "probestrecke.gewaesser.vorfluter2",
            "probestrecke.gewaesser.vorfluter3",
        ]
        assert schluessel(kette("Argen", "", "Schussen")) == [LUECKE, KEIN_ENDPUNKT]


class TestHinterDemEnde:
    def test_meldet_was_hinter_dem_ende_steht(self) -> None:
        zu_weit = kette("Argen", "Schussen", "Rhein", "Bodensee")
        assert pfade(zu_weit) == ["probestrecke.gewaesser.vorfluter4"]
        assert schluessel(zu_weit) == [NACH_ENDPUNKT]

    def test_meldet_die_erste_gefuellte_box_dahinter_nicht_eine_leere(self) -> None:
        assert pfade(kette("Rhein", "", "Bodensee")) == ["probestrecke.gewaesser.vorfluter3"]

    def test_meldet_nur_die_erste_box_dahinter(self) -> None:
        zu_weit = kette("Rhein", "Bodensee", "Aare", "Reuss")
        assert pfade(zu_weit) == ["probestrecke.gewaesser.vorfluter2"]
