"""Every move a protocol has made, and who made it.

project-overview.md calls this WorkflowEvent and fixes its columns. It is the
protocol's history: one row per status change, written in the same transaction as
the change itself, so a status that moved always has a record saying why and by
whom. The Verlauf panel in prototypes/pruefung-protokoll.html is this table
printed.

**Not the audit trail.** That is AuditEvent in feature 15, and it answers a
different question: who changed which answer. This one answers who moved the
protocol from one state to the next. Keeping them apart means the history a
reviewer reads is not buried under several hundred field-level edits.

**Nothing here is ever updated or deleted.** A history that can be rewritten is
not one. The only thing that removes a row is the protocol itself going, which
can only happen while it is still a draft.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.protokoll import Status
from app.models.typen import EnumText, als_sql_array


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    __table_args__ = (
        # Both statuses written out of the enum, the same way
        # submissions.status_bekannt is, so adding a state cannot leave a
        # constraint checking for the old set.
        CheckConstraint(
            text(f"von_status IS NULL OR ARRAY[von_status]::text[] <@ {als_sql_array(Status)}"),
            name="von_status_bekannt",
        ),
        CheckConstraint(
            text(f"ARRAY[nach_status]::text[] <@ {als_sql_array(Status)}"),
            name="nach_status_bekannt",
        ),
        # A move from a state to itself is not a move. It would print in the
        # Verlauf as a line saying nothing happened, and the only way to write one
        # is a bug in the caller.
        CheckConstraint(
            text("von_status IS NULL OR von_status <> nach_status"),
            name="uebergang_bewegt_sich",
        ),
        # **A Begruendung is either absent or is one.** The rules refuse a
        # rejection without a reason, and this is what stops a space bar from
        # being accepted as one at the level below them. Without it the surveyor
        # is told to correct something and shown an empty quotation.
        CheckConstraint(
            text("kommentar IS NULL OR btrim(kommentar) <> ''"),
            name="kommentar_nicht_leer",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # ON DELETE CASCADE, like attachments.submission_id and for the same reason:
    # the history of a protocol means nothing without the protocol. Only a draft
    # can be deleted, and a draft has at most no events, so in practice this
    # cascade guards a path nobody can currently take.
    #
    # Indexed because every read of this table is "the history of one protocol".
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )

    # No cascade, exactly as submissions.owner_user_id has none. A decision has to
    # outlive the account that made it: an accepted protocol whose reviewer has
    # since left FFS still needs to say who accepted it. Accounts are deactivated
    # rather than deleted for the same reason.
    actor_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))

    # Nullable, and it is the one column here that is. Every transition this
    # application writes knows the state it came from, so nothing fills this with
    # null today. It stays nullable because a row that arrives another way, a
    # backfill of the protocols submitted before this table existed, or an import
    # from FiaKa, genuinely does not know, and a made-up predecessor state would
    # be worse than an honest absence.
    von_status: Mapped[Status | None] = mapped_column(EnumText(Status), nullable=True)

    nach_status: Mapped[Status] = mapped_column(EnumText(Status))

    # The Begruendung, in the reviewer's own words. Required for a rejection and a
    # change request, which is a rule in app/protokolle/uebergang/regeln.py rather
    # than here, because a constraint cannot say which decisions need one without
    # repeating the whole table.
    #
    # The one piece of free text in this schema that is not the surveyor's. It is
    # shown to them unchanged, so it is stored unchanged.
    kommentar: Mapped[str | None] = mapped_column(Text, nullable=True)

    # clock_timestamp(), not now(), for the reason attachments.created_at gives:
    # now() is the moment the transaction began, so a submit and the event
    # recording it would share a timestamp to the microsecond, and two events
    # written in one test would be unorderable. The Verlauf is ordered by this
    # column, so it has to be the real moment of the insert.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )

    def __repr__(self) -> str:
        # No comment text. A repr ends up in logs and test failures, and a
        # reviewer's reasoning about somebody's work has no business in either.
        von = self.von_status.value if self.von_status else "-"
        return f"<WorkflowEvent {self.id} {von}->{self.nach_status.value}>"
