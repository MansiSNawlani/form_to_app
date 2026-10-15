"""The official water body network, as LUBW publishes it.

A reference dataset rather than anything a surveyor writes: LUBW's Amtliches
Digitales Wasserwirtschaftliches Gewaessernetz (AWGN), loaded one release at a
time by `befischung gewaessernetz laden`. Feature 18c searches it, 18d snaps a
point to it and 18e looks up identifiers in it. Nothing in the application ever
writes to these tables while it runs.

**Releases are kept side by side**, decided on 2026-10-14. An identifier stored on
a Gewaesser says which release it came from, in gis_dataset_version, and it has
to stay possible to look it up there after LUBW publishes the next one. Search
and snapping use the newest release.

The AWGN column names never reach this module. They stay in
app/gewaessernetz/lesen.py, so that if FFS answers docs/ffs-questions.md question
16 with a different dataset, that is a new reader and not a new table.
"""

import uuid
from datetime import date, datetime
from enum import StrEnum

from geoalchemy2 import Geometry, WKBElement
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.typen import EnumText, als_sql_array

#: ETRS89 / UTM zone 32N, the system of the legacy form and of AWGN itself.
SRID = 25832


class Netzart(StrEnum):
    # A flowing water is a line and is identified by its 13-digit
    # Gewaesserkennzahl; a standing water is an area and is identified by
    # LUBW's SEE_ID. The two kinds of number overlap, so the kind travels with
    # the identifier.
    FLIESSGEWAESSER = "FLIESSGEWAESSER"
    STEHENDES_GEWAESSER = "STEHENDES_GEWAESSER"


class GewaessernetzStand(Base):
    __tablename__ = "gewaessernetz_stand"

    # The release date LUBW gives, 2025-05-01 for the first one loaded. A date
    # rather than text so "the newest release" is an ORDER BY and not a parse.
    stand: Mapped[date] = mapped_column(Date, primary_key=True)

    geladen_am: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Recorded at load time so `befischung gewaessernetz liste` can show what a
    # release holds without counting a hundred megabytes of geometry.
    anzahl_fliessgewaesser: Mapped[int] = mapped_column(Integer)
    anzahl_stehende: Mapped[int] = mapped_column(Integer)

    def __repr__(self) -> str:
        return f"<GewaessernetzStand {self.stand}>"


class Gewaessernetz(Base):
    # Singular for the same reason gewaesser is: the German word is a mass noun.
    __tablename__ = "gewaessernetz"

    __table_args__ = (
        UniqueConstraint("stand", "art", "kennung", name="uq_gewaessernetz_kennung"),
        CheckConstraint(
            text(f"ARRAY[art]::text[] <@ {als_sql_array(Netzart)}"), name="art_bekannt"
        ),
        # The identifier is what ends up in Gewaesser.amtliche_id, so its shape is
        # held here and not only by the reader. A Gewaesserkennzahl read as a float
        # and written back through str() would be "2381333920000.0", which is
        # exactly the mistake this refuses.
        CheckConstraint(
            text(
                "(art = 'FLIESSGEWAESSER' AND kennung ~ '^[0-9]{13}$')"
                " OR (art = 'STEHENDES_GEWAESSER' AND kennung ~ '^[0-9]+$')"
            ),
            name="kennung_form",
        ),
        # A flowing water is a line and a standing one an area, always as a multi
        # geometry so one row is one water however many parts it has, and always in
        # two dimensions: AWGN's lines carry a measure that nothing here uses, and
        # GeometryType() names an M geometry differently, so this catches a loader
        # that forgot to drop it.
        CheckConstraint(
            text(
                "ST_NDims(geometrie) = 2 AND ("
                "(art = 'FLIESSGEWAESSER' AND GeometryType(geometrie) = 'MULTILINESTRING')"
                " OR (art = 'STEHENDES_GEWAESSER' AND GeometryType(geometrie) = 'MULTIPOLYGON'))"
            ),
            name="geometrie_passt_zur_art",
        ),
        # Declared here rather than left to GeoAlchemy2, which would otherwise
        # create one of its own that Alembic cannot see and `alembic check` would
        # then report as drift.
        Index("ix_gewaessernetz_geometrie", "geometrie", postgresql_using="gist"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Deleting a release takes its waters with it. Nothing deletes one yet, and a
    # release is only ever useful whole.
    stand: Mapped[date] = mapped_column(
        Date, ForeignKey("gewaessernetz_stand.stand", ondelete="CASCADE")
    )

    art: Mapped[Netzart] = mapped_column(EnumText(Netzart))

    #: The Gewaesserkennzahl or the SEE_ID. What 18c and 18e write to amtliche_id.
    kennung: Mapped[str] = mapped_column(Text)

    # Exactly as LUBW writes it, including the NN-xxx placeholders it uses for
    # most unnamed ponds. How to show those is 18c's question, not the loader's.
    name: Mapped[str] = mapped_column(Text)

    # The water this one flows into, for flowing waters. 18c may build the
    # Vorfluter chain from these.
    vorfluter_kennung: Mapped[str | None] = mapped_column(Text, nullable=True)
    vorfluter_name: Mapped[str | None] = mapped_column(Text, nullable=True)

    geometrie: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=SRID, spatial_index=False)
    )

    def __repr__(self) -> str:
        return f"<Gewaessernetz {self.stand} {self.art} {self.kennung} {self.name!r}>"
