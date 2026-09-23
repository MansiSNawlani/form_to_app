"""Reading a filled-in Protokoll E-Befischung out of the legacy Acrobat form.

Features 23a and 23b. The reading is plain functions over bytes and values: no
database, no HTTP and no German wording. `dienst.py` is the one thing here that
touches the database, because turning a reading into a draft is where the two
meet. 23c gives it a screen.

The mechanics of opening a form PDF live in `app/formular/pdf.py`, because the
extraction script and feature 23e's export need the same ones. What is here is
what makes a *filled-in* copy of that form into an answers document: which
fields carry answers, which form version the file is, and what its German dates
and numbers mean.

`lies_protokoll` is the whole of the reading, and it lives in `protokoll.py`.
The three modules under it are the three things reading a file means:
`version.py` decides what the file is, `antworten.py` turns its fields into a
document, and
`werte.py` turns one of its values into one of ours. `dienst.py` then makes a
protocol out of the result and asks the form rules what is wrong with it.
"""

from app.protokolle.einlesen.antworten import Einleseergebnis
from app.protokolle.einlesen.dienst import Einlesebericht, importiere
from app.protokolle.einlesen.fehler import (
    EinleseFehler,
    FormularversionFehlt,
    KeinBefischungsformular,
)
from app.protokolle.einlesen.protokoll import lies_protokoll

__all__ = [
    "EinleseFehler",
    "Einlesebericht",
    "Einleseergebnis",
    "FormularversionFehlt",
    "KeinBefischungsformular",
    "importiere",
    "lies_protokoll",
]
