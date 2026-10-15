"""The four boundary coordinates have to land in Baden-Württemberg.

The Python half of frontend/src/protokoll/regeln/koordinaten.ts.

Metres in EPSG:25832 (ETRS89 / UTM zone 32N), which is what the legacy form and
coding-standards.md both use.

Two checks, one after the other.

**A rectangle around the state, per box.** Baden-Württemberg spans roughly 7.5 to
10.5 degrees east and 47.5 to 49.8 north, which in zone 32N is about 388000 to
613000 east and 5266000 to 5516000 north, rounded outward. It catches the mistakes
that actually happen, and can say which box holds one: a swapped Rechtswert and
Hochwert, a dropped digit, a Gauss-Krüger value off an older map, or degrees typed
instead of metres.

**The real border, per point**, since feature 18b. A point both of whose values
pass the rectangle is tested against the state border widened by 2 km, so a
stretch in Bavaria, Hesse, Alsace or Switzerland is caught too while one on the
far bank of a border river is not. landesgrenze.py has the border; the message
goes on both boxes of the point, because it is the pair that is wrong.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from app.protokolle.formregeln.landesgrenze import (
    Landesgrenze,
    aktuelle_landesgrenze,
    liegt_im_land,
)
from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus

KEINE_GANZE_ZAHL = "protokoll.regeln.koordinateKeineGanzeZahl"
RECHTSWERT_AUSSERHALB = "protokoll.regeln.koordinateRechtswertAusserhalb"
HOCHWERT_AUSSERHALB = "protokoll.regeln.koordinateHochwertAusserhalb"
AUSSERHALB_LANDES = "protokoll.regeln.koordinateAusserhalbLandes"

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


# The two boundary points, each as its Rechtswert and Hochwert box.
PUNKTE = (("utm_rw_unten", "utm_hw_unten"), ("utm_rw_oben", "utm_hw_oben"))


def pruefe_koordinaten(
    antworten: Mapping[str, Any], grenze: Landesgrenze | None = None
) -> list[Formverstoss]:
    verstoesse: list[Formverstoss] = []
    im_rechteck: dict[str, int] = {}

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
            continue

        im_rechteck[feld.feld] = int(eingabe)

    grenze = grenze or aktuelle_landesgrenze()
    for rechtswert, hochwert in PUNKTE:
        # Only a point both of whose boxes passed. One already wrong has its own
        # message, and a point with one box empty is not a point yet.
        if rechtswert not in im_rechteck or hochwert not in im_rechteck:
            continue
        if not liegt_im_land(grenze, im_rechteck[rechtswert], im_rechteck[hochwert]):
            verstoesse.append(Formverstoss(f"probestrecke.{rechtswert}", AUSSERHALB_LANDES))
            verstoesse.append(Formverstoss(f"probestrecke.{hochwert}", AUSSERHALB_LANDES))

    return verstoesse
