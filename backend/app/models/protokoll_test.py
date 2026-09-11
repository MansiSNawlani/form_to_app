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
from datetime import UTC, date, datetime, time

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.benutzer import Locale, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission


def entwurf(besitzer: User, **felder: object) -> Submission:
    vorgabe: dict[str, object] = {
        "id": uuid.uuid4(),
        "owner_user_id": besitzer.id,
        "form_version": formular().version,
        "antworten": {},
    }
    return Submission(**(vorgabe | felder))


async def _stelle(session: AsyncSession) -> uuid.UUID:
    """One Gewaesser and one Probestrecke on it, for a submission to point at."""
    gewaesser = Gewaesser(id=uuid.uuid4(), name="Schussen", vorfluter=["Bodensee", "Rhein"])
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
    session.add_all([gewaesser, strecke])
    await session.flush()
    return strecke.id


async def _person(session: AsyncSession) -> uuid.UUID:
    person = Person(id=uuid.uuid4(), name="Anna Weber", email="weber@ffs.de")
    session.add(person)
    await session.flush()
    return person.id


async def _umschlag(session: AsyncSession) -> dict[str, object]:
    """Everything a submission that has left DRAFT has to carry."""
    return {
        "probestrecke_id": await _stelle(session),
        "person_id": await _person(session),
        "bearbeiter_name": "Anna Weber",
        "anlass": "wrrl",
        "datum": date(2026, 6, 9),
        "uhrzeit": time(14, 30),
        "submitted_at": datetime.now(UTC),
    }


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
    session.add(entwurf(besitzer, status=Status.IN_REVIEW, **await _umschlag(session)))
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
    session.add(entwurf(besitzer, status=Status.ACCEPTED, **await _umschlag(session)))
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


# The envelope, added in feature 11b. Everything below is about the two check
# constraints rather than about any code path: these are the guarantees that
# still hold for a row written by hand, which is the whole reason this suite runs
# against real Postgres.


async def test_ein_entwurf_braucht_keinen_umschlag(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A draft is exactly the state in which none of the eight exists yet.

    This is why they are nullable columns guarded by a constraint rather than
    NOT NULL ones: probestrecke_id on a draft would have to point at a stretch
    with no coordinates and no water type, and that row cannot exist.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer))
    await session.commit()

    gespeichert = (await session.scalars(select(Submission))).one()

    assert gespeichert.probestrecke_id is None
    assert gespeichert.submitted_at is None
    assert gespeichert.locked_at is None


@pytest.mark.parametrize(
    "fehlend",
    [
        "probestrecke_id",
        "person_id",
        "bearbeiter_name",
        "anlass",
        "datum",
        "uhrzeit",
        "submitted_at",
    ],
)
async def test_abgegeben_ohne_umschlag_wird_abgewiesen(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    fehlend: str,
) -> None:
    """Nullable here means "not yet", never "optional".

    One parameter per column, because a constraint written over seven values at
    once is exactly the kind that can pass while silently ignoring one of them.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    umschlag = await _umschlag(session)
    umschlag[fehlend] = None
    session.add(entwurf(besitzer, status=Status.SUBMITTED, **umschlag))

    with pytest.raises(IntegrityError) as fehler:
        await session.commit()

    assert "ck_submissions_umschlag_bei_abgabe" in str(fehler.value)


async def test_abgegeben_mit_umschlag_wird_angenommen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The other half of the constraint: a complete envelope is let through."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    session.add(entwurf(besitzer, status=Status.SUBMITTED, **await _umschlag(session)))
    await session.commit()

    gespeichert = (await session.scalars(select(Submission))).one()

    assert gespeichert.status is Status.SUBMITTED
    assert gespeichert.datum == date(2026, 6, 9)
    assert gespeichert.uhrzeit == time(14, 30)


@pytest.mark.parametrize(
    ("status", "locked_at", "erlaubt"),
    [
        (Status.LOCKED, True, True),
        (Status.SUBMITTED, False, True),
        # Locked without the moment of locking, and the moment without the lock.
        # Both are the same fact half-recorded.
        (Status.LOCKED, False, False),
        (Status.SUBMITTED, True, False),
    ],
)
async def test_gesperrt_und_zeitpunkt_gehoeren_zusammen(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    status: Status,
    locked_at: bool,
    erlaubt: bool,
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")
    umschlag = await _umschlag(session)
    if locked_at:
        umschlag["locked_at"] = datetime.now(UTC)
    session.add(entwurf(besitzer, status=status, **umschlag))

    if erlaubt:
        await session.commit()
        assert (await session.scalars(select(Submission))).one().status is status
        return

    with pytest.raises(IntegrityError) as fehler:
        await session.commit()

    assert "ck_submissions_gesperrt_hat_zeitpunkt" in str(fehler.value)
