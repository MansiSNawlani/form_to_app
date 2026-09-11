"""Attaching a picture to a protocol, and listing what is attached.

Thin routes. Who may see what lives in app/anlagen/dienst.py, what may be
attached lives in app/anlagen/regeln.py, and where the bytes go lives in
app/anlagen/speicher.py, so what is left here is parsing, authorising and
answering.

Nested under the protocol, so the address reads the way the data is shaped and
ownership is one lookup rather than two rules that have to agree. Route paths are
German, following the decision of 2026-08-24 that already gives us
/api/v1/protokolle.

Every route here requires a session. A survey photograph is no more public than
the answers beside it.
"""

import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.dienst import (
    Hochgeladen,
    hole_anlage,
    lege_anlage_an,
    liste_anlagen,
    loesche_anlage,
)
from app.anlagen.fehler import AnlageNichtGefunden
from app.anlagen.speicher import BLOCKGROESSE, Anlagenspeicher, get_speicher
from app.api.abhaengigkeiten import AngemeldeterBenutzer
from app.api.schemas import AnlageAntwort, FehlerAntwort
from app.db import get_session
from app.models.anlage import Anlagenart

# The protocol is part of every address here. app/anlagen/dienst.py says why that
# is load-bearing rather than decorative.
router = APIRouter(prefix="/api/v1/protokolle/{protokoll_id}/anlagen", tags=["Anlagen"])

Speicher = Annotated[Anlagenspeicher, Depends(get_speicher)]

MIT_PROTOKOLL: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_404_NOT_FOUND: {"model": FehlerAntwort},
}

# An upload can additionally be refused for what it is (422), for how big it is
# (413), or because the protocol has no room and is not a draft any more (409).
BEIM_HOCHLADEN: dict[int | str, dict[str, Any]] = {
    **MIT_PROTOKOLL,
    status.HTTP_409_CONFLICT: {"model": FehlerAntwort},
    status.HTTP_413_CONTENT_TOO_LARGE: {"model": FehlerAntwort},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": FehlerAntwort},
}


async def _bloecke(datei: UploadFile) -> AsyncIterator[bytes]:
    """The upload, a block at a time, so nothing here holds a whole photograph."""
    while block := await datei.read(BLOCKGROESSE):
        yield block


@router.post("", status_code=status.HTTP_201_CREATED, responses=BEIM_HOCHLADEN)
async def hochladen(
    protokoll_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    speicher: Speicher,
    art: Annotated[Anlagenart, Form()],
    datei: Annotated[UploadFile, File()],
) -> AnlageAntwort:
    """Attach one picture to a protocol.

    One file per request, not a batch, even though the Fotos picker takes several
    at once. Feature 10 settled that in regeln.ts: files are fed through in turn
    so a pick of five against eighteen stores two and names the three that did
    not fit. A batch endpoint would have to decide that ordering all over again
    and would have to answer half-success in a shape nobody has designed.

    An unknown art is refused by FastAPI before this runs, since Anlagenart is an
    enum, and comes back through the one handler that answers a malformed request
    without quoting it back.

    **What bounds the request body is the reverse proxy, not this route.** The
    multipart body is already parsed by the time a handler runs, so the cap
    enforced while reading below bounds what is stored and what is held in
    memory, and the proxy in front of the service is where a refusal before
    anything is spooled belongs.
    """
    anlage = await lege_anlage_an(
        session,
        speicher,
        protokoll_id=protokoll_id,
        besitzer=benutzer,
        art=art,
        datei=Hochgeladen(
            # UploadFile.filename is None when a client sends no name at all.
            # Empty rather than invented: the refusal messages have a placeholder
            # for that, and making one up would name a file the person never had.
            dateiname=datei.filename or "",
            gemeldeter_typ=datei.content_type,
            bloecke=_bloecke(datei),
        ),
    )
    return AnlageAntwort.model_validate(anlage)


@router.get("", responses=MIT_PROTOKOLL)
async def liste(
    protokoll_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[AnlageAntwort]:
    """This protocol's attachments, oldest first, without their bytes.

    Metadata only. The section draws twenty headings and asks for the pictures
    one at a time, so a list carrying the files would be 200 MB spent on drawing
    a list.
    """
    anlagen = await liste_anlagen(session, protokoll_id=protokoll_id, besitzer=benutzer)
    return [AnlageAntwort.model_validate(anlage) for anlage in anlagen]


def _dateiname_header(dateiname: str) -> str:
    """A Content-Disposition that survives an umlaut and cannot forge a header.

    Two problems, one line. A header is Latin-1, so "Weißenau.jpg" cannot go in
    one directly; RFC 6266's filename* carries UTF-8 as percent-encoded bytes,
    which every current browser reads. And percent-encoding is also what stops a
    filename containing a newline or a quote from ending the header early and
    starting one of its own, which is a header injection with a picture attached.

    quote() with no safe characters is doing both jobs, and that is deliberate:
    one escape rather than an escape plus a separate blocklist that somebody has
    to keep in step.
    """
    return f"attachment; filename*=UTF-8''{quote(dateiname or 'anlage', safe='')}"


@router.get("/{anlage_id}/datei", responses=MIT_PROTOKOLL)
async def herunterladen(
    protokoll_id: uuid.UUID,
    anlage_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    speicher: Speicher,
) -> StreamingResponse:
    """The attachment's own bytes.

    **How this is served is a security decision, not a detail.** A picture here
    was uploaded by somebody, and it comes back from our own origin, where
    anything that executes can read the session cookie of whoever opened it.
    Three things stand between those facts:

    - The type comes from the stored column, which app/anlagen/regeln.py filled
      in from the file's own first bytes. Nothing the request claimed is repeated
      back.
    - `X-Content-Type-Options: nosniff` stops a browser deciding for itself that
      the file is really HTML, which some will otherwise do when the content
      looks like markup.
    - `Content-Disposition: attachment` means opening the address directly
      downloads rather than renders. A preview still works: an `<img>` ignores
      this header entirely, which is what lets the section show the picture while
      a curious click cannot run it.

    Streamed rather than read whole. The section shows up to twenty photographs
    and asks for each separately, so holding whole files would be 200 MB to draw
    one screen.
    """
    anlage = await hole_anlage(
        session, protokoll_id=protokoll_id, anlage_id=anlage_id, besitzer=benutzer
    )

    # Asked before the response starts, because once the first block has gone out
    # the status code has already been sent and a 404 is no longer sayable.
    # app/anlagen/speicher.py explains how a row can outlive its file.
    if not await speicher.existiert(anlage.storage_key):
        raise AnlageNichtGefunden(anlage.dateiname)

    return StreamingResponse(
        speicher.bloecke(anlage.storage_key),
        media_type=anlage.mime_type,
        headers={
            "Content-Length": str(anlage.groesse),
            "Content-Disposition": _dateiname_header(anlage.dateiname),
            "X-Content-Type-Options": "nosniff",
            # An attachment's bytes never change: replacing the map excerpt makes
            # a new row with a new id, so this address always answers with the
            # same file or with nothing. Worth saying, because a section showing
            # twenty photographs otherwise re-fetches all of them on every visit.
            # Private, because it is one account's survey.
            "Cache-Control": "private, max-age=31536000, immutable",
        },
    )


@router.delete(
    "/{anlage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**MIT_PROTOKOLL, status.HTTP_409_CONFLICT: {"model": FehlerAntwort}},
)
async def loeschen(
    protokoll_id: uuid.UUID,
    anlage_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    speicher: Speicher,
) -> None:
    """Remove one attachment.

    Drafts only, like every other change to a protocol. No confirmation here:
    asking twice is the screen's job, and an API needing a second call to mean it
    would be one more thing for a client to get wrong.
    """
    await loesche_anlage(
        session,
        speicher,
        protokoll_id=protokoll_id,
        anlage_id=anlage_id,
        besitzer=benutzer,
    )
