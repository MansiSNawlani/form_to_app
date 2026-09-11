"""The Hydrologie block has to agree with the Gewässertyp.

The Python half of frontend/src/protokoll/regeln/hydrologie.ts, but pointing the
other way, and that difference is the whole module.

A standing water has no current, no line and no flow velocity, so the legacy
form takes the whole section away for one. It marks the section as not applying
rather than merely emptying it: every hydrology radio group carries an extra
button exporting 0, parked in the right margin of the printed form with no label
beside it, and the standing water handlers set all of them to that. Confirmed
with FFS on 2026-09-02.

In the browser this is an adjustment, not a rule. hydrologieAngleichen works out
which answers disagree with the chosen water type and an effect writes them, so
the block is never on screen for a standing water and the question of a wrong
answer never arises for somebody using the form.

Here it is a rule, because a document does not have to have come from the form.
The check is the same computation read as a complaint: anything the alignment
would want to change is an answer that disagrees with its own water type.

Which types are standing is defect 9 in docs/ffs-defect-list.md. In the PDF the
button exporting 28 runs `if (gewaessertyp == 31)` and the one exporting 29 runs
`if (gewaessertyp == 32)`, and the field exports neither number, so neither
branch has ever run. Keyed to the values the field actually exports, a connected
oxbow keeps the section and a cut-off oxbow loses it, which is what the printed
form intends.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

#: What a hydrology answer holds when the section does not apply.
NICHT_ZUTREFFEND = "0"

STEHENDE_GEWAESSERTYPEN = frozenset(
    {
        "21",  # See
        "26",  # Teich
        "29",  # abgeschnittenes Altwasser
    }
)

# The nine bands and the two estimates, in the order the legacy handlers set
# them, which is also the order the form prints them.
MARKIERTE_FELDER = (
    "breite",
    "breite_schaetzwert",
    "tiefe",
    "tiefe_schaetzwert",
    "tiefenvarianz",
    "linienfuehrung",
    "stroemung",
    "fliessgeschwindigkeit",
    "wasserfuehrung",
    "stillwasserbereich",
    "gesamtprofil",
)

# The four qualifiers sitting inside a band group's row. There is no 0 for a
# checkbox, so not ticked is the whole of what they can say.
HAKEN_FELDER = (
    "mit_flachstellen",
    "mit_gumpen",
    "furkationen",
    "rueckstroemung",
)

BEI_STILLGEWAESSER = "protokoll.regeln.hydrologieBeiStillgewaesser"
NICHT_ZUTREFFEND_BEI_FLIESSGEWAESSER = (
    "protokoll.regeln.hydrologieNichtZutreffendBeiFliessgewaesser"
)


def ist_stehendes_gewaesser(typ: str) -> bool:
    """Whether this Gewässertyp takes the Hydrologie block away."""
    return typ in STEHENDE_GEWAESSERTYPEN


def pruefe_hydrologie(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    typ = wert_aus(antworten, "probestrecke.gewaessertyp")
    # Nothing chosen yet says nothing about the water, so nothing here is wrong
    # yet. Whether a water type is required at all is vollstaendigkeit.py's.
    if ist_leer(typ):
        return []

    stehend = ist_stehendes_gewaesser(typ)
    verstoesse: list[Formverstoss] = []

    for feld in MARKIERTE_FELDER:
        pfad = f"hydrologie.{feld}"
        wert = wert_aus(antworten, pfad)
        markiert = wert == NICHT_ZUTREFFEND

        if stehend and not markiert and not ist_leer(wert):
            # A pond carrying a river's flow velocity. Only reachable by going
            # round the form, which is exactly what this half is here for.
            #
            # A blank one is deliberately not a violation here, which is where
            # this rule stops short of the browser's alignment: the alignment
            # writes the marking into an empty field too, so an aligned standing
            # water holds "0" eleven times. Complaining about a blank would mean
            # saying "this holds an answer it should not" about a field holding
            # nothing. Whether the marking has to be there at all is a question
            # about a finished protocol, so vollstaendigkeit.py asks it.
            verstoesse.append(Formverstoss(pfad, BEI_STILLGEWAESSER))
        elif not stehend and markiert:
            # Nothing offers 0 as a choice, so a group left holding one on a
            # flowing water would read as unanswered while the document claimed
            # the section does not apply.
            verstoesse.append(Formverstoss(pfad, NICHT_ZUTREFFEND_BEI_FLIESSGEWAESSER))

    if stehend:
        verstoesse.extend(
            Formverstoss(f"hydrologie.{feld}", BEI_STILLGEWAESSER)
            for feld in HAKEN_FELDER
            if not ist_leer(wert_aus(antworten, f"hydrologie.{feld}"))
        )

    return verstoesse
