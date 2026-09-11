"""What a finished protocol has to contain.

The one module in this package with no TypeScript twin, because until now
nothing in either half of the app has asked this question.

Every other rule here answers "is this answer wrong?" None answers "is this
answer there?", and regel.ist_leer says why in one line: blank is untouched, and
untouched is never wrong on its own. That is right for a document somebody is
still filling in over several sittings, and useless the moment they press
Absenden.

Requiredness in the browser is a red asterisk and nothing else. The pflicht prop
appears 32 times across six block components, covers parts 1, 2 and 5, and is
enforced nowhere. This module is the enforcing half, and 11c is where the panel
listing what is still missing starts reading this answer instead of the
asterisks, so that the two stop being separate truths.

Written as a rule rather than a table of flags because requiredness here depends
on other answers. The Monitoringstrecken-Nr. is needed only for a monitoring
occasion, and the hydrology block only on flowing water. A flat list of paths
could express neither.

## What parts 3, 4 and 6 require

Nothing marks them in the browser, so this was decided rather than read off, on
2026-09-11:

- **Parts 3 and 4 require nothing.** The legacy form demands neither, and
  requiring them would be new policy FFS never asked for, which would block
  somebody filing a protocol the paper form would have accepted. The existing
  rules still catch a half-finished percentage run: start one and it has to
  total 100. Worth putting to FFS rather than settling here.
- **Part 6 requires one named species.** A protocol that names no species and no
  "kein Nachweis" code is not a survey result: it reports neither a catch nor the
  absence of one. project-overview.md half-states this already, and
  artenliste.pruefe_fang_ohne_nachweis_code assumes somebody named something.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.artenliste import benannte_arten
from app.protokolle.formregeln.hydrologie import MARKIERTE_FELDER
from app.protokolle.formregeln.regel import ARTEN_TABELLE, Formverstoss, ist_leer, wert_aus

# One key for every missing field. The path already says which field it is, and
# the browser puts the message beside it, so a key per field would be 40 ways of
# writing the same sentence.
FEHLT = "protokoll.regeln.fehlt"

# The table needs its own, because "this field is needed" makes no sense printed
# under a grid of 338 cells. What is missing there is an answer, not a value.
FEHLT_ART = "protokoll.regeln.fehltArt"

# Part 1. The occasion, who surveyed, and where.
#
# The Monitoringstrecken-Nr. is deliberately absent even though it carries an
# asterisk: monitoring.py already demands it for a WRRL or FFH occasion, and
# listing it here too would put two messages on one empty box.
TEIL_1 = (
    "anlass",
    "z.rp",
    "datum",
    "messdaten.uhrzeit",
    "bearbeiter.name",
    "bearbeiter.email",
    "probestrecke.gewaesser.gewaessername",
    "probestrecke.gewaessertyp",
    "probestrecke.laenge",
    "probestrecke.ortsangabe",
    "probestrecke.gewaesser.vorfluter1",
    "probestrecke.untere",
    "probestrecke.utm_rw_unten",
    "probestrecke.utm_hw_unten",
    "probestrecke.obere",
    "probestrecke.utm_rw_oben",
    "probestrecke.utm_hw_oben",
)

# Part 2's measurements, which are taken on any water.
TEIL_2_MESSDATEN = (
    "messdaten.temperatur",
    "messdaten.leitfaehigkeit",
    "messdaten.regenfaelle",
    "messdaten.truebung",
    "messdaten.schaumbildung",
)

# Part 2's nine hydrology pickers, required on every water including a standing
# one. On a pond the only answer they may hold is the marking that says the
# section does not apply, which hydrologie.py enforces and the browser writes by
# itself; requiring them here is what makes that marking actually have to be
# there. The two estimates underneath the width and depth bands are not
# required: an estimate only ever refines a band.
#
# Read off hydrologie.py rather than listed again, minus the two estimates, so a
# band added to the block cannot be required in one file and forgotten in the
# other.
TEIL_2_HYDROLOGIE = tuple(
    f"hydrologie.{feld}" for feld in MARKIERTE_FELDER if not feld.endswith("_schaetzwert")
)

# Part 5. The device, what it was run at, and how it was built.
TEIL_5 = (
    "ausruestung.egeraet",
    "ausruestung.leistung",
    "ausruestung.bauweise",
)

PFLICHTFELDER = (*TEIL_1, *TEIL_2_MESSDATEN, *TEIL_2_HYDROLOGIE, *TEIL_5)


def pruefe_vollstaendigkeit(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Every answer a finished protocol needs and does not have.

    In form order, so the panel in 11c can list what is missing in the order
    somebody walks the protocol.
    """
    fehlend = [
        Formverstoss(pfad, FEHLT) for pfad in PFLICHTFELDER if ist_leer(wert_aus(antworten, pfad))
    ]

    if not benannte_arten(antworten):
        fehlend.append(Formverstoss(ARTEN_TABELLE, FEHLT_ART))

    return fehlend
