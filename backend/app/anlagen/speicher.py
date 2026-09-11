"""Where an attachment's bytes actually live.

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

File writing blocks, and this runs inside an async service, so every touch of
the disk goes through a worker thread. Without that, one upload stops every
other request on the process for as long as the write takes.
"""

import asyncio
import re
import shutil
import uuid
from collections.abc import AsyncIterable, AsyncIterator
from functools import lru_cache
from pathlib import Path

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
    genuine failure to write. Reaching it means a bug or an attempt to escape the
    storage directory, and neither should be answered by touching the disk.
    """


def anlagen_schluessel(submission_id: uuid.UUID, anlage_id: uuid.UUID) -> str:
    """Where this attachment's file goes, as a relative key.

    One directory per protocol, so deleting a protocol is one directory removal
    rather than a walk over rows that may already be gone.
    """
    return f"{submission_id}/{anlage_id}"


class Anlagenspeicher:
    """The attachment files under one root directory.

    A class rather than module functions because the root is configuration: the
    tests point it at a temporary directory, the container points it at a mounted
    volume, and a developer running uvicorn on the host points it at ./uploads.
    """

    def __init__(self, wurzel: Path) -> None:
        self.wurzel = wurzel

    def _pfad(self, schluessel: str) -> Path:
        if not SCHLUESSEL_MUSTER.fullmatch(schluessel):
            raise SchluesselUngueltig(f"Not a storage key: {schluessel!r}")
        return self.wurzel / schluessel

    async def schreibe(self, schluessel: str, bloecke: AsyncIterable[bytes]) -> int:
        """Write one file from a stream of blocks, and say how many bytes it held.

        A stream rather than a bytes object, because the caller is enforcing the
        size cap as it reads and has to be able to stop part way through. Reading
        the whole upload in first and checking afterwards would mean a client can
        send two gigabytes and have us hold every byte of it before we object.

        **Nothing is left behind if the stream fails.** The caller aborting past
        the cap, a disk filling up, a dropped connection: in each of those a
        partly written file would be a picture that opens as a grey band, so the
        half file is removed and the failure travels on to the caller.
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
        """The file's bytes, or nothing if there is no such file.

        Nothing rather than an exception, because a row pointing at a missing file
        is a state this design admits is possible, and the route above turns it
        into the same 404 as an unknown attachment. Raising would make it a 500,
        which says the server is broken when the honest answer is that the picture
        is gone.
        """
        pfad = self._pfad(schluessel)
        try:
            return await asyncio.to_thread(pfad.read_bytes)
        except FileNotFoundError:
            return None

    async def existiert(self, schluessel: str) -> bool:
        """Whether the file is actually there.

        Asked before a download starts streaming. Once the first block has gone
        out the status code has already been sent, so a missing file has to be
        found out about while a 404 is still possible to say.
        """
        return await asyncio.to_thread(self._pfad(schluessel).is_file)

    async def bloecke(self, schluessel: str) -> AsyncIterator[bytes]:
        """The file, a block at a time, for a response that streams.

        Not lies(). The section shows up to twenty photographs and asks for each
        one separately, so twenty requests each holding a whole 10 MB file is
        200 MB of memory to draw one screen. Streaming holds one block at a time
        instead.
        """
        pfad = self._pfad(schluessel)
        datei = await asyncio.to_thread(pfad.open, "rb")
        try:
            while block := await asyncio.to_thread(datei.read, BLOCKGROESSE):
                yield block
        finally:
            await asyncio.to_thread(datei.close)

    async def loesche(self, schluessel: str) -> None:
        """Remove one file. Quiet if it was not there.

        Deleting is the second half of removing an attachment and the row has
        usually gone already, so a missing file means the work is done rather than
        that something failed. Raising here would turn a successful delete into an
        error the surveyor cannot act on.
        """
        pfad = self._pfad(schluessel)
        await asyncio.to_thread(pfad.unlink, True)

    async def loesche_protokoll(self, submission_id: uuid.UUID) -> None:
        """Remove every file belonging to one protocol.

        One directory removal rather than a file at a time. Deleting a protocol
        cascades its attachment rows away in the same transaction, so walking the
        rows to find the files would be a race against the delete that removes
        them; the directory is named after the protocol precisely so it does not
        have to be.
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
    return Anlagenspeicher(get_settings().anlagen_verzeichnis)
