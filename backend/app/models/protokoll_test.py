"""What the submissions table itself guarantees, whatever the application does.

These check constraints are the reason the suite runs against real Postgres. A
stand-in with no check constraints would accept every row below, and the tests
would pass on exactly the data the constraints exist to reject.

Nothing here tests application logic; app/protokolle/ does that. This is the
floor underneath it, the part that still holds for a row written by hand in psql
or by a bug in a future feature.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.benutzer import Locale, User
from app.models.protokoll import Status, Submission


def entwurf(besitzer: User, **felder: object) -> Submission:
    vorgabe: dict[str, object] = {
        "id": uuid.uuid4(),
        "owner_user_id": besitzer.id,
        "form_version": formular().version,
        "antworten": {},
    }
    return Submission(**(vorgabe | felder))


async def test_ein_entwurf_bekommt_die_vorgaben(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A new row is a draft at version 1 with an empty document, from the
    database's own defaults rather than from anything Python set."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer))
    await session.commit()

    gespeichert = (await session.scalars(select(Submission))).one()

    assert gespeichert.status is Status.DRAFT
    assert gespeichert.version == 1
    assert gespeichert.antworten == {}
    assert gespeichert.created_at is not None
    assert gespeichert.updated_at is not None


async def test_der_status_kommt_als_status_zurueck(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Not as a bare string.

    This is what EnumText buys. Feature 11's state machine compares against
    Status members, and a string coming back would compare false against every
    one of them without anything failing loudly.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer, status=Status.IN_REVIEW))
    await session.commit()
    session.expunge_all()

    gespeichert = (await session.scalars(select(Submission))).one()

    assert gespeichert.status is Status.IN_REVIEW


async def test_zwei_enumtext_spalten_kommen_sich_nicht_ins_gehege(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """EnumText is used for both User.locale and Submission.status.

    It is cacheable, so SQLAlchemy may reuse a compiled statement across
    instances of it. If the enum class were left out of its cache key the two
    columns could share one, and a status would come back as a Locale or the
    other way round. That failure would be silent, so it is proved rather than
    assumed.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer, status=Status.ACCEPTED))
    await session.commit()
    session.expunge_all()

    geladen = (await session.scalars(select(User))).one()
    gespeichert = (await session.scalars(select(Submission))).one()

    assert geladen.locale is Locale.DE
    assert gespeichert.status is Status.ACCEPTED


async def test_eine_version_unter_eins_wird_abgewiesen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Version zero would mean a row that was never written.

    The bumped version is the only thing standing between two open tabs and
    silently lost work, so a value that cannot be compared against is refused.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer, version=0))

    with pytest.raises(IntegrityError) as fehler:
        await session.commit()

    assert "ck_submissions_version_positiv" in str(fehler.value)


@pytest.mark.parametrize(
    ("spalte", "wert", "constraint"),
    [
        # Not a status the workflow has. EnumText refuses to bind a bare string
        # at all, so the ORM cannot produce this row and only the constraint
        # underneath it stands between a hand written statement and a submission
        # in a state nothing knows how to move on from.
        ("status", "'ANGENOMMEN'", "ck_submissions_status_bekannt"),
        # A list is not a protocol. app/protokolle/regeln.py says the same thing
        # with a message somebody can act on; this is the guarantee under it.
        ("antworten", "'[]'::jsonb", "ck_submissions_antworten_objekt"),
    ],
)
async def test_weist_unmoegliche_zeilen_auch_ohne_orm_zurueck(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    spalte: str,
    wert: str,
    constraint: str,
) -> None:
    """Written as raw SQL on purpose.

    These are the rows the application cannot produce, which is exactly why the
    constraint is worth having: it still holds for a row written by hand in psql
    or by a bug in a feature nobody has written yet.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    with pytest.raises((IntegrityError, DBAPIError)) as fehler:
        await session.execute(
            text(
                f"INSERT INTO submissions (id, owner_user_id, form_version, {spalte})"
                f" VALUES (:id, :owner, :form_version, {wert})"
            ),
            {"id": uuid.uuid4(), "owner": besitzer.id, "form_version": "20260609"},
        )

    assert constraint in str(fehler.value)


async def test_ein_entwurf_braucht_ein_konto_das_es_gibt(session: AsyncSession) -> None:
    """The owner is a foreign key, so a submission cannot outlive into nowhere.

    Every query filters on this column, and a row pointing at an account that
    does not exist would be invisible to its owner and to everybody else.
    """
    session.add(
        Submission(
            id=uuid.uuid4(),
            owner_user_id=uuid.uuid4(),
            form_version=formular().version,
            antworten={},
        )
    )

    with pytest.raises(IntegrityError) as fehler:
        await session.commit()

    assert "fk_submissions_owner_user_id_users" in str(fehler.value)


async def test_das_dokument_ueberlebt_die_runde(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The nesting and the awkward keys come back exactly as they went in.

    arten.art1.0plus begins with a digit and the Bewirtschaftung group carries an
    umlaut. Both are legacy field paths that this project keeps exactly, so a
    round trip through JSONB has to leave them alone.
    """
    antworten = {
        "anlass": "wrrl_monitoring",
        "probestrecke": {"gewaesser": {"gewaessername": "Schussen"}},
        "arten": {"art1": {"name": "BFOR", "0plus": "4"}},
        "bewirschaftung": {"fischereiausübungsberechtigter": "Angelverein Langenargen"},
    }
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer, antworten=antworten))
    await session.commit()
    session.expunge_all()

    gespeichert = (await session.scalars(select(Submission))).one()

    assert gespeichert.antworten == antworten
