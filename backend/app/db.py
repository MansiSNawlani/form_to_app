"""The single place a database connection is obtained.

Feature 2 builds its session dependency on this rather than creating a second
engine. Two engines would mean two connection pools competing for the same
Postgres connection limit.
"""

from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

# A readiness probe has to answer promptly. Without a connect timeout an
# unreachable host leaves the request hanging until the platform's own timeout
# fires, which looks like a hung service rather than an unready one.
CONNECT_TIMEOUT_SECONDS = 5.0


# Connection parameters that only libpq understands.
#
# `sslmode` is renamed, because asyncpg has the same setting under another name
# and takes the same values. `channel_binding` is dropped, because asyncpg has no
# equivalent to pass it to: it negotiates SCRAM channel binding itself over the
# TLS connection that `ssl` already asks for, so removing the parameter loses
# nothing that was being enforced.
#
# Both were found the same way, by pasting a real provider's connection string in
# and reading what the driver said. Expect the list to grow the first time a
# different provider is used.
UMBENANNT = {"sslmode": "ssl"}
VERWORFEN = frozenset({"channel_binding"})


def fuer_asyncpg(url: str) -> str:
    """Make a connection string copied from a provider's console usable by asyncpg.

    Every managed Postgres hands out a libpq connection string: it is what psql
    and psycopg read, so it is what the console shows and what somebody pastes
    into the deployment. Neon's ends in `?sslmode=require&channel_binding=require`.
    asyncpg understands neither spelling and refuses the whole connection on the
    first unknown keyword.

    Without this, a correct connection string fails with
    `connect() got an unexpected keyword argument 'sslmode'`, raised from inside
    the driver, naming nothing the reader controls and offering no way forward.
    They would then have to know which parts of their own connection string to
    delete, which is not knowledge a deployment should demand.

    Nothing is added and nothing is renamed that asyncpg already understands: an
    explicit `ssl`, a URL with no query at all, and every parameter outside the
    two sets above are passed through untouched.
    """
    geteilt = urlsplit(url)
    parameter = parse_qsl(geteilt.query, keep_blank_values=True)
    if not any(name in UMBENANNT or name in VERWORFEN for name, _ in parameter):
        return url

    behalten = [
        (UMBENANNT.get(name, name), wert)
        for name, wert in parameter
        if name not in VERWORFEN
    ]
    return urlunsplit(geteilt._replace(query=urlencode(behalten)))


def _create_engine() -> AsyncEngine:
    return create_async_engine(
        # PostgresDsn is a URL object; SQLAlchemy wants the string form.
        fuer_asyncpg(str(get_settings().database_url)),
        # Checks a pooled connection is still alive before handing it out.
        # Without it the first request after Postgres restarts fails, which on
        # this project would make readiness flap rather than recover.
        pool_pre_ping=True,
        connect_args={"timeout": CONNECT_TIMEOUT_SECONDS},
    )


# create_async_engine does not open a connection, it only prepares a lazy pool.
# That is what lets the process start with an unreachable database and report
# the problem through /api/v1/ready instead of dying at import.
engine: AsyncEngine = _create_engine()

session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding one session per request. Unused until
    feature 2, which is the first feature with tables to talk to."""
    async with session_factory() as session:
        yield session


async def database_is_reachable() -> bool:
    """Answers whether the database can serve a trivial query right now.

    A FastAPI dependency rather than a plain call, so the readiness route can be
    tested against both answers without a database being present.

    OSError is caught alongside SQLAlchemyError because DNS and socket failures
    do not always arrive wrapped as a SQLAlchemy error. For a readiness probe
    any failure to reach the database means the same thing, and an uncaught
    exception here would surface as a 500, which tells a platform the service is
    broken rather than merely unready.
    """
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        return False
    return True
