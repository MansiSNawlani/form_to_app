"""What hangs off a protocol besides its answers.

The two kinds come straight from the legacy PDF, which carries five image buttons
rather than fields: one for the map excerpt and four for photographs. The four is
not inherited. Feature 10 recorded why: four is how many buttons fitted on the
printed page, not a statement about how many photographs a survey may have. The
one map excerpt is inherited, because that limit is about the thing rather than
about the page. There is one stretch and one excerpt of it.

The enum sits beside the table the way Status sits beside Submission, and it was
written first because app/anlagen/regeln.py guards this table before the table
exists.

**The row is not the picture.** The bytes live on a volume and this holds the
storage_key that finds them, which app/anlagen/speicher.py explains at length.
The short version: twenty photographs at 10 MB is 200 MB for one protocol, and a
database carrying that is a database nobody can restore quickly.
"""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.typen import EnumText, als_sql_array


class Anlagenart(StrEnum):
    """Which of the two an attachment is.

    The same two values frontend/src/protokoll/anlagen/typen.ts already uses, so
    the record travels from the browser to the column without being reshaped.
    """

    #: The map excerpt showing where the stretch is. At most one per protocol.
    KARTENAUSSCHNITT = "KARTENAUSSCHNITT"
    #: A photograph of the stretch. Up to twenty per protocol.
    FOTO = "FOTO"


class Attachment(Base):
    __tablename__ = "attachments"

    __table_args__ = (
        # Written out of the enum, the same way users.rollen_bekannt and
        # submissions.status_bekannt are, so adding a third kind cannot leave a
        # constraint checking for the old two.
        CheckConstraint(
            text(f"ARRAY[art]::text[] <@ {als_sql_array(Anlagenart)}"), name="art_bekannt"
        ),
        # A file of no length is a failed upload rather than a picture, and no
        # signature check can pass on nothing. Negative would mean a count that
        # went wrong somewhere.
        CheckConstraint(text("groesse > 0"), name="groesse_positiv"),
        # **The single map excerpt, as a fact about the data rather than a hope.**
        #
        # app/anlagen/regeln.py counts what is there and refuses a second one, and
        # that is the check the surveyor gets a sensible message from. It is also
        # a check two requests arriving together walk straight past: both count
        # zero, both are allowed, both insert. A partial unique index is what
        # makes the second one fail regardless of timing.
        #
        # Partial rather than a plain unique constraint over (submission_id, art),
        # because that would also cap photographs at one.
        Index(
            "uq_attachments_kartenausschnitt",
            "submission_id",
            unique=True,
            postgresql_where=text("art = 'KARTENAUSSCHNITT'"),
        ),
    )

    # Generated in Python rather than by the database, as Submission.id and
    # User.id are, so a row has its id before it is written. That matters more
    # here than elsewhere: the id is half the storage key, so the file cannot be
    # written until it exists.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)

    # ON DELETE CASCADE, unlike submissions.owner_user_id, which deliberately has
    # none. The reasoning is opposite in the two cases: a survey record has to
    # outlive the person who filed it, while a photograph of a stretch means
    # nothing without the protocol it belongs to.
    #
    # app/anlagen/dienst.py still deletes these rows explicitly, because it has to
    # remove the files in the same breath. The cascade is the guarantee that no
    # other path can leave a row pointing at a protocol that is gone.
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("submissions.id", ondelete="CASCADE"), index=True
    )

    art: Mapped[Anlagenart] = mapped_column(EnumText(Anlagenart))

    # Exactly as the surveyor picked it, umlauts, spaces and all. Data, never a
    # path: app/anlagen/speicher.py builds the key from ids and never from this,
    # which is what keeps a name like "../../etc/passwd" from being one.
    dateiname: Mapped[str] = mapped_column(Text)

    # What the bytes proved to be, never what the request claimed. This is the
    # type the file is served back as, so it has to be the trustworthy one.
    mime_type: Mapped[str] = mapped_column(Text)

    #: Bytes, as counted while the upload was read.
    groesse: Mapped[int] = mapped_column(Integer)

    # Where the file is, as "<submission_id>/<anlage_id>". Unique so two rows can
    # never claim the same file, which would make deleting either of them break
    # the other.
    #
    # It never leaves the server. A client has no use for a path, and a path a
    # client knows is a path a client will eventually try to bend.
    storage_key: Mapped[str] = mapped_column(Text, unique=True)

    # clock_timestamp(), not now(). The difference matters here and nowhere else
    # in this schema.
    #
    # now() is the moment the transaction started, so every row written in one
    # transaction carries the same timestamp to the microsecond. The list is
    # ordered by this column, and the tie-break is the id, which is a random
    # UUID: several files attached together would come back in a different order
    # every time the section was opened, which is exactly what ordering by age is
    # supposed to prevent. clock_timestamp() is the actual moment of the insert,
    # so the order is recoverable however the writes were grouped.
    #
    # It is also the more truthful answer to "when was this attached".
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.clock_timestamp()
    )

    # No updated_at. An attachment is not edited: replacing the map excerpt means
    # a new row and a new file, so a column recording a change that cannot happen
    # would be a promise the table does not keep.

    def __repr__(self) -> str:
        # No filename. A repr ends up in logs and test failures, and a picked
        # filename is the surveyor's, on the same footing as Submission.__repr__
        # keeping the answers out of its own.
        return f"<Attachment {self.id} {self.art.value} {self.groesse}B>"
