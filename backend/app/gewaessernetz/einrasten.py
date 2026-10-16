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

**At submit the server works it out again** and stores what it found, whatever
the draft held, so a submitted protocol never carries a position the browser
made up or one gone stale since. Like kennung.py, this needs the loaded network
and so sits here rather than among the pure rules in
app/protokolle/formregeln/. A point far from its water is never refused; only
a missing reason for it is (pruefe_abstand).
"""

import copy
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.kennung import datensatzversion, stand_aus_version
from app.models.gewaessernetz import SRID, Gewaessernetz, GewaessernetzStand, Netzart
from app.protokolle.formregeln.koordinaten import GANZE_ZAHL
from app.protokolle.formregeln.regel import Formverstoss, ist_leer, setze_wert, wert_aus
from app.protokolle.zuordnung.regeln import (
    AMTLICHE_ID,
    GEWAESSERNAME,
    GIS_DATASET_VERSION,
    normalisiert,
)

#: Further than this from its water and a point is warned about, and the submit
#: asks for a reason. Written again in frontend/src/protokoll/regeln/abstand.ts.
WARNABSTAND_M = 100

Punkt = tuple[int, int]

EINGERASTET_VERSION = "probestrecke.eingerastet_version"
ABSTAND_BEGRUENDUNG = "probestrecke.abstand_begruendung"
BEGRUENDUNG_FEHLT = "protokoll.regeln.abstandBegruendungFehlt"


@dataclass(frozen=True, slots=True)
class Grenzpunkt:
    """One boundary point: the two boxes typed, and the four answers snapped.

    The name beside the identifier so the review screen and the PDF can say
    which water without looking the identifier up again.
    """

    rw: str
    hw: str
    eingerastet_rw: str
    eingerastet_hw: str
    eingerastet_kennung: str
    eingerastet_name: str


GRENZPUNKTE = tuple(
    Grenzpunkt(
        rw=f"probestrecke.utm_rw_{grenze}",
        hw=f"probestrecke.utm_hw_{grenze}",
        eingerastet_rw=f"probestrecke.eingerastet_rw_{grenze}",
        eingerastet_hw=f"probestrecke.eingerastet_hw_{grenze}",
        eingerastet_kennung=f"probestrecke.eingerastet_kennung_{grenze}",
        eingerastet_name=f"probestrecke.eingerastet_name_{grenze}",
    )
    for grenze in ("unten", "oben")
)


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


def gewaehlt_aus(kennung: str, name: str, version: str) -> Gewaehlt | None:
    """The picked water, when the three answers 18c writes are all there and the
    version names a release; otherwise None."""
    stand = stand_aus_version(version)
    if ist_leer(kennung) or ist_leer(name) or stand is None:
        return None
    return Gewaehlt(kennung=kennung, name=name, stand=stand)


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


async def raste_protokoll_ein(
    session: AsyncSession, antworten: Mapping[str, Any], verstoesse: Sequence[Formverstoss]
) -> dict[str, str]:
    """The nine snapped answers as the server finds them, by path.

    A point is snapped only when both its boxes passed the rules, so one with a
    message of its own is not also given a position on some water. A point that
    is not snapped has its four answers emptied, and the release is empty when
    neither point was.
    """
    falsch = {verstoss.pfad for verstoss in verstoesse}
    gewaehlt = gewaehlt_aus(
        wert_aus(antworten, AMTLICHE_ID),
        wert_aus(antworten, GEWAESSERNAME),
        wert_aus(antworten, GIS_DATASET_VERSION),
    )
    werte: dict[str, str] = {EINGERASTET_VERSION: ""}

    for grenzpunkt in GRENZPUNKTE:
        werte[grenzpunkt.eingerastet_rw] = ""
        werte[grenzpunkt.eingerastet_hw] = ""
        werte[grenzpunkt.eingerastet_kennung] = ""
        werte[grenzpunkt.eingerastet_name] = ""
        if {grenzpunkt.rw, grenzpunkt.hw} & falsch:
            continue
        punkt = _punkt(antworten, grenzpunkt.rw, grenzpunkt.hw)
        if punkt is None:
            continue
        ergebnis = await einrasten(session, punkt, gewaehlt)
        if ergebnis.stand is None or ergebnis.treffer is None:
            continue
        werte[grenzpunkt.eingerastet_rw] = str(ergebnis.treffer.rw)
        werte[grenzpunkt.eingerastet_hw] = str(ergebnis.treffer.hw)
        werte[grenzpunkt.eingerastet_kennung] = ergebnis.treffer.kennung
        werte[grenzpunkt.eingerastet_name] = ergebnis.treffer.name
        werte[EINGERASTET_VERSION] = datensatzversion(ergebnis.stand)

    return werte


def mit_werten(antworten: Mapping[str, Any], werte: Mapping[str, str]) -> dict[str, Any]:
    """A copy of the answers with these values written in.

    A copy, so the column is assigned a new document: SQLAlchemy does not see a
    change made inside the JSON it already holds.
    """
    neu: dict[str, Any] = copy.deepcopy(dict(antworten))
    for pfad, wert in werte.items():
        setze_wert(neu, pfad, wert)
    return neu


def pruefe_abstand(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Nothing, or one message on the reason: a point is far and none is given.

    Pure, and run over the answers after raste_protokoll_ein has written the
    server's positions into them. Without a loaded network there is no snapped
    position, so nothing can be judged and nothing is asked for.
    """
    if not ist_leer(wert_aus(antworten, ABSTAND_BEGRUENDUNG)):
        return []
    for grenzpunkt in GRENZPUNKTE:
        punkt = _punkt(antworten, grenzpunkt.rw, grenzpunkt.hw)
        eingerastet = _punkt(antworten, grenzpunkt.eingerastet_rw, grenzpunkt.eingerastet_hw)
        if punkt and eingerastet and ist_fern(abstand_m(punkt, eingerastet)):
            return [Formverstoss(pfad=ABSTAND_BEGRUENDUNG, schluessel=BEGRUENDUNG_FEHLT)]
    return []


def _punkt(antworten: Mapping[str, Any], rw_pfad: str, hw_pfad: str) -> Punkt | None:
    rw = wert_aus(antworten, rw_pfad).strip()
    hw = wert_aus(antworten, hw_pfad).strip()
    if not GANZE_ZAHL.match(rw) or not GANZE_ZAHL.match(hw):
        return None
    return int(rw), int(hw)
