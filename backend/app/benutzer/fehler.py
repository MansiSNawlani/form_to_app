"""What can go wrong with an account, as types rather than strings.

coding-standards.md asks for typed domain exceptions translated to HTTP
responses in one place. These are those types. They carry the facts about what
went wrong and deliberately no wording: the command line turns them into German
sentences, feature 2b's endpoints turn them into HTTP responses, and feature 17
will need the wording translated. A message baked in here could not serve all
three.

Each one exists because it has a different way out for the person who hit it,
which is the standard this project set on 2026-09-06. Collapsing them into one
"invalid account" would throw away exactly the part that helps.
"""


class BenutzerFehler(Exception):
    """Base for everything in this module, so a caller can catch the family."""


class EmailUngueltig(BenutzerFehler):
    """The email address is not a usable address at all."""

    def __init__(self, email: str, grund: str) -> None:
        self.email = email
        # The underlying library's explanation, in English, for a developer or a
        # log. Never shown to a user as it stands.
        self.grund = grund
        super().__init__(f"Not a usable email address: {email}")


class EmailBereitsVergeben(BenutzerFehler):
    """An account with this email already exists.

    Raised in place of the raw unique constraint violation, which reaches the
    surface as a database error naming an index and helps nobody.
    """

    def __init__(self, email: str) -> None:
        self.email = email
        super().__init__(f"An account already exists for {email}")


class RollenLeer(BenutzerFehler):
    """An account was asked for with no roles, which could do nothing at all."""


class RegierungspraesidiumFehlt(BenutzerFehler):
    """A regional account was asked for without saying which region.

    It matters because feature 13 scopes what such an account sees by this
    number. Without one the account would see every region, which is the
    opposite of what the role is for.
    """


class RegierungspraesidiumUnzulaessig(BenutzerFehler):
    """A region number was given for an account that is not a regional one.

    It scopes nothing on any other role, so it is a wrong value sitting in the
    table waiting to be read by something that assumes it means something.
    """

    def __init__(self, regierungspraesidium: int) -> None:
        self.regierungspraesidium = regierungspraesidium
        super().__init__(
            f"Regierungspraesidium {regierungspraesidium} on a non-regional account"
        )


class RegierungspraesidiumAusserhalbBereich(BenutzerFehler):
    """There are four Regierungspräsidien, so the number must be 1 to 4."""

    def __init__(self, regierungspraesidium: int) -> None:
        self.regierungspraesidium = regierungspraesidium
        super().__init__(f"Regierungspraesidium {regierungspraesidium} is not 1 to 4")


class BenutzerNichtGefunden(BenutzerFehler):
    """No account exists for this email."""

    def __init__(self, email: str) -> None:
        self.email = email
        super().__init__(f"No account found for {email}")


class LetzterSuperAdmin(BenutzerFehler):
    """The change would leave the application without an active Super Admin.

    Only a Super Admin can hand out a role, so emptying that role locks everybody
    out of administering anything. The way back would be a terminal on the
    machine the database runs on, which is the very dependency feature 16 exists
    to remove.

    Raised for all three ways to reach the same state: locking the last one,
    taking the role off the last one, and doing both in one change.
    """


class SelbstEntzugUnzulaessig(BenutzerFehler):
    """A Super Admin tried to lock their own account or drop their own role.

    One error for both, against the usual rule in this module that an error
    exists when it has a different way out, because here the way out is the same
    one: somebody else with the role has to do it. Both also have the same
    consequence, which is being signed out of the screen you are standing on with
    nothing left that can undo it.

    Deliberately not covered by LetzterSuperAdmin, which allows this as long as
    another Super Admin exists. Allowed or not, nobody means to do it.
    """


class AnmeldungFehlgeschlagen(BenutzerFehler):
    """The address and password together do not identify anybody.

    Deliberately one error for two different situations: no such account, and the
    wrong password for a real one. Telling them apart would turn the login page
    into a way of finding out who holds an account here, which for a form filed
    by named external consultants is worth more to an attacker than it looks.

    It carries no email on purpose. Anything that carries the address invites a
    message that repeats it back, and the distinction leaks from there.
    """

    def __init__(self) -> None:
        super().__init__("Sign in failed")


class KontoDeaktiviert(BenutzerFehler):
    """The account exists and the password was right, but it is switched off.

    The one place we say more than AnmeldungFehlgeschlagen would, and only ever
    after the correct password, so it tells an attacker nothing they did not
    already have. The alternative is somebody retrying a password they know is
    correct until they give up, which is the failure that generates a support
    call rather than a fix.
    """


class KontoNichtInteraktiv(BenutzerFehler):
    """An INTEGRATION account tried to sign in.

    project-overview.md makes that role machine only. Feature 2a deliberately let
    the command line create such an account and left the refusal to this layer,
    because it is a rule about signing in rather than about the account existing.
    """


class NichtAngemeldet(BenutzerFehler):
    """The request carries no usable session.

    One error for every way that can happen: no cookie, an expired token, a
    forged one, or an account that has been deactivated or removed since it was
    issued. They differ only in ways the person cannot act on, and the single
    thing they can do about any of them is sign in again.
    """


class RolleFehlt(BenutzerFehler):
    """Signed in, and without the role this needs.

    Deliberately not the same as NichtAngemeldet. Sending somebody to the login
    page when they are already signed in is a loop they cannot get out of, which
    is why 401 and 403 have to stay different answers all the way up.
    """

    def __init__(self, benoetigt: tuple[str, ...]) -> None:
        self.benoetigt = benoetigt
        super().__init__(f"Requires one of {', '.join(benoetigt)}")
