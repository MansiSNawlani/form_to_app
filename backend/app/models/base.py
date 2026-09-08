"""The single declarative base every model inherits from.

One base, not one per module. Alembic's autogeneration only sees tables
registered on the metadata it is given, so a second base would mean a table that
silently never appears in a migration.

The naming convention is the load-bearing part. Left to itself, Postgres invents
a name for every index and constraint, and a later migration cannot drop one
without somebody looking up whatever name it invented. Naming them from a
template means the name is derivable from the table and column, so a constraint
added today can be dropped by a migration written next year.
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# ix index, uq unique, ck check, fk foreign key, pk primary key.
NAMENSSCHEMA = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    # constraint_name rather than a column list, because a check constraint can
    # span several columns or none, so the columns do not identify it.
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMENSSCHEMA)
