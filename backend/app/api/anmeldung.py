"""Signing in, signing out, asking who you are, and choosing your language.

Four thin routes. The rule about who may sign in lives in
app/benutzer/dienst.py, the token in app/security/token.py and the cookie in
app/api/sitzung.py, so what is left here is parsing, delegating and answering.

Route paths are German, following the same rule as the page routes decided on
2026-08-24. /anmeldung is also the page 2c builds, so the two read alike.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.abhaengigkeiten import AngemeldeterBenutzer
from app.api.schemas import AnmeldungAnfrage, BenutzerAntwort, FehlerAntwort, IchAendernAnfrage
from app.api.sitzung import loesche_sitzung, setze_sitzung
from app.benutzer.dienst import melde_an, setze_sprache
from app.db import get_session

router = APIRouter(prefix="/api/v1", tags=["Anmeldung"])

# Documented on the routes so the generated API docs show what a refusal looks
# like, rather than only the happy path.
ABLEHNUNGEN: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_403_FORBIDDEN: {"model": FehlerAntwort},
}


@router.post("/anmeldung", responses=ABLEHNUNGEN)
async def anmeldung(
    anfrage: AnmeldungAnfrage,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BenutzerAntwort:
    """Sign in: check the credentials, and set the session cookie.

    The account comes back in the body as well, so the browser learns who it is
    without a second request. It cannot read the cookie to find out: that is the
    whole point of httpOnly.
    """
    benutzer = await melde_an(session, email=anfrage.email, passwort=anfrage.passwort)
    setze_sitzung(response, benutzer.id)
    return BenutzerAntwort.model_validate(benutzer)


@router.get("/ich", responses=ABLEHNUNGEN)
async def ich(benutzer: AngemeldeterBenutzer) -> BenutzerAntwort:
    """Who the session belongs to.

    The browser cannot read the cookie, which is the point of httpOnly, so this is
    how a page reloaded eight minutes later finds out it is still signed in and as
    whom.
    """
    return BenutzerAntwort.model_validate(benutzer)


@router.patch("/ich", responses=ABLEHNUNGEN)
async def ich_aendern(
    benutzer: AngemeldeterBenutzer,
    anfrage: IchAendernAnfrage,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BenutzerAntwort:
    """Change the signed-in person's own interface language, and nothing else.

    No id in the path: the account is the one the session belongs to, so there is
    nobody else this can reach. Everything else about an account stays with the
    Super Admin's PATCH /benutzer/{id}.
    """
    geaendert = await setze_sprache(session, benutzer, locale=anfrage.locale)
    return BenutzerAntwort.model_validate(geaendert)


@router.post("/abmeldung", status_code=status.HTTP_204_NO_CONTENT)
async def abmeldung(response: Response) -> None:
    """Sign out: clear the cookie.

    Deliberately open to anybody, signed in or not. Being signed out is what the
    caller asked for, and refusing somebody whose session already expired would
    mean the sign-out button fails exactly when it is most likely to be pressed.

    Nothing is invalidated on the server, because nothing is stored there. A token
    already copied elsewhere stays valid until it expires, and the answer to that
    is to deactivate the account, which takes effect on the very next request.
    """
    loesche_sitzung(response)
