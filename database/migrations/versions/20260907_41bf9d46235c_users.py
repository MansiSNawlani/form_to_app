"""users

Creates the accounts table, the first real table in this database.

Drafted by autogenerate and then edited by hand in two places, both worth
knowing about.

The roles column came out as app.models.benutzer.RollenArray, a reference to a
Python class with no import to make it resolve. It is written as a plain text
array here instead. A migration must never import application code: it records
what the database was changed to on the day it ran, while the model keeps
changing after that, so a migration that reaches into app/ starts failing the
moment somebody renames a class it mentions.

Autogenerate also drafted a drop of spatial_ref_sys, PostGIS's own table of
coordinate system definitions, because no model claims it. That would have taken
EPSG:25832, which every coordinate on this project is in, with it. env.py now
filters PostGIS's tables out so the draft cannot contain it again.

Revision ID: 41bf9d46235c
Revises: b44c767a466e
Create Date: 2026-09-07 13:29:11.702254

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "41bf9d46235c"
down_revision: str | Sequence[str] | None = "b44c767a466e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("rollen", sa.ARRAY(sa.Text()), nullable=False),
        sa.Column("regierungspraesidium", sa.SmallInteger(), nullable=True),
        sa.Column("locale", sa.Text(), server_default="de", nullable=False),
        sa.Column("ist_aktiv", sa.Boolean(), server_default=sa.text("true"), nullable=False),
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
            "cardinality(rollen) > 0",
            name=op.f("ck_users_rollen_nicht_leer"),
        ),
        sa.CheckConstraint(
            "rollen <@ ARRAY['SUBMITTER', 'DATA_STEWARD', 'REVIEWER', 'SUPER_ADMIN',"
            " 'REGIERUNGSPRAESIDIUM', 'INTEGRATION']::text[]",
            name=op.f("ck_users_rollen_bekannt"),
        ),
        sa.CheckConstraint(
            "regierungspraesidium IS NULL OR regierungspraesidium BETWEEN 1 AND 4",
            name=op.f("ck_users_regierungspraesidium_bereich"),
        ),
        sa.CheckConstraint(
            "(regierungspraesidium IS NOT NULL) = ('REGIERUNGSPRAESIDIUM' = ANY(rollen))",
            name=op.f("ck_users_regierungspraesidium_nur_regional"),
        ),
        sa.CheckConstraint(
            "locale IN ('de', 'en')",
            name=op.f("ck_users_locale_bekannt"),
        ),
        sa.CheckConstraint(
            "email = lower(email)",
            name=op.f("ck_users_email_klein"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )


def downgrade() -> None:
    op.drop_table("users")
