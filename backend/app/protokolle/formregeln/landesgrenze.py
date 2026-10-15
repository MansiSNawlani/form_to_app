"""Whether a point lies in Baden-Wuerttemberg, widened by 2 km.

The Python half of frontend/src/protokoll/regeln/landesgrenze.ts. Both read the
same file, database/seed/landesgrenze/landesgrenze_bw.json, so the browser and
the server cannot disagree about where the border is; backend/scripts/
landesgrenze.py explains how it was made and why it is 2 km wider than the state.

Even-odd ray casting over every ring of every polygon, which gets holes and
separate parts right without telling outer rings from holes. A point exactly on
an edge counts as inside, decided by a separate test first, because ray casting
on its own answers an edge either way depending on which edge it is.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

Ring = list[list[int]]


@dataclass(frozen=True)
class Landesgrenze:
    #: Each polygon is its outer ring followed by its holes, in EPSG:25832 metres.
    polygone: tuple[tuple[Ring, ...], ...]


def lade_landesgrenze(pfad: Path) -> Landesgrenze:
    daten = json.loads(pfad.read_text(encoding="utf-8"))
    return Landesgrenze(polygone=tuple(tuple(polygon) for polygon in daten["polygone"]))


@lru_cache
def aktuelle_landesgrenze() -> Landesgrenze:
    """Read once per process: the file cannot change while the service runs."""
    return lade_landesgrenze(get_settings().landesgrenze_datei)


def liegt_im_land(grenze: Landesgrenze, rw: int, hw: int) -> bool:
    drin = False
    for polygon in grenze.polygone:
        for ring in polygon:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:], strict=False):
                if _auf_strecke(rw, hw, x1, y1, x2, y2):
                    return True
                # Does a ray from the point towards the east cross this edge? The
                # half-open comparison counts a vertex the ray passes through once.
                if (y1 > hw) != (y2 > hw) and rw < x1 + (hw - y1) * (x2 - x1) / (y2 - y1):
                    drin = not drin
    return drin


def _auf_strecke(px: int, py: int, x1: int, y1: int, x2: int, y2: int) -> bool:
    # Integers throughout, so the cross product is exact and "on the line" means
    # exactly on it.
    if (x2 - x1) * (py - y1) != (y2 - y1) * (px - x1):
        return False
    return min(x1, x2) <= px <= max(x1, x2) and min(y1, y2) <= py <= max(y1, y2)
