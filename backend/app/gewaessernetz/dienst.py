"""Loads one release of the water body network into the database.

A release is loaded whole or not at all. The two files are checked before
anything is written, and every row goes in inside one transaction that is rolled
back on any failure, so a broken file halfway through leaves the database exactly
as it was rather than holding a release with some of its waters missing.

Loading is a deploy step somebody runs, like migrating, and never happens when
the application starts. app/cli.py is the only caller.
"""

import uuid
from collections.abc import Callable, Iterator, Sequence
from datetime import date
from itertools import islice
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.fehler import StandBereitsGeladen, StandPasstNicht
from app.gewaessernetz.lesen import Netzdatei, Netzeintrag
from app.models.gewaessernetz import SRID, GewaessernetzStand

# Rows per round trip. Large enough that 30 000 waters is a few dozen statements,
# small enough that one batch of river geometry stays a few megabytes.
STAPEL = 500

# How LUBW writes a release in STAND_FACH: "Mai 2025".
MONATE = {
    "januar": 1,
    "februar": 2,
    "märz": 3,
    "maerz": 3,
    "april": 4,
    "mai": 5,
    "juni": 6,
    "juli": 7,
    "august": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "dezember": 12,
}

EINFUEGEN = text(
    "INSERT INTO gewaessernetz"
    " (id, stand, art, kennung, name, vorfluter_kennung, vorfluter_name, geometrie)"
    " VALUES (:id, :stand, :art, :kennung, :name, :vorfluter_kennung,"
    f" :vorfluter_name, ST_Multi(ST_GeomFromWKB(:wkb, {SRID})))"
)

Fortschritt = Callable[[Netzdatei, int], None]


def stand_passt(stand: date, staende: frozenset[str]) -> bool:
    """Whether the release date given is the first of the month every file names.

    The administrator types the date and the files carry only a month, so this is
    what catches loading the new download under last year's date, which would
    otherwise record the wrong release on every identifier taken from it.

    The first of the month and no other day. The files say nothing finer than a
    month, so any other day would be invented by whoever typed it, and the same
    download given as 2025-05-01 and as 2025-05-15 would load twice as two
    releases.
    """
    if stand.day != 1 or len(staende) != 1:
        return False
    teile = next(iter(staende)).lower().split()
    if len(teile) != 2 or not teile[1].isdigit():
        return False
    return MONATE.get(teile[0]) == stand.month and int(teile[1]) == stand.year


async def lade_stand(
    session: AsyncSession,
    stand: date,
    fliessgewaesser: Netzdatei,
    stehende: Netzdatei,
    fortschritt: Fortschritt | None = None,
) -> GewaessernetzStand:
    staende = fliessgewaesser.staende | stehende.staende
    if not stand_passt(stand, staende):
        raise StandPasstNicht(stand, staende)
    if await session.get(GewaessernetzStand, stand) is not None:
        raise StandBereitsGeladen(stand)

    eintrag = GewaessernetzStand(
        stand=stand,
        anzahl_fliessgewaesser=fliessgewaesser.anzahl,
        anzahl_stehende=stehende.anzahl,
    )
    try:
        session.add(eintrag)
        await session.flush()
        for datei in (fliessgewaesser, stehende):
            geschrieben = 0
            for stapel in _stapel(datei.eintraege()):
                await session.execute(EINFUEGEN, [_zeile(stand, e) for e in stapel])
                geschrieben += len(stapel)
                if fortschritt is not None:
                    fortschritt(datei, geschrieben)
        await session.commit()
    except IntegrityError as fehler:
        await session.rollback()
        # Two administrators loading the same release at once: the check above
        # passed for both, and the primary key stops the second.
        if "pk_gewaessernetz_stand" in str(fehler.orig):
            raise StandBereitsGeladen(stand) from fehler
        raise
    except BaseException:
        await session.rollback()
        raise
    return eintrag


async def liste_staende(session: AsyncSession) -> Sequence[GewaessernetzStand]:
    """Every loaded release, newest first, which is the one 18c and 18d use."""
    ergebnis = await session.execute(
        select(GewaessernetzStand).order_by(GewaessernetzStand.stand.desc())
    )
    return ergebnis.scalars().all()


def _stapel(eintraege: Iterator[Netzeintrag]) -> Iterator[list[Netzeintrag]]:
    while stapel := list(islice(eintraege, STAPEL)):
        yield stapel


def _zeile(stand: date, eintrag: Netzeintrag) -> dict[str, Any]:
    return {
        # In Python, as every id in this schema is. The model's default does not
        # apply to a statement written out as text.
        "id": uuid.uuid4(),
        "stand": stand,
        "art": eintrag.art.value,
        "kennung": eintrag.kennung,
        "name": eintrag.name,
        "vorfluter_kennung": eintrag.vorfluter_kennung,
        "vorfluter_name": eintrag.vorfluter_name,
        "wkb": eintrag.wkb,
    }
