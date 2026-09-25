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

import uuid
from collections.abc import Sequence

from sqlalchemy import Text, cast, func, select
from sqlalchemy.dialects.postgresql import ARRAY as PgARRAY
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
    pruefe_kein_selbstentzug,
    pruefe_regierungspraesidium,
    pruefe_super_admin_bleibt,
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


class Unveraendert:
    """The absence of a value, told apart from the value None.

    aendere_benutzer changes any subset of five fields, and one of them,
    regierungspraesidium, is genuinely nullable. "Leave the region alone" and
    "clear the region" are different instructions, and a default of None cannot
    express both. This sentinel is the difference.

    Public, because the router has to name the type to hand values in. There is
    exactly one instance, UNVERAENDERT below, and nothing should ever make a
    second: the checks are isinstance rather than identity so that a second one
    would still behave, but two of them would make the repr below a lie.
    """

    def __repr__(self) -> str:
        return "UNVERAENDERT"


UNVERAENDERT = Unveraendert()


def _oder[T](wert: T | Unveraendert, bisher: T) -> T:
    """The value that was given, or the one the account already has."""
    return bisher if isinstance(wert, Unveraendert) else wert


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


async def finde_nach_id(session: AsyncSession, benutzer_id: uuid.UUID) -> User | None:
    """The account with this id, or None.

    What the endpoints use. They identify an account by id rather than by email
    because the email is the very field an edit may be changing, and identifying
    a row by the value being written would make a rename look like a delete
    followed by a create.
    """
    gefunden: User | None = await session.get(User, benutzer_id)
    return gefunden


async def zaehle_andere_aktive_super_admins(
    session: AsyncSession, *, ausser: uuid.UUID
) -> int:
    """How many active Super Admins there are apart from this one account.

    The number pruefe_super_admin_bleibt needs. Counted rather than fetched,
    because the rule only ever asks whether it is zero and loading the rows to
    find that out would read every administrator's account to answer it.

    The cast is not decoration. `rollen` is a TypeDecorator over the generic
    ARRAY type, and the generic type refuses the containment operator because it
    is not portable; casting to the Postgres array type is what turns this into
    `rollen @> ARRAY['SUPER_ADMIN']`. Storage is unaffected: the cast exists only
    inside this query.
    """
    anzahl = await session.scalar(
        select(func.count())
        .select_from(User)
        .where(
            User.id != ausser,
            User.ist_aktiv,
            cast(User.rollen, PgARRAY(Text)).contains([Rolle.SUPER_ADMIN.value]),
        )
    )
    return int(anzahl or 0)


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

    # Checked here rather than only in the endpoints, so the command line is held
    # to it too. Its own escape hatch stays open: creating another Super Admin
    # still works, and that is the documented way back.
    ist_super_admin = Rolle.SUPER_ADMIN in benutzer.rollen
    pruefe_super_admin_bleibt(
        war_aktiver_super_admin=ist_super_admin and benutzer.ist_aktiv,
        ist_aktiver_super_admin_danach=ist_super_admin and aktiv,
        andere_aktive_super_admins=await zaehle_andere_aktive_super_admins(
            session, ausser=benutzer.id
        ),
    )

    benutzer.ist_aktiv = aktiv
    await session.commit()
    await session.refresh(benutzer)
    return benutzer


async def aendere_benutzer(
    session: AsyncSession,
    benutzer: User,
    *,
    handelnder: User,
    email: str | Unveraendert = UNVERAENDERT,
    rollen: Sequence[Rolle] | Unveraendert = UNVERAENDERT,
    regierungspraesidium: int | None | Unveraendert = UNVERAENDERT,
    locale: Locale | Unveraendert = UNVERAENDERT,
    ist_aktiv: bool | Unveraendert = UNVERAENDERT,
) -> User:
    """Change any subset of an account's fields, or raise saying what was wrong.

    Takes the account rather than an id, because the caller has already loaded it
    to answer "does this exist" and a second lookup here would ask the same
    question twice.

    `handelnder` is the account making the change, and it is required rather than
    optional so that a caller cannot quietly skip the rule that depends on it.
    The command line never calls this; it has no signed-in account to pass.

    Everything is checked before anything is written, like lege_benutzer_an, so a
    refused change leaves the row exactly as it was.
    """
    # The two that normalise keep their own line, because what they do to a given
    # value is part of the rule rather than a default. The other three are plain.
    neue_email = benutzer.email if isinstance(email, Unveraendert) else normalisiere_email(email)
    neue_rollen = (
        list(benutzer.rollen) if isinstance(rollen, Unveraendert) else normalisiere_rollen(rollen)
    )
    neues_rp = _oder(regierungspraesidium, benutzer.regierungspraesidium)
    neue_locale = _oder(locale, benutzer.locale)
    neu_aktiv = _oder(ist_aktiv, benutzer.ist_aktiv)

    # Taking the regional role away without clearing its number is refused rather
    # than fixed up. Dropping the number quietly would be this layer deciding
    # what somebody meant, and the number is the one field on the account that
    # scopes what it can see.
    pruefe_regierungspraesidium(neue_rollen, neues_rp)

    if neue_email != benutzer.email:
        vorhanden = await finde_nach_email(session, neue_email)
        if vorhanden is not None and vorhanden.id != benutzer.id:
            raise EmailBereitsVergeben(neue_email)

    war_super_admin = Rolle.SUPER_ADMIN in benutzer.rollen
    bleibt_super_admin = Rolle.SUPER_ADMIN in neue_rollen

    # Before pruefe_kein_selbstentzug on purpose, and the order is the message
    # rather than the outcome. A sole Super Admin demoting themselves breaks both
    # rules at once; "create a second one first" is something they can act on,
    # while "ask another Super Admin" names somebody who does not exist.
    pruefe_super_admin_bleibt(
        war_aktiver_super_admin=war_super_admin and benutzer.ist_aktiv,
        ist_aktiver_super_admin_danach=bleibt_super_admin and neu_aktiv,
        andere_aktive_super_admins=await zaehle_andere_aktive_super_admins(
            session, ausser=benutzer.id
        ),
    )

    pruefe_kein_selbstentzug(
        ist_eigenes_konto=handelnder.id == benutzer.id,
        verliert_super_admin=war_super_admin and not bleibt_super_admin,
        wird_gesperrt=benutzer.ist_aktiv and not neu_aktiv,
    )

    benutzer.email = neue_email
    benutzer.rollen = neue_rollen
    benutzer.regierungspraesidium = neues_rp
    benutzer.locale = neue_locale
    benutzer.ist_aktiv = neu_aktiv

    try:
        await session.commit()
    except IntegrityError as fehler:
        # The same race lege_benutzer_an guards against, from the other
        # direction: two accounts renamed to one address at the same moment.
        await session.rollback()
        if EMAIL_INDEX in str(fehler):
            raise EmailBereitsVergeben(neue_email) from fehler
        raise

    await session.refresh(benutzer)
    return benutzer


async def setze_passwort(session: AsyncSession, benutzer: User, *, passwort: str) -> User:
    """Give an account a new password.

    Its own function rather than a field of aendere_benutzer, because a password
    must never travel alongside values that get echoed back in a validation
    error, printed in a log line, or returned in a response.

    hashe_passwort refuses a password that is too short or too long before
    anything is written, so a refused reset leaves the old one in place.

    It does not end sessions that already exist. The session token is stateless
    and carries the account id, so one issued before this call stays valid until
    it expires. Where that matters, locking the account is the answer: it is
    honoured on the account's very next request, because aktueller_benutzer loads
    the row every time.
    """
    benutzer.password_hash = hashe_passwort(passwort)
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
