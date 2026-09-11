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

**The envelope arrived in feature 11b.** project-overview.md also puts
probestrecke_id, person_id, bearbeiter_name, anlass, datum, uhrzeit, submitted_at
and locked_at on this entity, and every one of them describes a protocol that has
been filled in and checked rather than one being written. A draft has none of
them, which is why all eight are nullable columns guarded by a check constraint
instead of required ones: probestrecke_id on a draft would have to point at a
Probestrecke row with no coordinates and no water type, and that row cannot
exist.

So nullability here does not mean optional. It means "not yet". The moment a
submission is anything but DRAFT the constraint below requires the lot, which is
the real rule and the reason the columns could not simply be declared NOT NULL.
"""

import uuid
from datetime import date, datetime, time
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    Time,
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
        # **What a protocol that has left DRAFT must carry.**
        #
        # The eight envelope columns are nullable so a draft can exist without
        # them, and this is what stops that nullability from meaning optional.
        # Written as one constraint over the whole set rather than seven, because
        # the rule is genuinely one rule: these arrive together, at submit, or
        # the row is not a submitted protocol.
        #
        # locked_at is not in the list. It is not part of being submitted, it is
        # part of being locked, and it has its own constraint below.
        CheckConstraint(
            text(
                "status = 'DRAFT' OR ("
                "probestrecke_id IS NOT NULL"
                " AND person_id IS NOT NULL"
                " AND bearbeiter_name IS NOT NULL"
                " AND anlass IS NOT NULL"
                " AND datum IS NOT NULL"
                " AND uhrzeit IS NOT NULL"
                " AND submitted_at IS NOT NULL)"
            ),
            name="umschlag_bei_abgabe",
        ),
        # Locked and the moment of locking are the same fact, so neither may
        # appear without the other. Feature 11d owns the transition that writes
        # them and may want to relax this if an unlock is ever added; there is no
        # unlock in the build plan today.
        CheckConstraint(
            text("(status = 'LOCKED') = (locked_at IS NOT NULL)"),
            name="gesperrt_hat_zeitpunkt",
        ),
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
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), index=True)

    status: Mapped[Status] = mapped_column(EnumText(Status), server_default=Status.DRAFT.value)

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

    # **The envelope.** Null while the protocol is a draft, required from the
    # moment it is not, which umschlag_bei_abgabe above enforces.
    #
    # These are promotions, not the only copy. Every one of them is also an
    # answer inside the antworten document, which is what keeps a protocol
    # displaying exactly what it was filed with even though the rows it points at
    # are shared. ADR 0003 is the rule being applied: a value the application
    # queries, sorts or authorises on is a column, and feature 12 sorts the
    # review queue on datum and filters it on anlass.

    # The place. Shared with every other protocol surveyed on the same stretch,
    # which is the entire point of ADR 0001 and the reason feature 12 can ask for
    # a stretch's history at all. app/protokolle/zuordnung/ decides which row
    # this points at, and never rewrites the row it lands on.
    probestrecke_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("probestrecken.id"), nullable=True, index=True
    )

    # The Bearbeiter, as an identity. Not the account that filed the protocol,
    # which is owner_user_id above and is often a different person entirely.
    person_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("personen.id"), nullable=True, index=True
    )

    # The Bearbeiter's name as it stood at submit, frozen. project-overview.md
    # asks for this explicitly so a historical record still reads correctly if
    # the Person row ever changes. It is belt and braces now that the matching
    # never updates a Person, and it stays because a later administrative feature
    # will correct these rows deliberately.
    bearbeiter_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The coded Anlass, e.g. "wrrl", not its label. Drives which fields were
    # mandatory, and feature 12 filters on it.
    anlass: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The day and time of the Befischung, as a real date and a real time rather
    # than the strings the answers document holds. created_at is when the draft
    # was started and updated_at when it was last touched; neither is when
    # somebody stood in the water.
    datum: Mapped[date | None] = mapped_column(Date, nullable=True)
    uhrzeit: Mapped[time | None] = mapped_column(Time, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # When it was handed in. Set once, by the transition feature 11d owns, and
    # not moved by a later resubmission after a change request: NEEDS_CHANGES
    # keeps the original hand-in, which is what a deadline is measured against.
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # When a reviewer accepted it and fixed it. Set in the same action as the
    # LOCKED status, which is what the reviewer mockup's button promises.
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
