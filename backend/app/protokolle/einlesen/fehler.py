"""Why a file is not a protocol this application can import.

Facts, no wording, like `app/protokolle/fehler.py` and for the same reason:
`app/api/fehler_http.py` turns these into HTTP responses and feature 17
translates them, so a message written here could be translated nowhere.

Why a file could not be *opened at all* is `app/formular/fehler.py`. These are
the refusals for a file that opened fine and is not the thing we were handed it
as.

What these carry is the form's own version stamp, never an answer anybody typed.
The note at the top of `app/protokolle/fehler.py` explains why that line matters:
a message built out of a person's own data repeats it back into logs and
screens, and none of these can.
"""


class EinleseFehler(Exception):
    """Base for everything here, so a caller can catch the family."""


class FormularversionFehlt(EinleseFehler):
    """The file does not say which form version it is.

    Its version field is gone, empty, or holds something that is not a version.
    Refused rather than assumed, because the other fields looking familiar is not
    evidence: ADR 0004 turns on a protocol knowing the version it was filled in
    under, and guessing it would put answers under rules they were never checked
    against.
    """


class FormularversionPasstNicht(EinleseFehler):
    """A protocol form, and not the one this deployment serves.

    Overwhelmingly the Protokoll Krebs, which FFS distributes alongside this one
    and which is feature 21. Carrying both versions means the message can say
    what the file actually is instead of only what it is not, which is the
    difference between "wrong file" and "this is the crayfish protocol".
    """

    def __init__(self, gefunden: str, erwartet: str) -> None:
        super().__init__(f"the file is form version {gefunden}, not {erwartet}")
        self.gefunden = gefunden
        self.erwartet = erwartet
