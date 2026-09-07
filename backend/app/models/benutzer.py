"""The account somebody signs in with.

The table is `users` and its columns are the ones project-overview.md fixes.
Entity names there are English where the concept is generic and German where it
is domain specific, and the columns follow the same rule: `email` and `locale`
are ordinary programming vocabulary, `rollen` and `ist_aktiv` are the domain's.

Every rule below is written twice on purpose, once as a check constraint here and
once as a plain function the application calls. The constraint is the guarantee:
it holds even for a row written by hand in psql, or by a future bug. The function
is what produces a message a person can act on, because a constraint violation
reaches the user as a database error and says nothing useful.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    SmallInteger,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

from app.models.base import Base


class Rolle(StrEnum):
    """The six roles, exactly as project-overview.md spells them.

    A StrEnum rather than a plain Enum so a role is its own database value with
    no lookup table in between: Rolle.REVIEWER is the string "REVIEWER", which is
    what goes into the array and what comes back out of it.
    """

    SUBMITTER = "SUBMITTER"
    DATA_STEWARD = "DATA_STEWARD"
    REVIEWER = "REVIEWER"
    SUPER_ADMIN = "SUPER_ADMIN"
    REGIERUNGSPRAESIDIUM = "REGIERUNGSPRAESIDIUM"
    INTEGRATION = "INTEGRATION"


class Locale(StrEnum):
    """Which language the interface is shown in. English arrives with feature 17."""

    DE = "de"
    EN = "en"


class RollenArray(TypeDecorator[list[Rolle]]):
    """Stores the roles as a plain text array and hands them back as Rolle values.

    Without this the roles come back as bare strings, and every permission check
    in features 2b, 11, 12, 13 and 16 would compare against a string literal that
    nothing checks for typos. Fifteen lines here buys a type error at the point of
    the mistake instead of a permission check that quietly never matches.

    A text array rather than a native Postgres ENUM type: altering an ENUM cannot
    run inside a transaction and a value can effectively never be removed, while
    changing the constraint below is an ordinary migration.
    """

    impl = ARRAY(Text)
    # The type has no configuration of its own, so SQLAlchemy may reuse a cached
    # compiled statement across instances of it.
    cache_ok = True

    def process_bind_param(
        self, value: list[Rolle] | None, dialect: Dialect
    ) -> list[str] | None:
        if value is None:
            return None
        return [rolle.value for rolle in value]

    def process_result_value(
        self, value: list[str] | None, dialect: Dialect
    ) -> list[Rolle] | None:
        if value is None:
            return None
        return [Rolle(wert) for wert in value]


def _rollen_liste_sql() -> str:
    """The six roles as a SQL array literal, built from the enum itself.

    Written out of Rolle rather than typed again, so adding a seventh role cannot
    leave the constraint checking for six.
    """
    werte = ", ".join(f"'{rolle.value}'" for rolle in Rolle)
    return f"ARRAY[{werte}]::text[]"


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        # An account with no roles can do nothing at all, so it is a mistake
        # rather than a state worth supporting.
        CheckConstraint(text("cardinality(rollen) > 0"), name="rollen_nicht_leer"),
        # <@ is "every element of the left array appears in the right one".
        CheckConstraint(text(f"rollen <@ {_rollen_liste_sql()}"), name="rollen_bekannt"),
        CheckConstraint(
            text("regierungspraesidium IS NULL OR regierungspraesidium BETWEEN 1 AND 4"),
            name="regierungspraesidium_bereich",
        ),
        # The number and the regional role imply each other. A regional account
        # with no number would see every region, which is the opposite of what
        # the role is for; a number on any other account scopes nothing and is
        # just a wrong value waiting to be read by feature 13.
        CheckConstraint(
            text(
                "(regierungspraesidium IS NOT NULL)"
                f" = ('{Rolle.REGIERUNGSPRAESIDIUM.value}' = ANY(rollen))"
            ),
            name="regierungspraesidium_nur_regional",
        ),
        CheckConstraint(text("locale IN ('de', 'en')"), name="locale_bekannt"),
        # The unique index below is case sensitive, so on its own it would let
        # anna@ffs.de and Anna@ffs.de both exist and let one person hold two
        # accounts. normalisiere_email lower cases on the way in; this refuses
        # anything that did not go through it, which is what makes the plain
        # unique index mean what it appears to mean.
        CheckConstraint(text("email = lower(email)"), name="email_klein"),
    )

    # Generated in Python rather than by the database, so an object has its id
    # before it is written and nothing has to read it back. Version 4 rather than
    # version 7, which indexes better but only reached the standard library in
    # Python 3.14 while this project targets 3.12.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # The login identifier. Stored lower case by normalisiere_email, so this
    # plain unique index is enough to stop one person holding two accounts that
    # differ only in capitals.
    email: Mapped[str] = mapped_column(Text, unique=True)

    # Argon2id. Never logged, never printed, never returned by an API.
    password_hash: Mapped[str] = mapped_column(Text)

    rollen: Mapped[list[Rolle]] = mapped_column(RollenArray)

    # 1 to 4, and only on a REGIERUNGSPRAESIDIUM account. Feature 13 reads it to
    # decide which region an account may see.
    regierungspraesidium: Mapped[int | None] = mapped_column(SmallInteger, default=None)

    locale: Mapped[str] = mapped_column(Text, server_default=Locale.DE.value)

    # Feature 2b refuses a false one at sign in. Deactivating rather than
    # deleting, because a deleted account takes its submissions' owner with it.
    ist_aktiv: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # onupdate as well as a default. A server default fills this in once, on
    # insert, and then never touches it again, so without onupdate a row edited a
    # year later would still claim it was last changed on the day it was created.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        # Email and roles only. A repr ends up in logs and test failures, and the
        # hash must reach neither.
        return f"<User {self.email} {[rolle.value for rolle in self.rollen]}>"
