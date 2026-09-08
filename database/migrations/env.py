"""How Alembic connects to the database and runs a migration.

Alembic imports this file every time it runs. Its one job is to hand the
migration scripts a live connection, or in offline mode a URL to print SQL
against.

Two things here are deliberate and worth knowing before changing them.

The database URL comes from the application's own settings, not from
alembic.ini. Settings already refuse to start on a missing or malformed URL, and
one source for the URL means the migrations can never be pointed at a different
database from the one the application uses.

The engine is created here rather than imported from app.db. That module's engine
is a long lived pool sized for a web service, and a migration is a script that
runs once and exits. NullPool below opens one connection and closes it, so the
command does not sit holding a pool open after its work is done.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.sql.schema import SchemaItem

from alembic import context
from app.config import get_settings

# Imported for its side effect as much as its value: app.models registers every
# model on this metadata, and autogenerate can only see a table that is on it.
# Importing the package rather than one model is what keeps that true as tables
# are added.
from app.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# What autogenerate compares the live database against.
target_metadata = Base.metadata

# Type changes are off by default, so widening a column in a model would
# otherwise produce an empty migration and a silent mismatch between the model
# and the database.
COMPARE_TYPE = True

# Tables PostGIS creates for itself. No model claims them, so without this filter
# autogenerate reads them as tables somebody forgot to delete and drafts a
# migration dropping them. spatial_ref_sys holds every coordinate system
# definition, including the EPSG:25832 that all of this project's coordinates are
# in, so dropping it would break feature 18 in a way that only shows up there.
#
# Seen for real while generating the users migration on 2026-09-07.
POSTGIS_TABELLEN = frozenset(
    {
        "spatial_ref_sys",
        "geography_columns",
        "geometry_columns",
        "raster_columns",
        "raster_overviews",
    }
)


def include_object(
    object: SchemaItem,
    name: str | None,
    type_: str,
    reflected: bool,
    compare_to: SchemaItem | None,
) -> bool:
    """Decides whether autogenerate considers a database object at all."""
    return not (type_ == "table" and name in POSTGIS_TABELLEN)


def database_url() -> str:
    """PostgresDsn is a URL object; SQLAlchemy and Alembic both want the string."""
    return str(get_settings().database_url)


def run_migrations_offline() -> None:
    """Print the SQL instead of running it, for `alembic upgrade head --sql`.

    Used where a database administrator applies the change by hand rather than
    letting a deploy connect. Nothing connects in this mode.
    """
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=COMPARE_TYPE,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=COMPARE_TYPE,
        include_object=include_object,
    )

    # Postgres can roll back a failed CREATE TABLE, unlike some databases, so a
    # migration that fails halfway leaves the schema exactly as it was rather
    # than half changed.
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(database_url(), poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        # The migration scripts are ordinary synchronous SQLAlchemy. run_sync
        # runs them against this async connection so they need no async syntax
        # of their own.
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
