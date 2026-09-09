"""What the endpoints accept and return.

One file rather than one per router, because the browser side mirrors these in a
single frontend/src/api/typen.ts and two files that have to be read together are
better kept together.

BenutzerAntwort is load-bearing. Feature 2c models the signed-in user on it, and
feature 16's user administration list reuses it, so a field added here is a field
they both get. password_hash is not on it and never will be: a response model
that lists its fields explicitly is what makes that a guarantee rather than a
habit, because a model built from the whole row would gain any column added later.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.benutzer import Locale, Rolle
from app.models.protokoll import Status

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


class ProtokollAntwort(BaseModel):
    """One protocol with its answers, as its owner sees it.

    Load-bearing. Feature 3b models the browser's draft on this, so a field added
    here is a field the form gets.

    owner_user_id is deliberately absent. Every route answering with this model
    already filtered on the caller's own id, so it would only ever repeat back
    who the caller is. Feature 12's review queue, where the owner is somebody
    else and worth showing, adds its own model rather than widening this one.

    version travels with the document because the next save has to say which
    version it was working from. Without it the browser could only send its
    answers and hope nothing else had changed in the meantime.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    form_version: str
    version: int
    # Left as a plain document rather than modelled field by field. The shape
    # check in app/protokolle/regeln.py is what validates it, against the
    # extracted form definition, because 540 field names restated here as
    # Pydantic fields is 540 chances to mistype one.
    antworten: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AntwortenSpeichern(BaseModel):
    """A save: the whole answers document, and the version it started from.

    The whole document rather than a patch, because the form holds every answer
    in one React Hook Form state and hands it over whole.

    version is what stops two open tabs overwriting each other. It is the version
    the browser last received, and the save is refused if the stored protocol has
    moved past it. Required rather than optional: a save with no version would be
    a save that silently wins every race, which is the thing this exists to
    prevent.

    antworten is left as a plain document rather than modelled field by field.
    app/protokolle/regeln.py checks it against the extracted form definition,
    because 540 field names restated here is 540 chances to mistype one.
    """

    version: int = Field(ge=1)
    antworten: dict[str, Any]


class SpeicherAntwort(BaseModel):
    """What a save answers with: the new state, without the answers.

    Deliberately not the whole protocol. Saving is automatic and fires while
    somebody types, so echoing a twenty kilobyte document back on every keystroke
    burst would be pure waste; the browser already has the answers it just sent.

    What it does not have is the new version, and it needs that for its next
    save, and the moment the save landed, which is what the indicator prints.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    version: int
    updated_at: datetime


class ProtokollUebersicht(BaseModel):
    """One protocol as the list shows it, without its answers.

    Mirrors app/protokolle/dienst.py's Protokollzeile, which is where the five
    display values below are read out of the answers document. Feature 3c's
    "Meine Protokolle" is built on exactly these fields, so anything the list
    needs to print has to be added in both places.

    A blank value arrives as null rather than an empty string. A field somebody
    typed into and then cleared reads to a person exactly like one they never
    touched, so there is one representation for "nothing to show".
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    form_version: str
    version: int
    created_at: datetime
    updated_at: datetime

    gewaessername: str | None
    ortsangabe: str | None
    laenge: str | None
    #: The day of the survey. updated_at is the day the draft was last touched.
    datum: str | None
    anlass: str | None


class FehlerAntwort(BaseModel):
    """The shape every refusal from this API takes, including a 422.

    Two fields, because they have two different readers. code is for the browser,
    which decides what to do about a failure and must not do that by matching on
    a sentence somebody may reword. nachricht is for the person, and says what
    went wrong and what they can do about it.

    Neither ever carries anything the caller sent. FastAPI's own validation
    response does, which is why app/api/fehler_http.py replaces it.
    """

    code: str
    nachricht: str
