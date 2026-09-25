"""Account administration: the five things a Super Admin can do to an account.

Feature 2a put these at the command line because the very first Super Admin has
to exist before anybody can sign in and make one, and that reason still holds for
the first account. It does not hold for the ninetieth. This router is where every
account after the first one is managed, by somebody who does not need a terminal
on the machine the database runs on.

Thin, like every other router here. What an account may look like lives in
app/benutzer/regeln.py and what changing one does lives in app/benutzer/dienst.py,
so both can be held to their promises without an HTTP request. What is left here
is parsing, authorising, delegating and answering.

**One rule this module owns rather than delegates: every route requires
SUPER_ADMIN.** app/api/fehler_http.py now maps BenutzerNichtGefunden to 404, and
that is only safe because no unauthenticated caller can reach a route that raises
it. A route added here without NUR_SUPER_ADMIN would turn this API into a way of
finding out which addresses hold an account.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.abhaengigkeiten import erfordert_rollen
from app.api.schemas import (
    BenutzerAntwort,
    FehlerAntwort,
    KontoAendernAnfrage,
    KontoAnlegenAnfrage,
    PasswortAnfrage,
)
from app.benutzer.dienst import (
    UNVERAENDERT,
    Unveraendert,
    aendere_benutzer,
    finde_nach_id,
    lege_benutzer_an,
    liste_benutzer,
    setze_passwort,
)
from app.benutzer.fehler import BenutzerNichtGefunden
from app.db import get_session
from app.models.benutzer import Rolle, User

router = APIRouter(prefix="/api/v1/benutzer", tags=["Benutzerverwaltung"])

# Documented on every route so the generated docs show what a refusal looks like
# rather than only the happy path, as the other routers here do.
ABLEHNUNGEN: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_403_FORBIDDEN: {"model": FehlerAntwort},
}

# Plus 404, for the three routes that name one account by id.
#
# Documented per route rather than once for all of them, because a status listed
# on a route that cannot produce it is a contract nobody reviewed, which is the
# objection app/api/fehler_http.py makes about its own table. Creating an account
# names no id and so can never be a 404; reading one or setting its password
# cannot be a 409.
MIT_KONTO: dict[int | str, dict[str, Any]] = {
    **ABLEHNUNGEN,
    status.HTTP_404_NOT_FOUND: {"model": FehlerAntwort},
}

# Plus 409, for the routes that can be refused by a rule rather than by a value:
# an address already in use, and the two safety rules.
MIT_KONFLIKT: dict[int | str, dict[str, Any]] = {
    **ABLEHNUNGEN,
    status.HTTP_409_CONFLICT: {"model": FehlerAntwort},
}

MIT_KONTO_UND_KONFLIKT: dict[int | str, dict[str, Any]] = {**MIT_KONTO, **MIT_KONFLIKT}


def _oder_unveraendert[T](wert: T | None) -> T | Unveraendert:
    """A value that was sent, or the sentinel meaning it was not.

    For the four fields where null is refused by the request model, so "is not
    None" already means "was sent". regierungspraesidium is the exception and
    does not come through here: on that one field a sent null is an instruction.
    """
    return UNVERAENDERT if wert is None else wert


# Super Admin alone, and deliberately not FFS_ROLLEN.
#
# A Data Steward corrects survey data and a Reviewer decides on protocols.
# Neither job involves handing somebody else a role, and project-overview.md
# gives account management to the Super Admin only. This is the one place in the
# application where "FFS staff" is too wide a description to authorise on.
NUR_SUPER_ADMIN = Depends(erfordert_rollen(Rolle.SUPER_ADMIN))


async def _konto(session: AsyncSession, benutzer_id: uuid.UUID) -> User:
    """The account this request is about, or a 404 saying it is gone.

    Shared by the four routes that name one account, so "does it exist" is
    answered the same way in all of them rather than four times.
    """
    konto = await finde_nach_id(session, benutzer_id)
    if konto is None:
        # The error carries an email and this has an id, which is the one place
        # the two identifiers meet. The wording never repeats either back, so
        # what goes in here only has to be true.
        raise BenutzerNichtGefunden(str(benutzer_id))
    return konto


@router.get("", responses=ABLEHNUNGEN)
async def konten(
    # Declared and not read. The parameter is what makes FastAPI run the role
    # requirement at all; every Super Admin sees the same list.
    handelnder: Annotated[User, NUR_SUPER_ADMIN],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BenutzerAntwort]:
    """Every account, by email.

    No paging and no search parameter, which is the opposite of what the
    Pruefliste does and deliberately so: protocols grow without bound and
    accounts do not. FFS staff plus the consultants and associations who file
    protocols is a list of tens. Feature 16b filters it in the browser.
    """
    return [BenutzerAntwort.model_validate(konto) for konto in await liste_benutzer(session)]


@router.get("/{benutzer_id}", responses=MIT_KONTO)
async def konto(
    handelnder: Annotated[User, NUR_SUPER_ADMIN],
    session: Annotated[AsyncSession, Depends(get_session)],
    benutzer_id: uuid.UUID,
) -> BenutzerAntwort:
    """One account."""
    return BenutzerAntwort.model_validate(await _konto(session, benutzer_id))


@router.post("", status_code=status.HTTP_201_CREATED, responses=MIT_KONFLIKT)
async def anlegen(
    handelnder: Annotated[User, NUR_SUPER_ADMIN],
    session: Annotated[AsyncSession, Depends(get_session)],
    anfrage: KontoAnlegenAnfrage,
) -> BenutzerAntwort:
    """Create an account.

    The password is set here and told to its owner by the administrator, because
    there is no mail to send it in until feature 14.
    """
    angelegt = await lege_benutzer_an(
        session,
        email=anfrage.email,
        passwort=anfrage.passwort,
        rollen=anfrage.rollen,
        regierungspraesidium=anfrage.regierungspraesidium,
        locale=anfrage.locale,
    )
    return BenutzerAntwort.model_validate(angelegt)


@router.patch("/{benutzer_id}", responses=MIT_KONTO_UND_KONFLIKT)
async def aendern(
    handelnder: Annotated[User, NUR_SUPER_ADMIN],
    session: Annotated[AsyncSession, Depends(get_session)],
    benutzer_id: uuid.UUID,
    anfrage: KontoAendernAnfrage,
) -> BenutzerAntwort:
    """Change an account. A field that is left out is left alone.

    One field is asked about differently from the other four, and that asymmetry
    is the point rather than an inconsistency. regierungspraesidium is nullable,
    so a sent null means "clear the region" and only model_fields_set can tell
    that from "the region was not mentioned". On the rest, null is refused by the
    request model, so "is not None" already means "was sent".
    """
    geaendert = await aendere_benutzer(
        session,
        await _konto(session, benutzer_id),
        handelnder=handelnder,
        email=_oder_unveraendert(anfrage.email),
        rollen=_oder_unveraendert(anfrage.rollen),
        regierungspraesidium=(
            anfrage.regierungspraesidium
            if anfrage.wurde_gesetzt("regierungspraesidium")
            else UNVERAENDERT
        ),
        locale=_oder_unveraendert(anfrage.locale),
        ist_aktiv=_oder_unveraendert(anfrage.ist_aktiv),
    )
    return BenutzerAntwort.model_validate(geaendert)


@router.put("/{benutzer_id}/passwort", responses=MIT_KONTO)
async def passwort(
    handelnder: Annotated[User, NUR_SUPER_ADMIN],
    session: Annotated[AsyncSession, Depends(get_session)],
    benutzer_id: uuid.UUID,
    anfrage: PasswortAnfrage,
) -> BenutzerAntwort:
    """Give an account a new password.

    PUT rather than PATCH because it replaces the password outright; there is no
    partial version of one.

    It does not end sessions the account already has. The session token is
    stateless and holds the account id, so one issued before this call stays
    valid until it expires, up to eight hours. Where that matters, because
    somebody else may have had the old password, locking the account is the part
    that takes effect at once: aktueller_benutzer loads the row on every request.
    """
    geaendert = await setze_passwort(
        session, await _konto(session, benutzer_id), passwort=anfrage.passwort
    )
    return BenutzerAntwort.model_validate(geaendert)
