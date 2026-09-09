"""Column types shared by more than one model.

Kept apart from any one model so the second use of a type is an import rather
than a copy. The alternative is two nearly identical TypeDecorators drifting
apart, which is exactly the duplication coding-standards.md asks us not to leave
behind.
"""

from enum import StrEnum
from typing import TypeVar

from sqlalchemy import Text
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

E = TypeVar("E", bound=StrEnum)


class EnumText(TypeDecorator[E]):
    """Stores a StrEnum as plain text and hands it back as the enum.

    Without this the value comes back as a bare string, and every comparison
    against it is a string literal that nothing checks for typos. A permission
    check or a status transition that quietly never matches is a bad way to find
    out about a misspelling, and this turns it into a type error at the point of
    the mistake.

    Text rather than a native Postgres ENUM type. Altering an ENUM cannot run
    inside a transaction and a value can effectively never be removed from one,
    while changing the check constraint that guards this column is an ordinary
    migration. Same reasoning as RollenArray in benutzer.py.
    """

    impl = Text
    # The enum class is a constructor argument, so SQLAlchemy folds it into this
    # type's cache key and two EnumText columns over different enums cannot share
    # a compiled statement. models/typen_test.py proves that rather than trusting
    # it, because the failure would be silent and would hand back the wrong type.
    cache_ok = True

    def __init__(self, enum_typ: type[E]) -> None:
        self.enum_typ = enum_typ
        super().__init__()

    def process_bind_param(self, value: E | None, dialect: Dialect) -> str | None:
        return None if value is None else value.value

    def process_result_value(self, value: str | None, dialect: Dialect) -> E | None:
        return None if value is None else self.enum_typ(value)


def als_sql_array(enum_typ: type[StrEnum]) -> str:
    """An enum's values as a SQL text array literal, for a check constraint.

    Written out of the enum rather than typed again, so adding a value cannot
    leave a constraint checking for the old set.
    """
    werte = ", ".join(f"'{mitglied.value}'" for mitglied in enum_typ)
    return f"ARRAY[{werte}]::text[]"
