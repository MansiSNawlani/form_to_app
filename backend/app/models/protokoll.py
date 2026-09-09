"""One Protokoll inside the application, with its workflow state.

CONTEXT.md separates the two words this file sits between. A Protokoll is the
survey document a person fills in; a Submission is the application's record of
one, together with the state it is in and who owns it. The table is named for the
record, the routes are named for the document.

ADR 0003 fixes the split inside the row. If the application queries, sorts or
authorises on a value it is a column; if it is only shown back to a human it
lives in the antworten document. That is why status and owner are columns while
the roughly 338 answers are one JSON value, and why the document is still
schema-validated on write, in app/protokolle/regeln.py.

**Most of the envelope is not here yet, and that is deliberate.**
project-overview.md also puts probestrecke_id, person_id, bearbeiter_name,
anlass, datum, uhrzeit, submitted_at and locked_at on this entity. Every one of
them describes a protocol that has been filled in and checked. A draft has none:
probestrecke_id would have to point at a Probestrecke row with no coordinates and
no water type, which the model says cannot exist. Feature 11 adds them in its own
migration, beside the tables they point at and the constraint that makes them
required the moment a submission leaves DRAFT.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.typen import EnumText, als_sql_array


class Status(StrEnum):
    """Where a submission is in its life, exactly as project-overview.md spells it.

    Feature 11 owns the transitions between these and the rules about who may
    make them. This feature only ever writes DRAFT; the rest are here because the
    column is the contract and inventing four of its values later would mean a
    migration for something already decided.
    """

    #: Being filled in. Only its owner can see or change it.
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    NEEDS_CHANGES = "NEEDS_CHANGES"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"
    #: Accepted and fixed. Only a transfer to FiaKa touches it after this.
    LOCKED = "LOCKED"


class Submission(Base):
    __tablename__ = "submissions"

    # Fetch the database-computed values back in the same statement that wrote
    # them, with RETURNING, rather than leaving them to be read later.
    #
    # updated_at is the one that needs it. It is set by onupdate below, so after a
    # save the value in Python is stale and SQLAlchemy marks it for reloading; the
    # save endpoint then answers with it, and reading it in an async request is a
    # lazy load with nowhere to run. The alternatives are an extra SELECT after
    # every automatic save, or an endpoint that cannot say when it saved.
    __mapper_args__ = {"eager_defaults": True}

    __table_args__ = (
        # <@ is "every element of the left array appears in the right one", used
        # here on a one element array so the constraint reads the same way as
        # users.rollen_bekannt and is written out of the enum for the same reason.
        CheckConstraint(
            text(f"ARRAY[status]::text[] <@ {als_sql_array(Status)}"), name="status_bekannt"
        ),
        # A version below one would mean a row that was never written, and a
        # bumped version is the only thing standing between two open tabs and
        # silently lost work.
        CheckConstraint(text("version >= 1"), name="version_positiv"),
        # jsonb_typeof rather than a Python-side check, because this is the
        # guarantee that survives a row written by hand in psql. The document's
        # contents are checked in app/protokolle/regeln.py, which can say
        # something useful about them; the database only insists it is an object
        # and not an array or a bare number.
        CheckConstraint(text("jsonb_typeof(antworten) = 'object'"), name="antworten_objekt"),
    )

    # Generated in Python rather than by the database, so an object has its id
    # before it is written. Same as User.id, and the same reason for version 4
    # over version 7: uuid7 only reached the standard library in Python 3.14 and
    # this project targets 3.12.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # The account that filed it. Every query in app/protokolle/dienst.py filters
    # on this, which is what keeps one surveyor's draft out of another's hands.
    #
    # No ON DELETE. Deleting an account would take its submissions with it, and a
    # survey record has to outlive the person who filed it; project-overview.md
    # deactivates accounts rather than deleting them for the same reason.
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), index=True
    )

    status: Mapped[Status] = mapped_column(
        EnumText(Status), server_default=Status.DRAFT.value
    )

    # e.g. "20260609". Never migrated: ADR 0004 freezes a submission to the
    # version it was filled in under, so an old protocol stays renderable exactly
    # as it was answered.
    form_version: Mapped[str] = mapped_column(Text)

    # The roughly 338 answers. JSONB rather than JSON so Postgres can index and
    # query inside it, which feature 12 needs to search the catch by species.
    antworten: Mapped[dict[str, str | dict[str, object]]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )

    # Raised by every save, and sent back with the draft so the next save can say
    # which version it was working from.
    #
    # A save replaces the whole answers document, so two tabs open on the same
    # protocol are two copies racing: the one that saves second overwrites
    # everything the first typed, with nothing on screen to say so. On a form
    # filled in over several sittings that is real lost work, and the attachment
    # store already records that the same protocol open twice is ordinary here.
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # onupdate as well as a default, so automatic saving moves it. Without that a
    # draft edited all afternoon would still claim it was last touched at the
    # moment it was created, and "Zuletzt bearbeitet" is a column on the list.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        # No answers. A repr ends up in logs and test failures, and a protocol's
        # contents are survey data that has no business in either.
        return f"<Submission {self.id} {self.status.value} v{self.version}>"
