"""The Nutzungsbedingte Einflüsse cannot say two things at once.

The Python half of frontend/src/protokoll/regeln/einfluesse.ts.

"keine (erkennbar)" and "unbekannt" are both blanket answers: each says there is
nothing in the list below to tick. So neither can stand beside a named use, and
they cannot stand beside each other, because "there are none" and "we do not
know" are different claims.

The legacy form allows all of it and checks nothing anywhere in part 4. This
rule is ours, added by decision on 2026-09-04. It is not in
docs/ffs-defect-list.md, because permitting a contradiction is a gap in what the
form asks for rather than something that corrupted a record already entered.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.regel import (
    EINFLUSS_WIDERSPRUCH,
    Formverstoss,
    ist_leer,
    wert_aus,
)

BEIDE_BLANKETT = "protokoll.regeln.einfluesseBeideBlankett"
KEINE_UND_NUTZUNG = "protokoll.regeln.einfluesseKeineUndNutzung"
UNBEKANNT_UND_NUTZUNG = "protokoll.regeln.einfluesseUnbekanntUndNutzung"

KEINE_EINFLUESSE = "einfluesse.keine_einfluesse"
UNBEKANNT_EINFLUESSE = "einfluesse.unbekannt_einfluesse"

# The thirteen named uses, which are the rest of the run. The browser derives
# this list by subtracting the two blanket answers from the rendered block; here
# it is written out, and the test pins every entry against felder.json so a use
# added to the form cannot go missing from the rule.
NUTZUNGEN = (
    "einfluesse.wasserkraft",
    "einfluesse.stauhaltung",
    "einfluesse.schwallbetrieb",
    "einfluesse.schifffahrt",
    "einfluesse.bewaesserung",
    "einfluesse.entwaesserung",
    "einfluesse.hochwasserrueckhaltung",
    "einfluesse.hochwasserablauf",
    "einfluesse.badebetrieb",
    "einfluesse.viehtraenke",
    "einfluesse.holzberieselung",
    "einfluesse.trinkwasserversorgung",
    "einfluesse.sonstige_Nutzung",
)


def _ist_gesetzt(antworten: Mapping[str, Any], pfad: str) -> bool:
    """A checkbox holds "Ja" when ticked and the empty string when not."""
    return not ist_leer(wert_aus(antworten, pfad))


def pruefe_einfluesse(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    keine_gesetzt = _ist_gesetzt(antworten, KEINE_EINFLUESSE)
    unbekannt_gesetzt = _ist_gesetzt(antworten, UNBEKANNT_EINFLUESSE)

    # An untouched block is not a wrong block, the same convention ist_leer
    # carries everywhere else on the protocol.
    if not keine_gesetzt and not unbekannt_gesetzt:
        return []

    # Both blanket answers at once is its own mistake and gets its own message.
    # Reported instead of the other one rather than alongside it: two messages
    # in one line for one confused block would not tell the reader what to do
    # first.
    if keine_gesetzt and unbekannt_gesetzt:
        return [Formverstoss(EINFLUSS_WIDERSPRUCH, BEIDE_BLANKETT)]

    if not any(_ist_gesetzt(antworten, pfad) for pfad in NUTZUNGEN):
        return []

    schluessel = KEINE_UND_NUTZUNG if keine_gesetzt else UNBEKANNT_UND_NUTZUNG
    return [Formverstoss(EINFLUSS_WIDERSPRUCH, schluessel)]
