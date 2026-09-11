"""Saving and deleting a protocol.

Apart from dienst_test.py, which covers creating, reading and listing. These are
the operations that change something, so they carry their own worries: that a
refused save changes nothing at all, and that two copies of one protocol cannot
quietly overwrite each other.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.speicher import Anlagenspeicher
from app.models.benutzer import User
from app.models.protokoll import Status
from app.protokolle.dienst import (
    hole_protokoll,
    lege_entwurf_an,
    liste_protokolle,
    loesche_protokoll,
    speichere_antworten,
)
from app.protokolle.fehler import (
    AntwortenUngueltig,
    ProtokollNichtGefunden,
    ProtokollNichtMehrEntwurf,
    ProtokollVeraendert,
)


async def test_speichern_legt_die_antworten_ab_und_hebt_die_version(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    gespeichert = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"anlass": "wrrl_monitoring"},
        version=entwurf.version,
    )

    assert gespeichert.antworten == {"anlass": "wrrl_monitoring"}
    assert gespeichert.version == 2


async def test_speichern_ersetzt_das_dokument_statt_es_zu_ergaenzen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A save carries every answer the form holds.

    So a value the browser left out is a value the surveyor cleared, not one the
    request forgot to mention.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    erst = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"anlass": "wrrl_monitoring", "datum": "2026-08-14"},
        version=entwurf.version,
    )

    danach = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"datum": "2026-08-15"},
        version=erst.version,
    )

    assert danach.antworten == {"datum": "2026-08-15"}


async def test_speichern_bewegt_den_zeitstempel(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Zuletzt bearbeitet is a column on the list, so a save has to move it.

    The old timestamp is planted rather than taken from the freshly created
    draft, and that is not a trick to make the test pass. Postgres' now() is the
    transaction's start time, and every test here runs inside one transaction, so
    creating and then saving would produce the same instant twice and the
    assertion would be comparing a value with itself. In the real application
    each request is its own transaction, so the times differ there.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    # Set explicitly, which overrides onupdate for this one statement, so the
    # draft now claims it was last touched in January.
    vorher = datetime(2026, 1, 1, tzinfo=UTC)
    entwurf.updated_at = vorher
    await session.commit()

    gespeichert = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"datum": "2026-08-14"},
        version=entwurf.version,
    )

    assert gespeichert.updated_at > vorher


async def test_eine_veraltete_version_wird_abgewiesen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Two tabs on one protocol: the second must not silently win.

    The first tab saves, the second still holds the version it loaded, and its
    save is refused rather than overwriting what the first put in.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    veraltet = entwurf.version
    await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"datum": "2026-08-14"},
        version=veraltet,
    )

    with pytest.raises(ProtokollVeraendert) as fehler:
        await speichere_antworten(
            session,
            protokoll_id=entwurf.id,
            besitzer=besitzer,
            antworten={"datum": "1999-01-01"},
            version=veraltet,
        )

    assert fehler.value.erwartet == veraltet
    assert fehler.value.tatsaechlich == veraltet + 1


async def test_eine_abgewiesene_speicherung_aendert_nichts(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A refused document may not touch what is stored.

    Losing an afternoon's work to a save that was going to be rejected anyway is
    the worst thing this endpoint could do.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    gut = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=besitzer,
        antworten={"datum": "2026-08-14"},
        version=entwurf.version,
    )

    with pytest.raises(AntwortenUngueltig):
        await speichere_antworten(
            session,
            protokoll_id=entwurf.id,
            besitzer=besitzer,
            antworten={"erfunden": "x"},
            version=gut.version,
        )

    unveraendert = await hole_protokoll(session, protokoll_id=entwurf.id, besitzer=besitzer)
    assert unveraendert.antworten == {"datum": "2026-08-14"}
    assert unveraendert.version == gut.version


async def test_die_version_wird_vor_dem_dokument_geprueft(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A stale save is stale whatever is in it.

    Telling somebody a field is wrong, when the real problem is that they have
    the protocol open twice, sends them to fix the wrong thing.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    with pytest.raises(ProtokollVeraendert):
        await speichere_antworten(
            session,
            protokoll_id=entwurf.id,
            besitzer=besitzer,
            antworten={"erfunden": "auch kaputt"},
            version=entwurf.version + 99,
        )


async def test_ein_einreicher_speichert_nicht_im_protokoll_eines_anderen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The permission test for writing.

    Reading somebody else's survey is a disclosure. Writing to it corrupts a
    record they are answerable for.
    """
    bergmann = await anlegen(email="bergmann@ffs.de")
    keller = await anlegen(email="keller@buero-keller.de")
    fremd = await lege_entwurf_an(session, besitzer=keller)

    with pytest.raises(ProtokollNichtGefunden):
        await speichere_antworten(
            session,
            protokoll_id=fremd.id,
            besitzer=bergmann,
            antworten={"datum": "1999-01-01"},
            version=fremd.version,
        )

    unveraendert = await hole_protokoll(session, protokoll_id=fremd.id, besitzer=keller)
    assert unveraendert.antworten == {}


async def test_ein_eingereichtes_protokoll_wird_nicht_mehr_geaendert(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Guards feature 11 rather than anything today.

    Nothing in this feature can produce a submission that is not a draft. The
    moment submitting exists, a save arriving late from a tab left open across
    the submit must not quietly undo it.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    entwurf.status = Status.SUBMITTED
    await session.commit()

    with pytest.raises(ProtokollNichtMehrEntwurf):
        await speichere_antworten(
            session,
            protokoll_id=entwurf.id,
            besitzer=besitzer,
            antworten={"datum": "1999-01-01"},
            version=entwurf.version,
        )


async def test_loescht_den_eigenen_entwurf(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    await loesche_protokoll(session, speicher, protokoll_id=entwurf.id, besitzer=besitzer)

    assert await liste_protokolle(session, besitzer=besitzer) == []


async def test_ein_einreicher_loescht_nicht_das_protokoll_eines_anderen(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """The permission test for deleting, and the worst of the three if it failed."""
    bergmann = await anlegen(email="bergmann@ffs.de")
    keller = await anlegen(email="keller@buero-keller.de")
    fremd = await lege_entwurf_an(session, besitzer=keller)

    with pytest.raises(ProtokollNichtGefunden):
        await loesche_protokoll(session, speicher, protokoll_id=fremd.id, besitzer=bergmann)

    assert [zeile.id for zeile in await liste_protokolle(session, besitzer=keller)] == [fremd.id]


async def test_ein_eingereichtes_protokoll_wird_nicht_geloescht(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """A submitted protocol is a record somebody else is working with.

    Taking it back is a workflow step for feature 11, not a delete.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    entwurf.status = Status.SUBMITTED
    await session.commit()

    with pytest.raises(ProtokollNichtMehrEntwurf):
        await loesche_protokoll(session, speicher, protokoll_id=entwurf.id, besitzer=besitzer)
