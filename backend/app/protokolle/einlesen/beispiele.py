"""One blank form's own contents and one filled-in protocol, for tests.

Here rather than in a test file because three test modules in this package need
the same two, and a second copy of a whole protocol is a second thing to keep in
step with the form. The same reason `app/protokolle/formregeln/beispiele.py`
exists.
"""

from typing import Any

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
