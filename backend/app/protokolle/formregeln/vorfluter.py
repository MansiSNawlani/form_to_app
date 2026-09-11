"""The receiving-water chain has to arrive at the Rhein or the Donau.

The Python half of frontend/src/protokoll/regeln/vorfluter.ts.

The chain is read downstream from the Probestrecke: this Gewässer flows into
that one, which flows into the next. Arriving at one of the two great rivers is
what fixes where the stretch sits in the state's drainage network. CONTEXT.md
defines the term.

Defect 8 in docs/ffs-defect-list.md is why the rule exists at all. The legacy
form checks the chain while somebody types and then checks only the first box at
submit, so a chain filled in and later cleared passes today.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

# The five boxes, named once, so the chain cannot grow a sixth link in the paths
# without growing one in the values read out of the document.
VORFLUTER_PFADE = tuple(f"probestrecke.gewaesser.vorfluter{nummer}" for nummer in range(1, 6))

ENDPUNKTE = ("rhein", "donau")

KEIN_ENDPUNKT = "protokoll.regeln.vorfluterKeinEndpunkt"
LUECKE = "protokoll.regeln.vorfluterLuecke"
NACH_ENDPUNKT = "protokoll.regeln.vorfluterNachEndpunkt"


def ist_endpunkt(name: str) -> bool:
    """Whether this name ends the chain.

    Ends with, not contains. The last part of a German compound is what the
    thing actually is, so "Oberrhein" and "Hochrhein" are the Rhein and "Alte
    Donau" is the Donau, while "Donaubach" is a Bach and ends nothing.

    Case and surrounding spaces are ignored for the comparison only. Nothing
    here rewrites the answer: defect 2 in docs/ffs-defect-list.md is the legacy
    form lowercasing every water body name, one of the three defects that put
    wrong data into FiaKa. Compare loosely, store faithfully.
    """
    normalisiert = name.strip().lower()
    return any(normalisiert.endswith(endpunkt) for endpunkt in ENDPUNKTE)


def pruefe_vorfluterkette(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    kette = [wert_aus(antworten, pfad) for pfad in VORFLUTER_PFADE]
    gefuellt = [not ist_leer(name) for name in kette]

    # An untouched chain is not a wrong chain. Whether the chain is required at
    # all is vollstaendigkeit.py's question, not this one's.
    if not any(gefuellt):
        return []

    ende_index = next(
        (index for index, name in enumerate(kette) if gefuellt[index] and ist_endpunkt(name)),
        -1,
    )
    letzter_index = max(index for index, voll in enumerate(gefuellt) if voll)

    # Where the chain stops being a chain: at its terminator if it has one, at
    # its last entry if it does not.
    ende = letzter_index if ende_index == -1 else ende_index

    verstoesse = [
        Formverstoss(VORFLUTER_PFADE[index], LUECKE)
        for index in range(ende)
        if not gefuellt[index]
    ]

    if ende_index == -1:
        verstoesse.append(Formverstoss(VORFLUTER_PFADE[ende], KEIN_ENDPUNKT))
        return verstoesse

    # Only the first entry past the end. Everything after it is the same mistake
    # said again, and four red boxes for one wrong idea is noise.
    zu_weit = next((index for index in range(ende + 1, len(kette)) if gefuellt[index]), -1)
    if zu_weit != -1:
        verstoesse.append(Formverstoss(VORFLUTER_PFADE[zu_weit], NACH_ENDPUNKT))

    return verstoesse
