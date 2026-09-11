"""A monitoring occasion demands a Monitoringstrecken-Nr.

The Python half of frontend/src/protokoll/regeln/monitoring.ts.

Only a monitoring programme assigns a Monitoringstrecken-Nr., so only a
monitoring Anlass may demand one. These are two of the six export values in the
extracted Anlass list. project-overview.md states the rule as "values containing
wrrl or ffh make monitoringstrecke_nr required", and since none of the other four
values contain either word, matching them exactly is the same rule without the
looseness.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

MONITORING_ANLAESSE = frozenset({"wrrl", "ffh"})

MONITORINGNUMMER_PFAD = "probestrecke.monitoringnummer"
PFLICHT = "protokoll.regeln.monitoringnummerPflicht"


def ist_monitoring_anlass(anlass: str) -> bool:
    """Whether this Anlass makes the Monitoringstrecken-Nr. mandatory."""
    return anlass in MONITORING_ANLAESSE


def pruefe_monitoringnummer(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    if not ist_monitoring_anlass(wert_aus(antworten, "anlass")):
        return []
    if not ist_leer(wert_aus(antworten, MONITORINGNUMMER_PFAD)):
        return []

    return [Formverstoss(MONITORINGNUMMER_PFAD, PFLICHT)]
