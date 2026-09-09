"""submissions

Creates the table a protocol lives in: the draft envelope as columns, and the
roughly 338 answers as one JSONB document, which is the split ADR 0003 fixes.

Drafted by autogenerate and then edited by hand in one place, the same place the
users migration needed editing.

The status column came out as app.models.typen.EnumText(), a reference to a
Python class with no import to make it resolve, and without the enum argument
that tells it which enum it is. It is written as plain text here instead. A
migration must never import application code: it records what the database was
changed to on the day it ran, while the model keeps changing afterwards, so a
migration reaching into app/ starts failing the moment somebody renames a class
it mentions. The check constraint below is what actually restricts the column,
and it is spelled out for the same reason.

Most of the submission envelope in project-overview.md is deliberately not here.
probestrecke_id, person_id, bearbeiter_name, anlass, datum, uhrzeit, submitted_at
and locked_at all describe a protocol that has been filled in and checked, and a
draft has none of them. Feature 11 adds them beside the tables they point at.

Revision ID: bbc4ea98c881
Revises: 41bf9d46235c
Create Date: 2026-09-09 13:58:21.393062

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "bbc4ea98c881"
down_revision: str | Sequence[str] | None = "41bf9d46235c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "submissions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_user_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.Text(), server_default="DRAFT", nullable=False),
        sa.Column("form_version", sa.Text(), nullable=False),
        sa.Column(
            "antworten",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ARRAY[status]::text[] <@ ARRAY['DRAFT', 'SUBMITTED', 'IN_REVIEW',"
            " 'NEEDS_CHANGES', 'REJECTED', 'ACCEPTED', 'LOCKED']::text[]",
            name=op.f("ck_submissions_status_bekannt"),
        ),
        sa.CheckConstraint(
            "version >= 1",
            name=op.f("ck_submissions_version_positiv"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(antworten) = 'object'",
            name=op.f("ck_submissions_antworten_objekt"),
        ),
        # No ON DELETE. Deleting an account would take its submissions with it,
        # and a survey record has to outlive the person who filed it.
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name=op.f("fk_submissions_owner_user_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_submissions")),
    )
    # Every query in app/protokolle/dienst.py filters on the owner, so this index
    # is the one the application actually uses rather than a precaution.
    op.create_index(
        op.f("ix_submissions_owner_user_id"),
        "submissions",
        ["owner_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_submissions_owner_user_id"), table_name="submissions")
    op.drop_table("submissions")
