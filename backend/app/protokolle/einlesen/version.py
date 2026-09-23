"""Deciding whether a file is a protocol this application can import.

The gate everything else runs behind, and it runs first.

**It asks what the file is, not which version it is.** Until 2026-09-22 it asked
the second question and refused every answer but one, which refused all three
real protocols FFS supplied that day: people fill in whatever copy of the PDF
they downloaded years ago, and all three recorded surveys carried out in 2026 on
templates from 2023 and 2024. An old template is not an old survey, and every
import is a new survey held to today's rules, so the version the file declares is
a fact about the file rather than a condition it has to meet.

What is checked instead is the field names, and that is safe to trust because it
was measured rather than assumed. The January 2024 form differs from ours in
nothing: same 540 fields, same buttons, same option lists, same number formats.
The February 2023 form differs in nine places, each hydrology group lacking the
unlabelled "0" button FFS added later, and a button a file does not have is a
button nobody could have ticked, so it cannot produce a value the reader chokes
on. A 2023 protocol for a standing water instead arrives carrying hydrology
answers, and the form rules then say so, which is what the import's report is
for.
"""

import re
from typing import Any

from pypdf import PdfReader

from app.formular.felder import ZUSAETZLICHE_PFADE, formular
from app.formular.pdf import decode, felder
from app.protokolle.einlesen.fehler import (
    FormularversionFehlt,
    KeinBefischungsformular,
)

VERSIONSFELD = "version"

# What the form stamps into that field: "Version 2026-06-09". The application
# writes the same version as "20260609", which is what felder.json records and
# what a Submission's form_version column holds.
VERSIONSTEXT = re.compile(r"^Version (\d{4})-(\d{2})-(\d{2})$")


def pruefe_formular(leser: PdfReader) -> str:
    """This is the Protokoll E-Befischung, and this is the version it says it is.

    Or a refusal. The two checks are in this order because they fail differently:
    a file with no version stamp at all is not a form of ours whatever its fields
    say, and the Protokoll Krebs has a perfectly good version stamp and is still
    the wrong form.

    The version that comes back is the **file's**, and the caller is expected to
    keep it apart from the version the imported protocol is stamped with, which
    is always this deployment's own.
    """
    version = _version_aus(_versionstext(leser))

    fehlend = _erwartete_felder() - {name for name, _ in felder(leser)}
    if fehlend:
        raise KeinBefischungsformular(len(fehlend))

    return version


def _erwartete_felder() -> frozenset[str]:
    """Every field name a copy of this form has to carry to be one.

    Our own additions taken back out. `bearbeiter.ort` is a question this
    application asks that the printed form has no box for, so no file that ever
    came out of Acrobat can have it, and leaving it in would refuse every
    protocol ever filled in.

    Only the names the form must **have**. A file carrying more than these is
    not refused: an extra field is what a later form version looks like, and
    `lies_antworten` already collects those under `unbekannt` rather than
    choking on them.
    """
    return formular().pfade - ZUSAETZLICHE_PFADE


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
    or a hand-edited stamp through, and the import's report would then name a
    source version that the file never actually declared.
    """
    if text is None:
        raise FormularversionFehlt("the file has no version field")
    treffer = VERSIONSTEXT.match(text.strip())
    if treffer is None:
        raise FormularversionFehlt("the version field does not hold a form version")
    return "".join(treffer.groups())
