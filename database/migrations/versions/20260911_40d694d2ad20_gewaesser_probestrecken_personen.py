"""gewaesser, probestrecken, personen

The three tables a protocol points at once it is submitted: the water, the
stretch of it that was fished, and the Bearbeiter who fished it. Until now all
three existed only as text inside one submission's answers document, so two
surveys of the same stretch were two unrelated blobs and nothing could relate
them.

Drafted by autogenerate and then read line by line, as every migration in this
directory is. This one came through in better shape than the attachments
migration did: the check constraints were picked up and no column came out as a
reference to a Python class. What was changed by hand is the documentation, the
banner comments, and the quoting.

**The two partial indexes on probestrecken are the feature.** They are not
performance tuning. Each one states which rows the application considers to be
the same stretch, and the WHERE clauses are where the decision of 2026-09-11
lives:

- A stretch carrying a Monitoringstrecken-Nr. is identified by that number, which
  is officially assigned and stable. Partial, because most stretches have none
  and a plain unique constraint would then permit exactly one of them.
- A stretch without one is identified by its water and both boundary
  coordinates. Two ends on one water are the stretch.
- The two never cross. A protocol carrying a number does not attach to an
  identically placed stretch that has none: it gets its own row, and the
  protocols filed before the stretch was numbered stay where they were filed.
  Nothing already on record is rewritten.

Indexes rather than checks in Python, for the reason the single map excerpt is
guarded this way in the attachments migration: two submissions arriving together
both look, both find nothing, and both insert. Only the database can lose that
race on purpose.

Each table carries a created_at. project-overview.md's sketch of these three
entities gives them none, but every other table in this schema has one and a
record with no age is the odd one out. Added on 2026-09-11 by decision.

Revision ID: 40d694d2ad20
Revises: 7d3b7f21a552
Create Date: 2026-09-11 16:37:15.810545

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "40d694d2ad20"
down_revision: str | Sequence[str] | None = "7d3b7f21a552"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gewaesser",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("vorfluter", sa.ARRAY(sa.Text()), nullable=False),
        # Created empty in v1 so that feature 18 is a backfill and not a schema
        # change. Not unique: two rows sharing an identifier is precisely the
        # duplicate that backfill goes looking for.
        sa.Column("amtliche_id", sa.Text(), nullable=True),
        sa.Column("gis_dataset_version", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "array_position(vorfluter, NULL) IS NULL",
            name=op.f("ck_gewaesser_vorfluter_ohne_luecke"),
        ),
        sa.CheckConstraint(
            "cardinality(vorfluter) BETWEEN 1 AND 5",
            name=op.f("ck_gewaesser_vorfluter_laenge"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gewaesser")),
    )
    op.create_table(
        "personen",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("firma", sa.Text(), nullable=True),
        sa.Column("strasse", sa.Text(), nullable=True),
        sa.Column("plz", sa.Text(), nullable=True),
        sa.Column("ort", sa.Text(), nullable=True),
        sa.Column("telefon", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_personen_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_personen")),
    )
    op.create_index(op.f("ix_personen_user_id"), "personen", ["user_id"], unique=False)
    # Over the normalised address, not the stored one, so the index answers the
    # same question the lookup asks. lower() and btrim() are both immutable,
    # which is what makes them indexable.
    op.create_index(
        "uq_personen_email",
        "personen",
        [sa.literal_column("lower(btrim(email))")],
        unique=True,
    )
    op.create_table(
        "probestrecken",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gewaesser_id", sa.Uuid(), nullable=False),
        sa.Column("monitoringstrecke_nr", sa.Text(), nullable=True),
        sa.Column("ortsangabe", sa.Text(), nullable=False),
        sa.Column("gewaessertyp", sa.Integer(), nullable=False),
        sa.Column("laenge_m", sa.Integer(), nullable=False),
        # EPSG:25832, as plain integers. Nothing before feature 18 asks a spatial
        # question of them, and the match on them is integer equality.
        sa.Column("untere_grenze_rechtswert", sa.Integer(), nullable=False),
        sa.Column("untere_grenze_hochwert", sa.Integer(), nullable=False),
        sa.Column("obere_grenze_rechtswert", sa.Integer(), nullable=False),
        sa.Column("obere_grenze_hochwert", sa.Integer(), nullable=False),
        sa.Column("regierungspraesidium", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # The eight codes the field actually exports. 31 and 32 are absent on
        # purpose: the legacy form's JavaScript tests for them and the field
        # never produces them, which is defect 9.
        sa.CheckConstraint(
            "gewaessertyp IN (11, 12, 13, 14, 21, 26, 28, 29)",
            name=op.f("ck_probestrecken_gewaessertyp_bekannt"),
        ),
        sa.CheckConstraint("laenge_m > 0", name=op.f("ck_probestrecken_laenge_positiv")),
        sa.CheckConstraint(
            "regierungspraesidium IN (1, 2, 3, 4)",
            name=op.f("ck_probestrecken_regierungspraesidium_bekannt"),
        ),
        sa.ForeignKeyConstraint(
            ["gewaesser_id"],
            ["gewaesser.id"],
            name=op.f("fk_probestrecken_gewaesser_id_gewaesser"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_probestrecken")),
    )
    op.create_index(
        op.f("ix_probestrecken_gewaesser_id"),
        "probestrecken",
        ["gewaesser_id"],
        unique=False,
    )
    # Feature 13 scopes a regional account by this column, so it is indexed from
    # the day the column exists rather than when that feature notices.
    op.create_index(
        op.f("ix_probestrecken_regierungspraesidium"),
        "probestrecken",
        ["regierungspraesidium"],
        unique=False,
    )
    op.create_index(
        "uq_probestrecken_koordinaten",
        "probestrecken",
        [
            "gewaesser_id",
            "untere_grenze_rechtswert",
            "untere_grenze_hochwert",
            "obere_grenze_rechtswert",
            "obere_grenze_hochwert",
        ],
        unique=True,
        postgresql_where=sa.text("monitoringstrecke_nr IS NULL"),
    )
    op.create_index(
        "uq_probestrecken_monitoringstrecke_nr",
        "probestrecken",
        ["monitoringstrecke_nr"],
        unique=True,
        postgresql_where=sa.text("monitoringstrecke_nr IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_probestrecken_monitoringstrecke_nr",
        table_name="probestrecken",
        postgresql_where=sa.text("monitoringstrecke_nr IS NOT NULL"),
    )
    op.drop_index(
        "uq_probestrecken_koordinaten",
        table_name="probestrecken",
        postgresql_where=sa.text("monitoringstrecke_nr IS NULL"),
    )
    op.drop_index(op.f("ix_probestrecken_regierungspraesidium"), table_name="probestrecken")
    op.drop_index(op.f("ix_probestrecken_gewaesser_id"), table_name="probestrecken")
    op.drop_table("probestrecken")
    op.drop_index("uq_personen_email", table_name="personen")
    op.drop_index(op.f("ix_personen_user_id"), table_name="personen")
    op.drop_table("personen")
    op.drop_table("gewaesser")
