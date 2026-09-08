"""The session token: making one at sign in, and reading one on every request.

A JWT is three pieces of text joined by dots. The first says how it was signed,
the second is the content, and the third is a signature made with a secret only
this service knows. Anyone can read the content, which is why nothing private
goes in it, but nobody can change it: edit a single character and the signature
stops matching and the token is refused.

That is what lets the service keep no list of who is signed in. The browser
carries the proof, the service checks it, and two containers behind a load
balancer need not agree with each other about anything.

Three things are deliberately not in the token. The roles, because a token
holding them keeps working with the old ones after an administrator takes one
away; they are read from the account row on every request instead. Anything
private, because the content is readable by whoever holds the token. And any way
to revoke one, because there is no server side session to revoke: deactivating
the account is what takes effect immediately, since every request loads the row.

Plain functions over strings and a UUID, with no database and no HTTP, as
coding-standards.md asks of any rule where a wrong answer is possible.
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings

# Symmetric, because the service that signs a token is the service that checks
# it. An asymmetric pair would only start earning its complexity when something
# else has to verify our tokens without being able to mint them.
ALGORITHMUS = "HS256"


class TokenFehler(Exception):
    """Base for everything below, so a caller can catch the family.

    Every one of these means the same thing to a route: this request is not
    signed in. They are told apart so a log can say which, never so that a
    response can: telling somebody their token expired rather than was forged is
    a difference they cannot act on and an attacker can.
    """


class TokenAbgelaufen(TokenFehler):
    """The session has run out. The ordinary one: it happens to everybody daily."""


class TokenSignaturUngueltig(TokenFehler):
    """The signature does not match. Either forged, or signed with an old secret."""


class TokenFehlerhaft(TokenFehler):
    """Not a token this service could ever have made: unreadable, or missing the id."""


def erstelle_token(benutzer_id: uuid.UUID, *, ausgestellt_am: datetime | None = None) -> str:
    """The signed token for this account, valid for the configured session length.

    ausgestellt_am is an argument rather than always now() so the tests can make a
    token that already expired without waiting eight hours or moving the clock.
    Nothing in the application passes it.
    """
    ausgestellt_am = ausgestellt_am or datetime.now(UTC)
    laeuft_ab = ausgestellt_am + timedelta(hours=get_settings().sitzungsdauer_stunden)

    return jwt.encode(
        {"sub": str(benutzer_id), "iat": ausgestellt_am, "exp": laeuft_ab},
        get_settings().jwt_secret.get_secret_value(),
        algorithm=ALGORITHMUS,
    )


def lies_token(token: str) -> uuid.UUID:
    """The account id this token is for, or a TokenFehler saying why not.

    algorithms is pinned to the one we issue. Without that, a token could name its
    own algorithm and a forged one could claim it needs no signature at all.
    """
    try:
        inhalt = jwt.decode(
            token,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=[ALGORITHMUS],
            # The library checks exp by default. Named here because a token that
            # never expires is the kind of thing a later refactor turns off by
            # accident, and require makes its absence a refusal rather than a
            # token that lives forever.
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as fehler:
        raise TokenAbgelaufen from fehler
    except jwt.InvalidSignatureError as fehler:
        raise TokenSignaturUngueltig from fehler
    except jwt.InvalidTokenError as fehler:
        # Everything else the library can raise: unreadable, wrong algorithm, or
        # missing a claim we required above.
        raise TokenFehlerhaft from fehler

    try:
        return uuid.UUID(inhalt["sub"])
    except (ValueError, TypeError) as fehler:
        # Correctly signed and still not usable, so it was made by something of
        # ours that put the wrong thing in. Worth its own path: it is a bug on
        # this side rather than a bad request.
        raise TokenFehlerhaft from fehler
