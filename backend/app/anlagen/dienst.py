"""Attaching, listing, reading and removing a protocol's pictures.

The layer where the model, the rules and the two stores meet. The routes in
app/api/anlagen.py parse, authorise and delegate here, so everything below can be
tested against a transaction and a temporary directory rather than through HTTP.

**Ownership is never asked about here directly.** Every function reaches an
attachment through hole_protokoll, which already filters on the account asking,
so a stranger learns exactly what they learn about the protocol itself: nothing.
That is one rule in one place rather than a second copy of it that a later
feature could forget to keep in step. app/protokolle/dienst.py explains the
reasoning at length and it applies here without change.

**The two writes are ordered so that only the harmless failure can happen.** A
file and a row are not one transaction: a process can die between them. On the
way in the file lands first and the row second, so a crash leaves a file nobody
points at. On the way out the row goes first and the file second, so a crash
leaves the same thing. The other order would leave a row pointing at a picture
that is not there, which shows a surveyor a broken image with no way back. A file
with no row is invisible and costs disk, which is the cheaper of the two by a
wide margin.
"""

import uuid
from collections.abc import AsyncIterable, AsyncIterator
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.fehler import AnlageNichtGefunden
from app.anlagen.regeln import (
    KOPFGROESSE,
    pruefe_gemeldeten_typ,
    pruefe_groesse,
    pruefe_inhalt,
    pruefe_platz,
)
from app.anlagen.speicher import Anlagenspeicher, anlagen_schluessel
from app.models.anlage import Anlagenart, Attachment
from app.models.benutzer import User
from app.models.protokoll import Submission
from app.protokolle.dienst import beruehre, hole_protokoll
from app.protokolle.regeln import pruefe_aenderbar


@dataclass(frozen=True)
class Hochgeladen:
    """One picked file on its way in, described without any HTTP in it.

    A stream rather than the bytes, so nothing here ever holds a whole
    photograph. gemeldeter_typ is what the request claimed, which is a hint for a
    message and never a decision: what gets stored is what the bytes turn out to
    be.
    """

    dateiname: str
    gemeldeter_typ: str | None
    bloecke: AsyncIterable[bytes]


class _GepruefterStrom:
    """The upload's bytes, checked as they pass rather than after they arrive.

    Two things are being decided while the file streams past, and both have to
    happen before the whole of it exists anywhere:

    - **What it really is.** The first bytes say, so the head is collected until
      there is enough to judge, and a file that is not a picture we serve is
      refused before the rest of it is read.
    - **Whether it is too big.** Counted as it goes, so a refusal happens at the
      cap rather than after buffering whatever was sent.

    The refusal comes out of the iteration itself, which is what makes
    Anlagenspeicher.schreibe clean up the part file: it is already handling the
    case of a stream that stops badly.
    """

    def __init__(self, dateiname: str, quelle: AsyncIterable[bytes]) -> None:
        self._dateiname = dateiname
        self._quelle = quelle
        self._kopf = b""
        #: What the bytes proved to be. Set once the head is long enough to judge.
        self.typ: str | None = None
        #: How many bytes went past, which is what the row records.
        self.groesse = 0

    async def __aiter__(self) -> AsyncIterator[bytes]:
        async for block in self._quelle:
            if self.typ is None:
                self._kopf += block
                if len(self._kopf) >= KOPFGROESSE:
                    self.typ = pruefe_inhalt(self._dateiname, self._kopf)

            self.groesse += len(block)
            pruefe_groesse(self._dateiname, self.groesse)
            yield block

        # A file shorter than a signature never reached the check above. It is
        # judged on what there is, which for anything this small is a refusal:
        # no signature fits, and an empty upload is a failed one rather than a
        # picture.
        if self.typ is None:
            self.typ = pruefe_inhalt(self._dateiname, self._kopf)


async def _zaehle(session: AsyncSession, protokoll_id: uuid.UUID, art: Anlagenart) -> int:
    """How many of this kind the protocol already holds.

    Counted in the database rather than by loading the rows. Nothing here needs
    the rows, and the answer has to be about what is stored rather than about
    what some earlier request thought was stored.
    """
    return (
        await session.scalar(
            select(func.count())
            .select_from(Attachment)
            .where(Attachment.submission_id == protokoll_id, Attachment.art == art)
        )
        or 0
    )


async def lege_anlage_an(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    *,
    protokoll_id: uuid.UUID,
    besitzer: User,
    art: Anlagenart,
    datei: Hochgeladen,
) -> Attachment:
    """Attach one file to a protocol.

    The checks are in this order on purpose, and it is the order
    frontend/src/protokoll/anlagen/regeln.ts already uses:

    1. Whose protocol it is. A stranger learns nothing beyond "no such protocol".
    2. Whether it may still be changed at all.
    3. Whether there is room. Before anything about the file, because no amount
       of converting or shrinking a photograph makes room for it, and any other
       message sends somebody off to fix the wrong thing.
    4. What the request says the file is. The cheap check, and the one that can
       say "that is not a picture" in so many words.
    5. What the bytes say it is, and how big it turns out to be. Both while it
       streams past, so nothing large is ever held to be refused afterwards.

    Nothing is stored until all of them pass.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)
    pruefe_aenderbar(protokoll.status)
    pruefe_platz(datei.dateiname, art, await _zaehle(session, protokoll_id, art))
    pruefe_gemeldeten_typ(datei.dateiname, datei.gemeldeter_typ)

    # Both ids exist before anything is written, because the id is half the
    # storage key and the file cannot be put anywhere until it does.
    anlage_id = uuid.uuid4()
    schluessel = anlagen_schluessel(protokoll_id, anlage_id)

    strom = _GepruefterStrom(datei.dateiname, datei.bloecke)
    # Raises out of the write when a check fails, and schreibe removes the part
    # file on its way past. Nothing is left behind by a refusal.
    await speicher.schreibe(schluessel, strom)

    anlage = Attachment(
        id=anlage_id,
        submission_id=protokoll_id,
        art=art,
        dateiname=datei.dateiname,
        # What the bytes proved to be, never what the request claimed. This is
        # the type the file is later served as, so it has to be the trustworthy
        # one. _GepruefterStrom has set it or raised by now.
        mime_type=strom.typ or "",
        groesse=strom.groesse,
        storage_key=schluessel,
    )
    session.add(anlage)
    # Attaching a photograph is working on the protocol, so the list has to show
    # it as freshly edited. Nothing else here touches the protocol's own row.
    beruehre(protokoll)

    try:
        await session.commit()
    except BaseException:
        # The row did not land, so the file it describes must not stay. Without
        # this the volume keeps a picture nothing will ever point at or remove.
        await session.rollback()
        await speicher.loesche(schluessel)
        raise

    return anlage


async def liste_anlagen(
    session: AsyncSession, *, protokoll_id: uuid.UUID, besitzer: User
) -> list[Attachment]:
    """This protocol's attachments, oldest first.

    Oldest first so photographs keep the order they were added in rather than
    shuffling every time the section is reopened, which is what
    frontend/src/protokoll/anlagen/store.ts already does.

    The id breaks a tie on created_at. Several files picked in one go are written
    in the same transaction and carry the same timestamp to the microsecond, so
    without it their order is whatever the database felt like.
    """
    await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)

    treffer = await session.scalars(
        select(Attachment)
        .where(Attachment.submission_id == protokoll_id)
        .order_by(Attachment.created_at, Attachment.id)
    )
    return list(treffer)


async def _hole_beide(
    session: AsyncSession, *, protokoll_id: uuid.UUID, anlage_id: uuid.UUID, besitzer: User
) -> tuple[Submission, Attachment]:
    """The attachment and the protocol it hangs off, both belonging to this account.

    **The protocol is part of the address, not decoration.** An attachment that
    exists but belongs to a different protocol is not found here, or the ownership
    check would be guarding nothing: anybody could name their own protocol
    alongside somebody else's attachment id and be handed the file.

    Both come back because deleting needs the protocol's status as well, and
    fetching it twice would be two chances for the second one to be forgotten.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)

    treffer = await session.scalar(
        select(Attachment).where(
            Attachment.id == anlage_id,
            Attachment.submission_id == protokoll_id,
        )
    )
    if treffer is None:
        raise AnlageNichtGefunden()
    return protokoll, treffer


async def hole_anlage(
    session: AsyncSession, *, protokoll_id: uuid.UUID, anlage_id: uuid.UUID, besitzer: User
) -> Attachment:
    """One attachment of one protocol belonging to this account, or a refusal.

    No draft check. Looking at a picture is not changing it, and once feature 11
    lets a reviewer see a submitted protocol its attachments have to be readable
    for as long as the protocol is.
    """
    _, anlage = await _hole_beide(
        session, protokoll_id=protokoll_id, anlage_id=anlage_id, besitzer=besitzer
    )
    return anlage


async def loesche_anlage(
    session: AsyncSession,
    speicher: Anlagenspeicher,
    *,
    protokoll_id: uuid.UUID,
    anlage_id: uuid.UUID,
    besitzer: User,
) -> None:
    """Remove one attachment, and the file behind it.

    The row goes first and the file second, which is the reverse of attaching and
    the same principle: if the process dies between them the leftover is a file
    nobody points at, rather than a row pointing at a picture that is not there.

    Only on a draft. Once a protocol has been submitted its pictures are part of
    a record somebody else is working with, and taking one back is a workflow
    step for feature 11 rather than a delete.
    """
    protokoll, anlage = await _hole_beide(
        session, protokoll_id=protokoll_id, anlage_id=anlage_id, besitzer=besitzer
    )
    pruefe_aenderbar(protokoll.status)

    schluessel = anlage.storage_key
    await session.delete(anlage)
    beruehre(protokoll)
    await session.commit()

    # After the commit, deliberately. A file removed before the row was actually
    # gone would leave a surveyor looking at a preview that can never load.
    await speicher.loesche(schluessel)
