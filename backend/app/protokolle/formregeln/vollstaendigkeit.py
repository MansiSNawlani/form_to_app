"""What a finished protocol has to contain.

The one module in this package with no TypeScript twin, because until now
nothing in either half of the app has asked this question.

Every other rule here answers "is this answer wrong?" None answers "is this
answer there?", and regel.ist_leer says why in one line: blank is untouched, and
untouched is never wrong on its own. That is right for a document somebody is
still filling in over several sittings, and useless the moment they press
Absenden.

**Where the list lives.** Not here. It is read from pflichtfelder.json in the
seed directory, through app/formular/pflicht.py, and the browser reads the same
file to decide which fields carry an asterisk. Until feature 11c it lived twice,
as a tuple here and as 32 props scattered through the form's components, and the
two had already drifted: a field marked required on screen that nothing checked
looks exactly like one that works. On 2026-09-12 the required set was widened to
cover all six parts, and that was the moment to stop keeping two copies of it.

**What stays here** is everything a list cannot say. Requiredness on this form
depends on other answers often enough that a flat set was never going to be the
whole story: the Monitoringstrecken-Nr. is needed only for a monitoring
occasion, the dam's slope only where there is a dam, the ring anodes' diameter
only if ring anodes were used, and a "sonstige ..., welche?" box only when its
own tick is set. Those are rules, and they live beside the other rules.

Part 6 requires one named species. A protocol that names no species and no "kein
Nachweis" code is not a survey result: it reports neither a catch nor the absence
of one. project-overview.md half-states this already, and
artenliste.pruefe_fang_ohne_nachweis_code assumes somebody named something.
"""

from collections.abc import Mapping
from typing import Any

from app.formular.pflicht import pflichtfelder
from app.protokolle.formregeln.artenliste import benannte_arten
from app.protokolle.formregeln.regel import ARTEN_TABELLE, Formverstoss, ist_leer, wert_aus

# One key for every missing field. The path already says which field it is, and
# the browser puts the message beside it, so a key per field would be 40 ways of
# writing the same sentence.
FEHLT = "protokoll.regeln.fehlt"

# The table needs its own, because "this field is needed" makes no sense printed
# under a grid of 338 cells. What is missing there is an answer, not a value.
FEHLT_ART = "protokoll.regeln.fehltArt"



def pruefe_vollstaendigkeit(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Every answer a finished protocol needs and does not have.

    In form order, so the panel in 11c can list what is missing in the order
    somebody walks the protocol.
    """
    fehlend = [
        Formverstoss(pfad, FEHLT)
        for pfad in pflichtfelder().pfade
        if ist_leer(wert_aus(antworten, pfad))
    ]

    if not benannte_arten(antworten):
        fehlend.append(Formverstoss(ARTEN_TABELLE, FEHLT_ART))

    return fehlend
