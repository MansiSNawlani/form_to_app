"""Every model, imported here so that Base.metadata knows about all of them.

Alembic's autogeneration compares the live database against Base.metadata, and a
model that was never imported is not on it. The failure is a quiet one: rather
than erroring, autogenerate sees a table in the database that no model claims and
generates a migration dropping it. Importing every model in one place is what
makes that impossible.
"""

from app.models.anlage import Anlagenart, Attachment
from app.models.base import Base
from app.models.benutzer import Locale, Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission

__all__ = [
    "Anlagenart",
    "Attachment",
    "Base",
    "Gewaesser",
    "Locale",
    "Person",
    "Probestrecke",
    "Rolle",
    "Status",
    "Submission",
    "User",
]
