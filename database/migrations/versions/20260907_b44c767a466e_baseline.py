"""baseline

The first migration, and deliberately an empty one.

It exists so that setting Alembic up and creating the first table are two
separate, separately reviewable steps. Wiring the tool and changing the schema in
one go means a failure could be either, and this is the one step whose failure
mode is a database in a shape nothing agrees on.

Applying and reversing this proves the configuration works: that env.py finds the
database, that a revision is recorded, and that a downgrade cleans up after
itself. It creates the alembic_version table as a side effect, which is Alembic's
own bookkeeping of which migrations have run.

Revision ID: b44c767a466e
Revises:
Create Date: 2026-09-07 13:15:24.290087

"""

from collections.abc import Sequence

revision: str = "b44c767a466e"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
