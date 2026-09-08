"""The session cookie: where it is set, and where it is cleared.

Both live here for one reason. A browser deletes a cookie by matching the name,
the path and the domain, so a sign-out whose attributes differ from the sign-in's
silently does nothing at all, and the response still says 200. One module, one
set of attributes, and that failure cannot happen.

docs/decisions.md fixed the cookie over browser storage: browser storage is
readable by any script on the page, and one bad dependency would be enough to
copy every session out. httpOnly means the page's own JavaScript cannot read this
one, so a compromised dependency can still make requests but cannot take the
session anywhere.
"""

import uuid
from typing import Any, Literal

from fastapi import Response

from app.config import get_settings
from app.security.token import erstelle_token

# Changing this name signs everybody out, because the browser keeps sending the
# old one and nothing reads it.
SITZUNGS_COOKIE = "befischung_sitzung"

# Lax rather than Strict. Lax already stops another site's form posting to us as
# the signed-in user, because every state-changing route here is a POST, PUT or
# DELETE and Lax withholds the cookie from all of those when the request comes
# from elsewhere. Strict would additionally withhold it from an ordinary link,
# and feature 14 emails people links into the application: they would arrive at a
# login page they do not need, and a refresh would fix it, which is exactly the
# sort of behaviour nobody ever reports as a bug.
SAMESITE: Literal["lax"] = "lax"


def _eigenschaften() -> dict[str, Any]:
    """The attributes both setting and clearing must agree on, in one place.

    A dict rather than the same four keywords written twice, so the two cannot
    drift apart. They are read fresh each call because cookie_secure comes from
    the settings, which the tests substitute.
    """
    return {
        "key": SITZUNGS_COOKIE,
        "httponly": True,
        "secure": get_settings().cookie_secure,
        "samesite": SAMESITE,
        "path": "/",
    }


def setze_sitzung(response: Response, benutzer_id: uuid.UUID) -> None:
    """Attach a fresh session cookie to this response."""
    response.set_cookie(
        value=erstelle_token(benutzer_id),
        # Matches the token's own expiry, so the browser stops sending a cookie
        # at about the moment the service would start refusing it. Without it the
        # cookie would live until the browser closed and every request after
        # expiry would be a pointless round trip.
        max_age=get_settings().sitzungsdauer_stunden * 60 * 60,
        **_eigenschaften(),
    )


def loesche_sitzung(response: Response) -> None:
    """Clear the session cookie, with the attributes it was set with."""
    response.delete_cookie(**_eigenschaften())
