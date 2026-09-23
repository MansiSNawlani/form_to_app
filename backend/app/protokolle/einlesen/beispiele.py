"""One blank form's own contents and one filled-in protocol, for tests.

Here rather than in a test file because four test modules in this package need
the same two, and a second copy of a whole protocol is a second thing to keep in
step with the form. The same reason `app/protokolle/formregeln/beispiele.py`
exists.

`als_formularwerte` at the foot is the third thing: it takes a document written
the way this application stores one, such as the complete protocol in
`app/protokolle/formregeln/beispiele.py`, and writes it the way the PDF would.
That is what lets a test import a protocol the form rules are known to be happy
with, rather than a second copy of one transcribed by hand into the form's own
writing.
"""

from collections.abc import Mapping
from typing import Any

from app.formular.beispiele import knopffelder

#: What the blank form itself carries: the defaults FFS ships it with.
#:
#: The blank form is not empty, which is worth knowing before anybody imports
#: one. Seventeen answers: fifteen numeric fields at 0, the Anlass at "best" and
#: the cathode at "Kupferlitze". None of that is invented by the reader: the file
#: really does say so, and a 0 that the form shipped cannot be told apart from a
#: 0 a surveyor meant. The `probestrecke.laenge` of 0 is then refused by the form
#: rules, loudly, which is the right place for that judgement.
VORBELEGT: dict[str, Any] = {
    "anlass": "best",
    "probestrecke": {"laenge": "0"},
    "strukturen": {
        "totholz": "0",
        "wurzeln_strukturen": "0",
        "aeste": "0",
        "schilf": "0",
        "submerse_makrophyten": "0",
        "schwimmblattpflanzen": "0",
        "emerse_makrophyten": "0",
        "sonstige_strukturen": "0",
    },
    "ausruestung": {
        "ringanoden": "0",
        "streifenanoden": "0",
        "kathode": "Kupferlitze",
    },
    "befischte_bereiche": {
        "ges_gew_laenge": "0",
        "ges_gew_breite": "0",
        "ufer_laenge": "0",
        "ufer_breite": "0",
    },
}

#: A protocol as the legacy form holds one. Radio and checkbox values carry the
#: leading slash, because that is how the PDF stores them.
AUSGEFUELLT = {
    "datum": "04.05.2026",
    "messdaten.uhrzeit": "14:30",
    "messdaten.temperatur": "12,5",
    "bearbeiter.name": "Käthe Müller",
    "probestrecke.gewaesser.gewaessername": "Schwarzer Regen",
    "probestrecke.gewaesser.vorfluter1": "Donau",
    "probestrecke.gewaessertyp": "/13",
    "einfluesse.wasserkraft": "/Ja",
    "arten.art1.name": "BFOR",
    "arten.art1.klasse_3": "1.234",
    "bemerkungen.sonstige_bemerkungen": "Zeile eins\nZeile zwei",
}


def als_formularwerte(dokument: Mapping[str, Any]) -> dict[str, str]:
    """An answers document, written the way the form itself writes one.

    Our nested document flattened back to the legacy dotted paths, with a slash
    put in front of every value belonging to a tick box or a radio group, which
    is how the PDF holds one. Without the slash pypdf writes nothing at all and
    the box stays unticked, so a fixture that forgot it would quietly test a
    protocol with three answers missing.

    Only the two shapes that differ. Numbers and dates go across untouched,
    because `werte.py` is written to read a value that is already in our own
    writing as well as one in the form's: `12.5` and `12,5` both mean 12.5. That
    is a deliberate property of the reader rather than a convenience here, and a
    round trip through this helper is one of the things that proves it.

    Not the export half of feature 23e. That one fills the official form for a
    person to keep, and has to write German dates and grouped numbers back out
    for a human to read; this only has to produce something the reader accepts.
    """
    werte: dict[str, str] = {}
    knoepfe = knopffelder()

    def geh(teil: Mapping[str, Any], praefix: str) -> None:
        for name, wert in teil.items():
            pfad = f"{praefix}{name}"
            if isinstance(wert, Mapping):
                geh(wert, f"{pfad}.")
            elif pfad in knoepfe:
                werte[pfad] = f"/{wert}"
            else:
                werte[pfad] = str(wert)

    geh(dokument, "")
    return werte
