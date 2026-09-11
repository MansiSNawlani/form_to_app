"""The Bearbeiter, held once per email address rather than once per protocol.

CONTEXT.md: the Bearbeiter is the person who carried out the Befischung and is
answerable for the Protokoll's contents, and is not necessarily the person
holding the account that files it. That is why this is its own table and not a
handful of columns on User.

**What this row is, and what it is not.** It is the identity behind an email
address. It is not a live address book. project-overview.md describes it as
contact details "held once and reused rather than repeated inside every
submission", and in practice they are repeated: the answers document has carried
bearbeiter.name, .firma, .telefon and the rest since feature 4a, so a protocol
always displays the details it was actually filed with. The row keeps whatever
was true the first time that address was seen, and filing a second protocol with
a new telephone number never rewrites it.

That was decided on 2026-09-11, when the first draft of feature 11b would have
refreshed the details on every submission. Refreshing writes to a row that
already-accepted protocols point at, and the rule across all three of these
tables is now that the matching reads or creates and never updates. Correcting a
stale row is a deliberate administrative action for a later feature.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Person(Base):
    __tablename__ = "personen"

    __table_args__ = (
        # **One row per address, enforced rather than hoped for.**
        #
        # app/protokolle/zuordnung/dienst.py looks a Person up by the normalised
        # address and inserts when it finds none. Two protocols submitted in the
        # same instant both find none, both insert, and the table quietly holds
        # the same Bearbeiter twice. A unique index is what makes the second
        # insert fail instead, which is the same argument the single map excerpt
        # is guarded by in anlage.py.
        #
        # Over the normalised form, not the stored one, so the index answers the
        # same question the lookup asks. Both lower() and btrim() are immutable,
        # which is what lets them be indexed at all; the equivalent for the
        # Vorfluter chain would need a helper function, and gewaesser.py records
        # why it goes without.
        Index("uq_personen_email", text("lower(btrim(email))"), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # Required, because formregeln/vollstaendigkeit.py requires bearbeiter.name
    # of a finished protocol. The five below carry no asterisk on the form and so
    # are nullable here; widening the gate in the database while the rules leave
    # it open would be two halves disagreeing about what a protocol needs.
    name: Mapped[str] = mapped_column(Text)

    # As typed. The same reasoning as Gewaesser.name: the address is compared
    # case-insensitively and stored exactly as the surveyor wrote it.
    email: Mapped[str] = mapped_column(Text)

    firma: Mapped[str | None] = mapped_column(Text, nullable=True)
    strasse: Mapped[str | None] = mapped_column(Text, nullable=True)
    plz: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Not on the legacy PDF, which has a street and a postcode and no town. Both
    # the mockup and project-overview.md's Person have one, and it is question 1
    # in docs/ffs-questions.md.
    ort: Mapped[str | None] = mapped_column(Text, nullable=True)
    telefon: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set when the Bearbeiter turns out to be the account that filed the
    # protocol, which is the common case for FFS staff and never the case for an
    # external consultant filing on somebody else's behalf.
    #
    # No ON DELETE, matching submissions.owner_user_id: a survey record has to
    # outlive the account that filed it, and accounts are deactivated rather than
    # deleted.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=True, index=True
    )

    # When this record first appeared. Not on project-overview.md's sketch for
    # this entity, added on 2026-09-11 because every other table here has one and
    # a record with no age is the odd one out. func.now() rather than the
    # clock_timestamp() attachments uses: nothing orders by this column, so rows
    # written in one transaction sharing a timestamp costs nothing.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        # The address, not the name. It is the identity this row is keyed on, and
        # it is already what a log line about an account shows.
        return f"<Person {self.id} {self.email}>"
