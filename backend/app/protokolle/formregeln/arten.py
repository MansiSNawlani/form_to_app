"""The catch table: what it adds up to, and what a cell may hold.

The Python half of frontend/src/protokoll/regeln/arten.ts. The counts live here;
the rules about which species a row may name are in artenliste.py, split off
because one module for both would be the largest file in the package by a wide
margin.

The legacy form works both totals out for itself, with AFSimple_Calculate("SUM")
over the ten size classes for a row and over the twenty-six row sums for the
table, and marks the results read-only. So they are derived here too and never
stored: a total in the document would be a second, disagreeing answer to a
question the cells already answer.

Why 0+ is not in either total

The printed form heads that column "davon", which is "of which". Young-of-year
individuals are already counted in the size classes beside them, so adding the
column would count them twice. The legacy form's own gesamtsumme sums only the
row sums and never the 0+ fields, which is the same decision made the same way.

Why an unreadable cell makes the total undefined

A blank cell is nothing and counts as zero, which is what an unfilled table
means. A cell holding a word is different: the total is then unknowable, and
saying so is the only honest answer. Reporting the sum of the readable cells
would put a confident wrong number under a column.
"""

from collections.abc import Mapping, Sequence
from typing import Any

from app.protokolle.formregeln.regel import Formverstoss, als_zahl, ist_leer, wert_aus

ANZAHL_KEINE_GANZE_ZAHL = "protokoll.regeln.anzahlKeineGanzeZahl"
NULL_PLUS_UEBER_SUMME = "protokoll.regeln.nullPlusUeberSumme"

#: Twenty-six rows, which is what the printed form has room for.
MAX_ARTEN = 26
ARTNUMMERN = tuple(range(1, MAX_ARTEN + 1))

#: The ten size class columns, ascending: klasse_1 is up to 5 cm.
KLASSENFELDER = tuple(f"klasse_{nummer}" for nummer in range(1, 11))

#: The young-of-year column. A quoted key because the legacy path begins with a
#: digit, and the legacy path wins over the tidier name.
NULL_PLUS_FELD = "0plus"

# The eleven fields in a row that hold a count. Not the same list as
# KLASSENFELDER, and the difference is load-bearing: a row total is the ten
# classes alone, because the 0+ individuals are already counted beside them.
# What all eleven have in common is only that each must be a whole number of
# animals.
ZAEHLFELDER = (*KLASSENFELDER, NULL_PLUS_FELD)


def art_pfad(nr: int, feld: str) -> str:
    """One answer's legacy path, such as arten.art7.klasse_3."""
    return f"arten.art{nr}.{feld}"


def klassen_pfade(nr: int) -> list[str]:
    """A row's ten size class paths, ascending."""
    return [art_pfad(nr, feld) for feld in KLASSENFELDER]


def zaehl_pfade(nr: int) -> list[str]:
    """One row's eleven count paths."""
    return [art_pfad(nr, feld) for feld in ZAEHLFELDER]


def summe_aus_werten(werte: Sequence[str]) -> int | None:
    """Counts added up, or None when one of them cannot be read.

    Whole fish only

    A count is a number of individuals, so 2.5 is not a smaller answer than 3,
    it is not an answer. Rejecting it also settles what "1.200" means, which is
    the one place a shared number parser could quietly lose 999 fish: als_zahl
    reads the dot as a decimal point, so "1.200" comes back as 1.2, and treating
    that as a total would be exactly the confident wrong number this module
    refuses to print.

    Part 5's quantities go through the same als_zahl and are deliberately left
    alone: a fished length of 1.2 m is a real measurement. Only counts are whole.
    """
    summe = 0

    for wert in werte:
        if ist_leer(wert):
            continue

        zahl = als_zahl(wert)
        if zahl is None or not zahl.is_integer():
            return None
        summe += int(zahl)

    return summe


def _ist_unmoegliche_anzahl(wert: str) -> bool:
    """Whether a cell holds something that is not a count of animals.

    Blank is not, because untouched is never wrong on its own. Everything else
    has to be a whole number of zero or more: minus four fish were not caught.

    None of these can be typed, since the browser cells are number inputs with a
    floor and a step, so they arrive by paste, by hand-editing, or by an API call
    that never met the form. The legacy form has no keystroke handler, no format
    check and no range check anywhere in part 6, so a negative count reaches
    FiaKa today. Rejecting it is ours rather than a port, on the same footing as
    part 5's sign check.
    """
    if ist_leer(wert):
        return False

    zahl = als_zahl(wert)
    return zahl is None or not zahl.is_integer() or zahl < 0


def unmoegliche_zellen(antworten: Mapping[str, Any], nr: int) -> list[str]:
    """The cells in one row holding something that is not a count."""
    return [pfad for pfad in zaehl_pfade(nr) if _ist_unmoegliche_anzahl(wert_aus(antworten, pfad))]


def _zeile_ueberzaehlt(antworten: Mapping[str, Any], nr: int) -> bool:
    null_plus = wert_aus(antworten, art_pfad(nr, NULL_PLUS_FELD))
    if ist_leer(null_plus):
        return False

    # Quiet about a row it cannot judge. If any of the eleven cells fails the
    # rule above, the total is not a number anybody should be reasoning from,
    # and the cell that broke it has already said so; a second message about a
    # consequence would only bury the cause.
    if unmoegliche_zellen(antworten, nr):
        return False

    summe = summe_aus_werten([wert_aus(antworten, pfad) for pfad in klassen_pfade(nr)])
    if summe is None:
        return False

    # The cell is not blank and passed the check above, so it is a whole
    # number. Written as a comparison rather than an assert because assert is
    # stripped under python -O, and this one is load-bearing.
    gezaehlt = als_zahl(null_plus)
    return gezaehlt is not None and gezaehlt > summe


def pruefe_anzahlen(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Every cell in the table that does not hold a count of animals."""
    return [
        Formverstoss(pfad, ANZAHL_KEINE_GANZE_ZAHL)
        for nr in ARTNUMMERN
        for pfad in unmoegliche_zellen(antworten, nr)
    ]


def pruefe_null_plus(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """A row's 0+ count cannot be larger than the row itself.

    The printed form heads that column "davon", which is "of which": the
    young-of-year individuals are already counted in the ten size classes beside
    them. So a row claiming seven 0+ out of a total of two is claiming five fish
    that are in no size class at all. The legacy form calculates the row total
    and never compares the two.

    Ten blank classes with 3 in 0+ does report, and that is deliberate: a row
    total of nothing cannot contain three fish.
    """
    return [
        Formverstoss(art_pfad(nr, NULL_PLUS_FELD), NULL_PLUS_UEBER_SUMME)
        for nr in ARTNUMMERN
        if _zeile_ueberzaehlt(antworten, nr)
    ]
