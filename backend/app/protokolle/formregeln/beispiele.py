"""Two whole protocols, for tests.

Every other test in this package builds the two or three answers its own rule
looks at. These are the documents that prove the rules work together: one that a
surveyor could really submit, and one that breaks a rule in every part.

Here rather than in a test file because feature 11c's endpoint tests need the
same two, and a second copy of a complete protocol is a second thing to keep in
step with the form.

The valid one is a real stretch on the Wolfegger Ach, the same one the reviewer
mockup uses, so the numbers read like a survey rather than like filler.
"""

from typing import Any

#: A protocol with nothing missing and nothing wrong. pruefe_protokoll says
#: nothing about it.
VOLLSTAENDIG: dict[str, Any] = {
    "anlass": "wrrl",
    "datum": "2026-07-15",
    "z": {"rp": "4"},
    "bearbeiter": {
        "name": "Dr. Anne Krüger",
        "firma": "Büro für Gewässerökologie",
        "email": "a.krueger@example.org",
        "ort": "Ravensburg",
    },
    "probestrecke": {
        "monitoringnummer": "1001000001",
        "gewaessertyp": "13",
        "laenge": "110",
        "ortsangabe": "Kiesbank unterhalb Vogt, ab Furt flussaufwärts",
        "gewaesser": {
            "gewaessername": "Wolfegger Ach",
            "vorfluter1": "Schussen",
            "vorfluter2": "Bodensee-Obersee",
            "vorfluter3": "Rhein",
        },
        "untere": "Furt an der Kiesbank",
        "utm_rw_unten": "551034",
        "utm_hw_unten": "5296712",
        "obere": "Alte Eiche am linken Ufer",
        "utm_rw_oben": "551098",
        "utm_hw_oben": "5296801",
    },
    "messdaten": {
        "uhrzeit": "08:41",
        "temperatur": "14,2",
        "leitfaehigkeit": "412",
        "regenfaelle": "2",
        "truebung": "1",
        "schaumbildung": "1",
    },
    # A Bach, so the section applies and every picker holds a real answer. The
    # two estimates sit inside their bands: 3,5 m is in band 3 (2 to under 5)
    # and 0,25 m is in band 2 (0,1 to under 0,3).
    "hydrologie": {
        "breite": "3",
        "breite_schaetzwert": "3,5",
        "tiefe": "2",
        "tiefe_schaetzwert": "0,25",
        "tiefenvarianz": "2",
        "linienfuehrung": "2",
        "stroemung": "3",
        "fliessgeschwindigkeit": "3",
        "wasserfuehrung": "2",
        "stillwasserbereich": "2",
        "gesamtprofil": "2",
        "mit_gumpen": "Ja",
    },
    "ausruestung": {
        "egeraet": "EFKO FEG 8000",
        "leistung": "8000",
        "bauweise": "1",
        "ringanoden": "2",
        "ringanoden_durchmesser": "40",
    },
    "befischte_bereiche": {
        "ges_gew_laenge": "110",
        "ges_gew_breite": "4",
    },
    # Two species, each with its young-of-year count inside its own row total.
    "arten": {
        "art1": {"name": "SATR", "klasse_2": "34", "klasse_3": "18", "0plus": "41"},
        "art2": {"name": "COGO", "klasse_1": "8", "klasse_2": "21", "0plus": "19"},
    },
    "bemerkungen": "Wasserstand nach den Regenfällen der Vorwoche leicht erhöht.",
}


#: The same protocol with one thing wrong in each part, on purpose. Every entry
#: below is a rule this package enforces, so a rule that quietly stopped firing
#: would show up as a shorter list rather than as nothing at all.
KAPUTT: dict[str, Any] = {
    "anlass": "wrrl",
    # probestrecke.monitoringnummer missing, which a WRRL occasion demands
    "datum": "2026-07-15",
    "z": {"rp": "4"},
    "bearbeiter": {"name": "Dr. Anne Krüger", "email": "a.krueger@example.org"},
    "probestrecke": {
        "gewaessertyp": "13",
        "laenge": "110",
        "ortsangabe": "Kiesbank unterhalb Vogt",
        # The chain stops at the Schussen and never reaches the Rhein
        "gewaesser": {"gewaessername": "Wolfegger Ach", "vorfluter1": "Schussen"},
        "untere": "Furt",
        # A Hochwert typed into the Rechtswert box
        "utm_rw_unten": "5296712",
        "utm_hw_unten": "5296712",
        "obere": "Alte Eiche",
        "utm_rw_oben": "551098",
        "utm_hw_oben": "5296801",
    },
    "messdaten": {
        "uhrzeit": "08:41",
        "temperatur": "14,2",
        "leitfaehigkeit": "412",
        "regenfaelle": "2",
        "truebung": "1",
        # schaumbildung missing
    },
    "hydrologie": {
        "breite": "2",
        # 95 m under a band that runs from 1 to under 2 m
        "breite_schaetzwert": "95",
        "tiefe": "2",
        "tiefenvarianz": "2",
        "linienfuehrung": "2",
        "stroemung": "3",
        "fliessgeschwindigkeit": "3",
        "wasserfuehrung": "2",
        "stillwasserbereich": "2",
        "gesamtprofil": "2",
    },
    # Part 3: a run that was started and comes to 43
    "gewaessersohle": {"sand": "43"},
    # Part 4: nothing found, beside a named use
    "einfluesse": {"keine_einfluesse": "Ja", "wasserkraft": "Ja"},
    "ausruestung": {
        "egeraet": "EFKO FEG 8000",
        "leistung": "8000",
        "bauweise": "1",
        # No anode of either kind
        "ringanoden": "0",
        "streifenanoden": "0",
    },
    # Part 6: the same species twice, and a 0+ count above its row
    "arten": {
        "art1": {"name": "SATR", "klasse_2": "34", "0plus": "99"},
        "art2": {"name": "SATR", "klasse_1": "8"},
    },
}
