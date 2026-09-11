"""Each estimate has to fall inside the band chosen above it.

The Python half of frontend/src/protokoll/regeln/schaetzwert.ts.

Defect 3 in docs/ffs-defect-list.md is why this rule was written out rather than
ported from the PDF in the first place. The legacy check reads
`value < lower AND value <= upper`, which no value above a band can ever
satisfy, so selecting "0,1 - < 0,3 m" and entering 95 passes today.

The bounds are transcribed from the two field scripts in the legacy PDF,
verified on 2026-09-02. Lower bound inclusive, upper bound exclusive, which is
what the printed labels say: "< 2" is the band below 2, and 2 itself belongs to
"< 5". The legacy code treats both ends as inclusive and so accepts 2 in two
neighbouring bands.
"""

import re
from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.hydrologie import NICHT_ZUTREFFEND
from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

AUSSERHALB_BAND = "protokoll.regeln.schaetzwertAusserhalbBand"
OHNE_BAND = "protokoll.regeln.schaetzwertOhneBand"
KEINE_ZAHL = "protokoll.regeln.schaetzwertKeineZahl"

#: The two band pickers that carry an estimate underneath them.
BANDFELDER = ("breite", "tiefe")

# Metres, keyed by the export value of the band. None as an upper bound is the
# last band, "100 or more", which has no top.
#
# Only the seven real bands. The eighth button, exporting 0, means the section
# does not apply and is never offered as an option.
BAENDER: dict[str, dict[str, tuple[float, float | None]]] = {
    "breite": {
        "1": (0, 1),
        "2": (1, 2),
        "3": (2, 5),
        "4": (5, 15),
        "5": (15, 50),
        "6": (50, 100),
        "7": (100, None),
    },
    "tiefe": {
        "1": (0, 0.1),
        "2": (0.1, 0.3),
        "3": (0.3, 0.5),
        "4": (0.5, 1),
        "5": (1, 2),
        "6": (2, 4),
        "7": (4, None),
    },
}

# A comma, because that is what the legacy form formats both estimates with and
# what a German keyboard produces. A full stop too, because an input of type
# number hands one over whatever was typed into it. Nothing else: an exponent, a
# thousands separator or a unit is not a number somebody meant.
DEZIMALZAHL = re.compile(r"^-?\d+([.,]\d+)?$")


def _zahl_aus(eingabe: str) -> float | None:
    if not DEZIMALZAHL.match(eingabe):
        return None
    return float(eingabe.replace(",", "."))


def _passt(zahl: float, band: tuple[float, float | None]) -> bool:
    von, bis = band
    if zahl < von:
        return False
    return bis is None or zahl < bis


def pruefe_schaetzwerte(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    verstoesse: list[Formverstoss] = []

    for feld in BANDFELDER:
        pfad = f"hydrologie.{feld}_schaetzwert"
        eingabe = wert_aus(antworten, pfad).strip()
        # Untouched is not wrong. An estimate only ever refines a band.
        if ist_leer(eingabe):
            continue

        gewaehlt = wert_aus(antworten, f"hydrologie.{feld}").strip()

        # On a standing water the band and the estimate are both marked as not
        # applying, so the only estimate that belongs under this band is the
        # same marking. Nothing in the interface can produce anything else,
        # since the block is off screen; this is what keeps a hand-edited
        # document from carrying a river's width on a pond.
        if gewaehlt == NICHT_ZUTREFFEND:
            if eingabe != NICHT_ZUTREFFEND:
                verstoesse.append(Formverstoss(pfad, AUSSERHALB_BAND))
            continue

        if ist_leer(gewaehlt):
            verstoesse.append(Formverstoss(pfad, OHNE_BAND))
            continue

        zahl = _zahl_aus(eingabe)
        if zahl is None:
            verstoesse.append(Formverstoss(pfad, KEINE_ZAHL))
            continue

        # A band the option list does not offer can only come from a
        # hand-edited document. There is nothing useful to say about it, and the
        # test tying these tables to the option lists is what keeps this from
        # being a real gap.
        band = BAENDER[feld].get(gewaehlt)
        if band is None:
            continue

        if not _passt(zahl, band):
            verstoesse.append(Formverstoss(pfad, AUSSERHALB_BAND))

    return verstoesse
