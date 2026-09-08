"""What the account endpoints accept and return.

BenutzerAntwort is load-bearing. Feature 2c models the signed-in user on it, and
feature 16's user administration list reuses it, so a field added here is a field
they both get. password_hash is not on it and never will be: a response model
that lists its fields explicitly is what makes that a guarantee rather than a
habit, because a model built from the whole row would gain any column added later.
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.benutzer import Locale, Rolle

# Far above any address anybody has, and far below a payload worth hashing. It
# exists so a request cannot be arbitrarily large before anything looks at it.
EMAIL_HOECHSTLAENGE = 254

# Above the password policy's own maximum, so the refusal for an over-long
# password comes from the policy with its own message rather than from here.
PASSWORT_HOECHSTLAENGE = 4096


class AnmeldungAnfrage(BaseModel):
    """The sign-in request.

    email is a plain string rather than EmailStr on purpose. An address that is
    not an address at all is answered exactly like a wrong password, because
    anything else is one more signal for somebody probing the login page. The
    real address check happens where the account is looked up.
    """

    email: str = Field(min_length=1, max_length=EMAIL_HOECHSTLAENGE)
    passwort: str = Field(min_length=1, max_length=PASSWORT_HOECHSTLAENGE)


class BenutzerAntwort(BaseModel):
    """The signed-in account, as every screen sees it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    rollen: list[Rolle]
    regierungspraesidium: int | None
    locale: Locale
    ist_aktiv: bool


class FehlerAntwort(BaseModel):
    """The shape every refusal from this API takes.

    Two fields, because they have two different readers. code is for the browser,
    which decides what to do about a failure and must not do that by matching on
    a sentence somebody may reword. nachricht is for the person, and says what
    went wrong and what they can do about it.
    """

    code: str
    nachricht: str
