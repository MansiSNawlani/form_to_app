"""What the workflow_events table guarantees, whatever the application does.

The same footing as app/models/protokoll_test.py and app/models/anlage_test.py.
app/protokolle/uebergang/regeln.py decides which moves are allowed and produces
the message a person reads; this is the floor underneath it, which still holds for
a row written by hand in psql or by a bug in a later feature.

The comment constraint is the reason this file exists. A rejection has to carry a
reason, and a reason made of spaces is not one: the surveyor would be told to
correct something and shown an empty quotation.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.models.workflow_event import WorkflowEvent


def ereignis(protokoll: Submission, akteur: User, **felder: object) -> WorkflowEvent:
    vorgabe: dict[str, object] = {
        "submission_id": protokoll.id,
        "actor_user_id": akteur.id,
        "von_status": Status.SUBMITTED,
        "nach_status": Status.NEEDS_CHANGES,
        "kommentar": "Bitte die Leitfaehigkeit nachtragen.",
    }
    return WorkflowEvent(**(vorgabe | felder))


@pytest.fixture
async def besitzer(anlegen: Callable[..., Awaitable[User]]) -> User:
    return await anlegen(email="bergmann@ffs.de")


@pytest.fixture
async def protokoll(session: AsyncSession, besitzer: User) -> Submission:
    eintrag = Submission(
        id=uuid.uuid4(),
        owner_user_id=besitzer.id,
        form_version=formular().version,
        antworten={},
    )
    session.add(eintrag)
    await session.commit()
    return eintrag


async def test_ein_ereignis_bekommt_die_vorgaben(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    session.add(ereignis(protokoll, besitzer))
    await session.commit()

    gespeichert = (await session.scalars(select(WorkflowEvent))).one()

    assert gespeichert.id is not None
    assert gespeichert.created_at is not None


async def test_die_status_kommen_als_status_zurueck(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """Not as bare strings.

    This is what EnumText buys, exactly as it does on Submission.status. A string
    coming back would compare false against every enum member with nothing
    failing loudly, and the Verlauf branches on these values to choose a wording.
    """
    session.add(ereignis(protokoll, besitzer))
    await session.commit()

    gespeichert = (await session.scalars(select(WorkflowEvent))).one()

    assert gespeichert.von_status is Status.SUBMITTED
    assert gespeichert.nach_status is Status.NEEDS_CHANGES


async def test_ein_ereignis_ohne_vorherigen_status_ist_erlaubt(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """Nothing writes one today. A later backfill or an import would."""
    session.add(ereignis(protokoll, besitzer, von_status=None, nach_status=Status.SUBMITTED))
    await session.commit()

    assert (await session.scalars(select(WorkflowEvent))).one().von_status is None


async def test_ein_unbekannter_status_wird_abgewiesen(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """Written as raw SQL, because the model's own type would not let this past."""
    with pytest.raises(IntegrityError):
        await session.execute(
            text(
                "INSERT INTO workflow_events"
                " (id, submission_id, actor_user_id, von_status, nach_status)"
                " VALUES (:id, :protokoll, :akteur, 'SUBMITTED', 'GENEHMIGT')"
            ),
            {"id": uuid.uuid4(), "protokoll": protokoll.id, "akteur": besitzer.id},
        )


async def test_ein_ereignis_das_sich_nicht_bewegt_wird_abgewiesen(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """A move from a state to itself is not a move, and would print as a line in
    the Verlauf saying nothing happened.

    Raw SQL again: the writer never builds one, so only the database can refuse it.
    """
    with pytest.raises(IntegrityError):
        await session.execute(
            text(
                "INSERT INTO workflow_events"
                " (id, submission_id, actor_user_id, von_status, nach_status)"
                " VALUES (:id, :protokoll, :akteur, 'SUBMITTED', 'SUBMITTED')"
            ),
            {"id": uuid.uuid4(), "protokoll": protokoll.id, "akteur": besitzer.id},
        )


async def test_ein_ereignis_ohne_kommentar_ist_erlaubt(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """Annehmen and In Pruefung nehmen need no reason. Only a refusal does."""
    session.add(ereignis(protokoll, besitzer, nach_status=Status.LOCKED, kommentar=None))
    await session.commit()

    assert (await session.scalars(select(WorkflowEvent))).one().kommentar is None


async def test_ein_kommentar_aus_leerzeichen_wird_abgewiesen(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """The one this file exists for.

    The rules refuse a rejection with no Begruendung and say so in words the
    reviewer can act on. This is what holds when the text is there and is nothing:
    the surveyor would otherwise be told to correct something and shown a blank
    quotation.
    """
    session.add(ereignis(protokoll, besitzer, kommentar="   "))

    with pytest.raises(IntegrityError):
        await session.commit()


async def test_ein_geloeschtes_protokoll_nimmt_seine_geschichte_mit(
    session: AsyncSession, protokoll: Submission, besitzer: User
) -> None:
    """ON DELETE CASCADE. A history without its protocol points at nothing.

    Only a draft can be deleted, so nothing in the application can reach this
    today; the cascade is what stops a later feature leaving orphans behind.
    """
    session.add(ereignis(protokoll, besitzer))
    await session.commit()

    await session.delete(protokoll)
    await session.commit()

    assert (await session.scalars(select(WorkflowEvent))).all() == []
