"""The delimited stretch of water a Befischung covers.

A first-class entity by [ADR 0001](../../../docs/adr/0001-probestrecke-is-a-first-class-entity.md):
the same stretch surveyed in different years is one row here with several
submissions against it. That is what lets feature 12 ask for every survey of a
stretch and lets two years be compared at all.

**A row here is a place, not a survey.** Two protocols pointing at the same row
stay two entirely separate protocols, with their own answers, their own
Bearbeiter, their own Anlass and their own catch. Nothing about them is merged.
The only thing they share is the statement that they were carried out in the same
place.

**And a row is never updated.** Found or created, as with Gewaesser and Person.
A protocol arriving with a Monitoringstrecken-Nr. does not stamp that number onto
a stretch that has none, even at identical coordinates; it gets its own row. That
was decided on 2026-09-11, and the two indexes below are how the rule is enforced
rather than merely intended.
"""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# The eight codes the Gewässertyp field actually exports, out of CONTEXT.md.
# Deliberately without 31 and 32: the legacy form's JavaScript tests for them and
# the field never produces them, which is defect 9 in docs/ffs-defect-list.md.
GEWAESSERTYPEN = (11, 12, 13, 14, 21, 26, 28, 29)

#: The four Regierungspräsidien, matching the z.rp option list.
REGIERUNGSPRAESIDIEN = (1, 2, 3, 4)

# The four columns that fix a stretch in space when no official number does.
KOORDINATEN = (
    "untere_grenze_rechtswert",
    "untere_grenze_hochwert",
    "obere_grenze_rechtswert",
    "obere_grenze_hochwert",
)


def _als_sql_liste(werte: tuple[int, ...]) -> str:
    """The codes as a SQL IN list, written out of the tuple rather than retyped."""
    return ", ".join(str(wert) for wert in werte)


class Probestrecke(Base):
    __tablename__ = "probestrecken"

    __table_args__ = (
        CheckConstraint(
            text(f"gewaessertyp IN ({_als_sql_liste(GEWAESSERTYPEN)})"),
            name="gewaessertyp_bekannt",
        ),
        CheckConstraint(
            text(f"regierungspraesidium IN ({_als_sql_liste(REGIERUNGSPRAESIDIEN)})"),
            name="regierungspraesidium_bekannt",
        ),
        # A stretch of no length was not fished, and a negative one is a sign
        # error. No upper bound: how long a stretch may be is a judgement FFS
        # would have to make, and inventing one here would refuse real surveys.
        CheckConstraint(text("laenge_m > 0"), name="laenge_positiv"),
        # **The natural key, where there is one.**
        #
        # Only a monitoring programme assigns a Monitoringstrecken-Nr., so most
        # stretches have none and a plain unique constraint would allow exactly
        # one of them. Partial, so the uniqueness applies to the rows that have a
        # number and says nothing about the rest.
        Index(
            "uq_probestrecken_monitoringstrecke_nr",
            "monitoringstrecke_nr",
            unique=True,
            postgresql_where=text("monitoringstrecke_nr IS NOT NULL"),
        ),
        # **The key for everything else: the water plus both boundaries.**
        #
        # Two ends on one water are the stretch, so a second row with the same
        # four numbers would be the same place recorded twice.
        #
        # WHERE monitoringstrecke_nr IS NULL is not an implementation detail, it
        # is the decision: a numbered stretch and an unnumbered one never collide
        # even at identical coordinates, because the numbered one is a different
        # record and the unnumbered protocols stay where they were filed.
        #
        # An index rather than a check in Python, for the reason anlage.py gives
        # about the single map excerpt: two submissions arriving together both
        # look, both find nothing, and both insert. Only the database can lose
        # that race on purpose.
        Index(
            "uq_probestrecken_koordinaten",
            "gewaesser_id",
            *KOORDINATEN,
            unique=True,
            postgresql_where=text("monitoringstrecke_nr IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # No ON DELETE. A Gewässer with stretches on it is not something anything
    # deletes, and a cascade would make deleting one quietly take survey history
    # with it.
    gewaesser_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("gewaesser.id"), index=True
    )

    # Officially assigned and stable, which is why it outranks the coordinates as
    # an identity. Null for the great majority of stretches, which are ordinary
    # surveys belonging to no programme.
    monitoringstrecke_nr: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Where the stretch is, in words. Not part of any key: two people describe
    # the same place differently and both are right.
    ortsangabe: Mapped[str] = mapped_column(Text)

    # The code, not the label. 11 Graben, 12 Kanal, 13 Bach, 14 Fluss, 21 See,
    # 26 Teich, 28 angebundenes Altwasser, 29 abgeschnittenes Altwasser. Codes
    # below 20 plus 28 require the hydrology section; 21, 26 and 29 suppress it,
    # which formregeln/hydrologie.py owns.
    gewaessertyp: Mapped[int] = mapped_column(Integer)

    # Metres, along the water rather than between the endpoints. A stream
    # meanders, so this is genuinely more than the straight-line distance the
    # coordinates imply, which is why it is not derived from them and not part of
    # the key either.
    laenge_m: Mapped[int] = mapped_column(Integer)

    # EPSG:25832 (ETRS89 / UTM zone 32N), the system the legacy form uses.
    #
    # Plain integers, not PostGIS geometry. Nothing before feature 18 asks a
    # spatial question of them, and the equality these are matched on is an
    # integer comparison. Feature 18 is where a geometry column and the snapping
    # that needs it belong.
    #
    # No bounds check here even though formregeln/koordinaten.py has one. That
    # module says its numbers are still to be confirmed with FFS, and a check
    # constraint would turn confirming them into a migration.
    untere_grenze_rechtswert: Mapped[int] = mapped_column(Integer)
    untere_grenze_hochwert: Mapped[int] = mapped_column(Integer)
    obere_grenze_rechtswert: Mapped[int] = mapped_column(Integer)
    obere_grenze_hochwert: Mapped[int] = mapped_column(Integer)

    # 1 to 4, read from the z.rp answer. It lives on the stretch rather than on
    # the protocol because which authority is responsible is a fact about the
    # place, which is what lets feature 13 scope a regional account by joining
    # here instead of re-reading every protocol's answers.
    regierungspraesidium: Mapped[int] = mapped_column(Integer, index=True)

    def __repr__(self) -> str:
        kennung = self.monitoringstrecke_nr or "ohne Nr."
        return f"<Probestrecke {self.id} {kennung}>"
