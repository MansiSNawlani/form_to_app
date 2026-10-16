"""Where on the water a boundary point of the stretch lies.

A point set on the map or typed from a GPS reading is rarely exactly on the line
LUBW drew for the water. This finds the nearest position that is, so the map can
show both and a point far from any water can be warned about
(docs/decisions.md section 9). The typed point stays the record: nothing here
changes the four coordinate boxes.

**Snapped to the picked water when there is one.** A surveyor who picked the Enz
from the search (feature 18c) is surveying the Enz, so a point between the Enz
and a ditch belongs on the Enz, in the release it was picked from. With a typed
name it snaps to whatever water of the newest release is nearest, placeholder
NN- names included, since a nameless ditch is still a water.

**A point inside a standing water stays where it is**, at distance 0: a lake is
an area and the point is on it. One outside snaps to the shore.
"""

import math
from dataclasses import dataclass
from datetime import date

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gewaessernetz import SRID, Gewaessernetz, GewaessernetzStand, Netzart
from app.protokolle.zuordnung.regeln import normalisiert

#: Further than this from its water and a point is warned about, and the submit
#: asks for a reason. Written again in frontend/src/protokoll/karte/einrasten.ts.
WARNABSTAND_M = 100

Punkt = tuple[int, int]


@dataclass(frozen=True, slots=True)
class Gewaehlt:
    """A water picked from the search: its identifier, its name, its release."""

    kennung: str
    name: str
    stand: date


@dataclass(frozen=True, slots=True)
class Einrastung:
    kennung: str
    art: Netzart
    name: str
    #: The position on the water, whole metres in EPSG:25832 like the typed boxes.
    rw: int
    hw: int
    entfernung_m: int


@dataclass(frozen=True, slots=True)
class Einrastergebnis:
    #: The release snapped against, None when it is not loaded.
    stand: date | None
    #: None when nothing is loaded or the picked water is not in its release.
    treffer: Einrastung | None


def abstand_m(punkt: Punkt, eingerastet: Punkt) -> int:
    """Whole metres between a typed point and its position on the water.

    Worked out from the two stored positions rather than stored itself, so the
    warning and the number shown can never disagree with the coordinates.
    """
    return round(math.hypot(eingerastet[0] - punkt[0], eingerastet[1] - punkt[1]))


def ist_fern(abstand: int) -> bool:
    return abstand > WARNABSTAND_M


async def einrasten(
    session: AsyncSession, punkt: Punkt, gewaehlt: Gewaehlt | None = None
) -> Einrastergebnis:
    """The nearest position on the picked water, or on any water."""
    if gewaehlt is not None:
        stand = await session.scalar(
            select(GewaessernetzStand.stand).where(GewaessernetzStand.stand == gewaehlt.stand)
        )
    else:
        stand = await session.scalar(select(func.max(GewaessernetzStand.stand)))
    if stand is None:
        return Einrastergebnis(stand=None, treffer=None)

    ort = func.ST_SetSRID(func.ST_MakePoint(punkt[0], punkt[1]), SRID)
    naechster = func.ST_ClosestPoint(Gewaessernetz.geometrie, ort)
    abfrage = select(
        Gewaessernetz,
        cast(func.round(func.ST_X(naechster)), Integer),
        cast(func.round(func.ST_Y(naechster)), Integer),
    ).where(Gewaessernetz.stand == stand)

    if gewaehlt is not None:
        # The identifier alone could name a flowing and a standing water, whose
        # numbers overlap; the name settles it, compared as kennung.py does.
        zeilen = (
            await session.execute(abfrage.where(Gewaessernetz.kennung == gewaehlt.kennung))
        ).all()
        zeilen = [z for z in zeilen if normalisiert(z[0].name) == normalisiert(gewaehlt.name)]
    else:
        # <-> is the index-assisted distance, so this is a nearest-neighbour
        # search over the whole network rather than a scan of it.
        zeilen = (
            await session.execute(abfrage.order_by(Gewaessernetz.geometrie.op("<->")(ort)).limit(1))
        ).all()

    if not zeilen:
        return Einrastergebnis(stand=stand, treffer=None)

    gewaesser, rw, hw = zeilen[0]
    return Einrastergebnis(
        stand=stand,
        treffer=Einrastung(
            kennung=gewaesser.kennung,
            art=gewaesser.art,
            name=gewaesser.name,
            rw=rw,
            hw=hw,
            entfernung_m=abstand_m(punkt, (rw, hw)),
        ),
    )
