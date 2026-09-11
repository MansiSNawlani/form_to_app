"""Part 5: three pair checks ported from the legacy form, and one sign check.

The Python half of frontend/src/protokoll/regeln/ausruestung.ts.

## The three pair checks

All the same shape: two numbers, at least one of which has to say something.
The legacy form writes them as sums:

    (ringanoden + streifenanoden) < 1
    (ges_gew_laenge + ufer_laenge) == 0
    (ges_gew_breite + ufer_breite) == 0

Copied literally those fire on a brand new draft, where both boxes are empty.
So each check is split in two and neither half is dropped:

    both boxes blank    nobody has answered yet. Silent here; vollstaendigkeit.py
                        is what refuses the submission.
    both boxes zero     an answer, and a wrong one. Zero ring anodes and zero
                        strip anodes is a claim that the survey was carried out
                        with no anode, which cannot be true of an electrofishing
                        survey. Reported.
    one blank, one set  fine. The legacy form is satisfied by either.

The pairs run across the rows, not down them: the two lengths are checked
against each other and the two widths against each other, never a row against
itself. That is the legacy form's own pairing, kept deliberately. Whether a
fished area needs both numbers is question 5 in docs/ffs-questions.md.

The message goes under the pair rather than on a box, because neither box is the
wrong one and only the surveyor knows which number they meant.

## The sign check

None of part 5's nine quantities can be negative. The legacy form permits all of
them: no keystroke handler, no format check and no range check anywhere in part
5, so a fished length of -50 reaches FiaKa today.

Added on 2026-09-04 by decision. A deliberate narrowing rather than a port, and
the one narrowing here that needs nothing from FFS: no survey reports a negative
count of anodes. Only the sign is judged. A ceiling would need FFS to say what a
plausible voltage or ring anode diameter is.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.protokolle.formregeln.regel import (
    ANODEN_PAAR,
    BREITE_PAAR,
    LAENGE_PAAR,
    Formverstoss,
    als_zahl,
    ist_leer,
    wert_aus,
)

ANODEN_KEINE = "protokoll.regeln.anodenKeine"
BEFISCHTE_LAENGE_NULL = "protokoll.regeln.befischteLaengeNull"
BEFISCHTE_BREITE_NULL = "protokoll.regeln.befischteBreiteNull"
ZAHL_NEGATIV = "protokoll.regeln.zahlNegativ"

ANODEN_FELDER = ("ausruestung.ringanoden", "ausruestung.streifenanoden")
LAENGE_FELDER = ("befischte_bereiche.ges_gew_laenge", "befischte_bereiche.ufer_laenge")
BREITE_FELDER = ("befischte_bereiche.ges_gew_breite", "befischte_bereiche.ufer_breite")


@dataclass(frozen=True)
class Paar:
    pfad: str
    schluessel: str
    felder: tuple[str, str]


PAARE = (
    Paar(ANODEN_PAAR, ANODEN_KEINE, ANODEN_FELDER),
    Paar(LAENGE_PAAR, BEFISCHTE_LAENGE_NULL, LAENGE_FELDER),
    Paar(BREITE_PAAR, BEFISCHTE_BREITE_NULL, BREITE_FELDER),
)

# Every answer in part 5 that is a quantity rather than a word or a tick. All
# nine measure something that has no negative: a voltage, a power output, a
# count of anodes, a diameter, a length, a width.
ZAHLENFELDER = (
    "ausruestung.spannung",
    "ausruestung.leistung",
    "ausruestung.ringanoden",
    "ausruestung.ringanoden_durchmesser",
    "ausruestung.streifenanoden",
    *LAENGE_FELDER,
    *BREITE_FELDER,
)


def ist_leeres_paar(werte: Sequence[str]) -> bool:
    """Whether a pair of answers is a claim of nothing rather than an unfilled pair."""
    # At least one answered, and none of the answered ones above zero.
    if all(ist_leer(wert) for wert in werte):
        return False
    return all(ist_leer(wert) or als_zahl(wert) == 0 for wert in werte)


def pruefe_ausruestung(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    negative = [
        Formverstoss(pfad, ZAHL_NEGATIV)
        for pfad in ZAHLENFELDER
        if (zahl := als_zahl(wert_aus(antworten, pfad))) is not None and zahl < 0
    ]

    leere_paare = [
        Formverstoss(paar.pfad, paar.schluessel)
        for paar in PAARE
        if ist_leeres_paar([wert_aus(antworten, pfad) for pfad in paar.felder])
    ]

    return negative + leere_paare
