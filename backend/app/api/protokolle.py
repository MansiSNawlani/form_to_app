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

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.speicher import Anlagenspeicher, get_speicher
from app.api.abhaengigkeiten import AngemeldeterBenutzer, erfordert_rollen
from app.api.schemas import (
    AbsendenAnfrage,
    AbsendenAntwort,
    AntwortenSpeichern,
    EingelesenesProtokoll,
    EinleseAntwort,
    EntscheidungAnfrage,
    FehlerAntwort,
    ProtokollAntwort,
    ProtokollUebersicht,
    SpeicherAntwort,
    UebergangAntwort,
    VerlaufEintrag,
)
from app.db import get_session
from app.models.benutzer import User
from app.protokolle.absenden import sende_ab
from app.protokolle.dienst import (
    Protokollansicht,
    hole_protokollansicht,
    lege_entwurf_an,
    liste_protokolle,
    loesche_protokoll,
    speichere_antworten,
)
from app.protokolle.einlesen.dienst import MAX_PDF_BYTES, importiere
from app.protokolle.einlesen.fehler import DateiZuGross
from app.protokolle.uebergang.dienst import fuehre_uebergang_aus, lies_verlauf
from app.protokolle.uebergang.regeln import PRUEFERROLLEN, Aktion

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

# An import can be refused for what the file is (422) or for how big it is (413),
# and for nothing else: it is never refused for what the protocol says, which is
# the whole design of the import.
BEIM_EINLESEN: dict[int | str, dict[str, Any]] = {
    **ANGEMELDET,
    status.HTTP_413_CONTENT_TOO_LARGE: {"model": FehlerAntwort},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": FehlerAntwort},
}

# A reviewer's move can be refused for a fourth reason the owner's actions cannot
# be: the account has no business deciding anything, or is deciding on its own
# protocol.
BEIM_ENTSCHEIDEN: dict[int | str, dict[str, Any]] = {
    **BEIM_ABSENDEN,
    status.HTTP_403_FORBIDDEN: {"model": FehlerAntwort},
}

# Every route a reviewer reaches declares the roles from the transition table
# rather than naming them again here. One answer to who may decide.
PRUEFER = Depends(erfordert_rollen(*PRUEFERROLLEN))


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
    # The same shape the read route answers with, so the browser can cache what
    # it gets back here under the same type. A draft has no Probestrecke until
    # submitting matches one, which is feature 11b, so there is no region to name
    # yet; the rest of the envelope is null on the row itself.
    return ProtokollAntwort.model_validate(
        Protokollansicht.aus(entwurf, eingereicht_von=benutzer.email, regierungspraesidium=None)
    )


# Big enough that a 2 MB protocol is a handful of reads, small enough that the
# cap below is reached long before an over-sized upload is all in memory.
LESEBLOCK = 256 * 1024


async def _gelesen(datei: UploadFile) -> bytes:
    """The upload, with the cap enforced while it is read rather than after.

    A block at a time, so a 30 MB file is refused at 25 and the rest of it is
    never taken. app/anlagen/dienst.py does the same thing for a photograph and
    for the same reason.
    """
    daten = bytearray()
    while block := await datei.read(LESEBLOCK):
        daten += block
        if len(daten) > MAX_PDF_BYTES:
            raise DateiZuGross(datei.filename or "", MAX_PDF_BYTES)
    return bytes(daten)


# Declared before the routes that take an id. Not load-bearing, since no other
# POST here is a single fixed segment, but it keeps the reading of this file in
# step with the matching.
@router.post("/einlesen", status_code=status.HTTP_201_CREATED, responses=BEIM_EINLESEN)
async def einlesen(
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    datei: Annotated[UploadFile, File()],
) -> EingelesenesProtokoll:
    """Read a protocol out of the legacy Acrobat form and open it as a draft.

    One file per request. The surveyor who would rather fill the PDF in on a
    laptop in a field office should not have to type it all again because the
    reviewers now work in the application, and this is that path.

    **The draft belongs to whoever uploaded it**, and lands as a draft whatever
    the rules make of it. An imported protocol is never trusted: the legacy form
    has known validation bugs, so what comes back beside the protocol is
    everything wrong with it, and submitting it is a separate decision the person
    makes afterwards. It is refused only for not being a readable copy of this
    form at all.

    **Any version of the form is accepted**, not only the one this deployment
    serves. People fill in whatever copy of the PDF they downloaded years ago,
    and an old template is not an old survey; the protocol is stamped with our
    own form version and the file's travels in the report.
    """
    entwurf, bericht = await importiere(
        session,
        daten=await _gelesen(datei),
        # UploadFile.filename is None when a client sends no name at all. Empty
        # rather than invented, exactly as the attachment upload does it: the
        # refusals have a placeholder for that, and making one up would name a
        # file the person never had.
        dateiname=datei.filename or "",
        besitzer=benutzer,
    )
    return EingelesenesProtokoll(
        protokoll=ProtokollAntwort.model_validate(
            Protokollansicht.aus(
                entwurf, eingereicht_von=benutzer.email, regierungspraesidium=None
            )
        ),
        bericht=EinleseAntwort.model_validate(bericht),
    )


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

    Answers 404 for a protocol this account may not see, exactly as it does for
    one that does not exist. A 403 would confirm the id is real, which is a fact
    about another surveyor's work that a stranger has no business collecting.

    Since feature 11d, FFS staff may open a protocol they did not file, because a
    reviewer cannot decide on something they cannot read. **A draft is still
    private to its owner**: it is somebody's unfinished work, which is what
    CONTEXT.md says a draft is. app/protokolle/dienst.py holds that rule.
    """
    ansicht = await hole_protokollansicht(session, protokoll_id=protokoll_id, benutzer=benutzer)
    return ProtokollAntwort.model_validate(ansicht)


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


@router.post("/{protokoll_id}/pruefung", responses=BEIM_ENTSCHEIDEN)
async def in_pruefung_nehmen(
    protokoll_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    benutzer: Annotated[User, PRUEFER],
) -> UebergangAntwort:
    """Take a submitted protocol into Pruefung.

    No request body. There is nothing to say beyond that you have picked it up,
    and app/protokolle/uebergang/regeln.py says what picking it up does and does
    not mean.
    """
    protokoll = await fuehre_uebergang_aus(
        session, protokoll_id=protokoll_id, aktion=Aktion.IN_PRUEFUNG_NEHMEN, akteur=benutzer
    )
    return UebergangAntwort.model_validate(protokoll)


@router.post("/{protokoll_id}/entscheidung", responses=BEIM_ENTSCHEIDEN)
async def entscheiden(
    protokoll_id: uuid.UUID,
    anfrage: EntscheidungAnfrage,
    session: Annotated[AsyncSession, Depends(get_session)],
    benutzer: Annotated[User, PRUEFER],
) -> UebergangAntwort:
    """Accept a protocol, send it back for correction, or reject it.

    One route for the three, because the reviewer screen is one radio group and
    one button. What each of them does is app/protokolle/uebergang/regeln.py.

    Answers 422 when a rejection or a change request arrives without a
    Begruendung, 409 when the protocol is not in a state the decision can be made
    from, and 403 when the account may not decide at all or filed the protocol
    itself.
    """
    protokoll = await fuehre_uebergang_aus(
        session,
        protokoll_id=protokoll_id,
        aktion=anfrage.entscheidung,
        akteur=benutzer,
        kommentar=anfrage.kommentar,
    )
    return UebergangAntwort.model_validate(protokoll)


@router.get("/{protokoll_id}/verlauf", responses=MIT_PROTOKOLL)
async def verlauf(
    protokoll_id: uuid.UUID,
    benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[VerlaufEintrag]:
    """Everything that has happened to one protocol, newest first.

    Not a reviewer route. The surveyor needs it more than anybody: it is where
    they read what a reviewer asked them to correct.
    """
    eintraege = await lies_verlauf(session, protokoll_id=protokoll_id, benutzer=benutzer)
    return [VerlaufEintrag.model_validate(eintrag) for eintrag in eintraege]


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
