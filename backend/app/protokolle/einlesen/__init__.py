"""Reading a filled-in Protokoll E-Befischung out of the legacy Acrobat form.

Feature 23a. Plain functions over bytes and values: no database, no HTTP, no
German wording. 23b gives them an endpoint, 23c a screen.

The mechanics of opening a form PDF live in `app/formular/pdf.py`, because the
extraction script and feature 23e's export need the same ones. What is here is
what makes a *filled-in* copy of that form into an answers document: which
fields carry answers, which form version the file is, and what its German dates
and numbers mean.

`lies_protokoll` is the whole of it, and it lives in `protokoll.py`. The three
modules under it are the three things reading a file means: `version.py` decides
what the file is, `antworten.py` turns its fields into a document, and
`werte.py` turns one of its values into one of ours.
"""

from app.protokolle.einlesen.antworten import Einleseergebnis
from app.protokolle.einlesen.fehler import (
    EinleseFehler,
    FormularversionFehlt,
    FormularversionPasstNicht,
)
from app.protokolle.einlesen.protokoll import lies_protokoll

__all__ = [
    "EinleseFehler",
    "Einleseergebnis",
    "FormularversionFehlt",
    "FormularversionPasstNicht",
    "lies_protokoll",
]
