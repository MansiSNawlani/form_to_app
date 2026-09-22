"""Reading a filled-in protocol out of the legacy Acrobat form.

The version gate lives here, ahead of everything else, and the order is the
point: a file is identified before a single answer is taken out of it. A
protocol is never migrated between form versions (ADR 0004), so answers read
under the wrong version's rules would be answers nobody ever checked.
"""

import re
from typing import Any

from pypdf import PdfReader

from app.formular.felder import formular
from app.formular.pdf import decode, felder
from app.protokolle.einlesen.fehler import (
    FormularversionFehlt,
    FormularversionPasstNicht,
)

VERSIONSFELD = "version"

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
