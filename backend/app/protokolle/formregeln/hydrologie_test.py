"""The Hydrologie block against the Gewässertyp.

No TypeScript twin to port from. In the browser this is an adjustment that runs
as the water type changes, so a wrong combination never reaches the screen; here
it is a rule, because a document need not have come from the form.
"""

from typing import Any

import pytest

from app.formular.optionen import optionen
from app.protokolle.formregeln.hydrologie import (
    BEI_STILLGEWAESSER,
    HAKEN_FELDER,
    MARKIERTE_FELDER,
    NICHT_ZUTREFFEND,
    NICHT_ZUTREFFEND_BEI_FLIESSGEWAESSER,
    STEHENDE_GEWAESSERTYPEN,
    pruefe_hydrologie,
)

FLIESSEND = ["11", "12", "13", "14", "28"]
STEHEND = ["21", "26", "29"]


def protokoll(typ: str, **hydrologie: str) -> dict[str, Any]:
    return {"probestrecke": {"gewaessertyp": typ}, "hydrologie": hydrologie}


def markiert(typ: str) -> dict[str, Any]:
    """A standing water with the whole block marked as not applying."""
    return protokoll(typ, **{feld: NICHT_ZUTREFFEND for feld in MARKIERTE_FELDER})


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_hydrologie(antworten)]


class TestGegenDasSeed:
    def test_die_acht_gewaessertypen_sind_die_des_formulars(self) -> None:
        assert optionen().werte("gewaessertyp") == frozenset(FLIESSEND + STEHEND)

    def test_die_stehenden_typen_gibt_es_wirklich(self) -> None:
        # Defect 9: the legacy form's own script tests for 31 and 32, which the
        # field never exports. Pinned so a regenerated seed cannot quietly move
        # this rule onto codes that do not exist.
        assert STEHENDE_GEWAESSERTYPEN <= optionen().werte("gewaessertyp")


class TestOhneGewaessertyp:
    def test_sagt_nichts_solange_kein_typ_gewaehlt_ist(self) -> None:
        assert pruefe_hydrologie({}) == []
        assert pruefe_hydrologie({"hydrologie": {"stroemung": "3"}}) == []
        assert pruefe_hydrologie(protokoll("", stroemung="3")) == []


class TestFliessgewaesser:
    @pytest.mark.parametrize("typ", FLIESSEND)
    def test_nimmt_echte_hydrologie(self, typ: str) -> None:
        assert pruefe_hydrologie(protokoll(typ, breite="3", stroemung="2")) == []

    @pytest.mark.parametrize("typ", FLIESSEND)
    def test_nimmt_einen_unausgefuellten_block(self, typ: str) -> None:
        # Whether the block has to be filled in is vollstaendigkeit.py's
        # question, not this rule's.
        assert pruefe_hydrologie(protokoll(typ)) == []

    def test_weist_die_markierung_auf_einem_fliessgewaesser_zurueck(self) -> None:
        # Nothing offers 0 as a choice, so a group holding one would read as
        # unanswered while the document claimed the section does not apply.
        verstoesse = pruefe_hydrologie(protokoll("13", stroemung=NICHT_ZUTREFFEND))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("hydrologie.stroemung", NICHT_ZUTREFFEND_BEI_FLIESSGEWAESSER)
        ]

    def test_meldet_jedes_markierte_feld(self) -> None:
        alle_markiert = protokoll("14", **{feld: NICHT_ZUTREFFEND for feld in MARKIERTE_FELDER})
        assert schluessel(alle_markiert) == [NICHT_ZUTREFFEND_BEI_FLIESSGEWAESSER] * len(
            MARKIERTE_FELDER
        )

    def test_sagt_nichts_zu_den_haken_auf_einem_fliessgewaesser(self) -> None:
        assert pruefe_hydrologie(protokoll("13", mit_gumpen="ja", furkationen="ja")) == []


class TestStillgewaesser:
    @pytest.mark.parametrize("typ", STEHEND)
    def test_nimmt_einen_durchgaengig_markierten_block(self, typ: str) -> None:
        assert pruefe_hydrologie(markiert(typ)) == []

    @pytest.mark.parametrize("typ", STEHEND)
    def test_nimmt_einen_leeren_block(self, typ: str) -> None:
        # A blank field is not "an answer that should not be here". Whether the
        # marking is required is vollstaendigkeit.py's question.
        assert pruefe_hydrologie(protokoll(typ)) == []

    def test_weist_eine_echte_antwort_auf_einem_see_zurueck(self) -> None:
        verstoesse = pruefe_hydrologie(protokoll("21", fliessgeschwindigkeit="4"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("hydrologie.fliessgeschwindigkeit", BEI_STILLGEWAESSER)
        ]

    def test_meldet_jedes_beantwortete_feld(self) -> None:
        ein_fluss_auf_einem_teich = protokoll("26", **{feld: "2" for feld in MARKIERTE_FELDER})
        assert schluessel(ein_fluss_auf_einem_teich) == [BEI_STILLGEWAESSER] * len(
            MARKIERTE_FELDER
        )

    def test_weist_einen_gesetzten_haken_auf_einem_stillgewaesser_zurueck(self) -> None:
        # There is no 0 for a checkbox, so not ticked is the whole of what one
        # can say on a standing water.
        angehakt = markiert("29")
        angehakt["hydrologie"]["rueckstroemung"] = "ja"
        assert schluessel(angehakt) == [BEI_STILLGEWAESSER]

    def test_meldet_jeden_gesetzten_haken(self) -> None:
        angehakt = markiert("21")
        for feld in HAKEN_FELDER:
            angehakt["hydrologie"][feld] = "ja"
        assert schluessel(angehakt) == [BEI_STILLGEWAESSER] * len(HAKEN_FELDER)

    def test_ein_abgeschnittenes_altwasser_verliert_den_block(self) -> None:
        # Defect 9 again, from the intended side: 29 is standing and 28 is not.
        assert schluessel(protokoll("29", stroemung="2")) == [BEI_STILLGEWAESSER]
        assert pruefe_hydrologie(protokoll("28", stroemung="2")) == []
