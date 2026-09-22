"""Reading a filled-in protocol out of the legacy Acrobat form.

The version gate lives here, ahead of everything else, and the order is the
point: a file is identified before a single answer is taken out of it. A
protocol is never migrated between form versions (ADR 0004), so answers read
under the wrong version's rules would be answers nobody ever checked.
"""

import re
from dataclasses import dataclass, field
from typing import Any

from pypdf import PdfReader
from pypdf.generic import DictionaryObject, NameObject

from app.formular.felder import FormularDefinition, formular
from app.formular.pdf import decode, felder, oeffne
from app.protokolle.einlesen.fehler import (
    FormularversionFehlt,
    FormularversionPasstNicht,
)
from app.protokolle.einlesen.felder import BILDER, ist_antwort
from app.protokolle.einlesen.werte import umwandle
from app.protokolle.regeln import MAX_ZEICHEN_PRO_ANTWORT

VERSIONSFELD = "version"

#: What an unticked box and an unchosen radio group hold.
AUS = "Off"

# What the form stamps into that field: "Version 2026-06-09". The application
# writes the same version as "20260609", which is what felder.json records and
# what a Submission's form_version column holds.
VERSIONSTEXT = re.compile(r"^Version (\d{4})-(\d{2})-(\d{2})$")


def lies_version(leser: PdfReader) -> str:
    """Which form version this file is, or a refusal.

    Read out of the file's own read-only version stamp rather than guessed from
    which fields it has. The Protokoll Krebs has 350 fields with names that look
    much like these, so "it has fields called bearbeiter.name" identifies
    nothing.

    Compared against the version this deployment serves rather than against a
    constant written here, so the day a second form version exists this function
    needs no change: `formular()` already reads the version out of the seed.
    """
    gefunden = _version_aus(_versionstext(leser))
    erwartet = formular().version
    if gefunden != erwartet:
        raise FormularversionPasstNicht(gefunden, erwartet)
    return gefunden


def _versionstext(leser: PdfReader) -> str | None:
    """The raw contents of the version field, or nothing if it has none."""
    for name, feld in felder(leser):
        if name == VERSIONSFELD:
            wert: Any = feld.get("/V")
            return None if wert is None else decode(wert)
    return None


def _version_aus(text: str | None) -> str:
    """Turn "Version 2026-06-09" into "20260609", or refuse.

    Deliberately strict. A looser read would let a file carrying "Version 2026"
    or a hand-edited stamp through, and what follows would then check a protocol
    against the wrong version's option lists while reporting the right one.
    """
    if text is None:
        raise FormularversionFehlt("the file has no version field")
    treffer = VERSIONSTEXT.match(text.strip())
    if treffer is None:
        raise FormularversionFehlt("the version field does not hold a form version")
    return "".join(treffer.groups())


@dataclass(frozen=True, slots=True)
class Antwortenlesung:
    """The answers a file held, and what could not be taken from it."""

    #: Nested exactly as the answers document is, strings only, blanks left out.
    antworten: dict[str, Any] = field(default_factory=dict)

    #: Fields the file carried that this application has no home for.
    unbekannt: tuple[str, ...] = ()

    #: Answers worth a second look. All but the over-long ones are still in
    #: `antworten`, exactly as the file wrote them.
    unbrauchbar: tuple[str, ...] = ()


def lies_antworten(
    leser: PdfReader, *, definition: FormularDefinition | None = None
) -> Antwortenlesung:
    """Every answer the file holds, as an answers document.

    The definition is an argument so a test can narrow it. In the running
    application it is always the one this deployment serves, which `lies_version`
    has already checked the file against.

    **A blank form does not read as empty**, and whoever imports one should know
    it: FFS ships this form with nineteen answers already in it, twelve of them a
    zero and the Anlass at "best". The file really does say so, and a shipped
    zero cannot be told apart from a zero a surveyor meant, so nothing here tries
    to guess which it was. The form rules then refuse the ones that are not
    plausible, such as a Probestrecke of no length at all.
    """
    formular_ = definition if definition is not None else formular()

    antworten: dict[str, Any] = {}
    unbekannt: list[str] = []
    unbrauchbar: list[str] = []

    for name, feld in felder(leser):
        if not ist_antwort(name):
            continue
        roh = wert_aus(feld)
        if roh is None:
            continue
        if name not in formular_.pfade:
            unbekannt.append(name)
            continue

        ergebnis = umwandle(roh, formular_.formate.get(name))
        # The length check first, because it is the only one that drops the
        # value, and naming one field twice would say there are two problems.
        if len(ergebnis.text) > MAX_ZEICHEN_PRO_ANTWORT:
            unbrauchbar.append(name)
            continue
        if not ergebnis.brauchbar:
            unbrauchbar.append(name)
        _setze(antworten, name, ergebnis.text)

    return Antwortenlesung(
        antworten=antworten,
        unbekannt=tuple(unbekannt),
        unbrauchbar=tuple(unbrauchbar),
    )


def wert_aus(feld: DictionaryObject) -> str | None:
    """What one field holds, unwrapped from the way the PDF holds it.

    The PDF keeps a ticked box and a chosen radio button as a name, `/Ja` or
    `/13`, and everything else as a string. Which it is is read from the value
    itself rather than from the field's declared type, because a name is a name
    whatever the field claims to be, and this form has 81 button fields whose
    values would otherwise arrive with a slash on the front.

    Nothing comes back for an answer nobody gave. Three ways a field says that:
    no value at all, `/Off` for a box nobody ticked, and whitespace, which is the
    single space Acrobat parks in an unchosen dropdown. The last one matters
    most: 32 fields hold it in the blank form, the 26 species pickers among them,
    and a space is not a species. The extraction script already skips the same
    placeholder where it reads the option lists.
    """
    wert: Any = feld.get("/V")
    if wert is None:
        return None

    # A multi-select dropdown would hold an array. This form has none, and
    # str() on one would store its Python repr as somebody's answer.
    if isinstance(wert, list):
        return None

    text = decode(wert).strip()

    if _ist_knopf(feld, wert):
        text = text.removeprefix("/")
        return None if text in ("", AUS) else text

    return text or None


def _ist_knopf(feld: DictionaryObject, wert: Any) -> bool:
    """Whether this field's value is a PDF name rather than text.

    By the field's declared type first. Not by the shape of the value, because
    a remark beginning with a slash is a remark, and losing its first character
    would be a silent corruption of exactly the kind this module is built to
    avoid.

    The value's own type is a second chance rather than the first, for a field
    that declares no type of its own. All 540 in this form do.
    """
    if str(feld.get("/FT", "")) == "/Btn":
        return True
    return isinstance(wert, NameObject)


def _setze(antworten: dict[str, Any], pfad: str, wert: str) -> None:
    """Put one value at its dotted path, making the levels above it as needed.

    `arten.art1.klasse_3` becomes `{"arten": {"art1": {"klasse_3": ...}}}`, which
    is the shape `frontend/src/protokoll/entwurf/typen.ts` describes and the
    shape the save endpoint already accepts.
    """
    *eltern, blatt = pfad.split(".")
    ziel = antworten
    for teil in eltern:
        ziel = ziel.setdefault(teil, {})
    ziel[blatt] = wert


@dataclass(frozen=True, slots=True)
class Einleseergebnis:
    """Everything one uploaded file turned out to hold.

    Load-bearing: 23b answers with this, 23c shows it, 23d fills in the
    pictures. What it deliberately does not carry is any judgement about the
    protocol's contents. `pruefe_protokoll` already says what is wrong with an
    answers document, and calling it belongs where the answer reaches a person.
    """

    #: The form version the file declares, as the application writes it.
    version: str

    #: The answers, ready for the ordinary save path without reshaping.
    antworten: dict[str, Any] = field(default_factory=dict)

    #: Fields the file carried that this application has no home for.
    unbekannt: tuple[str, ...] = ()

    #: Answers worth a second look. All but the over-long ones are in
    #: `antworten`, exactly as the file wrote them.
    unbrauchbar: tuple[str, ...] = ()

    #: How many of the five picture slots carry an image. Feature 23d imports
    #: them; until then this is how 23b can still say they are there, which it
    #: must, because an attachment is part of the protocol rather than a
    #: decoration on it.
    bilder: int = 0


def lies_protokoll(daten: bytes) -> Einleseergebnis:
    """One uploaded file, read as far as it can be read.

    In this order, and the order is the whole design. The file is opened, then
    identified, and only then are its answers touched. A protocol whose form
    version we do not know is one whose rules we do not know, so reading its
    answers first would mean building a document out of the wrong form and then
    refusing it with somebody's data already in hand.
    """
    leser = oeffne(daten)
    version = lies_version(leser)
    lesung = lies_antworten(leser)

    return Einleseergebnis(
        version=version,
        antworten=lesung.antworten,
        unbekannt=lesung.unbekannt,
        unbrauchbar=lesung.unbrauchbar,
        bilder=zaehle_bilder(leser),
    )


def zaehle_bilder(leser: PdfReader) -> int:
    """How many of the five picture slots hold an image.

    The legacy form keeps a photograph as a push button's icon, in the widget's
    appearance dictionary under `/MK /I`. The blank form has no `/I` on any of
    the five, so its presence means somebody really put a picture there.

    A count rather than the pictures. Reading the pixels out is feature 23d, and
    it is separated off because it is the one part of the import that may not
    work; until it lands, a count is still enough to tell somebody their
    photographs did not come with their answers.
    """
    gefunden = 0
    for name, feld in felder(leser):
        if name not in BILDER:
            continue
        symbol: Any = feld.get("/MK")
        if symbol is not None and symbol.get("/I") is not None:
            gefunden += 1
    return gefunden
