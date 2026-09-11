"""What may be attached to a protocol.

The Python half of frontend/src/protokoll/anlagen/regeln.ts.
coding-standards.md requires every rule twice, once in the browser for instant
feedback and once here as the gate, because a browser rule is a convenience that
anybody can step around by not using the browser. Attachments have had only the
browser half since feature 10, which built them before there was a server to
enforce anything.

The values are the same on both sides and have to stay that way: three accepted
types, 10 MB, one Kartenausschnitt, twenty Fotos. If one of them changes, it
changes in both files in the same commit.

Plain functions over values, holding no database and no HTTP, exactly like
app/protokolle/regeln.py.

**The one rule that exists only here** is that the bytes have to be the picture
the request claims. A browser reports the type it guessed from the extension and
a request written by hand can claim whatever it likes, so this is not something
the browser could check even in principle. It is also the rule that matters most:
without it an HTML file named karte.jpg is stored, and later served from our own
origin, where it can read the session cookie of whoever opens it.

**HEIC is deliberately not repeated here.** The browser gives an iPhone owner its
own message with the two ways out, which is help rather than a gate, and a HEIC
file that reaches this far is refused by the type rules like anything else.
Keeping the advice in one place means one sentence to maintain rather than two,
and nobody in a field office will ever see a message written in Python.
"""

from app.anlagen.fehler import (
    AnlageInhaltKeinBild,
    AnlagenartVoll,
    AnlageTypUnzulaessig,
    AnlageZuGross,
)
from app.models.anlage import Anlagenart

# What a browser can put in an <img> without help. The same three as regeln.ts.
ERLAUBTE_TYPEN = frozenset({"image/jpeg", "image/png", "image/webp"})

# A phone photograph is 2 to 8 MB, so this leaves room without letting one file
# eat a protocol's whole allowance. Matches MAX_BYTES in regeln.ts.
MAX_BYTES = 10 * 1024 * 1024

# Not the legacy form's four photograph slots; feature 10 recorded why. Twenty is
# a safety valve rather than a judgement about the survey, and one map excerpt is
# a fact about the thing: there is one stretch and one excerpt of it.
MAX_FOTOS = 20
MAX_KARTENAUSSCHNITTE = 1

# The first bytes that say what a file really is, longest signature first so a
# shorter one cannot claim a file that a longer one describes better.
#
# JPEG starts FF D8 FF. PNG has an eight byte signature whose CR, LF and Ctrl-Z
# exist to catch a file mangled by a transfer that rewrote line endings. WEBP is
# a RIFF container, so its name sits at offset 8 rather than at the start, which
# is why it is checked apart from the others.
SIGNATUREN: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
)

# Enough to hold the longest signature and WEBP's name at offset 8. The service
# sniffs the first block it reads, which is far larger than this; the constant is
# here so a test can say what the minimum actually is.
KOPFGROESSE = 12


def hoechstzahl(art: Anlagenart) -> int:
    """How many of this kind one protocol may hold."""
    return MAX_FOTOS if art is Anlagenart.FOTO else MAX_KARTENAUSSCHNITTE


def erkenne_typ(kopf: bytes) -> str | None:
    """What these bytes actually are, or nothing if it is not a picture we accept.

    Only the three types this application serves. This is not a general file type
    detector and must not become one: everything it recognises is something we
    are prepared to hand back to a browser, so a type added here is a decision
    about what we serve, not about what we can name.
    """
    for signatur, typ in SIGNATUREN:
        if kopf.startswith(signatur):
            return typ

    # RIFF....WEBP, where the four bytes between are the file's length.
    if kopf[:4] == b"RIFF" and kopf[8:12] == b"WEBP":
        return "image/webp"

    return None


def pruefe_gemeldeten_typ(dateiname: str, gemeldeter_typ: str | None) -> None:
    """Refuse a file the request itself says is a kind we do not accept.

    The cheap half, mirroring what regeln.ts checks in the browser. It is worth
    doing even though pruefe_inhalt below is the real gate, because the two
    produce different messages: this one can say "that is not a picture", while a
    content check on a text file can only say the bytes are not an image, which
    is the same sentence a corrupted photograph would get.

    A missing type counts as not accepted. A browser that has never heard of the
    format sends an empty one, and empty is not evidence of anything.
    """
    if (gemeldeter_typ or "").lower() not in ERLAUBTE_TYPEN:
        raise AnlageTypUnzulaessig(dateiname, gemeldeter_typ or "")


def pruefe_inhalt(dateiname: str, kopf: bytes) -> str:
    """The type these bytes really are, or a refusal.

    **What comes back here is what gets stored and what the file is later served
    as.** The type the request declared never reaches the database, which is the
    whole point: the thing we hand back to a browser is described by its own
    contents rather than by whoever uploaded it.

    A file whose declared type and real type disagree but are both on the list,
    such as a photograph renamed from .png to .jpg, is accepted and stored as
    what it is. Refusing that would fail an honest upload to prove a point, and
    since the stored type comes from the bytes there is nothing left to be wrong
    about.
    """
    typ = erkenne_typ(kopf)
    if typ is None:
        raise AnlageInhaltKeinBild(dateiname)
    return typ


def pruefe_groesse(dateiname: str, gelesen: int) -> None:
    """Refuse a file past the cap.

    Asked repeatedly while the upload is being read rather than once at the end.
    Reading it all in first and checking afterwards means a client can send two
    gigabytes and have us hold every byte of it before we object, which is one
    request away from taking the service down.
    """
    if gelesen > MAX_BYTES:
        raise AnlageZuGross(dateiname, gelesen, MAX_BYTES)


def pruefe_platz(dateiname: str, art: Anlagenart, vorhanden: int) -> None:
    """Refuse a file this protocol has no room for.

    Asked before anything about the file itself, exactly as regeln.ts does it. No
    amount of converting or shrinking a photograph makes room for it, so saying
    the slot is full is the only useful answer and any other message would send
    somebody off to fix the wrong thing.
    """
    hoechstens = hoechstzahl(art)
    if vorhanden >= hoechstens:
        raise AnlagenartVoll(dateiname, art.value, vorhanden, hoechstens)
