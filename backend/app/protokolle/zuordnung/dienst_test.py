"""The matching, against a real database.

Every test here is really one question: does filing a second protocol share the
first one's records or start new ones? The answers are the decision of
2026-09-11, and the last three are the important ones, because they are where the
rule could plausibly have gone the other way.

A real database rather than a stand-in, for the reason conftest.py gives about
every other suite here: the guarantees being leaned on are two partial unique
indexes, and nothing but Postgres has them.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.protokolle.zuordnung.dienst import ordne_zu
from app.protokolle.zuordnung.regeln import lies_umschlag
from app.protokolle.zuordnung.regeln_test import VOLLSTAENDIG, mit


def strecke(**aenderungen: object) -> dict[str, object]:
    """The complete document with the Probestrecke branch adjusted."""
    return mit(probestrecke={**VOLLSTAENDIG["probestrecke"], **aenderungen})  # type: ignore[dict-item]


def gewaesser(**aenderungen: object) -> dict[str, object]:
    """The complete document with the Gewaesser branch adjusted."""
    vorher = VOLLSTAENDIG["probestrecke"]["gewaesser"]  # type: ignore[index]
    return strecke(gewaesser={**vorher, **aenderungen})


def bearbeiter(**aenderungen: object) -> dict[str, object]:
    return mit(bearbeiter={**VOLLSTAENDIG["bearbeiter"], **aenderungen})  # type: ignore[dict-item]


async def _zaehle(session: AsyncSession, modell: type[object]) -> int:
    return (await session.scalars(select(func.count()).select_from(modell))).one()


@pytest.fixture
def konto(anlegen: Callable[..., Awaitable[User]]) -> Callable[..., Awaitable[User]]:
    return anlegen


async def test_legt_beim_ersten_mal_alle_drei_an(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await konto(email="bergmann@ffs.de")

    zuordnung = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)

    assert await _zaehle(session, Gewaesser) == 1
    assert await _zaehle(session, Probestrecke) == 1
    assert await _zaehle(session, Person) == 1
    assert zuordnung.probestrecke_id is not None
    assert zuordnung.person_id is not None


async def test_zwei_protokolle_auf_derselben_strecke_teilen_sich_die_saetze(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """The point of ADR 0001, and the thing the whole feature exists for.

    Two surveys stay two protocols. What they share is the statement that they
    were carried out in the same place.
    """
    erste = await konto(email="weber@ffs.de")
    zweite = await konto(email="klein@ffs.de")

    eine = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), erste)
    andere = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), zweite)

    assert eine.probestrecke_id == andere.probestrecke_id
    assert eine.gewaesser_id == andere.gewaesser_id
    assert await _zaehle(session, Probestrecke) == 1
    assert await _zaehle(session, Gewaesser) == 1


async def test_erkennt_dieselbe_strecke_trotz_anderer_schreibweise(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    zweite = await ordne_zu(
        session,
        lies_umschlag(gewaesser(gewaessername="  SCHUSSEN ", vorfluter1="bodensee")),
        besitzer,
    )

    assert erste.gewaesser_id == zweite.gewaesser_id
    assert await _zaehle(session, Gewaesser) == 1


async def test_speichert_die_erste_schreibweise_und_laesst_sie_stehen(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """Read or create, never update, at its plainest.

    The second protocol matches the first's water and does not restyle its name.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    await ordne_zu(session, lies_umschlag(gewaesser(gewaessername="SCHUSSEN")), besitzer)

    gespeichert = (await session.scalars(select(Gewaesser))).one()

    assert gespeichert.name == "Schussen"


async def test_ein_anderes_einzugsgebiet_ist_ein_anderes_gewaesser(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """Two Muehlbaeche draining to different rivers are two waters."""
    besitzer = await konto(email="bergmann@ffs.de")

    zum_rhein = await ordne_zu(
        session,
        lies_umschlag(gewaesser(gewaessername="Muehlbach", vorfluter1="Neckar", vorfluter2="")),
        besitzer,
    )
    zur_donau = await ordne_zu(
        session,
        lies_umschlag(gewaesser(gewaessername="Muehlbach", vorfluter1="Iller", vorfluter2="")),
        besitzer,
    )

    assert zum_rhein.gewaesser_id != zur_donau.gewaesser_id
    assert await _zaehle(session, Gewaesser) == 2


async def test_andere_koordinaten_sind_eine_andere_strecke(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """One metre out is a different stretch until feature 18 brings snapping."""
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    zweite = await ordne_zu(session, lies_umschlag(strecke(utm_rw_unten="512341")), besitzer)

    assert erste.probestrecke_id != zweite.probestrecke_id
    assert erste.gewaesser_id == zweite.gewaesser_id
    assert await _zaehle(session, Probestrecke) == 2


async def test_eine_laenge_oder_ortsangabe_macht_keine_zweite_strecke(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """Neither is part of the key.

    A stream meanders, so two people honestly disagree about the length along it,
    and they describe the same bridge in different words. The stored row keeps
    what it was created with.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    zweite = await ordne_zu(
        session,
        lies_umschlag(strecke(laenge="800", ortsangabe="bei der Muehle")),
        besitzer,
    )

    assert erste.probestrecke_id == zweite.probestrecke_id
    gespeichert = (await session.scalars(select(Probestrecke))).one()
    assert gespeichert.laenge_m == 450
    assert gespeichert.ortsangabe == "unterhalb der Bruecke"


async def test_dieselbe_monitoringnummer_ist_dieselbe_strecke(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """The number outranks the coordinates, and the stored ones are left alone.

    Two surveyors reading a map disagree by a few metres about the same official
    monitoring stretch. The number is what settles it.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(strecke(monitoringnummer="MS-4711")), besitzer)
    zweite = await ordne_zu(
        session,
        lies_umschlag(strecke(monitoringnummer="MS-4711", utm_rw_unten="512999")),
        besitzer,
    )

    assert erste.probestrecke_id == zweite.probestrecke_id
    assert (await session.scalars(select(Probestrecke))).one().untere_grenze_rechtswert == 512340


async def test_eine_nummer_haengt_sich_nicht_an_eine_strecke_ohne_nummer(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """**The decision of 2026-09-11, and the one that could have gone otherwise.**

    A stretch is fished, then taken into the monitoring programme and given a
    number, then fished again. Stamping the number onto the existing record would
    write to a row already-accepted protocols point at, so it gets its own record
    instead. The earlier protocols stay exactly where they were filed.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    ohne_nummer = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    mit_nummer = await ordne_zu(
        session, lies_umschlag(strecke(monitoringnummer="MS-4711")), besitzer
    )

    assert ohne_nummer.probestrecke_id != mit_nummer.probestrecke_id
    assert await _zaehle(session, Probestrecke) == 2
    alte = await session.get(Probestrecke, ohne_nummer.probestrecke_id)
    assert alte is not None
    assert alte.monitoringstrecke_nr is None


async def test_dieselbe_adresse_ist_dieselbe_person(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    zweite = await ordne_zu(session, lies_umschlag(bearbeiter(email="WEBER@ffs.DE")), besitzer)

    assert erste.person_id == zweite.person_id
    assert await _zaehle(session, Person) == 1


async def test_eine_neue_telefonnummer_aendert_die_person_nicht(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """The case the first draft of this feature got wrong.

    Refreshing the details would write to a row accepted protocols point at.
    Nothing is lost: every protocol carries its own copy of the Bearbeiter's
    details in its answers, so each displays what it was filed with.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)
    zweite = await ordne_zu(
        session,
        lies_umschlag(bearbeiter(telefon="0711 999999", firma="Weber und Partner")),
        besitzer,
    )

    assert erste.person_id == zweite.person_id
    gespeichert = (await session.scalars(select(Person))).one()
    assert gespeichert.telefon == "07541 12345"
    assert gespeichert.firma == "Buero Weber"


async def test_verknuepft_den_bearbeiter_mit_dem_konto_das_ihm_gehoert(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """Set when the Bearbeiter turns out to be the account filing the protocol."""
    besitzer = await konto(email="weber@ffs.de")

    await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)

    assert (await session.scalars(select(Person))).one().user_id == besitzer.id


async def test_laesst_den_bearbeiter_ohne_konto_wenn_ein_anderer_einreicht(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """The ordinary case for an external consultant filing for somebody else."""
    besitzer = await konto(email="buero@consultants.de")

    await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)

    assert (await session.scalars(select(Person))).one().user_id is None


async def test_schreibt_nichts_wenn_die_strecke_nicht_angelegt_werden_kann(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """A half-written set of records is worse than none.

    The Gewaesser is created before the Probestrecke, so a stretch the database
    refuses must not leave a water body behind with nothing on it.
    """
    besitzer = await konto(email="bergmann@ffs.de")
    umschlag = lies_umschlag(VOLLSTAENDIG)
    # Past the four the check constraint allows, which only the database knows.
    object.__setattr__(umschlag.probestrecke, "regierungspraesidium", 9)

    with pytest.raises(IntegrityError):
        await ordne_zu(session, umschlag, besitzer)

    await session.rollback()
    assert await _zaehle(session, Gewaesser) == 0


async def test_gibt_die_ids_zurueck_die_wirklich_in_der_datenbank_stehen(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """The submission's foreign keys point at these, so they have to be real."""
    besitzer = await konto(email="bergmann@ffs.de")

    zuordnung = await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)

    strecke_ = await session.get(Probestrecke, zuordnung.probestrecke_id)
    assert strecke_ is not None
    assert strecke_.gewaesser_id == zuordnung.gewaesser_id
    assert isinstance(zuordnung.person_id, uuid.UUID)


async def test_eine_treffende_nummer_legt_kein_gewaesser_an(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """Found by the branch review on 2026-09-11.

    The water used to be resolved before the stretch was looked up. When the
    Monitoringstrecken-Nr. then matched a stretch recorded against a differently
    spelled water, the freshly created Gewaesser row was left behind with nothing
    pointing at it. Creating nothing that is not needed is the same rule as never
    updating what is already there.

    The stretch the number names wins, and the protocol attaches to it. The
    number is officially assigned and the name was typed.
    """
    besitzer = await konto(email="bergmann@ffs.de")

    erste = await ordne_zu(session, lies_umschlag(strecke(monitoringnummer="MS-4711")), besitzer)
    zweite = await ordne_zu(
        session,
        lies_umschlag(
            mit(
                probestrecke={
                    **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                    "monitoringnummer": "MS-4711",
                    "gewaesser": {"gewaessername": "Neckar", "vorfluter1": "Rhein"},
                }
            )
        ),
        besitzer,
    )

    assert erste.probestrecke_id == zweite.probestrecke_id
    assert zweite.gewaesser_id == erste.gewaesser_id
    assert await _zaehle(session, Gewaesser) == 1


async def test_die_drei_saetze_wissen_wann_sie_entstanden_sind(
    session: AsyncSession, konto: Callable[..., Awaitable[User]]
) -> None:
    """created_at comes from the database's own default, not from Python."""
    besitzer = await konto(email="bergmann@ffs.de")

    await ordne_zu(session, lies_umschlag(VOLLSTAENDIG), besitzer)

    assert (await session.scalars(select(Gewaesser))).one().created_at is not None
    assert (await session.scalars(select(Probestrecke))).one().created_at is not None
    assert (await session.scalars(select(Person))).one().created_at is not None
