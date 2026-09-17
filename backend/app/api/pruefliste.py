"""The review queue: the protocols waiting for FFS to do something about them.

Its own router, at /api/v1/pruefliste rather than under /api/v1/protokolle. A
literal path segment sitting beside the UUID parameter of
/api/v1/protokolle/{protokoll_id} is order-dependent: declared after it, FastAPI
tries to read "pruefliste" as a UUID and answers 422, and the only thing keeping
it working is the order two routes happen to be written in. It is also genuinely a
different resource, a view across protocols with a paging envelope of its own,
rather than one protocol.

Thin, like every other router here. What the queue is lives in
app/protokolle/pruefliste/dienst.py and what a page number means lives in
app/protokolle/pruefliste/parameter.py, so both can be held to their promises
without an HTTP request.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.abhaengigkeiten import erfordert_rollen
from app.api.schemas import FehlerAntwort, PrueflisteAntwort, Pruefstatus
from app.db import get_session
from app.models.benutzer import User
from app.models.protokoll import Status
from app.protokolle.dienst import FFS_ROLLEN
from app.protokolle.pruefliste.dienst import Prueffilter, liste_pruefliste
from app.protokolle.pruefliste.parameter import (
    JAHR_MAX,
    JAHR_MIN,
    PRO_SEITE_STANDARD,
)

# Far longer than any water or place anybody types, and short enough that a
# search cannot be an arbitrarily large request before anything looks at it.
SUCHE_HOECHSTLAENGE = 200

router = APIRouter(prefix="/api/v1/pruefliste", tags=["Pruefliste"])

# Documented on the route so the generated docs show what a refusal looks like
# rather than only the happy path, exactly as app/api/protokolle.py does it.
NUR_FFS: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_403_FORBIDDEN: {"model": FehlerAntwort},
}

# The three accounts whose job is other people's protocols, named from the tuple
# app/protokolle/dienst.py already keeps rather than retyped here. A
# REGIERUNGSPRAESIDIUM account is deliberately not among them: it sees its own
# region only, which is feature 13, and letting it see everything now and
# narrowing it later would be a leak with a date on it.
FFS = Depends(erfordert_rollen(*FFS_ROLLEN))


@router.get("", responses=NUR_FFS)
async def pruefliste(
    # Declared and not read, which is not an oversight. The parameter is what
    # makes FastAPI run the role requirement at all, and the queue is the same
    # list for everybody who passes it. Feature 13 is where the account itself
    # starts to matter, and it will read this.
    benutzer: Annotated[User, FFS],
    session: Annotated[AsyncSession, Depends(get_session)],
    status_: Annotated[
        list[Pruefstatus] | None,
        Query(
            alias="status",
            description=(
                "Nur Protokolle in diesen Zustaenden. Mehrfach angebbar."
                " Ohne Angabe: alle eingereichten Protokolle."
            ),
        ),
    ] = None,
    anlass: Annotated[
        str | None,
        Query(description='Nur Protokolle zu diesem Anlass, als Code, etwa "wrrl".'),
    ] = None,
    jahr: Annotated[
        int | None,
        Query(
            ge=JAHR_MIN,
            le=JAHR_MAX,
            description="Nur Befischungen aus diesem Jahr. Der Tag der Befischung zaehlt,"
            " nicht der Tag der Abgabe.",
        ),
    ] = None,
    suche: Annotated[
        str | None,
        Query(
            max_length=SUCHE_HOECHSTLAENGE,
            description="Freitext ueber Gewaessername, Ortsangabe und"
            " Monitoringstrecken-Nr. Jedes Wort muss irgendwo vorkommen.",
        ),
    ] = None,
    seite: Annotated[
        int,
        Query(description="Welche Seite, ab 1 gezaehlt."),
    ] = 1,
    pro_seite: Annotated[
        int,
        Query(description="Wie viele Protokolle eine Seite traegt, hoechstens 100."),
    ] = PRO_SEITE_STANDARD,
) -> PrueflisteAntwort:
    """One page of the protocols that have been handed in, longest wait first.

    Every protocol, whoever filed it, and no drafts at all. A draft is somebody's
    unfinished work rather than work waiting for FFS, which is why this is not the
    same question app/protokolle/dienst.py's _sichtbar answers.

    Refused with 403 rather than with an empty list for an account that has no
    business here. The refusal is about the caller and not about the data, and an
    empty list would say "there is no work", which is a different and untrue
    statement.

    seite and pro_seite are clamped rather than refused: page 0 is answered as page
    1, and a request for 500 rows is answered with 100. A page past the end comes
    back empty with the true total, so the pager can offer the way back instead of
    the screen having to handle a 404.

    **Everything that changes which protocols come back, and in what order, is a
    query parameter.** Nothing is taken from the session or from a default the
    caller cannot see. Feature 12d's Vorheriges and Naechstes have to rebuild this
    same list from a URL alone, and a hidden input would make "the protocol before
    this one" depend on what the reviewer happened to do earlier.

    Asking for DRAFT is refused by Pruefstatus rather than answered with nothing.
    The queue never lists a draft, and quietly returning an empty page would read
    like a database with no protocols in it.
    """
    seitenergebnis = await liste_pruefliste(
        session,
        auswahl=Prueffilter(
            # Pruefstatus is the same six values narrowed to what may be asked
            # for; the query is written in the protocol's own Status.
            status=tuple(Status(zustand.value) for zustand in status_ or ()),
            anlass=anlass,
            jahr=jahr,
            suche=suche,
        ),
        seite=seite,
        pro_seite=pro_seite,
    )
    return PrueflisteAntwort.model_validate(seitenergebnis)
