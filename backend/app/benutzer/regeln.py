"""The rules about an account that are not the database's job.

The check constraints on the users table already refuse a bad row. These
functions exist alongside them for two reasons. A constraint violation surfaces
as a database error naming an index, which tells the person who hit it nothing
they can act on. And a constraint only fires once a write is attempted, while
these can refuse before anything is touched.

Plain functions over values, with no database and no HTTP, so they are testable
without either and so the same rules can be read across into the browser side
later, exactly as the Zod rules on the frontend already are.
"""

from collections.abc import Sequence

from email_validator import EmailNotValidError
from email_validator import validate_email as _validate_email

from app.benutzer.fehler import (
    EmailUngueltig,
    LetzterSuperAdmin,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
    SelbstEntzugUnzulaessig,
)
from app.models.benutzer import Rolle

# The four Regierungspräsidien, defined once.
#
# Named rather than a bare range, because "--regierungspraesidium 3" means
# nothing to somebody setting the system up and everything to the person whose
# account it is. The command line prints the names from here, so a fifth region
# would be one edit plus the table constraint, not three.
REGIERUNGSPRAESIDIEN = {
    1: "Stuttgart",
    2: "Karlsruhe",
    3: "Freiburg",
    4: "Tübingen",
}


def normalisiere_email(email: str) -> str:
    """Checks the address is usable and returns the one form we store.

    Lower case throughout, because this is the login identifier and nobody should
    end up with two accounts because they capitalised their own name one day. The
    users table refuses anything that did not come through here, so this is the
    only way an address gets in.

    Strictly, the part before the @ is case sensitive in the standard and only
    the domain is not. In practice no mail provider treats it that way, and
    treating it that way here would mean somebody typing their address with a
    capital could not sign in to their own account.

    Deliberately does not ask the network whether the domain exists. That would
    make a rule that must be fast and predictable depend on DNS being up, and
    would fail an address that is perfectly valid on an internal mail server the
    developer's machine cannot see.
    """
    try:
        geprueft = _validate_email(email.strip(), check_deliverability=False)
    except EmailNotValidError as fehler:
        raise EmailUngueltig(email, str(fehler)) from fehler
    return geprueft.normalized.lower()


def normalisiere_rollen(rollen: Sequence[Rolle]) -> list[Rolle]:
    """The roles in the order given, without repeats, and never empty.

    The table's constraint refuses an empty array but has nothing to say about
    ARRAY['SUBMITTER', 'SUBMITTER'], which passes every check and then makes
    every listing of that account read oddly forever. Removing the repeat here is
    cheaper than explaining it later.

    Order is preserved rather than sorted, so a listing shows the roles the way
    whoever created the account thought of them.
    """
    if not rollen:
        raise RollenLeer

    ohne_wiederholung: list[Rolle] = []
    for rolle in rollen:
        if rolle not in ohne_wiederholung:
            ohne_wiederholung.append(rolle)
    return ohne_wiederholung


def pruefe_regierungspraesidium(
    rollen: Sequence[Rolle], regierungspraesidium: int | None
) -> None:
    """The region number and the regional role require each other.

    Checked in this order on purpose. An account that should not carry a number
    at all is told that first, because telling somebody their number is out of
    range when the real answer is that they should not have one sends them to fix
    the wrong thing.
    """
    ist_regional = Rolle.REGIERUNGSPRAESIDIUM in rollen

    if ist_regional and regierungspraesidium is None:
        raise RegierungspraesidiumFehlt

    if not ist_regional and regierungspraesidium is not None:
        raise RegierungspraesidiumUnzulaessig(regierungspraesidium)

    if regierungspraesidium is not None and regierungspraesidium not in REGIERUNGSPRAESIDIEN:
        raise RegierungspraesidiumAusserhalbBereich(regierungspraesidium)


def pruefe_super_admin_bleibt(
    *,
    war_aktiver_super_admin: bool,
    ist_aktiver_super_admin_danach: bool,
    andere_aktive_super_admins: int,
) -> None:
    """At least one active Super Admin has to survive the change.

    Three ways to break that and one rule covering all of them, which is why the
    arguments describe the state before and after rather than which operation was
    asked for: locking an account, taking SUPER_ADMIN off it, and doing both at
    once all reach the same place.

    Keyword arguments only. Three booleans in a row are trivially swapped, and
    two of the swaps produce a rule that refuses nothing.

    The first branch is not an optimisation. Without it, a database whose only
    account is a SUBMITTER, which is a state the command line can create, would
    refuse every edit to that account on the grounds that a Super Admin has to
    survive, when this change never had one to lose. The rule is about losing the
    last one, so an account that was never one is none of its business.
    """
    if not war_aktiver_super_admin:
        return

    if ist_aktiver_super_admin_danach:
        return

    if andere_aktive_super_admins > 0:
        return

    raise LetzterSuperAdmin


def pruefe_kein_selbstentzug(
    *,
    ist_eigenes_konto: bool,
    verliert_super_admin: bool,
    wird_gesperrt: bool,
) -> None:
    """Nobody takes their own access away, even when somebody else still has it.

    Narrower than pruefe_super_admin_bleibt and not implied by it: with three
    other Super Admins on the system that rule is satisfied, and locking your own
    account still signs you out of the screen you are standing on with nothing
    left that can undo it.

    Inert wherever there is no signed-in account to compare against, which is
    what makes the command line unaffected: ist_eigenes_konto is false there and
    always will be.
    """
    if not ist_eigenes_konto:
        return

    if verliert_super_admin or wird_gesperrt:
        raise SelbstEntzugUnzulaessig
