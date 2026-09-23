"""One uploaded file, read as far as it can be read.

What 23b calls. Three things in one order: open the file, identify it, then take
its answers. Nothing else in this package knows about that order, which is why
it is a module of its own rather than a step inside the walk.
"""

from dataclasses import replace
from typing import Any

from pypdf import PdfReader

from app.formular.pdf import felder, oeffne
from app.protokolle.einlesen.antworten import Einleseergebnis, lies_antworten
from app.protokolle.einlesen.felder import BILDER
from app.protokolle.einlesen.version import lies_version


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

    # replace rather than a fresh Einleseergebnis listing all five fields, so the
    # two this function actually establishes are the two it names.
    return replace(lesung, version=version, bilder=zaehle_bilder(leser))


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
