"""Turning a password into something safe to store, and checking it later.

A hash is a one way scramble. The database holds the scramble and never the
password, so somebody who steals the whole table still cannot sign in as anyone.
Checking a password means scrambling what was typed and comparing the results.

The scramble is slow on purpose. A fast one lets an attacker with a stolen table
try billions of guesses a second; Argon2id is deliberately expensive in both time
and memory, so the same attack becomes impractical while one honest sign in stays
imperceptible.

Everything here is a plain function over strings, with no database and no HTTP, as
coding-standards.md asks of any rule where a wrong answer is possible.

Note for feature 2b, which will use these: the sign in endpoint must take about
the same time whether or not the email exists. Looking the user up, finding
nothing and returning immediately is measurably faster than looking one up and
verifying a password, and that difference is enough to tell an attacker which
email addresses hold accounts. The endpoint should verify against a throwaway
hash when it finds no user.
"""

from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)

from app.benutzer.fehler import BenutzerFehler

# The library's own defaults, deliberately not pinned to numbers here.
#
# They are Argon2id at 64 MiB, three passes and four threads, which is above the
# current published minimums, and they only ever get stronger as the library is
# updated. Writing the numbers out would freeze them at whatever was current on
# the day this was typed, and braucht_neuen_hash below is exactly how an existing
# account moves up to newer settings, so there is nothing to gain by pinning.
#
# One operational consequence worth knowing: each hash claims 64 MiB while it
# runs. That is fine at this scale, but it is a real limit on how many sign ins
# can be in flight at once, and it is the number to look at first if the service
# ever runs out of memory under load.
_hasher = PasswordHasher()

# Long enough that guessing is hopeless, short enough that people do not give up
# and write it on a note. Current guidance is against also demanding a digit, a
# capital and a symbol: those rules push people towards "Passwort1!" and towards
# writing it down, which costs more than the entropy they add.
MINDESTLAENGE = 12

# Not a limit on real passphrases, which is why it is far above anything anyone
# types. It exists because hashing is deliberately expensive, so an unbounded
# input is a way to make the server do a great deal of work on request. A refusal
# rather than a silent truncation: quietly cutting a password at some length
# means the part beyond it never protected anything, and nobody was told.
HOECHSTLAENGE = 1024


class PasswortZuKurz(BenutzerFehler):
    """Raised when a password is below MINDESTLAENGE."""

    def __init__(self, mindestlaenge: int = MINDESTLAENGE) -> None:
        self.mindestlaenge = mindestlaenge
        super().__init__(f"Password shorter than {mindestlaenge} characters")


class PasswortZuLang(BenutzerFehler):
    """Raised when a password is above HOECHSTLAENGE."""

    def __init__(self, hoechstlaenge: int = HOECHSTLAENGE) -> None:
        self.hoechstlaenge = hoechstlaenge
        super().__init__(f"Password longer than {hoechstlaenge} characters")


def pruefe_passwortregel(passwort: str) -> None:
    """Raises if the password is not one we are willing to store.

    Length is measured in characters, not bytes, so an accented or non Latin
    passphrase is not quietly penalised for encoding to more bytes.
    """
    if len(passwort) < MINDESTLAENGE:
        raise PasswortZuKurz
    if len(passwort) > HOECHSTLAENGE:
        raise PasswortZuLang


def hashe_passwort(passwort: str) -> str:
    """Checks the password against the policy, then hashes it.

    The check happens here rather than being left to the caller, so there is no
    route to storing a password that breaks the rule. A caller who forgets to
    validate gets an exception instead of a weak account.

    Every call returns a different string for the same password, because a random
    salt goes into each one. That is what stops two people with the same password
    being visibly identical in the table, and it is why a hash can only ever be
    checked with pruefe_passwort and never compared with ==.
    """
    pruefe_passwortregel(passwort)
    return _hasher.hash(passwort)


def pruefe_passwort(passwort: str, passwort_hash: str) -> bool:
    """Whether this password produced this hash.

    Returns False rather than raising for every failure, including a hash that is
    corrupt or was written by some other tool. A malformed hash in one row is a
    data problem worth fixing, but it must not turn a sign in attempt into a
    server error, and it must not look any different from a wrong password to
    whoever is trying.
    """
    try:
        return _hasher.verify(passwort_hash, passwort)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def braucht_neuen_hash(passwort_hash: str) -> bool:
    """Whether this hash was made with weaker settings than we now use.

    A stored hash keeps the settings it was made with forever, so an account
    created years ago stays at that strength unless something re-hashes it. The
    only moment the plain password is available to do that is during a successful
    sign in, so feature 2b checks this there and quietly stores a fresh hash when
    it answers true.
    """
    try:
        return _hasher.check_needs_rehash(passwort_hash)
    except InvalidHashError:
        # Unreadable, so it certainly cannot be verified against. Replacing it is
        # the only useful thing left to do with it.
        return True
