"""gewaessernetz

The two tables the official water body network is loaded into, feature 18b: one
row per loaded release, and one row per water in it. app/models/gewaessernetz.py
gives the reasoning for the shape.

Drafted by autogenerate and edited by hand in the two places earlier migrations
needed it. The art column came out as app.models.typen.EnumText(), which a
migration cannot import, so it is plain text and the check constraint does the
restricting. The geometry column came out as geoalchemy2.types.Geometry without
an import; it now imports GeoAlchemy2 itself, which is a library rather than
application code, so the rule against migrations reaching into app/ still holds.

**This is also the migration that switches PostGIS on.** Nothing before it used a
geometry type, so nothing asked for the extension, and the development database
only had it because the postgis/postgis image creates it in POSTGRES_DB on first
start. The test database pytest creates did not, and neither would a managed
database. IF NOT EXISTS makes it a no-op where the image already did it, and the
downgrade leaves it in place: removing an extension is a decision about the
whole database, not about these two tables.

The spatial index is created here explicitly and GeoAlchemy2 is told not to make
its own, so Alembic sees exactly one index and `alembic check` stays quiet.

Revision ID: 8f948c3df12b
Revises: 23a161edb386
Create Date: 2026-10-14 12:52:13.702173

"""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geometry

from alembic import op

revision: str = "8f948c3df12b"
down_revision: str | Sequence[str] | None = "23a161edb386"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "gewaessernetz_stand",
        sa.Column("stand", sa.Date(), nullable=False),
        sa.Column(
            "geladen_am",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("anzahl_fliessgewaesser", sa.Integer(), nullable=False),
        sa.Column("anzahl_stehende", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("stand", name=op.f("pk_gewaessernetz_stand")),
    )
    op.create_table(
        "gewaessernetz",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("stand", sa.Date(), nullable=False),
        sa.Column("art", sa.Text(), nullable=False),
        sa.Column("kennung", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("vorfluter_kennung", sa.Text(), nullable=True),
        sa.Column("vorfluter_name", sa.Text(), nullable=True),
        sa.Column(
            "geometrie",
            Geometry(geometry_type="GEOMETRY", srid=25832, spatial_index=False),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(art = 'FLIESSGEWAESSER' AND kennung ~ '^[0-9]{13}$')"
            " OR (art = 'STEHENDES_GEWAESSER' AND kennung ~ '^[0-9]+$')",
            name=op.f("ck_gewaessernetz_kennung_form"),
        ),
        sa.CheckConstraint(
            "ARRAY[art]::text[] <@ ARRAY['FLIESSGEWAESSER', 'STEHENDES_GEWAESSER']::text[]",
            name=op.f("ck_gewaessernetz_art_bekannt"),
        ),
        sa.CheckConstraint(
            "ST_NDims(geometrie) = 2 AND ("
            "(art = 'FLIESSGEWAESSER' AND GeometryType(geometrie) = 'MULTILINESTRING')"
            " OR (art = 'STEHENDES_GEWAESSER' AND GeometryType(geometrie) = 'MULTIPOLYGON'))",
            name=op.f("ck_gewaessernetz_geometrie_passt_zur_art"),
        ),
        sa.ForeignKeyConstraint(
            ["stand"],
            ["gewaessernetz_stand.stand"],
            name=op.f("fk_gewaessernetz_stand_gewaessernetz_stand"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_gewaessernetz")),
        sa.UniqueConstraint("stand", "art", "kennung", name="uq_gewaessernetz_kennung"),
    )
    op.create_index(
        "ix_gewaessernetz_geometrie",
        "gewaessernetz",
        ["geometrie"],
        unique=False,
        postgresql_using="gist",
    )


def downgrade() -> None:
    op.drop_index("ix_gewaessernetz_geometrie", table_name="gewaessernetz")
    op.drop_table("gewaessernetz")
    op.drop_table("gewaessernetz_stand")
