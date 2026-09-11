"""attachments

Creates the table an attachment's description lives in. The bytes themselves are
not here: they sit on a volume, found through storage_key, and
app/anlagen/speicher.py gives the reasoning. The short version is that twenty
photographs at 10 MB is 200 MB for one protocol, and a database carrying that is
one nobody can restore quickly.

Drafted by autogenerate and then edited by hand in the same one place the users
and submissions migrations needed editing. The art column came out as
app.models.typen.EnumText(), a reference to a Python class with no import to
resolve it and without the enum argument that says which enum it is, so it would
have failed with a NameError the first time it ran. It is plain text here
instead.

A migration must never import application code. It records what the database was
changed to on the day it ran, while the model keeps changing afterwards, so a
migration reaching into app/ starts failing the moment somebody renames a class it
mentions. The check constraint below is what actually restricts the column, and
it is spelled out for the same reason.

Revision ID: 7d3b7f21a552
Revises: bbc4ea98c881
Create Date: 2026-09-10 15:54:56.169498

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7d3b7f21a552"
down_revision: str | Sequence[str] | None = "bbc4ea98c881"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("submission_id", sa.Uuid(), nullable=False),
        # Text, not EnumText. See the note at the top of this file.
        sa.Column("art", sa.Text(), nullable=False),
        sa.Column("dateiname", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.Text(), nullable=False),
        sa.Column("groesse", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        # clock_timestamp() rather than the now() the other tables use. now() is
        # the moment the transaction started, so rows written together share a
        # timestamp and the list's ordering falls back to a random uuid. The
        # model has the reasoning in full.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ARRAY[art]::text[] <@ ARRAY['KARTENAUSSCHNITT', 'FOTO']::text[]",
            name=op.f("ck_attachments_art_bekannt"),
        ),
        # A file of no length is a failed upload rather than a picture.
        sa.CheckConstraint(
            "groesse > 0",
            name=op.f("ck_attachments_groesse_positiv"),
        ),
        # ON DELETE CASCADE, unlike submissions.owner_user_id, which has none on
        # purpose. A survey record has to outlive the person who filed it; a
        # photograph of a stretch means nothing without the protocol it belongs
        # to.
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["submissions.id"],
            name=op.f("fk_attachments_submission_id_submissions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attachments")),
        # Two rows can never claim the same file, which would make deleting
        # either of them break the other.
        sa.UniqueConstraint("storage_key", name=op.f("uq_attachments_storage_key")),
    )
    # Every query in app/anlagen/dienst.py reaches an attachment through its
    # protocol, so this index is the one the application actually uses rather
    # than a precaution.
    op.create_index(
        op.f("ix_attachments_submission_id"),
        "attachments",
        ["submission_id"],
        unique=False,
    )
    # The single map excerpt, as a fact about the data rather than a hope about
    # the order requests arrive in. app/anlagen/regeln.py counts what is there
    # and produces the message a surveyor reads; two requests arriving together
    # both count zero and both pass it. This is what makes the second one fail.
    #
    # Partial rather than a plain unique constraint over (submission_id, art),
    # which would also cap photographs at one.
    op.create_index(
        "uq_attachments_kartenausschnitt",
        "attachments",
        ["submission_id"],
        unique=True,
        postgresql_where=sa.text("art = 'KARTENAUSSCHNITT'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_attachments_kartenausschnitt",
        table_name="attachments",
        postgresql_where=sa.text("art = 'KARTENAUSSCHNITT'"),
    )
    op.drop_index(op.f("ix_attachments_submission_id"), table_name="attachments")
    op.drop_table("attachments")
