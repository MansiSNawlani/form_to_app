"""One value, from the writing the form uses into the writing we store.

The most dangerous module in the import, and the only one where a mistake
produces a protocol that looks right. Everything else here either works or
refuses; this can quietly change a number.

The problem, in one line: 373 of this form's 383 numeric fields group their
thousands with a dot and mark decimals with a comma. So a catch of 1234 fish is
written `1.234`, and `alsZahl` in `frontend/src/protokoll/regeln/arten.ts` reads
that as 1.2. That file's own comment calls it "the one place a shared number
parser could quietly lose 999 fish", and an import is exactly where those
999 would go.

The second problem is that we do not know which writing the file holds. Acrobat
runs two scripts on a field, one that parses what was typed and one that formats
what is shown, and which of the two results ends up in `/V` is not something the
file tells us. So every conversion here is written to be right either way: a
value already in our own form is left exactly as it is. That is why the same
function turns both `12,5` and `12.5` into `12.5`, rather than one of them into
nonsense.

Nothing here ever rewrites a value into something merely plausible. A value it
cannot read is handed back untouched and marked, and the form rules name it again
beside its own field afterwards.
"""

import re
from dataclasses import dataclass
from datetime import date

from app.formular.felder import Feldformat, Formatart
from app.protokolle.formregeln.regel import ZAHL

#: How the form writes a date, and how we store one.
DEUTSCHES_DATUM = re.compile(r"^(\d{2})\.(\d{2})\.(\d{4})$")
ISO_DATUM = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")

#: Acrobat's separator styles, as the thousands separator each one uses. An empty
#: string means that style does not group at all, so a dot in such a field can
#: only ever be a decimal point.
GRUPPENTRENNER = {0: ",", 1: "", 2: ".", 3: ""}

#: The same four styles, as the character each uses to mark the decimals.
DEZIMALTRENNER = {0: ".", 1: ".", 2: ",", 3: ","}


@dataclass(frozen=True, slots=True)
class Umwandlung:
    """What to store, and whether it could be read at all."""

    #: The value for the answers document. The original, untouched, when it could
    #: not be read.
    text: str

    #: False means the file held something this application cannot make sense of
    #: for that field. The value is still above, exactly as the file wrote it.
    brauchbar: bool = True


def umwandle(wert: str, format_: Feldformat | None) -> Umwandlung:
    """One value, ready for the answers document.

    A field with no declared format is a name, an address or a remark: 155 of the
    540, and nothing to do to any of them.
    """
    if format_ is None or not wert.strip():
        return Umwandlung(wert)
    if format_.art is Formatart.ZEIT:
        # HH:MM both sides. FeldDatum.tsx says so in its own comment.
        return Umwandlung(wert)
    if format_.art is Formatart.DATUM:
        return _datum(wert)
    return _zahl(wert, stellen=format_.stellen, trennung=format_.trennung)


def _datum(wert: str) -> Umwandlung:
    """04.05.2026 becomes 2026-05-04, and 2026-05-04 stays as it is.

    A date that is written correctly and is not a real day, such as the 31st of
    February, is somebody's typo rather than a format we have misread, so it is
    handed back untouched to be looked at rather than rolled forward into March.
    """
    text = wert.strip()

    if treffer := DEUTSCHES_DATUM.match(text):
        tag, monat, jahr = treffer.groups()
        return _falls_echt(wert, jahr=jahr, monat=monat, tag=tag)
    if treffer := ISO_DATUM.match(text):
        jahr, monat, tag = treffer.groups()
        return _falls_echt(wert, jahr=jahr, monat=monat, tag=tag)
    return Umwandlung(wert, brauchbar=False)


def _falls_echt(wert: str, *, jahr: str, monat: str, tag: str) -> Umwandlung:
    try:
        date(int(jahr), int(monat), int(tag))
    except ValueError:
        return Umwandlung(wert, brauchbar=False)
    return Umwandlung(f"{jahr}-{monat}-{tag}")


def _zahl(wert: str, *, stellen: int, trennung: int) -> Umwandlung:
    """The German writing of a number, turned into ours.

    Ours is what `ZAHL` in `app/protokolle/formregeln/regel.py` accepts: a dot
    for the decimals and nothing between the thousands. Imported rather than
    restated, so there is one answer in the backend to what a number is.
    """
    text = wert.strip()
    dezimal = DEZIMALTRENNER.get(trennung, ".")
    gruppe = GRUPPENTRENNER.get(trennung, "")

    if dezimal in text:
        ganz, _, bruch = text.partition(dezimal)
        if gruppe:
            ganz = ganz.replace(gruppe, "")
        kandidat = f"{ganz}.{bruch}" if bruch else ganz
    elif gruppe and _ist_gruppiert(text, gruppe):
        kandidat = text.replace(gruppe, "")
    else:
        kandidat = text

    if ZAHL.match(kandidat) is None:
        return Umwandlung(wert, brauchbar=False)
    return Umwandlung(kandidat)


def _ist_gruppiert(text: str, gruppe: str) -> bool:
    """Whether that separator is grouping thousands rather than marking decimals.

    Strict about the shape on purpose, because the two readings of `12.5` on a
    dot-grouping field are 12.5 and 125, and only one of them is a number of
    fish anybody caught. A thousands separator is always followed by exactly
    three digits, every time it appears, so `1.234` groups and `12.5` does not.
    `12.5` is then left alone and part 6's own rule refuses it as not a whole
    number, which is the right place for that judgement.

    One case this cannot decide: a field with three decimal places, where
    `1.234` is genuinely either. This form has no such field, since none
    declares more than one decimal place.
    """
    zahlengruppen = re.fullmatch(r"\d{1,3}(?:" + re.escape(gruppe) + r"\d{3})+", text)
    return zahlengruppen is not None
