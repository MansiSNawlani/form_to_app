"""Who is making this request, and may they.

A dependency is FastAPI's way of running something before the route. These two
are the only sanctioned way a route learns either answer. A route that reads the
cookie itself is a route that will one day forget the deactivation check below,
and a route that compares roles itself is one more place for the comparison to be
subtly different.

Features 3, 11, 12, 13 and 16 all need exactly this, which is why it is built now
rather than five times later.
"""

import uuid
from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.sitzung import SITZUNGS_COOKIE
from app.benutzer.fehler import NichtAngemeldet, RolleFehlt
from app.db import get_session
from app.models.benutzer import Rolle, User
from app.security.token import TokenFehler, lies_token


async def aktueller_benutzer(
    session: Annotated[AsyncSession, Depends(get_session)],
    sitzung: Annotated[str | None, Cookie(alias=SITZUNGS_COOKIE)] = None,
) -> User:
    """The account this request is signed in as, or a refusal.

    The account is loaded from the database on every request rather than read out
    of the token. That costs one lookup by primary key, and it buys the thing an
    administrator actually needs: deactivating somebody takes effect at once
    instead of whenever their token happens to run out, up to eight hours later.

    It is also why the roles are not in the token. Loading the row means the roles
    are always the current ones, so taking a role away is immediate for the same
    reason.
    """
    if sitzung is None:
        raise NichtAngemeldet

    try:
        benutzer_id = lies_token(sitzung)
    except TokenFehler as fehler:
        # Expired, forged and unreadable all end here. Which one it was belongs in
        # a log, never in the response: it is nothing the person can act on, and
        # it is something somebody probing would like to know.
        raise NichtAngemeldet from fehler

    benutzer = await _lade(session, benutzer_id)
    if benutzer is None or not benutzer.ist_aktiv:
        raise NichtAngemeldet

    return benutzer


async def _lade(session: AsyncSession, benutzer_id: uuid.UUID) -> User | None:
    gefunden: User | None = await session.get(User, benutzer_id)
    return gefunden


AngemeldeterBenutzer = Annotated[User, Depends(aktueller_benutzer)]


def erfordert_rollen(*rollen: Rolle) -> object:
    """A dependency that lets through an account holding any one of these roles.

    Any-of rather than all-of, because the real cases read "a reviewer or a super
    admin may accept this". An all-of check would lock out somebody holding both
    of two acceptable roles, which is the opposite of what anybody means.

    Written as a factory so the roles are named at the route: a route reads
    Depends(erfordert_rollen(Rolle.REVIEWER)) and says what it needs on its own
    line, instead of the requirement living in a table somewhere else.
    """
    benoetigt = tuple(rollen)

    async def pruefe(benutzer: AngemeldeterBenutzer) -> User:
        if not any(rolle in benutzer.rollen for rolle in benoetigt):
            raise RolleFehlt(tuple(rolle.value for rolle in benoetigt))
        return benutzer

    return Depends(pruefe)
