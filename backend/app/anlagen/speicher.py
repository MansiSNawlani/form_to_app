"""Where an attachment's bytes actually live.

**Two stores, one interface.** Anlagenspeicher below names what a store has to be
able to do; DateiSpeicher keeps those bytes in a directory, and S3Speicher keeps
them in an object store. Which one runs is configuration, because the answer
depends on the platform rather than on the code: a directory is right wherever
the service has a disk that outlives it, and there is no such disk on a platform
that throws its filesystem away between requests. Everything above this module
takes the interface and never a path.

The row in the database describes a photograph; this is the photograph. They are
kept apart because they are different sizes of problem: twenty pictures at 10 MB
is 200 MB for one protocol, and putting that in a Postgres column would make
every backup carry every photograph and pull a whole file through the ORM to
serve it. project-overview.md's Attachment already has a storage_key for exactly
this reason.

The cost of the split, accepted knowingly, is that a file and its row can drift
apart if a process dies between writing them. app/anlagen/dienst.py orders the
two writes so the drift is always the harmless direction: a file nobody points
at, never a row pointing at a picture that is not there. One is invisible and
costs disk; the other shows a surveyor a broken image with no way back.

**A storage key is built from ids we generated and from nothing in the request.**
Not the filename, not the declared type, not a header. A key assembled out of a
filename is how a name like "../../etc/passwd" turns into a path, and that whole
class of problem simply does not arise if the filename never reaches the path.
The name the surveyor picked is kept in a column, where it is data.
"""

import asyncio
import re
import shutil
import uuid
from collections.abc import AsyncIterable, AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.config import get_settings

# Big enough that a 10 MB photograph is forty hops between the event loop and a
# worker thread rather than hundreds, small enough that a refused upload is
# abandoned early rather than after buffering something large.
BLOCKGROESSE = 256 * 1024

# What a key is allowed to look like: two UUIDs and the separator between them.
# Every key this module makes matches it by construction, so this guards the case
# of one arriving from anywhere else. Checking the shape is worth more than
# checking for ".." because it accepts only what we know rather than refusing the
# tricks somebody thought of.
SCHLUESSEL_MUSTER = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


class SchluesselUngueltig(ValueError):
    """A storage key that this module did not produce.

    Its own type rather than a bare ValueError so a caller can tell it from a
    genuine failure to write. Reaching it means a bug or an attempt to reach
    outside our own keyspace, and neither should be answered by touching storage.
    """


def anlagen_schluessel(submission_id: uuid.UUID, anlage_id: uuid.UUID) -> str:
    """Where this attachment goes, as a store-independent key.

    The protocol id comes first so that everything belonging to one protocol
    shares a prefix. That is what lets a store delete a whole protocol in one
    move rather than walking rows that may already be gone, whether the prefix
    happens to be a directory or not.
    """
    return f"{submission_id}/{anlage_id}"


class Anlagenspeicher(Protocol):
    """What every attachment store has to be able to do.

    The contract, not an implementation. The rules stated below are load-bearing,
    each because breaking it loses or misreports survey evidence, and they live
    here so a second store inherits them rather than rediscovering them.
    """

    async def schreibe(self, schluessel: str, bloecke: AsyncIterable[bytes]) -> int:
        """Store one attachment from a stream of blocks, and say how many bytes it held.

        **A stream, and nothing kept on failure.** The caller enforces the size
        cap as it reads and has to be able to stop part way through, so a store
        may never read the whole upload in and check afterwards: that lets a
        client send two gigabytes and have us hold every byte before objecting.
        When the stream fails, whether the caller aborted past the cap, the
        connection dropped or the disk filled, nothing partial may be left
        behind. A half written file is a picture that opens as a grey band.
        """
        ...

    async def lies(self, schluessel: str) -> bytes | None:
        """The attachment's bytes, or None if there is no such object.

        **None rather than an exception.** A row pointing at a missing file is a
        state this design admits is possible, and the route above turns it into
        the same 404 as an unknown attachment. Raising would make it a 500, which
        says the server is broken when the honest answer is that the picture is
        gone.
        """
        ...

    async def existiert(self, schluessel: str) -> bool:
        """Whether the attachment is actually there.

        Asked before a download starts streaming. Once the first block has gone
        out the status code has already been sent, so a missing file has to be
        found out about while a 404 is still possible to say.
        """
        ...

    def bloecke(self, schluessel: str) -> AsyncIterator[bytes]:
        """The attachment, a block at a time, for a response that streams.

        Not lies(). The section shows up to twenty photographs and asks for each
        one separately, so twenty requests each holding a whole 10 MB file is
        200 MB of memory to draw one screen.
        """
        ...

    async def loesche(self, schluessel: str) -> None:
        """Remove one attachment. Quiet if it was not there.

        Deleting is the second half of removing an attachment and the row has
        usually gone already, so a missing object means the work is done rather
        than that something failed. Raising here would turn a successful delete
        into an error the surveyor cannot act on.
        """
        ...

    async def loesche_protokoll(self, submission_id: uuid.UUID) -> None:
        """Remove everything belonging to one protocol.

        Deleting a protocol cascades its attachment rows away in the same
        transaction, so walking the rows to find the files would be a race
        against the delete that removes them. The key is prefixed with the
        protocol precisely so it does not have to be.
        """
        ...


class DateiSpeicher:
    """Anlagenspeicher over a directory. The store for anywhere with a real disk.

    A class rather than module functions because the root is configuration: the
    tests point it at a temporary directory, the container points it at a mounted
    volume, and a developer running uvicorn on the host points it at ./uploads.

    File I/O blocks, and this runs inside an async service, so every touch of the
    disk goes through a worker thread. Without that, one upload stops every other
    request on the process for as long as the write takes.
    """

    def __init__(self, wurzel: Path) -> None:
        self.wurzel = wurzel

    def _pfad(self, schluessel: str) -> Path:
        if not SCHLUESSEL_MUSTER.fullmatch(schluessel):
            raise SchluesselUngueltig(f"Not a storage key: {schluessel!r}")
        return self.wurzel / schluessel

    async def schreibe(self, schluessel: str, bloecke: AsyncIterable[bytes]) -> int:
        """Write the blocks straight out to the file as they arrive.

        Nothing is buffered: the file itself is the buffer, so a 10 MB
        photograph never exists in memory. The half file is removed on the way
        past a failure, which is this store's half of the interface's promise
        that a refusal leaves nothing behind.
        """
        pfad = self._pfad(schluessel)
        await asyncio.to_thread(pfad.parent.mkdir, parents=True, exist_ok=True)

        geschrieben = 0
        try:
            with pfad.open("wb") as datei:
                async for block in bloecke:
                    await asyncio.to_thread(datei.write, block)
                    geschrieben += len(block)
        except BaseException:
            await self.loesche(schluessel)
            raise

        return geschrieben

    async def lies(self, schluessel: str) -> bytes | None:
        """FileNotFoundError is the missing object, and becomes None."""
        pfad = self._pfad(schluessel)
        try:
            return await asyncio.to_thread(pfad.read_bytes)
        except FileNotFoundError:
            return None

    async def existiert(self, schluessel: str) -> bool:
        """One stat call, which is cheaper than opening the file to find out."""
        return await asyncio.to_thread(self._pfad(schluessel).is_file)

    async def bloecke(self, schluessel: str) -> AsyncIterator[bytes]:
        """Read and yield a block at a time, closing the handle on any exit."""
        pfad = self._pfad(schluessel)
        datei = await asyncio.to_thread(pfad.open, "rb")
        try:
            while block := await asyncio.to_thread(datei.read, BLOCKGROESSE):
                yield block
        finally:
            await asyncio.to_thread(datei.close)

    async def loesche(self, schluessel: str) -> None:
        """unlink(missing_ok=True) is exactly the interface's quiet delete."""
        pfad = self._pfad(schluessel)
        await asyncio.to_thread(pfad.unlink, True)

    async def loesche_protokoll(self, submission_id: uuid.UUID) -> None:
        """One directory removal rather than a file at a time.

        The key's first segment is the protocol id, so on a filesystem the whole
        protocol is already one directory and this is a single rmtree.
        """
        verzeichnis = self.wurzel / str(submission_id)
        await asyncio.to_thread(shutil.rmtree, verzeichnis, True)


@lru_cache
def get_speicher() -> Anlagenspeicher:
    """The one store the running service uses, as a FastAPI dependency.

    Cached so the configuration is read once per process. A function rather than
    a module-level instance so the tests can override it with one pointing at a
    temporary directory, exactly as they override the database session.
    """
    return DateiSpeicher(get_settings().anlagen_verzeichnis)
