"""What the service guarantees that a route cannot easily be made to show.

The routes are exercised in app/api/anlagen_test.py, which covers every refusal
and both permission rules. What is left here is the failure between the two
stores: the file lands first and the row second, so a row that does not land has
to take its file with it. Reaching that through HTTP would mean breaking the
database mid-request, so it is asked of the service directly.
"""

import uuid
from collections.abc import AsyncIterator, Awaitable, Callable

import pytest
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.dienst import Hochgeladen, lege_anlage_an
from app.anlagen.speicher import Anlagenspeicher
from app.formular.felder import formular
from app.models.anlage import Anlagenart
from app.models.benutzer import User
from app.models.protokoll import Submission

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 64


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
