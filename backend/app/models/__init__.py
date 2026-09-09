"""Every model, imported here so that Base.metadata knows about all of them.

Alembic's autogeneration compares the live database against Base.metadata, and a
model that was never imported is not on it. The failure is a quiet one: rather
than erroring, autogenerate sees a table in the database that no model claims and
generates a migration dropping it. Importing every model in one place is what
makes that impossible.
"""

from app.models.base import Base
from app.models.benutzer import Locale, Rolle, User
from app.models.protokoll import Status, Submission

__all__ = ["Base", "Locale", "Rolle", "Status", "Submission", "User"]
