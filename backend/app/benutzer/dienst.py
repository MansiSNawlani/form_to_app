"""Creating, finding and deactivating accounts.

The layer where the model, the hashing, the rules and the database meet. Above
it sits the command line in step 7 and feature 2b's endpoints; both get the same
behaviour and the same errors, because both come through here.

The session is an argument rather than something this module reaches for. That
is what lets these functions be tested against a transaction that is thrown away
afterwards, and it is the same shape the browser side already uses, where the
draft store takes its storage as an argument.

These functions commit. At this size that is the least surprising thing they can
do: the caller asks for an account to be created and afterwards there is one. The
day some feature needs two of these to succeed or fail together is the day to
move the commit out to the caller, and not before.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
)
from app.benutzer.regeln import (
    normalisiere_email,
    normalisiere_rollen,
    pruefe_regierungspraesidium,
)
from app.models.benutzer import Locale, Rolle, User
from app.security.passwoerter import (
    PasswortZuKurz,
    PasswortZuLang,
    braucht_neuen_hash,
    hashe_passwort,
    pruefe_blind,
    pruefe_passwort,
)

# The unique index from the users migration. Named here so a violation can be
# told apart from any other constraint failure without guessing.
EMAIL_INDEX = "uq_users_email"


async def lege_benutzer_an(
    session: AsyncSession,
    *,
    email: str,
    passwort: str,
    rollen: Sequence[Rolle],
    regierungspraesidium: int | None = None,
    locale: Locale = Locale.DE,
) -> User:
    """Create one account, or raise saying exactly what was wrong with it.

    Keyword arguments only, because five of the six are easy to swap by accident
    and two of those swaps produce a working call with the wrong meaning.

    Everything is checked before anything is written, so a rejected account
    leaves no trace and the message names the first real problem rather than
    whichever one the database happened to notice.
    """
    email = normalisiere_email(email)
    rollen = normalisiere_rollen(rollen)
    pruefe_regierungspraesidium(rollen, regierungspraesidium)

    if await finde_nach_email(session, email) is not None:
        raise EmailBereitsVergeben(email)

    # Last of the checks, because hashing is deliberately slow and everything
    # above can reject the account for free. Hashing first would spend 45 ms on
    # an account that was never going to exist.
    passwort_hash = hashe_passwort(passwort)

    benutzer = User(
        email=email,
        password_hash=passwort_hash,
        rollen=list(rollen),
        regierungspraesidium=regierungspraesidium,
        locale=locale,
    )
    session.add(benutzer)

    try:
        await session.commit()
    except IntegrityError as fehler:
        # The check above catches this in every ordinary case. This is for the
        # one it cannot: two accounts with the same email created at the same
        # moment, where both looked up and both found nothing. Rare, and the
        # difference between a clear refusal and a stack trace.
        await session.rollback()
        if EMAIL_INDEX in str(fehler):
            raise EmailBereitsVergeben(email) from fehler
        raise

    await session.refresh(benutzer)
    return benutzer


async def finde_nach_email(session: AsyncSession, email: str) -> User | None:
    """The account for this address, or None.

    Normalises first, so looking up "Anna@FFS.de" finds the account stored as
    "anna@ffs.de". Without that, every caller would have to remember to
    normalise and one of them eventually would not.
    """
    # Annotated rather than returned directly: session.scalar is typed loosely
    # enough to hand back Any, and mypy in strict mode is right to object. The
    # annotation is what makes a later change of query fail here rather than
    # silently widening the return type.
    gefunden: User | None = await session.scalar(
        select(User).where(User.email == normalisiere_email(email))
    )
    return gefunden


async def setze_aktiv(session: AsyncSession, email: str, aktiv: bool) -> User:
    """Turn an account on or off.

    Deactivating rather than deleting is deliberate and belongs to the data
    model: a deleted account would take the owner of every submission it filed
    with it, and those records have to stay readable. Feature 2b refuses an
    inactive account at sign in.
    """
    benutzer = await finde_nach_email(session, email)
    if benutzer is None:
        raise BenutzerNichtGefunden(normalisiere_email(email))

    benutzer.ist_aktiv = aktiv
    await session.commit()
    await session.refresh(benutzer)
    return benutzer


async def liste_benutzer(session: AsyncSession) -> list[User]:
    """Every account, by email.

    Ordered so that two runs of the listing command can be compared. Without an
    order Postgres is free to return rows however it finds them, which changes
    as rows are updated.
    """
    ergebnis = await session.scalars(select(User).order_by(User.email))
    return list(ergebnis)


async def melde_an(session: AsyncSession, *, email: str, passwort: str) -> User:
    """The account for these credentials, or a refusal saying which kind it is.

    Keyword arguments because two strings next to each other are easy to swap, and
    swapping these produces a working call that always refuses.

    The order of the checks is the security decision in this function. The
    password comes first, so that "this account is deactivated" and "this account
    cannot sign in here" are only ever said to somebody who already had the
    password. Reversing it would make either message confirm that an address holds
    an account.
    """
    try:
        benutzer = await finde_nach_email(session, email)
    except EmailUngueltig:
        # Not a usable address at all, so certainly not one with an account. Answered
        # like any other failed attempt rather than as a validation error, so a
        # malformed address cannot be told apart from a wrong password either.
        benutzer = None

    if benutzer is None:
        pruefe_blind(passwort)
        raise AnmeldungFehlgeschlagen

    if not pruefe_passwort(passwort, benutzer.password_hash):
        raise AnmeldungFehlgeschlagen

    if not benutzer.ist_aktiv:
        raise KontoDeaktiviert

    if Rolle.INTEGRATION in benutzer.rollen:
        raise KontoNichtInteraktiv

    await _erneuere_hash_falls_noetig(session, benutzer, passwort)
    return benutzer


async def _erneuere_hash_falls_noetig(
    session: AsyncSession, benutzer: User, passwort: str
) -> None:
    """Store a stronger hash when the settings have moved on since this one was made.

    A stored hash keeps its own settings forever, so without this an account
    created years ago stays at that strength no matter what the library later
    defaults to. A successful sign in is the only moment the plain password exists
    to make a new one from.
    """
    if not braucht_neuen_hash(benutzer.password_hash):
        return

    try:
        neuer_hash = hashe_passwort(passwort)
    except (PasswortZuKurz, PasswortZuLang):
        # The password predates a tightening of the policy. Refusing to rehash is
        # right; refusing the sign in over it would lock out every account that
        # existed before the change, which is an outage rather than a security
        # gain. The account keeps its old hash until its password is changed.
        return

    benutzer.password_hash = neuer_hash
    await session.commit()
    await session.refresh(benutzer)
