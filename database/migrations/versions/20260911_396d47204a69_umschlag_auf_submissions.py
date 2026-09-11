"""umschlag auf submissions

The eight columns a submitted protocol carries besides its answers: what it is
about, who surveyed, when, where, and when it was handed in and locked. The
previous migration created the tables the first two point at.

**Safe on a database that already holds drafts.** Every column is added nullable
and nothing is backfilled, because there is nothing to backfill: every existing
row is a DRAFT and a draft is precisely the state in which none of these values
exists yet. No existing row is touched or rewritten.

**Both check constraints below were written by hand.** Autogenerate did not
produce either of them, and did not complain either. Alembic does not compare
check constraints at all, which is the first of the three failure modes AGENTS.md
names when it says a generated migration is a draft. A run that trusted the
output would have created eight nullable columns and none of the rule that gives
them meaning, and every test would still have passed.

The rule is that nullable here means "not yet", not "optional":

- umschlag_bei_abgabe requires seven of the eight together the moment a
  submission is anything other than DRAFT. One constraint over the whole set
  rather than seven, because they genuinely arrive together at submit.
- gesperrt_hat_zeitpunkt makes LOCKED and locked_at the same fact, so neither can
  appear without the other.

Revision ID: 396d47204a69
Revises: 40d694d2ad20
Create Date: 2026-09-11 16:39:47.376040

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "396d47204a69"
down_revision: str | Sequence[str] | None = "40d694d2ad20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Spelled out rather than imported from app/models/protokoll.py. A migration
# records what the database was changed to on the day it ran, while the model
# keeps changing afterwards, so a migration reaching into app/ starts failing the
# moment somebody edits the class it borrowed from.
UMSCHLAG_BEI_ABGABE = (
    "status = 'DRAFT' OR ("
    "probestrecke_id IS NOT NULL"
    " AND person_id IS NOT NULL"
    " AND bearbeiter_name IS NOT NULL"
    " AND anlass IS NOT NULL"
    " AND datum IS NOT NULL"
    " AND uhrzeit IS NOT NULL"
    " AND submitted_at IS NOT NULL)"
)

GESPERRT_HAT_ZEITPUNKT = "(status = 'LOCKED') = (locked_at IS NOT NULL)"


def upgrade() -> None:
    op.add_column("submissions", sa.Column("probestrecke_id", sa.Uuid(), nullable=True))
    op.add_column("submissions", sa.Column("person_id", sa.Uuid(), nullable=True))
    op.add_column("submissions", sa.Column("bearbeiter_name", sa.Text(), nullable=True))
    op.add_column("submissions", sa.Column("anlass", sa.Text(), nullable=True))
    # A real date and a real time. The answers document holds them as the strings
    # the pickers produced, "2026-09-11" and "14:30"; these are the values feature
    # 12 sorts the review queue on.
    op.add_column("submissions", sa.Column("datum", sa.Date(), nullable=True))
    op.add_column("submissions", sa.Column("uhrzeit", sa.Time(), nullable=True))
    op.add_column(
        "submissions", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "submissions", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        op.f("ix_submissions_person_id"), "submissions", ["person_id"], unique=False
    )
    op.create_index(
        op.f("ix_submissions_probestrecke_id"),
        "submissions",
        ["probestrecke_id"],
        unique=False,
    )
    # No ON DELETE, matching owner_user_id on this table. A survey record has to
    # outlive everything it points at, and a stretch other protocols still
    # reference is not something anything deletes.
    op.create_foreign_key(
        op.f("fk_submissions_probestrecke_id_probestrecken"),
        "submissions",
        "probestrecken",
        ["probestrecke_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_submissions_person_id_personen"),
        "submissions",
        "personen",
        ["person_id"],
        ["id"],
    )
    op.create_check_constraint(
        "umschlag_bei_abgabe", "submissions", sa.text(UMSCHLAG_BEI_ABGABE)
    )
    op.create_check_constraint(
        "gesperrt_hat_zeitpunkt", "submissions", sa.text(GESPERRT_HAT_ZEITPUNKT)
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_submissions_gesperrt_hat_zeitpunkt"), "submissions", type_="check"
    )
    op.drop_constraint(
        op.f("ck_submissions_umschlag_bei_abgabe"), "submissions", type_="check"
    )
    op.drop_constraint(
        op.f("fk_submissions_person_id_personen"), "submissions", type_="foreignkey"
    )
    op.drop_constraint(
        op.f("fk_submissions_probestrecke_id_probestrecken"),
        "submissions",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_submissions_probestrecke_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_person_id"), table_name="submissions")
    op.drop_column("submissions", "locked_at")
    op.drop_column("submissions", "submitted_at")
    op.drop_column("submissions", "uhrzeit")
    op.drop_column("submissions", "datum")
    op.drop_column("submissions", "anlass")
    op.drop_column("submissions", "bearbeiter_name")
    op.drop_column("submissions", "person_id")
    op.drop_column("submissions", "probestrecke_id")
