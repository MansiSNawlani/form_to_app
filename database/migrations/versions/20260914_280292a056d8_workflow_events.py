"""workflow events

Creates the table that records every move a protocol makes: who moved it, from
which state to which, what they wrote, and when. Feature 11d writes the first
rows; app/models/workflow_event.py has the reasoning in full.

Drafted by autogenerate and then edited by hand in the same one place the users,
submissions and attachments migrations all needed editing. The two status columns
came out as app.models.typen.EnumText(), a reference to a Python class with no
import to resolve it and without the enum argument saying which enum it is, so it
would have failed with a NameError the first time it ran. They are plain text
here instead.

A migration must never import application code. It records what the database was
changed to on the day it ran, while the model keeps changing afterwards, so a
migration reaching into app/ starts failing the moment somebody renames a class it
mentions. The check constraints below are what actually restrict the two columns,
and they are spelled out for the same reason.

Revision ID: 280292a056d8
Revises: 396d47204a69
Create Date: 2026-09-14 11:07:09.214846

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "280292a056d8"
down_revision: str | Sequence[str] | None = "396d47204a69"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The seven states, spelled out rather than read from the enum. Written twice in
# the two constraints below because a migration is a record of one day's change
# and must not move when the enum does.
STATUS = (
    "ARRAY['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_CHANGES',"
    " 'REJECTED', 'ACCEPTED', 'LOCKED']::text[]"
)


def upgrade() -> None:
    op.create_table(
        "workflow_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        # Text, not EnumText. See the note at the top of this file.
        #
        # Nullable, and the only column here that is. Every transition the
        # application writes knows where it came from; a later backfill of the
        # protocols submitted before this table existed would not, and an
        # invented predecessor state is worse than an honest absence.
        sa.Column("von_status", sa.Text(), nullable=True),
        sa.Column("nach_status", sa.Text(), nullable=False),
        sa.Column("kommentar", sa.Text(), nullable=True),
        # clock_timestamp() rather than the now() the users and submissions
        # tables use, for the reason attachments.created_at gives: now() is the
        # moment the transaction began, so a status change and the event
        # recording it would carry the same timestamp to the microsecond. The
        # Verlauf is ordered by this column, so it has to be the real moment of
        # the insert.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            f"von_status IS NULL OR ARRAY[von_status]::text[] <@ {STATUS}",
            name=op.f("ck_workflow_events_von_status_bekannt"),
        ),
        sa.CheckConstraint(
            f"ARRAY[nach_status]::text[] <@ {STATUS}",
            name=op.f("ck_workflow_events_nach_status_bekannt"),
        ),
        # A move from a state to itself is not a move, and the only way to write
        # one is a bug in the caller.
        sa.CheckConstraint(
            "von_status IS NULL OR von_status <> nach_status",
            name=op.f("ck_workflow_events_uebergang_bewegt_sich"),
        ),
        # A Begruendung is either absent or is one. The rules refuse a rejection
        # without a reason; this is what stops a space bar standing in for one,
        # which would show the surveyor an empty quotation.
        sa.CheckConstraint(
            "kommentar IS NULL OR btrim(kommentar) <> ''",
            name=op.f("ck_workflow_events_kommentar_nicht_leer"),
        ),
        # No cascade, exactly as submissions.owner_user_id has none. An accepted
        # protocol whose reviewer has since left FFS still has to say who
        # accepted it.
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_workflow_events_actor_user_id_users"),
        ),
        # ON DELETE CASCADE, like attachments.submission_id: a protocol's history
        # means nothing without the protocol. Only a draft can be deleted, so in
        # practice this guards a path nobody can currently take.
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["submissions.id"],
            name=op.f("fk_workflow_events_submission_id_submissions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workflow_events")),
    )
    # Every read of this table is "the history of one protocol", so this index is
    # the one the application uses rather than a precaution.
    op.create_index(
        op.f("ix_workflow_events_submission_id"),
        "workflow_events",
        ["submission_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_workflow_events_submission_id"), table_name="workflow_events")
    op.drop_table("workflow_events")
