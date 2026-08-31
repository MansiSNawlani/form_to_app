"""The single place a database connection is obtained.

Feature 2 builds its session dependency on this rather than creating a second
engine. Two engines would mean two connection pools competing for the same
Postgres connection limit.
"""

from collections.abc import AsyncIterator

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


def _create_engine() -> AsyncEngine:
    return create_async_engine(
        # PostgresDsn is a URL object; SQLAlchemy wants the string form.
        str(get_settings().database_url),
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
