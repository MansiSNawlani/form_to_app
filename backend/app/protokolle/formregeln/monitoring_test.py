"""Ported case for case from frontend/src/protokoll/regeln/monitoring.test.ts."""

from typing import Any

import pytest

from app.formular.optionen import optionen
from app.protokolle.formregeln.monitoring import (
    MONITORING_ANLAESSE,
    PFLICHT,
    pruefe_monitoringnummer,
)

# The six Anlass values are the export values extracted from the legacy PDF.
# Only wrrl and ffh are monitoring programmes, and only a monitoring programme
# assigns a Monitoringstrecken-Nr.
OHNE_PFLICHT = ["best", "bergung", "maps", "sonst"]
MIT_PFLICHT = ["wrrl", "ffh"]


def antworten(anlass: str = "", monitoringnummer: str = "") -> dict[str, Any]:
    return {"anlass": anlass, "probestrecke": {"monitoringnummer": monitoringnummer}}


class TestOhnePflicht:
    @pytest.mark.parametrize("anlass", OHNE_PFLICHT)
    def test_nimmt_eine_fehlende_nummer(self, anlass: str) -> None:
        assert pruefe_monitoringnummer(antworten(anlass)) == []

    @pytest.mark.parametrize("anlass", OHNE_PFLICHT)
    def test_nimmt_eine_gegebene_nummer(self, anlass: str) -> None:
        assert pruefe_monitoringnummer(antworten(anlass, "1001000001")) == []

    def test_sagt_nichts_solange_kein_anlass_gewaehlt_ist(self) -> None:
        assert pruefe_monitoringnummer({}) == []


class TestMitPflicht:
    @pytest.mark.parametrize("anlass", MIT_PFLICHT)
    def test_verlangt_eine_nummer(self, anlass: str) -> None:
        verstoesse = pruefe_monitoringnummer(antworten(anlass))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("probestrecke.monitoringnummer", PFLICHT)
        ]

    @pytest.mark.parametrize("anlass", MIT_PFLICHT)
    def test_ist_mit_einer_nummer_zufrieden(self, anlass: str) -> None:
        assert pruefe_monitoringnummer(antworten(anlass, "1001000001")) == []

    def test_behandelt_eine_geleerte_nummer_als_fehlend(self) -> None:
        assert len(pruefe_monitoringnummer(antworten("wrrl", "   "))) == 1


class TestGegenDasSeed:
    def test_die_sechs_anlaesse_sind_die_des_formulars(self) -> None:
        # Pinned against the seed, so a regenerated option list that renames or
        # drops an occasion is caught here rather than by a rule that silently
        # stops firing.
        assert optionen().werte("anlass") == frozenset(OHNE_PFLICHT + MIT_PFLICHT)

    def test_die_monitoring_anlaesse_gibt_es_wirklich(self) -> None:
        assert MONITORING_ANLAESSE <= optionen().werte("anlass")
