"""A named body of water, and where it drains to.

CONTEXT.md is firm that a Gewässer is identified authoritatively by an identifier
from the state GIS dataset and never by name alone. That identifier is not here
yet: amtliche_id exists from v1 and stays empty until feature 18 backfills it,
which is the whole reason the column is created now rather than then. Until it
arrives, the name together with the Vorfluter chain is the best identity
available, and app/protokolle/zuordnung/ is where that is spelled out.

**Nothing in this table is ever updated.** A row is found or it is created. The
reasoning is in zuordnung/dienst.py and it is the rule that governs all three of
these tables: a protocol is an official record on its way to FiaKa, and anything
an accepted one points at has to be as fixed as the protocol itself.

No created_at, unlike every other table here. project-overview.md gives User,
Submission and Attachment timestamps and gives these three none, and a column
nothing reads is a promise the table would have to keep for no one.
"""

import uuid

from sqlalchemy import ARRAY, CheckConstraint, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

#: The legacy form's five Vorfluter boxes, which is what caps the chain.
MAX_VORFLUTER = 5


class Gewaesser(Base):
    # Singular, because the German is. "gewaessers" would be an invented plural
    # and "gewaessern" a dative, so the table is named the way the word is.
    __tablename__ = "gewaesser"

    __table_args__ = (
        # One to five. The upper bound is the legacy form's five boxes; the lower
        # is that a chain of nothing places the water nowhere, and
        # formregeln/vollstaendigkeit.py already requires the first link.
        CheckConstraint(
            text(f"cardinality(vorfluter) BETWEEN 1 AND {MAX_VORFLUTER}"),
            name="vorfluter_laenge",
        ),
        # A Postgres array may hold NULLs, and one in the middle of the chain
        # would be a gap that formregeln/vorfluter.py exists to reject. The rule
        # catches it with a message; this catches it in a row written by hand.
        CheckConstraint(
            text("array_position(vorfluter, NULL) IS NULL"), name="vorfluter_ohne_luecke"
        ),
    )

    # Generated in Python, as every id in this schema is, so a row has its id
    # before it is written.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # **Exactly as the surveyor typed it.** Defect 2 in docs/ffs-defect-list.md is
    # the legacy form lowercasing water body names, one of the three defects that
    # put wrong data into FiaKa. The matching compares loosely and stores
    # faithfully; nothing anywhere writes a normalised name into this column.
    #
    # Deliberately not unique, and not uniquely indexed together with vorfluter
    # either. The matching compares the normalised forms, so a plain index over
    # the stored spellings would guard a different question than the one the
    # lookup asks, and indexing the normalised form of a text array needs an
    # immutable helper function for the sake of a race between two submissions
    # naming the same new water in the same instant. Duplicates are an accepted
    # cost here; feature 18 is where merging them can be done correctly.
    name: Mapped[str] = mapped_column(Text)

    # The receiving-water chain, read downstream: this water flows into the
    # first, which flows into the second. It has to arrive at the Rhein or the
    # Donau, which formregeln/vorfluter.py enforces and this column does not:
    # that rule can name which link is wrong, and a check constraint cannot.
    #
    # An ordered array rather than five columns, because the order is the chain.
    vorfluter: Mapped[list[str]] = mapped_column(ARRAY(Text))

    # The authoritative GIS identifier. Created empty in v1 on purpose, so
    # feature 18 is a backfill script and not a schema change.
    #
    # Not unique. Two rows sharing an identifier is exactly the duplicate feature
    # 18 goes looking for, and a unique index would make the backfill fail
    # halfway through rather than find them.
    amtliche_id: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Which GIS dataset amtliche_id was read from. Empty until feature 18.
    gis_dataset_version: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Gewaesser {self.id} {self.name!r}>"
