"""What can go wrong with an attachment, as types rather than strings.

The same arrangement as app/protokolle/fehler.py and app/benutzer/fehler.py:
these carry the facts and no wording, so app/api/fehler_http.py turns them into
HTTP responses and feature 17 can translate them without touching the rules.

**Each of these carries the filename, and that is deliberate.** Everywhere else
in this backend a refusal names a field path and never a value, because values
are survey data. A filename is different: a pick can hold twenty files and the
surveyor has to be told which one to go back for, and the name is theirs rather
than somebody else's. Feature 10 set that standard on 2026-09-06 and this is the
server half of it.

Nothing here carries a single byte of the file. The name, and the numbers the
message needs, and nothing else.
"""


def sicherer_name(dateiname: str, hoechstens: int = 120) -> str:
    """A filename fit to put in a message.

    Two things are taken out. Control characters, including newlines, because a
    name carrying them would break the line of a log and could make one refusal
    look like several. And anything past a sensible length, because a name is
    allowed to be long and a message quoting all of it stops being readable.

    The name is otherwise left exactly as picked: this is what the surveyor will
    look for on their own machine, so a "cleaned up" version helps nobody.

    No name at all comes back as no name, so a refusal about no particular file,
    such as AnlageNichtGefunden, does not open with a prefix. A name that was
    given but is unprintable comes back as a placeholder instead, because there
    the message really is about one file and saying nothing would read as a bug.
    """
    if not dateiname:
        return ""

    sauber = "".join(zeichen for zeichen in dateiname if zeichen.isprintable())
    if len(sauber) > hoechstens:
        sauber = sauber[:hoechstens] + "..."
    return sauber or "(ohne Namen)"


class AnlageFehler(Exception):
    """Base for everything in this module, so a caller can catch the family."""

    def __init__(self, dateiname: str, meldung: str) -> None:
        self.dateiname = sicherer_name(dateiname)
        super().__init__(meldung)


class AnlageNichtGefunden(AnlageFehler):
    """No such attachment on this protocol.

    Raised for an attachment that does not exist, one belonging to a different
    protocol, and one whose file has gone missing from the volume. All three
    answer the same 404 for the reason ProtokollNichtGefunden gives at length:
    telling them apart lets a stranger map out which ids are real.

    The missing-file case is the odd one of the three and is admitted rather than
    hidden. app/anlagen/speicher.py explains why a row can outlive its file. A 500
    would claim the server is broken when the honest answer is that the picture is
    gone.
    """

    def __init__(self, dateiname: str = "") -> None:
        super().__init__(dateiname, "No such attachment on this protocol")


class AnlageTypUnzulaessig(AnlageFehler):
    """The request says this file is a kind we do not accept.

    Judged on what the request declared, which mirrors what
    frontend/src/protokoll/anlagen/regeln.ts checks in the browser. A declaration
    is not evidence, so AnlageInhaltKeinBild below checks the bytes as well; this
    is the cheaper half and the one that produces the friendlier message.
    """

    def __init__(self, dateiname: str, gemeldeter_typ: str) -> None:
        self.gemeldeter_typ = gemeldeter_typ
        super().__init__(dateiname, f"Declared type {gemeldeter_typ!r} is not accepted")


class AnlageInhaltKeinBild(AnlageFehler):
    """The bytes are not a picture of a kind we accept, whatever the request said.

    The real gate, and the one check the browser cannot make. A browser reports
    the type it guessed from the file's extension, and a request written by hand
    can claim anything at all, so an HTML file named karte.jpg would otherwise be
    stored and later served back from our own origin. The first bytes of a JPEG,
    a PNG and a WEBP each say what they are, and that is the only trustworthy
    evidence in the whole request.
    """

    def __init__(self, dateiname: str) -> None:
        super().__init__(dateiname, "File contents are not an accepted image")


class AnlageZuGross(AnlageFehler):
    """The file is past the size one attachment may be.

    Carries both numbers because the message has to say how far over it is. The
    count is what had been read when the cap was passed, not the whole file: the
    read stops there rather than taking the rest of something we already know we
    will refuse.
    """

    def __init__(self, dateiname: str, gelesen: int, hoechstens: int) -> None:
        self.gelesen = gelesen
        self.hoechstens = hoechstens
        super().__init__(dateiname, f"File exceeds {hoechstens} bytes")


class AnlagenartVoll(AnlageFehler):
    """This protocol already holds as many of this kind as it may.

    Carries the numbers rather than a sentence, so the message can say "you
    already have twenty" instead of "limit exceeded". Feature 10's standard: the
    useful half of a refusal is the way out, and here the way out is removing one
    first, which the person can only decide about if they know how many there are.
    """

    def __init__(self, dateiname: str, art: str, vorhanden: int, hoechstens: int) -> None:
        self.art = art
        self.vorhanden = vorhanden
        self.hoechstens = hoechstens
        super().__init__(dateiname, f"Already holds {vorhanden} of {hoechstens} {art}")
