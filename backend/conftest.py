"""A real Postgres database for the tests that need one.

Why a real database rather than an in-memory stand-in. Everything the users
table guarantees is Postgres specific: a text array, six check constraints, a
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
from httpx import ASGITransport, AsyncClient
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
from app.db import get_session
from app.main import app
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


def _connection_string(url: URL) -> str:
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
    admin_engine = create_async_engine(
        _connection_string(url.set(database="postgres")), isolation_level="AUTOCOMMIT"
    )
    try:
        async with admin_engine.connect() as admin_connection:
            # FORCE disconnects anything still attached, so a psql window left
            # open on the test database does not block the next run.
            await admin_connection.execute(
                text(f'DROP DATABASE IF EXISTS "{TESTDATENBANK}" WITH (FORCE)')
            )
            await admin_connection.execute(text(f'CREATE DATABASE "{TESTDATENBANK}"'))
    finally:
        await admin_engine.dispose()


def _migriere(url: URL) -> None:
    """Run every migration into the freshly created database.

    env.py reads the URL from the application's settings, which is the single
    source it is supposed to have, so pointing the migrations somewhere else
    means pointing that one source somewhere else for the duration.

    """
    vorher = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = _connection_string(url)
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
    engine_ = create_async_engine(_connection_string(testdatenbank))
    yield engine_
    await engine_.dispose()


@pytest_asyncio.fixture
async def connection(engine: AsyncEngine) -> AsyncIterator[AsyncConnection]:
    """One connection per test, inside a transaction that is rolled back.

    Everything a test does goes through this connection, so nothing it writes
    survives it and tests cannot leak state into each other whatever order they
    run in.
    """
    async with engine.connect() as open_connection:
        transaction = await open_connection.begin()
        try:
            yield open_connection
        finally:
            await transaction.rollback()


@pytest_asyncio.fixture
async def session(connection: AsyncConnection) -> AsyncIterator[AsyncSession]:
    """A session whose writes are undone when the test ends.

    join_transaction_mode="create_savepoint" is what lets the code under test
    call commit() normally. Without it, the first commit would end the outer
    transaction and there would be nothing left to roll back.
    """
    factory = async_sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    async with factory() as open_session:
        yield open_session


async def _empty_tables(url: str) -> None:
    """Empty every table, through an engine of this call's own."""
    engine_ = create_async_engine(url, poolclass=NullPool)
    try:
        async with engine_.begin() as connection:
            for table in reversed(Base.metadata.sorted_tables):
                await connection.execute(table.delete())
    finally:
        await engine_.dispose()


@pytest.fixture
def eigene_sessions(testdatenbank: URL) -> Iterator[async_sessionmaker[AsyncSession]]:
    """A session factory for code that runs its own event loop.

    The command line is the case. It calls asyncio.run(), which raises if a loop
    is already running, so its tests have to be ordinary synchronous ones and
    cannot use the rolled-back connection above: that connection belongs to the
    session loop, and a connection belongs to the loop it was opened on.

    So this hands out real sessions on their own connections, and the table is
    emptied afterwards instead. NullPool because each asyncio.run() is a fresh
    loop, and a pooled connection kept from a previous one could not be reused.
    """
    engine_ = create_async_engine(_connection_string(testdatenbank), poolclass=NullPool)
    yield async_sessionmaker(engine_)
    asyncio.run(_empty_tables(_connection_string(testdatenbank)))


@pytest.fixture
def gepoolte_sessions(testdatenbank: URL) -> Iterator[async_sessionmaker[AsyncSession]]:
    """Like eigene_sessions, but pooling connections the way production does.

    app/db.py keeps one long lived pool, so anything that opens and closes an
    event loop meets a connection belonging to a loop that is gone. The
    NullPool factory above cannot show that, which is exactly how it stayed
    hidden until the command was run by hand on 2026-09-07.
    """
    engine_ = create_async_engine(_connection_string(testdatenbank))
    yield async_sessionmaker(engine_)

    # A fresh engine to clean up with. The one above has pooled connections
    # belonging to an event loop the command already closed, so reusing it here
    # would fail on the stale connection rather than on anything real.
    asyncio.run(_empty_tables(_connection_string(testdatenbank)))


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """The application, answering requests against the rolled-back test session.

    get_session is overridden rather than left alone so a route test writes into
    the same transaction the session fixture throws away afterwards. Without the
    override the routes would open their own connection through app/db.py, write
    for real, and leave rows behind for the next test to trip over.

    base_url is https because the session cookie is marked Secure. Over
    http://testserver httpx would accept the cookie and then never send it back,
    and every test of a signed-in request would fail for a reason that has nothing
    to do with what it is testing.
    """

    async def _test_session() -> AsyncIterator[AsyncSession]:
        yield session

    app.dependency_overrides[get_session] = _test_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://testserver"
        ) as offener_client:
            yield offener_client
    finally:
        app.dependency_overrides.clear()
