"""The values of a filled-in form, as an answers document.

The walk that turns 485 fields into the nested document the application already
stores, and the result type the whole import answers with.

Only the answers. What is wrong with them is `pruefe_protokoll`'s to say, and
saying it belongs where the result reaches a person, which is 23b.
"""

from dataclasses import dataclass, field
from typing import Any

from pypdf import PdfReader
from pypdf.generic import DictionaryObject, NameObject

from app.formular.felder import FormularDefinition, formular
from app.formular.pdf import decode, felder
from app.protokolle.einlesen.felder import ist_antwort
from app.protokolle.einlesen.werte import umwandle
from app.protokolle.regeln import MAX_ZEICHEN_PRO_ANTWORT

#: What an unticked box and an unchosen radio group hold.
AUS = "Off"


@dataclass(frozen=True, slots=True)
class Einleseergebnis:
    """Everything one uploaded file turned out to hold.

    Load-bearing: 23b answers with this, 23c shows it, 23d fills in the
    pictures. What it deliberately does not carry is any judgement about the
    protocol's contents. `pruefe_protokoll` already says what is wrong with an
    answers document, and calling it belongs where the answer reaches a person.
    """

    #: The form version the file declares, as the application writes it.
    #:
    #: Empty until `lies_protokoll` stamps it. The walk below does not read it,
    #: because the version has to be settled before the walk is allowed to run
    #: at all, and a function cannot both check a thing and depend on it.
    version: str = ""

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


def lies_antworten(
    leser: PdfReader, *, definition: FormularDefinition | None = None
) -> Einleseergebnis:
    """Every answer the file holds, as an answers document.

    The definition is an argument so a test can narrow it. In the running
    application it is always the one this deployment serves, whose field names
    `pruefe_formular` has already found in the file.

    The version and the picture count in the result are left at their defaults.
    `lies_protokoll` fills them in, because it is the one thing here that knows
    the whole file.

    **A blank form does not read as empty**, and whoever imports one should know
    it: FFS ships this form with seventeen answers already in it, fifteen of them
    a zero, plus the Anlass at "best" and the cathode at "Kupferlitze". The file
    really does say so, and a shipped zero cannot be told apart from a zero a
    surveyor meant, so nothing here tries to guess which it was. The form rules
    then refuse the ones that are not plausible, such as a Probestrecke of no
    length at all.
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

    return Einleseergebnis(
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
