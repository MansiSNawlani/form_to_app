"""What can go wrong with a protocol, as types rather than strings.

The same arrangement as app/benutzer/fehler.py, and for the same reason: these
carry the facts and no wording, so app/api/fehler_http.py can turn them into HTTP
responses and feature 17 can translate them without touching the rules.

None of these ever carries an answer somebody typed. They carry field paths,
which come from our own form definition rather than from the request, so a
message built out of them cannot repeat a person's data back at them or into a
log. That is the whole reason app/api/fehler_http.py replaces FastAPI's own
validation response.
"""

import uuid
from dataclasses import dataclass
from enum import StrEnum


class Verstossgrund(StrEnum):
    """Why one answer could not be stored.

    Kept apart rather than folded into one "invalid", because the three have
    nothing in common except that none of them went in, and what to do about each
    is different. This is the standard the frontend's pruefeAnlage already
    follows for attachments.
    """

    #: No such field on this form version. Almost always our own bug.
    UNBEKANNT = "unbekannt"
    #: A number, a list or an object where the form holds text.
    KEIN_TEXT = "kein_text"
    #: Text past the length one answer may be.
    ZU_LANG = "zu_lang"
    #: A key with a dot in it, which would be a second spelling of a nested path.
    PUNKT_IM_SCHLUESSEL = "punkt_im_schluessel"


@dataclass(frozen=True)
class Verstoss:
    """One answer that could not be stored, and why.

    The path only. Never the value: see the note at the top of this file.
    """

    pfad: str
    grund: Verstossgrund


class ProtokollFehler(Exception):
    """Base for everything in this module, so a caller can catch the family."""


class ProtokollNichtGefunden(ProtokollFehler):
    """No protocol with this id that this account may see.

    Deliberately one error for two situations: there is no such protocol, and
    there is one but it belongs to somebody else. Telling them apart would let a
    stranger discover which ids exist, which for surveys filed by named external
    consultants is a fact about other people's work that nobody outside it should
    be able to collect. It is the same reasoning that keeps
    AnmeldungFehlgeschlagen from saying whether an account exists.

    It carries the id because a log needs it. The message built from it does not.
    """

    def __init__(self, protokoll_id: uuid.UUID) -> None:
        self.protokoll_id = protokoll_id
        super().__init__(f"No protocol {protokoll_id} for this account")


class ProtokollVeraendert(ProtokollFehler):
    """The protocol moved on since the version this save was working from.

    A save replaces the whole answers document, so two tabs open on the same
    protocol are two copies racing each other: the one that saves second
    overwrites everything the first put in, with nothing on screen to say so. On
    a form filled in over several sittings that is real lost work, and
    frontend/src/protokoll/anlagen/store.ts already records that the same
    protocol open twice is ordinary here rather than an edge case.

    So a save says which version it was working from, and this is what happens
    when that is no longer the current one. Nothing is written.

    Carries both numbers for a log. The message says what to do rather than
    quoting them, because "version 4, expected 7" means nothing to a surveyor.
    """

    def __init__(self, erwartet: int, tatsaechlich: int) -> None:
        self.erwartet = erwartet
        self.tatsaechlich = tatsaechlich
        super().__init__(f"Save based on version {erwartet}, stored version is {tatsaechlich}")


class ProtokollNichtMehrEntwurf(ProtokollFehler):
    """The protocol has been submitted, so its owner may no longer change it.

    Nothing in this feature can produce a submission that is not a draft, so this
    guards feature 11 rather than anything today: the moment submitting exists, a
    save or a delete arriving late, from a tab left open across the submit, must
    not quietly undo it.

    Which states are editable is feature 11's to decide, and NEEDS_CHANGES will
    almost certainly join DRAFT. That widening happens in app/protokolle/regeln.py
    in one place, not at each call site.
    """

    def __init__(self, status: str) -> None:
        self.status = status
        super().__init__(f"Protocol is {status}, not a draft")


class AntwortenNichtLesbar(ProtokollFehler):
    """The answers are not a document at all.

    A list, a number or a string where an object belongs. Pydantic already
    refuses this at the route, so in practice this guards the rules being called
    from somewhere else, such as a future import script.
    """


class AntwortenZuGross(ProtokollFehler):
    """The document as a whole is past the size a protocol can be.

    Carries both numbers because the message has to say how far over it is.
    Nothing filled in legitimately comes close, so this is a runaway client or a
    paste of something that does not belong in a form.
    """

    def __init__(self, zeichen: int, hoechstens: int) -> None:
        self.zeichen = zeichen
        self.hoechstens = hoechstens
        super().__init__(f"Answers document holds {zeichen} characters, limit {hoechstens}")


class AntwortenUngueltig(ProtokollFehler):
    """One or more answers are not something this form can hold.

    Carries every violation rather than only the first. A client sending one
    wrong path is probably sending several, and reporting them one save at a time
    turns a five minute fix into an afternoon.
    """

    def __init__(self, verstoesse: tuple[Verstoss, ...]) -> None:
        self.verstoesse = verstoesse
        super().__init__(f"{len(verstoesse)} answers could not be stored")

    def nach_grund(self) -> dict[Verstossgrund, list[str]]:
        """The offending paths grouped by why, for a message that reads sensibly.

        Sorted so the same broken document always produces the same sentence,
        which matters for a test and for anybody comparing two reports.
        """
        gruppen: dict[Verstossgrund, list[str]] = {}
        for verstoss in self.verstoesse:
            gruppen.setdefault(verstoss.grund, []).append(verstoss.pfad)
        return {grund: sorted(pfade) for grund, pfade in gruppen.items()}
