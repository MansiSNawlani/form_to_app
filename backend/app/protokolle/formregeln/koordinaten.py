"""The four boundary coordinates have to land in Baden-Württemberg.

The Python half of frontend/src/protokoll/regeln/koordinaten.ts.

Metres in EPSG:25832 (ETRS89 / UTM zone 32N), which is what the legacy form and
coding-standards.md both use.

The bounds are a rectangle around the state, not its border: Baden-Württemberg
spans roughly 7.5 to 10.5 degrees east and 47.5 to 49.8 north, which in zone 32N
is about 388000 to 613000 east and 5266000 to 5516000 north, rounded outward. A
point just over the line in Bavaria, Hesse, Switzerland or Alsace therefore
passes.

That is deliberate. The check exists to catch the mistakes that actually happen,
and all of them land far outside the box: a swapped Rechtswert and Hochwert, a
dropped digit, a Gauss-Krüger value off an older map, or degrees typed instead
of metres. Testing against the real border needs the official water body dataset
and belongs to feature 18.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

KEINE_GANZE_ZAHL = "protokoll.regeln.koordinateKeineGanzeZahl"
RECHTSWERT_AUSSERHALB = "protokoll.regeln.koordinateRechtswertAusserhalb"
HOCHWERT_AUSSERHALB = "protokoll.regeln.koordinateHochwertAusserhalb"

# Still to be confirmed with FFS, so they live in one place on each side. The
# browser interpolates these same numbers into the two messages that name a
# range, so changing a bound is one edit per half.
RECHTSWERT_MIN = 380_000
RECHTSWERT_MAX = 620_000
HOCHWERT_MIN = 5_255_000
HOCHWERT_MAX = 5_525_000

# Metres, so no decimal point and no thousands separator. The browser control is
# an input of type number, which still lets "512000.5" and "5,12e5" reach the
# document, and nothing at all stops a direct API call.
#
# A minus sign passes this test and fails the bounds test instead, which is the
# more useful complaint: a negative metre value is not a number somebody typed
# wrongly, it is a coordinate in the wrong place.
GANZE_ZAHL = re.compile(r"^-?\d+$")


@dataclass(frozen=True)
class Koordinatenfeld:
    feld: str
    min_wert: int
    max_wert: int
    ausserhalb: str


FELDER = (
    Koordinatenfeld("utm_rw_unten", RECHTSWERT_MIN, RECHTSWERT_MAX, RECHTSWERT_AUSSERHALB),
    Koordinatenfeld("utm_hw_unten", HOCHWERT_MIN, HOCHWERT_MAX, HOCHWERT_AUSSERHALB),
    Koordinatenfeld("utm_rw_oben", RECHTSWERT_MIN, RECHTSWERT_MAX, RECHTSWERT_AUSSERHALB),
    Koordinatenfeld("utm_hw_oben", HOCHWERT_MIN, HOCHWERT_MAX, HOCHWERT_AUSSERHALB),
)


def pruefe_koordinaten(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    verstoesse: list[Formverstoss] = []

    for feld in FELDER:
        pfad = f"probestrecke.{feld.feld}"
        wert = wert_aus(antworten, pfad)
        # Untouched is not wrong. Whether a coordinate is required at all is
        # vollstaendigkeit.py's question.
        if ist_leer(wert):
            continue

        eingabe = wert.strip()
        if not GANZE_ZAHL.match(eingabe):
            verstoesse.append(Formverstoss(pfad, KEINE_GANZE_ZAHL))
            continue

        if not feld.min_wert <= int(eingabe) <= feld.max_wert:
            verstoesse.append(Formverstoss(pfad, feld.ausserhalb))

    return verstoesse
