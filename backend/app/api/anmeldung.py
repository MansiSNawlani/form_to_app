"""Signing in, signing out, and asking who you are.

Thin routes. The rule about who may sign in lives in
app/benutzer/dienst.py, the token in app/security/token.py and the cookie in
app/api/sitzung.py, so what is left here is parsing, delegating and answering.

Route paths are German, following the same rule as the page routes decided on
2026-08-24. /anmeldung is also the page 2c builds, so the two read alike.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import AnmeldungAnfrage, BenutzerAntwort, FehlerAntwort
from app.api.sitzung import setze_sitzung
from app.benutzer.dienst import melde_an
from app.db import get_session

router = APIRouter(prefix="/api/v1", tags=["Anmeldung"])

# Documented on the routes so the generated API docs show what a refusal looks
# like, rather than only the happy path.
REFUSALS: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_403_FORBIDDEN: {"model": FehlerAntwort},
}


@router.post("/anmeldung", responses=REFUSALS)
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
