"""What the attachments table itself guarantees, whatever the application does.

The same footing as app/models/protokoll_test.py. app/anlagen/regeln.py counts
what is already attached and produces the message a surveyor reads, and it is
also the check two requests arriving together walk straight past: both count
zero, both are allowed, both insert. What is tested here is the floor underneath
that, which still holds for a row written by hand in psql or by a bug in a
future feature.

The partial unique index is the reason this file exists. A stand-in database
without it would accept the second map excerpt, and the test would pass on
exactly the row the index exists to reject.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.anlage import Anlagenart, Attachment
from app.models.benutzer import User
from app.models.protokoll import Submission


def entwurf(besitzer: User) -> Submission:
    return Submission(
        id=uuid.uuid4(),
        owner_user_id=besitzer.id,
        form_version=formular().version,
        antworten={},
    )


def anlage(protokoll: Submission, **felder: object) -> Attachment:
    anlage_id = uuid.uuid4()
    vorgabe: dict[str, object] = {
        "id": anlage_id,
        "submission_id": protokoll.id,
        "art": Anlagenart.FOTO,
        "dateiname": "schussen.jpg",
        "mime_type": "image/jpeg",
        "groesse": 12_345,
        "storage_key": f"{protokoll.id}/{anlage_id}",
    }
    return Attachment(**(vorgabe | felder))


@pytest.fixture
async def protokoll(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> Submission:
    besitzer = await anlegen(email="bergmann@ffs.de")
    eintrag = entwurf(besitzer)
    session.add(eintrag)
    await session.commit()
    return eintrag


async def test_eine_anlage_bekommt_die_vorgaben(
    session: AsyncSession, protokoll: Submission
) -> None:
    session.add(anlage(protokoll))
    await session.commit()

    gespeichert = (await session.scalars(select(Attachment))).one()

    assert gespeichert.art is Anlagenart.FOTO
    assert gespeichert.created_at is not None


async def test_die_art_kommt_als_anlagenart_zurueck(
    session: AsyncSession, protokoll: Submission
) -> None:
    """Not as a bare string.

    This is what EnumText buys, exactly as it does for Status. A string coming
    back would compare false against every enum member with nothing failing
    loudly, and app/anlagen/regeln.py branches on this value to decide whether
    the cap is one or twenty.
    """
    session.add(anlage(protokoll, art=Anlagenart.KARTENAUSSCHNITT))
    await session.commit()

    gespeichert = (await session.scalars(select(Attachment))).one()

    assert gespeichert.art is Anlagenart.KARTENAUSSCHNITT


async def test_eine_unbekannte_art_wird_abgewiesen(
    session: AsyncSession, protokoll: Submission
) -> None:
    """Written as raw SQL, because the model's own type would not let this past."""
    with pytest.raises(IntegrityError):
        await session.execute(
            text(
                "INSERT INTO attachments"
                " (id, submission_id, art, dateiname, mime_type, groesse, storage_key)"
                " VALUES (:id, :protokoll, 'VIDEO', 'clip.mp4', 'video/mp4', 1, :key)"
            ),
            {"id": uuid.uuid4(), "protokoll": protokoll.id, "key": "a/b"},
        )


async def test_eine_leere_datei_wird_abgewiesen(
    session: AsyncSession, protokoll: Submission
) -> None:
    """Zero bytes is a failed upload, not a picture. No signature passes on nothing."""
    session.add(anlage(protokoll, groesse=0))

    with pytest.raises(IntegrityError):
        await session.commit()


async def test_zwei_fotos_sind_erlaubt(session: AsyncSession, protokoll: Submission) -> None:
    """The partial index must not cap photographs, which is what a plain unique
    constraint over (submission_id, art) would have done."""
    session.add(anlage(protokoll))
    session.add(anlage(protokoll))
    await session.commit()

    assert len((await session.scalars(select(Attachment))).all()) == 2


async def test_ein_zweiter_kartenausschnitt_wird_von_der_datenbank_abgewiesen(
    session: AsyncSession, protokoll: Submission
) -> None:
    """The one this file exists for.

    There is one stretch and one excerpt of it. The rule in app/anlagen/regeln.py
    gives the surveyor a sensible message; this is what holds when two uploads
    arrive at the same moment and each counts zero before either inserts.
    """
    session.add(anlage(protokoll, art=Anlagenart.KARTENAUSSCHNITT))
    await session.commit()

    session.add(anlage(protokoll, art=Anlagenart.KARTENAUSSCHNITT))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_jedes_protokoll_darf_seinen_eigenen_kartenausschnitt_haben(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The index is per protocol, not global. Two surveys both have a map."""
    besitzer = await anlegen(email="frey@ffs.de")
    erstes, zweites = entwurf(besitzer), entwurf(besitzer)
    session.add_all([erstes, zweites])
    await session.commit()

    session.add(anlage(erstes, art=Anlagenart.KARTENAUSSCHNITT))
    session.add(anlage(zweites, art=Anlagenart.KARTENAUSSCHNITT))
    await session.commit()

    assert len((await session.scalars(select(Attachment))).all()) == 2


async def test_zwei_zeilen_koennen_nicht_dieselbe_datei_beanspruchen(
    session: AsyncSession, protokoll: Submission
) -> None:
    """Deleting either of them would otherwise break the other."""
    session.add(anlage(protokoll, storage_key="geteilt/schluessel"))
    await session.commit()

    session.add(anlage(protokoll, storage_key="geteilt/schluessel"))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_eine_anlage_ohne_protokoll_kann_es_nicht_geben(
    session: AsyncSession,
) -> None:
    kein_protokoll = uuid.uuid4()
    anlage_id = uuid.uuid4()
    session.add(
        Attachment(
            id=anlage_id,
            submission_id=kein_protokoll,
            art=Anlagenart.FOTO,
            dateiname="schussen.jpg",
            mime_type="image/jpeg",
            groesse=12_345,
            storage_key=f"{kein_protokoll}/{anlage_id}",
        )
    )

    with pytest.raises((IntegrityError, DBAPIError)):
        await session.commit()


async def test_ein_geloeschtes_protokoll_nimmt_seine_anlagen_mit(
    session: AsyncSession, protokoll: Submission
) -> None:
    """ON DELETE CASCADE, unlike submissions.owner_user_id.

    The reasoning is opposite in the two cases: a survey record has to outlive
    the person who filed it, while a photograph of a stretch means nothing
    without the protocol it belongs to. app/anlagen/dienst.py still deletes these
    rows itself, because it has to remove the files at the same time; this is the
    guarantee that no other path leaves a row pointing at a protocol that is gone.
    """
    session.add(anlage(protokoll))
    await session.commit()

    await session.delete(protokoll)
    await session.commit()

    assert (await session.scalars(select(Attachment))).all() == []
