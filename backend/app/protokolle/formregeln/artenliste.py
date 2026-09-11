"""Which species a catch row may name, and what "kein Nachweis" excludes.

The second half of frontend/src/protokoll/regeln/arten.ts, split from arten.py
because one module for both would be the largest file in the package by a wide
margin. The counts are there; the species are here.

Part 6's assembled check also lives here rather than in arten.py, because it has
to see both halves and this is the half that can import the other.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.arten import (
    ARTNUMMERN,
    art_pfad,
    pruefe_anzahlen,
    pruefe_null_plus,
    zaehl_pfade,
)
from app.protokolle.formregeln.regel import (
    ARTEN_TABELLE,
    Formverstoss,
    als_zahl,
    erste_je_pfad,
    ist_leer,
    wert_aus,
)

ART_DOPPELT = "protokoll.regeln.artDoppelt"
KEIN_NACHWEIS_MIT_FANG = "protokoll.regeln.keinNachweisMitFang"
KEIN_NACHWEIS_NEBEN_ART = "protokoll.regeln.keinNachweisNebenArt"
FANG_OHNE_NACHWEIS_CODE = "protokoll.regeln.fangOhneNachweisCode"

NAME_FELD = "name"

# The four species codes that record a survey finding nothing.
#
# Read straight out of the printed form's own species list, where they sit
# between Kaulbarsch and Kesslergrundel under the labels "kein Nachweis", "kein
# Nachweis, Fische", "kein Nachweis, Krebse" and "kein Nachweis, Muscheln". They
# are ordinary entries in the picker; what makes them different is only what they
# mean. Pinned against the seed in the test, because a code renamed upstream
# would otherwise disable these rules silently rather than fail.
KEIN_NACHWEIS = ("OFAN", "OFAF", "KNKR", "KNMU")

# The unqualified one. The other three each name what was not found, so "kein
# Nachweis, Krebse" beside three Hechte is coherent, while this one says nothing
# at all was found and so excludes every other species in the table.
#
# Telling the qualified three apart from a species they contradict would need to
# know which of the 123 entries is a fish, a crayfish or a mussel, and the seed
# list carries only a code and a German label. See question 10 in
# docs/ffs-questions.md.
OHNE_QUALIFIKATION = "OFAN"


def artcode(antworten: Mapping[str, Any], nr: int) -> str:
    """The export code a row names, or "" for a row that names no species.

    Returned exactly as stored. The codes come from the picker rather than from
    typing, so casing and whitespace carry no information, and normalising them
    here would hide a seed list that had drifted rather than fix one.
    """
    return wert_aus(antworten, art_pfad(nr, NAME_FELD))


def benannte_arten(antworten: Mapping[str, Any]) -> list[str]:
    """Every species actually named in the table, in row order, blanks left out."""
    return [code for nr in ARTNUMMERN if not ist_leer(code := artcode(antworten, nr))]


def pruefe_doppelte_arten(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """One species, one row.

    Two rows both naming HECH are two answers to one question, and the eventual
    FiaKa transfer would carry the species twice with different counts. The
    legacy form permits it: it has no cross-row check of any kind.

    Reported on the second row and any after it, never on the first. The row
    that was named first is not the one that went wrong, and reporting it would
    ask the surveyor to correct the answer they got right.
    """
    gesehen: set[str] = set()
    verstoesse: list[Formverstoss] = []

    for nr in ARTNUMMERN:
        code = artcode(antworten, nr)
        if ist_leer(code):
            continue
        if code in gesehen:
            verstoesse.append(Formverstoss(art_pfad(nr, NAME_FELD), ART_DOPPELT))
            continue
        gesehen.add(code)

    return verstoesse


def pruefe_kein_nachweis_mit_fang(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """A row that reports no detection cannot also count animals.

    "kein Nachweis, Fische" beside 7 in the 10-15 cm column says both that no
    fish were found and that seven were. Reported on the species cell rather
    than on the counts: the counts are the record of what was seen, and the code
    is the answer that contradicts them.

    Only a count above zero is a catch, so a word or a negative number never
    reaches this rule and is left to the one that judges counts. A fraction does
    reach it, and the row then carries two messages in two cells, which is
    right: 2,5 is both an impossible count and a catch this row says it did not
    make.
    """
    return [
        Formverstoss(art_pfad(nr, NAME_FELD), KEIN_NACHWEIS_MIT_FANG)
        for nr in ARTNUMMERN
        if artcode(antworten, nr) in KEIN_NACHWEIS
        and any(
            (zahl := als_zahl(wert_aus(antworten, pfad))) is not None and zahl > 0
            for pfad in zaehl_pfade(nr)
        )
    ]


def pruefe_kein_nachweis_neben_art(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The unqualified "kein Nachweis" excludes everything else in the table.

    OFAN says nothing at all was found, so any other species named anywhere in
    the table contradicts it outright, whichever row it sits in.
    """
    if not any(code != OHNE_QUALIFIKATION for code in benannte_arten(antworten)):
        return []

    return [
        Formverstoss(art_pfad(nr, NAME_FELD), KEIN_NACHWEIS_NEBEN_ART)
        for nr in ARTNUMMERN
        if artcode(antworten, nr) == OHNE_QUALIFIKATION
    ]


def pruefe_fang_ohne_nachweis_code(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """A survey that caught nothing has to say so with one of the four codes.

    project-overview.md states this as "an empty arten list requires one of the
    four no detection codes". It needs the most care of the six, because in a
    half-finished document "nothing caught" and "not filled in yet" look almost
    the same. Three conditions separate them and all three are needed:

        a real species is named    otherwise there is nothing to correct, and an
                                   empty table is unfinished rather than a claim
        no code is named           a table that already says "kein Nachweis" has
                                   said it
        every count is 0, and at   this is the difference between a blank cell
        least one was typed        and one holding a typed zero: both are 0
                                   arithmetically and they mean opposite things

    Silent about a table holding anything unreadable or negative. That cell has
    its own message, and a table whose totals cannot be trusted is not evidence
    that nothing was caught.

    The message goes under the table, because no single cell is the wrong one:
    the fix is to pick a "kein Nachweis" entry in place of the species named.
    """
    benannt = benannte_arten(antworten)

    if not any(code not in KEIN_NACHWEIS for code in benannt):
        return []
    if any(code in KEIN_NACHWEIS for code in benannt):
        return []

    gezaehlt = [
        wert
        for nr in ARTNUMMERN
        for pfad in zaehl_pfade(nr)
        if not ist_leer(wert := wert_aus(antworten, pfad))
    ]

    if not gezaehlt:
        return []
    if any(als_zahl(wert) != 0 for wert in gezaehlt):
        return []

    return [Formverstoss(ARTEN_TABELLE, FANG_OHNE_NACHWEIS_CODE)]


def pruefe_arten(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The whole of part 6.

    The order below is what decides which message a cell keeps, and it runs from
    the most specific complaint to the most general: what a cell holds, then what
    it contradicts, then that it has been said before.
    """
    return erste_je_pfad(
        [
            *pruefe_anzahlen(antworten),
            *pruefe_null_plus(antworten),
            *pruefe_kein_nachweis_mit_fang(antworten),
            *pruefe_kein_nachweis_neben_art(antworten),
            *pruefe_doppelte_arten(antworten),
            *pruefe_fang_ohne_nachweis_code(antworten),
        ]
    )
