"""A real Postgres database for the tests that need one.

Why a real database rather than an in-memory stand-in. Everything the users
table guarantees is Postgres specific: a text array, five check constraints, a
unique index. SQLite has none of them, so a suite running against it would pass
happily on exactly the rows those constraints exist to reject, and the first time
anybody found out would be in production.

How it works, in order:

1. Once per run, a separate database called befischung_test is dropped if it is
   left over, created fresh, and migrated to head. Migrated rather than built
   from the models, so the migrations themselves are exercised: a hand edited
   migration that has drifted from its model fails here rather than on a server.
2. Each test gets a session inside a transaction that is rolled back afterwards,
   so it starts from empty tables without anything being created or dropped
   between tests. Rebuilding a database per test would make a suite slow enough
   that nobody runs it.
3. If no database is reachable, every test needing one skips with a message
   naming what to start, rather than failing. A developer without Docker running
   should see "not run here", not a wall of red.

The test database is deliberately not dropped at the end. A failed run leaves it
there to be looked at, and the drop at the start means the next run is clean
regardless of how this one ended.
"""

import asyncio
import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, make_url, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.models import Base

TESTDATENBANK = "befischung_test"

ALEMBIC_INI = Path(__file__).parent / "alembic.ini"

NICHT_ERREICHBAR = (
    "No database reachable at {host}. Start it with `docker compose up -d`"
    " from the repository root, then run the tests again."
)


def _test_url() -> URL:
    """The development URL with the database name swapped.

    Same host and credentials, a different database. A test that escapes its
    rollback must not be able to reach real rows.
    """
    return make_url(str(get_settings().database_url)).set(database=TESTDATENBANK)


def _verbindungstext(url: URL) -> str:
    """The URL as something that can actually connect.

    SQLAlchemy's str() replaces the password with "***", which is the right
    default for anything that might be logged and useless for connecting. Every
    place here that hands a URL to a driver has to go through this, and the
    failure when it does not is a password authentication error that looks like
    wrong credentials rather than a masked string.
    """
    return url.render_as_string(hide_password=False)


async def _erzeuge_datenbank(url: URL) -> None:
    """Drop and recreate the test database.

    Connects to the "postgres" maintenance database, because a session cannot
    drop the database it is currently connected to. AUTOCOMMIT because CREATE
    DATABASE and DROP DATABASE cannot run inside a transaction, which is also why
    this cannot be folded into an ordinary migration.
    """
    verwaltung = create_async_engine(
        _verbindungstext(url.set(database="postgres")), isolation_level="AUTOCOMMIT"
    )
    try:
        async with verwaltung.connect() as verbindung:
            # FORCE disconnects anything still attached, so a psql window left
            # open on the test database does not block the next run.
            await verbindung.execute(
                text(f'DROP DATABASE IF EXISTS "{TESTDATENBANK}" WITH (FORCE)')
            )
            await verbindung.execute(text(f'CREATE DATABASE "{TESTDATENBANK}"'))
    finally:
        await verwaltung.dispose()


def _migriere(url: URL) -> None:
    """Run every migration into the freshly created database.

    env.py reads the URL from the application's settings, which is the single
    source it is supposed to have, so pointing the migrations somewhere else
    means pointing that one source somewhere else for the duration.

    """
    vorher = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _verbindungstext(url)
    get_settings.cache_clear()
    try:
        command.upgrade(Config(str(ALEMBIC_INI)), "head")
    finally:
        if vorher is None:
            del os.environ["DATABASE_URL"]
        else:
            os.environ["DATABASE_URL"] = vorher
        get_settings.cache_clear()


@pytest.fixture(scope="session")
def testdatenbank() -> Iterator[URL]:
    """Creates and migrates the test database once, or skips everything.

    A synchronous fixture on purpose. Alembic's upgrade command calls
    asyncio.run() inside env.py, and asyncio.run() raises if there is already a
    loop running, so the migration cannot happen inside an async fixture.
    """
    url = _test_url()
    try:
        asyncio.run(_erzeuge_datenbank(url))
    except (SQLAlchemyError, OSError):
        pytest.skip(NICHT_ERREICHBAR.format(host=url.host))

    _migriere(url)
    yield url


@pytest_asyncio.fixture(scope="session")
async def engine(testdatenbank: URL) -> AsyncIterator[AsyncEngine]:
    """One engine for the whole run, against the test database."""
    motor = create_async_engine(_verbindungstext(testdatenbank))
    yield motor
    await motor.dispose()


@pytest_asyncio.fixture
async def verbindung(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """One connection per test, inside a transaction that is rolled back.

    Everything a test does goes through this connection, so nothing it writes
    survives it and tests cannot leak state into each other whatever order they
    run in.
    """
    async with engine.connect() as offen:
        transaktion = await offen.begin()
        try:
            yield offen
        finally:
            await transaktion.rollback()


@pytest_asyncio.fixture
async def session(verbindung: AsyncConnection) -> AsyncIterator[AsyncSession]:
    """A session whose writes are undone when the test ends.

    join_transaction_mode="create_savepoint" is what lets the code under test
    call commit() normally. Without it, the first commit would end the outer
    transaction and there would be nothing left to roll back.
    """
    fabrik = async_sessionmaker(bind=verbindung, join_transaction_mode="create_savepoint")
    async with fabrik() as sitzung:
        yield sitzung


async def _leere_tabellen(url: str) -> None:
    """Empty every table, through an engine of this call's own."""
    motor = create_async_engine(url, poolclass=NullPool)
    try:
        async with motor.begin() as verbindung:
            for tabelle in reversed(Base.metadata.sorted_tables):
                await verbindung.execute(tabelle.delete())
    finally:
        await motor.dispose()


@pytest.fixture
def eigenstaendige_sitzungen(testdatenbank: URL) -> Iterator[async_sessionmaker[AsyncSession]]:
    """A session factory for code that runs its own event loop.

    The command line is the case. It calls asyncio.run(), which raises if a loop
    is already running, so its tests have to be ordinary synchronous ones and
    cannot use the rolled-back connection above: that connection belongs to the
    session loop, and a connection belongs to the loop it was opened on.

    So this hands out real sessions on their own connections, and the table is
    emptied afterwards instead. NullPool because each asyncio.run() is a fresh
    loop, and a pooled connection kept from a previous one could not be reused.
    """
    motor = create_async_engine(_verbindungstext(testdatenbank), poolclass=NullPool)
    yield async_sessionmaker(motor)
    asyncio.run(_leere_tabellen(_verbindungstext(testdatenbank)))


@pytest.fixture
def gepoolte_sitzungen(testdatenbank: URL) -> Iterator[async_sessionmaker[AsyncSession]]:
    """Like eigenstaendige_sitzungen, but pooling connections the way production does.

    app/db.py keeps one long lived pool, so anything that opens and closes an
    event loop meets a connection belonging to a loop that is gone. The
    NullPool factory above cannot show that, which is exactly how it stayed
    hidden until the command was run by hand on 2026-09-07.
    """
    motor = create_async_engine(_verbindungstext(testdatenbank))
    yield async_sessionmaker(motor)

    # A fresh engine to clean up with. The one above has pooled connections
    # belonging to an event loop the command already closed, so reusing it here
    # would fail on the stale connection rather than on anything real.
    asyncio.run(_leere_tabellen(_verbindungstext(testdatenbank)))
