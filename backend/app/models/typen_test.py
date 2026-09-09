"""The shared column types, at the level that needs no database.

EnumText's behaviour against a real Postgres is proved in protokoll_test.py,
where both columns using it are read back in one session. What is here is the SQL
generator, because it builds a fragment by string concatenation and a wrong one
would reach a migration rather than a type error.
"""

from app.models.benutzer import Rolle
from app.models.protokoll import Status
from app.models.typen import als_sql_array


def test_baut_ein_sql_array_aus_einem_enum() -> None:
    assert als_sql_array(Status) == (
        "ARRAY['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_CHANGES',"
        " 'REJECTED', 'ACCEPTED', 'LOCKED']::text[]"
    )


def test_die_reihenfolge_ist_die_des_enums() -> None:
    """Not sorted.

    A constraint reads better in the order the enum declares, which for both of
    these is the order the domain thinks in: a submission's life from DRAFT to
    LOCKED, and the roles from the most common to the most specialised.
    """
    assert als_sql_array(Rolle).index("'SUBMITTER'") < als_sql_array(Rolle).index("'INTEGRATION'")
