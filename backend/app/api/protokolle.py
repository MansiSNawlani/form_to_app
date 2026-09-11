"""Creating, reading, saving and deleting a protocol.

Thin routes. The rule about who may see what lives in app/protokolle/dienst.py
and the rule about what an answers document may hold lives in
app/protokolle/regeln.py, so what is left here is parsing, authorising and
answering.

Route paths are German, following the decision of 2026-08-24 that already gives
us /api/v1/anmeldung. The table is called submissions because that is the
entity's name in CONTEXT.md, and the route is called protokolle because that is
what the person using it is working on and what the page route /protokolle/:id
already says. A reader following one to the other finds the same word.

Every route here requires a session. There is no anonymous access to a protocol
of any kind, and there never will be: a draft is somebody's unfinished work and a
submitted one is survey data.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.speicher import Anlagenspeicher, get_speicher
from app.api.abhaengigkeiten import AngemeldeterBenutzer
from app.api.schemas import (
    AbsendenAnfrage,
    AbsendenAntwort,
    AntwortenSpeichern,
    FehlerAntwort,
    ProtokollAntwort,
    ProtokollUebersicht,
    SpeicherAntwort,
)
from app.db import get_session
from app.protokolle.absenden import sende_ab
from app.protokolle.dienst import (
    hole_protokoll,
    lege_entwurf_an,
    liste_protokolle,
    loesche_protokoll,
    speichere_antworten,
)

router = APIRouter(prefix="/api/v1/protokolle", tags=["Protokolle"])

# Documented on the routes so the generated API docs show what a refusal looks
# like rather than only the happy path.
ANGEMELDET: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
}

MIT_PROTOKOLL: dict[int | str, dict[str, Any]] = {
    **ANGEMELDET,
    status.HTTP_404_NOT_FOUND: {"model": FehlerAntwort},
}

# A change can additionally collide: the protocol has moved on since the version
# being saved from, or it is no longer a draft at all. Both are 409.
BEIM_AENDERN: dict[int | str, dict[str, Any]] = {
    **MIT_PROTOKOLL,
    status.HTTP_409_CONFLICT: {"model": FehlerAntwort},
}

# Submitting can collide the same way and can additionally be refused for what is
# in the document, which a save never is: a draft is half-finished by definition.
BEIM_ABSENDEN: dict[int | str, dict[str, Any]] = {
    **BEIM_AENDERN,
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": FehlerAntwort},
}


@router.post("", status_code=status.HTTP_201_CREATED, responses=ANGEMELDET)
async def anlegen(
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProtokollAntwort:
    """Start a protocol.

    No request body. A protocol is filled in over several sittings, so it begins
    empty and everything about it arrives through later saves; there is nothing
    the caller could usefully say at this moment that it could not say then.

    The whole draft comes back rather than only its id, so the browser can go
    straight to the form without a second request for a document it already knows
    is empty.
    """
    entwurf = await lege_entwurf_an(session, besitzer=benutzer)
    return ProtokollAntwort.model_validate(entwurf)


@router.get("", responses=ANGEMELDET)
async def liste(
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProtokollUebersicht]:
    """This account's own protocols, most recently worked on first.

    Summaries rather than whole protocols. Twenty of them carrying 338 answers
    each is a large response for drawing twenty table rows, and the list has
    nothing to do with the answers themselves.

    No filter parameters. prototypes/meine-protokolle.html sketches a search box
    and three dropdowns, and those belong with the review queue in feature 12,
    which is the screen that reads across every account rather than one person's
    handful.
    """
    zeilen = await liste_protokolle(session, besitzer=benutzer)
    return [ProtokollUebersicht.model_validate(zeile) for zeile in zeilen]


@router.get("/{protokoll_id}", responses=MIT_PROTOKOLL)
async def lesen(
    protokoll_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProtokollAntwort:
    """One protocol in full, answers included.

    Answers 404 for a protocol belonging to somebody else, exactly as it does for
    one that does not exist. A 403 would confirm the id is real, which is a fact
    about another surveyor's work that a stranger has no business collecting.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=benutzer)
    return ProtokollAntwort.model_validate(protokoll)


@router.put("/{protokoll_id}/antworten", responses=BEIM_AENDERN)
async def speichern(
    protokoll_id: uuid.UUID,
    anfrage: AntwortenSpeichern,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SpeicherAntwort:
    """Save a draft's answers.

    PUT rather than PATCH, because this replaces the document rather than merging
    into it. A save carries every answer the form holds, so a value the browser
    left out is a value the surveyor cleared.

    Answers 409 when the protocol has moved on since the version being saved
    from, and nothing is written. That is what stops one open tab overwriting
    what another put in.
    """
    protokoll = await speichere_antworten(
        session,
        protokoll_id=protokoll_id,
        besitzer=benutzer,
        antworten=anfrage.antworten,
        version=anfrage.version,
    )
    return SpeicherAntwort.model_validate(protokoll)


@router.post("/{protokoll_id}/absenden", responses=BEIM_ABSENDEN)
async def absenden(
    protokoll_id: uuid.UUID,
    anfrage: AbsendenAnfrage,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AbsendenAntwort:
    """Send a finished protocol to FFS.

    POST to a sub-path rather than a PATCH setting the status, because this is an
    action and not an edit: a client that could set the status directly could
    also set it to ACCEPTED. What it actually does is in app/protokolle/absenden.py.

    Answers 422 when the protocol is not finished, carrying every unfinished or
    broken answer as a path and a message key.
    """
    protokoll = await sende_ab(
        session,
        protokoll_id=protokoll_id,
        besitzer=benutzer,
        version=anfrage.version,
    )
    return AbsendenAntwort.model_validate(protokoll)


@router.delete("/{protokoll_id}", status_code=status.HTTP_204_NO_CONTENT, responses=BEIM_AENDERN)
async def loeschen(
    protokoll_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    speicher: Annotated[Anlagenspeicher, Depends(get_speicher)],
) -> None:
    """Delete a draft.

    Drafts only. A submitted protocol is a record somebody else is working with,
    and taking it back is a workflow step for feature 11 rather than a delete.

    No confirmation here. Asking twice is the screen's job, and an API that
    needed a second call to mean it would be one more thing for a client to get
    wrong.

    Takes the attachment store because deleting a protocol deletes its pictures
    too. The rows go with it through ON DELETE CASCADE, but a cascade knows
    nothing about the volume, so without this the files would stay there forever
    with nothing pointing at them.
    """
    await loesche_protokoll(session, speicher, protokoll_id=protokoll_id, besitzer=benutzer)
