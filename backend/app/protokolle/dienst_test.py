"""Creating and finding protocols, against a real database.

The ownership tests here are the ones coding-standards.md calls non-optional.
They are at this layer rather than only at the route, because this is where the
rule actually lives: a route added later that forgets to authorise still cannot
reach another account's protocol, since the filter is part of the query.
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import pytest
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.protokolle.dienst import hole_protokoll, lege_entwurf_an, liste_protokolle
from app.protokolle.fehler import ProtokollNichtGefunden


async def test_ein_neuer_entwurf_ist_leer_und_gehoert_dem_konto(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")

    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    assert entwurf.owner_user_id == besitzer.id
    assert entwurf.status is Status.DRAFT
    assert entwurf.antworten == {}
    assert entwurf.version == 1


async def test_ein_neuer_entwurf_traegt_die_aktuelle_formularversion(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """ADR 0004 freezes a submission to the version it was filled in under.

    The version comes from the loaded definition rather than a constant in the
    service, so there is one place that knows which version this is.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    assert entwurf.form_version == formular().version


async def test_zwei_entwuerfe_sind_zwei_entwuerfe(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Nothing reuses an empty draft.

    A surveyor may have several protocols on the go at once, which is the whole
    reason drafts have identities rather than there being one per account.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    erster = await lege_entwurf_an(session, besitzer=besitzer)
    zweiter = await lege_entwurf_an(session, besitzer=besitzer)

    assert erster.id != zweiter.id


async def test_holt_das_eigene_protokoll(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)

    geholt = await hole_protokoll(session, protokoll_id=entwurf.id, besitzer=besitzer)

    assert geholt.id == entwurf.id


async def test_ein_unbekanntes_protokoll_gibt_es_nicht(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")

    with pytest.raises(ProtokollNichtGefunden):
        await hole_protokoll(session, protokoll_id=uuid.uuid4(), besitzer=besitzer)


async def test_ein_einreicher_kommt_nicht_an_das_protokoll_eines_anderen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The permission test coding-standards.md makes non-optional.

    A draft is somebody's unfinished work, and submitters here are often external
    consultants and angling associations rather than colleagues, so one seeing
    another's survey is a disclosure between organisations rather than an
    inconvenience.
    """
    bergmann = await anlegen(email="bergmann@ffs.de")
    keller = await anlegen(email="keller@buero-keller.de")
    fremd = await lege_entwurf_an(session, besitzer=keller)

    with pytest.raises(ProtokollNichtGefunden):
        await hole_protokoll(session, protokoll_id=fremd.id, besitzer=bergmann)


async def test_ein_fremdes_protokoll_meldet_dasselbe_wie_ein_unbekanntes(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The two must stay indistinguishable.

    Different errors here would become different responses, and a stranger could
    then work out which protocol ids exist by watching which refusal came back.
    """
    bergmann = await anlegen(email="bergmann@ffs.de")
    keller = await anlegen(email="keller@buero-keller.de")
    fremd = await lege_entwurf_an(session, besitzer=keller)

    with pytest.raises(ProtokollNichtGefunden) as fremder_fehler:
        await hole_protokoll(session, protokoll_id=fremd.id, besitzer=bergmann)
    with pytest.raises(ProtokollNichtGefunden) as unbekannter_fehler:
        await hole_protokoll(session, protokoll_id=uuid.uuid4(), besitzer=bergmann)

    assert type(fremder_fehler.value) is type(unbekannter_fehler.value)


async def test_die_liste_eines_neuen_kontos_ist_leer(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Empty rather than a failure. A new account simply has nothing yet."""
    besitzer = await anlegen(email="bergmann@ffs.de")

    assert await liste_protokolle(session, besitzer=besitzer) == []


async def test_die_liste_zeigt_nur_die_eigenen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The permission test for the list.

    A leak here would be worse than one on a single protocol: it hands over every
    survey at once rather than the one whose id somebody guessed.
    """
    bergmann = await anlegen(email="bergmann@ffs.de")
    keller = await anlegen(email="keller@buero-keller.de")
    eigen = await lege_entwurf_an(session, besitzer=bergmann)
    await lege_entwurf_an(session, besitzer=keller)

    zeilen = await liste_protokolle(session, besitzer=bergmann)

    assert [zeile.id for zeile in zeilen] == [eigen.id]


async def test_die_liste_zeigt_das_zuletzt_bearbeitete_zuerst(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Newest first, because a surveyor comes back to what they were last doing."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    aelter = await lege_entwurf_an(session, besitzer=besitzer)
    neuer = await lege_entwurf_an(session, besitzer=besitzer)
    await session.execute(
        update(Submission)
        .where(Submission.id == aelter.id)
        .values(updated_at=datetime(2026, 1, 1, tzinfo=UTC))
    )
    await session.commit()

    zeilen = await liste_protokolle(session, besitzer=besitzer)

    assert [zeile.id for zeile in zeilen] == [neuer.id, aelter.id]


async def test_die_reihenfolge_ist_auch_bei_gleicher_zeit_eindeutig(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Two drafts written in one transaction carry the same timestamp.

    Without the id as a tiebreaker their order would be whatever the database
    felt like, and a test asserting it would fail now and then for no reason
    anybody could reproduce.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    gleichzeitig = datetime(2026, 8, 14, 12, 0, tzinfo=UTC)
    for _ in range(5):
        await lege_entwurf_an(session, besitzer=besitzer)
    await session.execute(update(Submission).values(updated_at=gleichzeitig))
    await session.commit()

    zeilen = await liste_protokolle(session, besitzer=besitzer)

    assert [zeile.id for zeile in zeilen] == sorted(
        (zeile.id for zeile in zeilen), reverse=True
    )


async def test_die_liste_liest_die_anzeigewerte_aus_den_antworten(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The five values the mockup prints, out of the JSON document."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    entwurf.antworten = {
        "anlass": "wrrl_monitoring",
        "datum": "2026-08-14",
        "probestrecke": {
            "gewaesser": {"gewaessername": "Schussen"},
            "ortsangabe": "Weißenau, oberhalb der Brücke",
            "laenge": "120",
        },
    }
    await session.commit()

    zeile = (await liste_protokolle(session, besitzer=besitzer))[0]

    assert zeile.gewaessername == "Schussen"
    assert zeile.ortsangabe == "Weißenau, oberhalb der Brücke"
    assert zeile.laenge == "120"
    assert zeile.datum == "2026-08-14"
    assert zeile.anlass == "wrrl_monitoring"


async def test_ein_neuer_entwurf_hat_keine_anzeigewerte(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Nothing has been typed yet, so there is nothing to print."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    await lege_entwurf_an(session, besitzer=besitzer)

    zeile = (await liste_protokolle(session, besitzer=besitzer))[0]

    assert zeile.gewaessername is None
    assert zeile.ortsangabe is None
    assert zeile.datum is None


async def test_ein_geleertes_feld_zaehlt_als_leer(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Typed into and cleared reads exactly like never touched.

    One representation for "nothing to show", so the list has one case to draw
    rather than remembering that "" and null mean the same thing here.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=besitzer)
    entwurf.antworten = {"probestrecke": {"gewaesser": {"gewaessername": "   "}}}
    await session.commit()

    zeile = (await liste_protokolle(session, besitzer=besitzer))[0]

    assert zeile.gewaessername is None
