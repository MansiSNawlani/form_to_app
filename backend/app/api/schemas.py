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
from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.anlage import Anlagenart
from app.models.benutzer import Locale, Rolle
from app.models.protokoll import Status
from app.protokolle.regeln import MAX_ZEICHEN_PRO_ANTWORT
from app.protokolle.uebergang.regeln import Aktion

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
    # When the account was made. Feature 16b's list shows it so an administrator
    # can tell a long-standing account from one created this morning.
    #
    # updated_at is deliberately absent. _erneuere_hash_falls_noetig writes to
    # the row on any sign in where the hashing settings have moved on, so the
    # column is not a "last edited" date, and a column labelled one that is not
    # one is worse than no column at all.
    created_at: datetime


class KontoAnlegenAnfrage(BaseModel):
    """A new account, as feature 16c's form sends it.

    Deliberately not AnmeldungAnfrage with extra fields. Sign-in treats a
    malformed address like a wrong password, so that nothing about the request
    tells somebody probing whether an address exists; creating an account is done
    by a Super Admin who is already signed in, and there the opposite is true:
    "that is not an address" is exactly what they need to be told. The two shapes
    look alike and answer to different rules.

    The roles, the region and the password are checked by the rules in
    app/benutzer, not here. What this model does is refuse a request that is the
    wrong shape or an unreasonable size before any of that runs.
    """

    email: str = Field(min_length=1, max_length=EMAIL_HOECHSTLAENGE)
    passwort: str = Field(min_length=1, max_length=PASSWORT_HOECHSTLAENGE)
    rollen: list[Rolle] = Field(min_length=1)
    regierungspraesidium: int | None = None
    locale: Locale = Locale.DE


class KontoAendernAnfrage(BaseModel):
    """A change to an account, as feature 16d's form sends it.

    Every field is optional, and a field that is left out is left alone. That is
    what makes the shape usable for a screen where somebody edits one thing.

    **The difference between absent and null is load-bearing, and it applies to
    exactly one field.** regierungspraesidium is genuinely nullable, so "do not
    touch the region" and "clear the region" are different instructions and a
    default of None cannot express both. model_fields_set is what tells them
    apart, and wurde_gesetzt below is how the router reads it.

    On the other four, null means nothing. An account has no state in which it
    has no email or no language, so a request sending one explicitly is a mistake
    rather than an instruction, and the validator below refuses it. Ignoring it
    instead would be worse than refusing: the change would appear to be accepted
    and nothing would happen, which reads as the server losing the edit. Refusing
    it is also what lets the router narrow these to "a value or nothing" without
    a cast.

    rollen has min_length=1 rather than allowing an empty list, so "no roles at
    all" is refused here with the request rather than after a database round
    trip. It is still checked again by normalisiere_rollen, because this model is
    not the only way into that service function.
    """

    model_config = ConfigDict(extra="forbid")

    email: str | None = Field(default=None, min_length=1, max_length=EMAIL_HOECHSTLAENGE)
    rollen: list[Rolle] | None = Field(default=None, min_length=1)
    regierungspraesidium: int | None = None
    locale: Locale | None = None
    ist_aktiv: bool | None = None

    def wurde_gesetzt(self, feld: str) -> bool:
        """Whether the request actually carried this field.

        Only regierungspraesidium needs this, because it is the only field where
        a sent null means something. For the rest the validator below has already
        ruled null out, so "is not None" and "was sent" are the same question.
        """
        return feld in self.model_fields_set

    @model_validator(mode="after")
    def _kein_ausdrueckliches_null(self) -> "KontoAendernAnfrage":
        ohne_leerwert = ("email", "rollen", "locale", "ist_aktiv")
        geleert = [
            feld
            for feld in ohne_leerwert
            if feld in self.model_fields_set and getattr(self, feld) is None
        ]
        if geleert:
            raise ValueError(
                "Diese Felder koennen nicht geleert werden: " + ", ".join(geleert)
            )
        return self


class PasswortAnfrage(BaseModel):
    """A new password for an account, set by an administrator.

    Its own request rather than a field of KontoAendernAnfrage. A password must
    never travel beside values that get echoed back in a validation error, and
    keeping it in a body of its own is what makes that easy to keep true.

    The length policy lives in app/security/passwoerter.py and produces its own
    message. The bound here is only a cap on how large a request may be before
    anything looks at it, and it sits above the policy's maximum so the policy is
    what refuses a long password.
    """

    passwort: str = Field(min_length=1, max_length=PASSWORT_HOECHSTLAENGE)


class ProtokollAntwort(BaseModel):
    """One protocol with its answers, and the envelope around them.

    Load-bearing. Feature 3b models the browser's draft on this, so a field added
    here is a field the form gets, and feature 11e's reviewer screen draws its
    summary bar out of the envelope fields at the bottom.

    **The owner used to be deliberately absent**, on the grounds that every route
    answering with this model had already filtered on the caller's own id and
    would only be repeating back who was asking. Feature 11d ended that: FFS staff
    read protocols they did not file, and the first thing a reviewer's screen has
    to print is whose protocol this is. The rest of that reasoning still holds,
    which is why this model lists its fields explicitly rather than being built
    from the whole row: a column added later cannot appear here by itself.

    Validated from app/protokolle/dienst.py's Protokollansicht rather than from
    the row, because two of the fields are not columns on it.

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

    #: The account that filed it, as an address. Named for what it is meant to be
    #: rather than for what it holds, exactly as VerlaufEintrag.akteur_name is, so
    #: feature 16 can put a real name behind it without this changing.
    eingereicht_von: str
    #: When it was first handed in, which a re-submission deliberately does not
    #: move. Null while it is still a draft.
    submitted_at: datetime | None
    #: Written by Annehmen and by nothing else, since accepting and locking are
    #: one action.
    locked_at: datetime | None
    #: The frozen snapshot taken at submit, so a historical protocol still reads
    #: correctly after the Person record behind it changes. Not the live answer.
    bearbeiter_name: str | None
    #: The coded occasion, never its label. The browser owns the labels.
    anlass: str | None
    #: 1 to 4, off the Probestrecke matched at submit. Null on a draft, which has
    #: no Probestrecke yet.
    regierungspraesidium: int | None


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


class AbsendenAnfrage(BaseModel):
    """A submit: the version the browser was working from, and nothing else.

    Required for the same reason a save carries one, and with more at stake.
    Submitting cannot be taken back, so a tab left open across somebody else's
    editing session must not be able to send a document that is no longer the
    current one: the surveyor would have submitted answers they never saw.

    No answers. Whatever is stored is what gets submitted, so a submit carrying
    its own document would be a save and a submit in one request, with two ways
    for them to disagree.
    """

    version: int = Field(ge=1)


class AbsendenAntwort(BaseModel):
    """What a submit answers with: where the protocol ended up.

    Not the whole protocol. The browser is leaving the form for Meine Protokolle,
    which fetches its own rows, so the answers it already holds are of no further
    use to it.

    version comes back because a tab still open on this protocol is now behind,
    and submitted_at because it is the moment the record left the surveyor's
    hands.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    version: int
    submitted_at: datetime


class EntscheidungAnfrage(BaseModel):
    """A reviewer's decision, and why.

    One route for all three rather than three routes, because the reviewer screen
    is one radio group and one button: prototypes/pruefung-protokoll.html offers
    Annehmen, Aenderung anfordern and Ablehnen as a single choice with a single
    Begruendung under it.

    Typed as the three decisions rather than as Aktion, so ABSENDEN and
    IN_PRUEFUNG_NEHMEN cannot arrive here. Neither is a decision, and both have
    their own way in.

    No version. A save carries one because two tabs editing the same answers
    overwrite each other; a decision writes no answer, and two reviewers deciding
    at once are handled by the row lock in app/protokolle/uebergang/dienst.py.

    The cap is the one app/protokolle/regeln.py already puts on a single answer.
    A Begruendung is a few sentences; anything approaching four thousand
    characters is a pasted document, and the column has no business storing one.
    """

    entscheidung: Literal[Aktion.ANNEHMEN, Aktion.AENDERUNG_ANFORDERN, Aktion.ABLEHNEN]
    kommentar: str | None = Field(default=None, max_length=MAX_ZEICHEN_PRO_ANTWORT)


class UebergangAntwort(BaseModel):
    """Where the protocol ended up after a transition.

    Not the whole protocol, for the reason AbsendenAntwort is not: the reviewer
    screen refetches what it needs, and the answers travelled to it already.

    No version. Nothing here changes the answers document, so the number that
    guards it has not moved and echoing it back would suggest it had.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    locked_at: datetime | None


class VerlaufEintrag(BaseModel):
    """One line of a protocol's history.

    Mirrors prototypes/pruefung-protokoll.html's Verlauf panel, which prints what
    happened, who did it, when, and the comment underneath.

    akteur_name is the account's email address, because User has no display name:
    project-overview.md gives it email, rollen and locale and nothing else to call
    a person by. The mockup prints "Dr. S. Lehmann", which no table can supply
    today. It is named for what it is meant to be rather than for what it
    currently holds, so feature 16 can put a real name behind it without every
    caller changing.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    von_status: Status | None
    nach_status: Status
    kommentar: str | None
    akteur_name: str
    created_at: datetime


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


class Pruefstatus(StrEnum):
    """Which states the review queue may be asked for: every one but DRAFT.

    A narrower enum rather than a hand-written check, so asking for drafts is
    refused by FastAPI with a 422 and the generated docs list the six acceptable
    values instead of seven with one that always fails.

    Drafts are missing because the queue never lists one. Accepting DRAFT here and
    quietly returning nothing would read like a database with no protocols in it,
    which is a worse answer than saying no.

    Pinned against Status in app/api/schemas_test.py, so a state added to the
    protocol later cannot silently become unaskable here.
    """

    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    NEEDS_CHANGES = "NEEDS_CHANGES"
    REJECTED = "REJECTED"
    ACCEPTED = "ACCEPTED"
    LOCKED = "LOCKED"


class PruefzeileAntwort(BaseModel):
    """One protocol as the review queue shows it, without its answers.

    Mirrors Pruefzeile in app/protokolle/pruefliste/dienst.py, which is where
    every value below is read. Load-bearing: feature 12b renders exactly these
    fields, 12c adds a filter over them and 12d walks the list they come in.

    **Deliberately not ProtokollUebersicht.** That model is Meine Protokolle's. It
    reads five display values out of the answers document, because a draft has no
    envelope behind it, and it carries no Bearbeiter, no filer and no region.
    Widening it to serve both screens would put nullable fields on a list that
    never needs them and tie two screens to one shape.

    Four of these are nullable columns on the row and are not optional here.
    umschlag_bei_abgabe requires the whole envelope the moment a protocol leaves
    DRAFT, and nothing in this list is a draft.

    What each field means is written once, on Pruefzeile. Saying it again here
    would be two descriptions of one value, free to drift apart.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Status
    form_version: str

    datum: date
    anlass: str
    bearbeiter_name: str
    submitted_at: datetime
    updated_at: datetime

    eingereicht_von: str

    gewaessername: str
    ortsangabe: str
    laenge_m: int
    monitoringstrecke_nr: str | None
    regierungspraesidium: int


class PrueflisteAntwort(BaseModel):
    """One page of the review queue, and enough to draw a pager around it.

    Mirrors Prueflistenseite in app/protokolle/pruefliste/dienst.py, which is
    where what each of the four numbers promises is written down.
    """

    model_config = ConfigDict(from_attributes=True)

    zeilen: list[PruefzeileAntwort]
    gesamt: int
    seite: int
    pro_seite: int
    seiten: int


class NachbarAntwort(BaseModel):
    """The protocol standing next to another one in the review queue.

    Mirrors Nachbar in app/protokolle/pruefliste/dienst.py, which is where what
    each of the three values promises is written down.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seite: int
    gewaessername: str


class NachbarschaftAntwort(BaseModel):
    """Where one protocol sits in the queue, and what stands either side of it.

    Mirrors Nachbarschaft in app/protokolle/pruefliste/dienst.py, where what
    each value promises and why a protocol outside the list is answered rather
    than refused are both written down.
    """

    model_config = ConfigDict(from_attributes=True)

    position: int | None
    seite: int | None
    vorheriges: NachbarAntwort | None
    naechstes: NachbarAntwort | None


class AnlageAntwort(BaseModel):
    """One attachment, without its bytes.

    Mirrors the Anlage record in frontend/src/protokoll/anlagen/typen.ts, which
    feature 10 shaped against the Attachment model for exactly this moment, so
    the swap in step 6 is plumbing rather than a reshape.

    **storage_key is deliberately absent, and must stay absent.** It is a path. A
    client has no use for one, and a path a client knows is a path a client will
    eventually try to bend. Listing the fields explicitly rather than dumping the
    row is what makes that a guarantee instead of a habit.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submission_id: uuid.UUID
    art: Anlagenart
    dateiname: str
    #: What the bytes proved to be, not what the upload claimed.
    mime_type: str
    #: Bytes, as counted while the upload was read.
    groesse: int
    created_at: datetime


class VerstossAntwort(BaseModel):
    """One thing wrong with a protocol somebody tried to submit.

    See Formverstoss in app/protokolle/formregeln/regel.py for why this is a key
    and not a sentence. This is that type on the wire.

    pfad is a dotted path into the answers document, or one of the pseudo-paths
    the rules use where the wrong thing is a combination rather than a single
    field. Every field on the form carries its path as its DOM id, so the browser
    can point straight at the control this concerns.
    """

    model_config = ConfigDict(from_attributes=True)

    pfad: str
    schluessel: str


class EinleseAntwort(BaseModel):
    """What an import produced, beyond the protocol itself.

    The report 23c draws beside a freshly imported draft. Three different things,
    deliberately kept apart rather than merged into one list of problems, because
    the person can do something different about each: the rules' complaints are
    theirs to fix, an answer that could not be taken over is theirs to retype, and
    a picture the file carries is something they have to attach again.

    **unbekannt is deliberately not here.** A field the file holds that this
    application has no home for means our definition and the file disagree, which
    is our problem rather than something the person uploading can act on. It is
    logged instead, and this project's rule is that a message somebody sees has to
    tell them what to do.
    """

    model_config = ConfigDict(from_attributes=True)

    #: The version the **file** declared, which is not the version the protocol
    #: carries. Every import is a new survey stamped with the version this
    #: deployment serves, so this says which template was filled in, nothing more.
    quellversion: str = Field(validation_alias="version")

    #: Answers the file held that could not be taken over, as field paths. A date
    #: written in a way this application cannot read is the usual one. The value
    #: is in the protocol exactly as the file wrote it, so nothing is lost; it
    #: simply has to be looked at.
    unbrauchbar: list[str]

    #: How many pictures the file carries. They did not come with the answers,
    #: and an attachment is part of the protocol rather than a decoration on it,
    #: so the person has to be told rather than left to notice. Feature 23d is
    #: what reads them out into real Anlagen.
    bilder: int

    #: Everything the rules say is wrong or missing, exactly as a refused Absenden
    #: reports it. An empty list means the protocol could be submitted as it
    #: stands, which is a real answer and not a failure to check.
    verstoesse: list[VerstossAntwort]


class EingelesenesProtokoll(BaseModel):
    """What the import endpoint answers with: the draft, and what came of it.

    The protocol in the shape the create and read routes already answer with, so
    the browser can go straight to the form with a document it knows how to hold,
    and the report beside it rather than inside it: one is the protocol, the other
    is about the import that made it, and only one of the two is worth keeping.
    """

    protokoll: ProtokollAntwort
    bericht: EinleseAntwort


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

    # Only a refused submit fills this in. Every other refusal leaves it out, so
    # nothing reading the old two-field shape breaks.
    #
    # It exists because this is the one refusal the browser draws rather than
    # prints: a panel listing each unfinished or broken answer next to the field
    # it concerns. A sentence could not be drawn that way.
    verstoesse: list[VerstossAntwort] | None = None
