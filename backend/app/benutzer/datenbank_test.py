"""Proves the test database fixture itself, before anything relies on it.

Nothing here tests application code. These exist so that a later failure in a
database test can be read as "the code is wrong" rather than "maybe the fixture
never worked". The pair of write and empty tests is the important part: if the
rollback silently stopped happening, every later test would still pass while
quietly depending on the order it ran in.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import Rolle, User


def _konto(email: str) -> User:
    return User(id=uuid.uuid4(), email=email, password_hash="x", rollen=[Rolle.SUBMITTER])


async def test_die_migrationen_sind_gelaufen(session: AsyncSession) -> None:
    """The table exists, so the migrations ran rather than the models being
    created directly. A migration that has drifted from its model fails here."""
    assert await session.scalar(select(func.count()).select_from(User)) == 0


async def test_ein_test_darf_schreiben(session: AsyncSession) -> None:
    session.add(_konto("erster@ffs.de"))
    await session.commit()
    assert await session.scalar(select(func.count()).select_from(User)) == 1


async def test_der_naechste_test_sieht_nichts_davon(session: AsyncSession) -> None:
    """The rollback. If this ever fails, every database test below it has been
    depending on the order it happened to run in."""
    assert await session.scalar(select(func.count()).select_from(User)) == 0


async def test_die_pruefconstraints_gelten_auch_hier(session: AsyncSession) -> None:
    """The reason this is real Postgres and not a stand-in.

    A substitute with no check constraints would accept this row, and the suite
    would pass on exactly the data the constraints exist to reject.
    """
    session.add(User(id=uuid.uuid4(), email="leer@ffs.de", password_hash="x", rollen=[]))
    try:
        await session.commit()
    except IntegrityError as fehler:
        assert "ck_users_rollen_nicht_leer" in str(fehler)
    else:
        raise AssertionError("an account with no roles should have been rejected")
