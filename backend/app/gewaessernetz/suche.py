"""Searching the newest release of the water body network by name.

What the Gewaesser field in section 1 asks while a surveyor types. Picking a
result fills in the name, the official identifier and, where it fits the form,
the Vorfluter chain, so each result carries all three.

**Only the newest release is searched.** Older ones are kept so an identifier can
be looked up where it came from (models/gewaessernetz.py), but a new protocol
should name a water as LUBW currently has it.

**Placeholder names are left out.** LUBW calls most unnamed ponds and ditches
NN-something; 13 000 of the 32 000 waters are named that way. Nobody can search
for one by a name they have never seen, and 18d finds them by position instead.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from sqlalchemy import (
    ColumnElement,
    ColumnExpressionArgument,
    Integer,
    case,
    cast,
    func,
    literal,
    select,
    text,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gewaessernetz import SRID, Gewaessernetz, GewaessernetzStand, Netzart
from app.protokolle.formregeln.vorfluter import VORFLUTER_PFADE, ist_endpunkt

MAX_TREFFER = 20

#: The form's five boxes. One more link is fetched than fits, so a chain that
#: runs past the fifth box is told from one that simply stops.
MAX_KETTE = len(VORFLUTER_PFADE)

# A German keyboard types the umlaut, a borrowed one or a phone often does not.
# Folding both sides lets "Muehlbach" find "Mühlbach". Search only: nothing
# folded is ever stored.
_FALTUNG = (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"))

PLATZHALTER = "^NN-"

KETTE = text(
    """
    WITH RECURSIVE kette(start, name, naechste, tiefe) AS (
        SELECT g.kennung, v.name, v.vorfluter_kennung, 1
        FROM gewaessernetz g
        JOIN gewaessernetz v
          ON v.stand = g.stand AND v.art = :fliess AND v.kennung = g.vorfluter_kennung
        WHERE g.stand = :stand AND g.art = :fliess AND g.kennung = ANY(:kennungen)
      UNION ALL
        SELECT k.start, v.name, v.vorfluter_kennung, k.tiefe + 1
        FROM kette k
        JOIN gewaessernetz v
          ON v.stand = :stand AND v.art = :fliess AND v.kennung = k.naechste
        WHERE k.tiefe <= :grenze
    )
    SELECT start, name FROM kette ORDER BY start, tiefe
    """
)


def suchform(wert: str) -> str:
    """A name as the search compares it. Spelled again in SQL by suchform_sql."""
    gefaltet = wert.strip().lower()
    for zeichen, ersatz in _FALTUNG:
        gefaltet = gefaltet.replace(zeichen, ersatz)
    return gefaltet


def suchform_sql(spalte: ColumnExpressionArgument[str]) -> ColumnElement[str]:
    """suchform, as the database runs it. A test holds the two to one answer."""
    gefaltet: ColumnElement[str] = func.lower(func.btrim(spalte))
    for zeichen, ersatz in _FALTUNG:
        gefaltet = func.replace(gefaltet, zeichen, ersatz)
    return gefaltet


def kette_fuer_formular(namen: Sequence[str]) -> tuple[str, ...] | None:
    """The chain as the form's five boxes would hold it, or None if it cannot.

    It has to arrive at the Rhein or the Donau, which is what
    formregeln/vorfluter.py asks of a typed chain, and within five links. Rather
    than fill four boxes with a chain that stops short, nothing is filled and the
    surveyor keeps what they typed.
    """
    for index, name in enumerate(namen[:MAX_KETTE]):
        if ist_endpunkt(name):
            return tuple(namen[: index + 1])
    return None


@dataclass(frozen=True, slots=True)
class Treffer:
    kennung: str
    art: Netzart
    name: str
    #: What it flows into, as LUBW names it. None for a standing water.
    vorfluter_name: str | None
    #: The chain for the form's boxes, or None when it does not fit them.
    vorfluter: tuple[str, ...] | None
    #: Whole metres to the nearest point given, or None without one.
    entfernung_m: int | None


@dataclass(frozen=True, slots=True)
class Suchergebnis:
    #: The release searched, None when nothing is loaded.
    stand: date | None
    treffer: list[Treffer]


async def suche(
    session: AsyncSession, eingabe: str, punkte: Sequence[tuple[int, int]] = ()
) -> Suchergebnis:
    """Up to twenty waters whose name contains what was typed.

    Without a point, names beginning with it come first, then alphabetical. With
    one, nearest first: a surveyor who has already placed the stretch is looking
    for the Muehlbach there, not the first of the 102 alphabetically.
    """
    stand = await session.scalar(select(func.max(GewaessernetzStand.stand)))
    if stand is None:
        return Suchergebnis(stand=None, treffer=[])

    gesucht = suchform(eingabe)
    name = suchform_sql(Gewaessernetz.name)
    entfernung = _entfernung(punkte)

    abfrage = (
        select(Gewaessernetz, entfernung.label("entfernung"))
        .where(Gewaessernetz.stand == stand)
        .where(name.contains(gesucht, autoescape=True))
        .where(~Gewaessernetz.name.regexp_match(PLATZHALTER))
        .limit(MAX_TREFFER)
    )
    if punkte:
        abfrage = abfrage.order_by(entfernung, Gewaessernetz.name, Gewaessernetz.kennung)
    else:
        anfang = case((name.startswith(gesucht, autoescape=True), 0), else_=1)
        abfrage = abfrage.order_by(anfang, Gewaessernetz.name, Gewaessernetz.kennung)

    zeilen = (await session.execute(abfrage)).all()
    ketten = await _ketten(
        session, stand, [g.kennung for g, _ in zeilen if g.art is Netzart.FLIESSGEWAESSER]
    )

    return Suchergebnis(
        stand=stand,
        treffer=[
            Treffer(
                kennung=gewaesser.kennung,
                art=gewaesser.art,
                name=gewaesser.name,
                vorfluter_name=gewaesser.vorfluter_name,
                vorfluter=kette_fuer_formular(ketten.get(gewaesser.kennung, [])),
                entfernung_m=meter,
            )
            for gewaesser, meter in zeilen
        ],
    )


def _entfernung(punkte: Sequence[tuple[int, int]]) -> ColumnElement[int]:
    """Whole metres to the nearest of the points, or NULL without any."""
    if not punkte:
        return cast(literal(None), Integer)
    mehrpunkt = "MULTIPOINT(" + ", ".join(f"{rw} {hw}" for rw, hw in punkte) + ")"
    return cast(
        func.round(
            func.ST_Distance(Gewaessernetz.geometrie, func.ST_GeomFromText(mehrpunkt, SRID))
        ),
        Integer,
    )


async def _ketten(session: AsyncSession, stand: date, kennungen: list[str]) -> dict[str, list[str]]:
    """Each flowing water's chain downstream, up to one link past the boxes."""
    if not kennungen:
        return {}
    zeilen = await session.execute(
        KETTE,
        {
            "stand": stand,
            "kennungen": kennungen,
            "grenze": MAX_KETTE,
            "fliess": Netzart.FLIESSGEWAESSER.value,
        },
    )
    ketten: dict[str, list[str]] = {}
    for start, name in zeilen:
        ketten.setdefault(start, []).append(name)
    return ketten
