"""What the service guarantees that a route cannot easily be made to show.

The routes are exercised in app/api/anlagen_test.py, which covers every refusal
and both permission rules. What is left here is the failure between the two
stores: the file lands first and the row second, so a row that does not land has
to take its file with it. Reaching that through HTTP would mean breaking the
database mid-request, so it is asked of the service directly.
"""

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, date, datetime, time

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.dienst import Hochgeladen, lege_anlage_an
from app.anlagen.speicher import Anlagenspeicher
from app.formular.felder import formular
from app.models.anlage import Anlagenart
from app.models.benutzer import User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 64


async def umschlag_fuer(session: AsyncSession) -> dict[str, object]:
    """The columns feature 11b requires of anything that is not a draft.

    Built here rather than taken from the shared conftest fixture, because that
    one is a fixture and this is wanted inside a test that has already had its
    protocol from another one.
    """
    gewaesser = Gewaesser(id=uuid.uuid4(), name="Schussen", vorfluter=["Rhein"])
    strecke = Probestrecke(
        id=uuid.uuid4(),
        gewaesser_id=gewaesser.id,
        ortsangabe="unterhalb der Bruecke",
        gewaessertyp=13,
        laenge_m=450,
        untere_grenze_rechtswert=512340,
        untere_grenze_hochwert=5398120,
        obere_grenze_rechtswert=512890,
        obere_grenze_hochwert=5398450,
        regierungspraesidium=4,
    )
    person = Person(id=uuid.uuid4(), name="Anna Weber", email="weber@ffs.de")
    session.add_all([gewaesser, strecke, person])
    await session.flush()

    return {
        "probestrecke_id": strecke.id,
        "person_id": person.id,
        "bearbeiter_name": "Anna Weber",
        "anlass": "wrrl",
        "datum": date(2026, 6, 9),
        "uhrzeit": time(14, 30),
        "submitted_at": datetime.now(UTC),
    }


async def bloecke(inhalt: bytes) -> AsyncIterator[bytes]:
    yield inhalt


def hochgeladen(inhalt: bytes = JPEG) -> Hochgeladen:
    return Hochgeladen(
        dateiname="schussen.jpg", gemeldeter_typ="image/jpeg", bloecke=bloecke(inhalt)
    )


@pytest.fixture
async def protokoll(session: AsyncSession, anlegen: Callable[..., Awaitable[User]]) -> Submission:
    besitzer = await anlegen(email="bergmann@ffs.de")
    eintrag = Submission(
        id=uuid.uuid4(),
        owner_user_id=besitzer.id,
        form_version=formular().version,
        antworten={},
    )
    session.add(eintrag)
    await session.commit()
    return eintrag


@pytest.fixture
def besitzer_von(session: AsyncSession) -> Callable[[Submission], Awaitable[User]]:
    async def _besitzer(protokoll: Submission) -> User:
        benutzer = await session.get(User, protokoll.owner_user_id)
        assert benutzer is not None
        return benutzer

    return _besitzer


async def test_eine_zeile_die_nicht_landet_nimmt_ihre_datei_mit(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    protokoll: Submission,
    besitzer_von: Callable[[Submission], Awaitable[User]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The file is written before the row, so a failed commit must undo it.

    Without this the volume keeps a picture that nothing will ever point at,
    show, or remove. The opposite order is worse, which is why it is this way
    round: a row pointing at a missing file shows a surveyor a broken image with
    no way back, while an orphaned file is invisible and costs only disk.
    """
    besitzer = await besitzer_von(protokoll)

    async def kaputtes_commit() -> None:
        raise SQLAlchemyError("die Verbindung ist weg")

    monkeypatch.setattr(session, "commit", kaputtes_commit)

    with pytest.raises(SQLAlchemyError):
        await lege_anlage_an(
            session,
            speicher,
            protokoll_id=protokoll.id,
            besitzer=besitzer,
            art=Anlagenart.FOTO,
            datei=hochgeladen(),
        )

    assert list(speicher.wurzel.rglob("*.*")) == []
    assert [pfad for pfad in speicher.wurzel.rglob("*") if pfad.is_file()] == []


async def test_der_speicherschluessel_kommt_aus_den_beiden_ids(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    protokoll: Submission,
    besitzer_von: Callable[[Submission], Awaitable[User]],
) -> None:
    """Never from the filename, which is what keeps a name from being a path."""
    besitzer = await besitzer_von(protokoll)

    anlage = await lege_anlage_an(
        session,
        speicher,
        protokoll_id=protokoll.id,
        besitzer=besitzer,
        art=Anlagenart.FOTO,
        datei=Hochgeladen(
            dateiname="../../boom.jpg",
            gemeldeter_typ="image/jpeg",
            bloecke=bloecke(JPEG),
        ),
    )

    assert anlage.storage_key == f"{protokoll.id}/{anlage.id}"
    # The name is kept exactly as picked, because that is what the surveyor will
    # look for on their own machine. It is data, and it never became a path.
    assert anlage.dateiname == "../../boom.jpg"
    assert (speicher.wurzel / str(protokoll.id) / str(anlage.id)).is_file()


async def test_ein_zurueckgegebenes_protokoll_nimmt_noch_fotos_an(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    protokoll: Submission,
    besitzer_von: Callable[[Submission], Awaitable[User]],
) -> None:
    """A change request often is "please add the photograph you left out".

    Attachments ask pruefe_aenderbar, the same question saving asks, so the day
    feature 11d let a returned protocol be edited they became changeable with it.
    This is that shared rule being held to, since nothing in this module mentions
    a status at all.
    """
    # The envelope first, then the status, and both before anything is written.
    # umschlag_bei_abgabe requires the whole envelope the moment a protocol is
    # not a draft, so a flush between the two halves fails on the constraint
    # rather than on anything this test is about.
    felder = await umschlag_fuer(session)
    for spalte, wert in felder.items():
        setattr(protokoll, spalte, wert)
    protokoll.status = Status.NEEDS_CHANGES
    await session.commit()

    anlage = await lege_anlage_an(
        session,
        speicher,
        protokoll_id=protokoll.id,
        besitzer=await besitzer_von(protokoll),
        art=Anlagenart.FOTO,
        datei=hochgeladen(),
    )

    assert anlage.id is not None
