"""The four invented protocols the demo starts with.

Built from the complete test protocol rather than written out four times, so
they stay valid as the form's rules change: that one is held against the rules
by its own tests. Every name, place and number is made up. Nothing here comes
from Resources/, which holds real surveyors' details.
"""

import copy
from dataclasses import dataclass
from typing import Any

from app.models.protokoll import Status
from app.protokolle.formregeln.beispiele import VOLLSTAENDIG


@dataclass(frozen=True, slots=True)
class Beispiel:
    """One example protocol and the state the demo leaves it in."""

    antworten: dict[str, Any]
    status: Status
    #: The reviewer's words, for the one that is sent back.
    kommentar: str | None = None


def _mit(basis: dict[str, Any], aenderungen: dict[str, Any]) -> dict[str, Any]:
    """A deep copy of basis with aenderungen merged in, group by group."""
    ergebnis = copy.deepcopy(basis)
    for schluessel, wert in aenderungen.items():
        if isinstance(wert, dict) and isinstance(ergebnis.get(schluessel), dict):
            ergebnis[schluessel] = _mit(ergebnis[schluessel], wert)
        else:
            ergebnis[schluessel] = copy.deepcopy(wert)
    return ergebnis


def _bestandserhebung(aenderungen: dict[str, Any]) -> dict[str, Any]:
    """A general survey rather than WRRL monitoring, so no monitoring number."""
    antworten = _mit(VOLLSTAENDIG, {"anlass": "best", **aenderungen})
    del antworten["probestrecke"]["monitoringnummer"]
    return antworten


_MURR = _bestandserhebung(
    {
        "datum": "2026-08-20",
        "z": {"rp": "2"},
        "bearbeiter": {
            "name": "Tobias Lindner",
            "firma": "Fischereiverein Backnang",
            "email": "t.lindner@example.org",
            "ort": "Backnang",
        },
        "probestrecke": {
            "gewaessertyp": "14",
            "laenge": "200",
            "ortsangabe": "Unterhalb der Wehranlage Steinbach",
            "gewaesser": {
                "gewaessername": "Murr",
                "vorfluter1": "Neckar",
                "vorfluter2": "Rhein",
                "vorfluter3": "",
            },
            "untere": "Fußgängerbrücke",
            "utm_rw_unten": "532410",
            "utm_hw_unten": "5419820",
            "obere": "Wehr Steinbach",
            "utm_rw_oben": "532560",
            "utm_hw_oben": "5419960",
        },
        "arten": {
            "art1": {"name": "BARB", "klasse_3": "6", "klasse_4": "4", "0plus": "0"},
            "art2": {"name": "DOEB", "klasse_2": "12", "klasse_3": "9", "0plus": "5"},
            "art3": {"name": "GRUE", "klasse_1": "25", "klasse_2": "14", "0plus": "20"},
        },
        "bemerkungen": {"sonstige_bemerkungen": "Leicht getrübt nach Gewitter am Vortag."},
    }
)

_ELZ = _bestandserhebung(
    {
        "datum": "2026-07-02",
        "z": {"rp": "3"},
        "bearbeiter": {
            "name": "Miriam Fischer",
            "firma": "Ingenieurbüro Fischer & Kern",
            "email": "m.fischer@example.org",
            "ort": "Emmendingen",
        },
        "probestrecke": {
            "ortsangabe": "Oberhalb Kollmarsreute, rechtes Ufer",
            "gewaesser": {
                "gewaessername": "Elz",
                "vorfluter1": "Rhein",
                "vorfluter2": "",
                "vorfluter3": "",
            },
            "untere": "Einmündung Mühlkanal",
            "utm_rw_unten": "415230",
            "utm_hw_unten": "5329880",
            "obere": "Holzsteg",
            "utm_rw_oben": "415310",
            "utm_hw_oben": "5329970",
        },
        "arten": {
            "art1": {"name": "ELRI", "klasse_1": "40", "klasse_2": "22", "0plus": "30"},
            "art2": {"name": "SMER", "klasse_1": "15", "klasse_2": "9", "0plus": "8"},
        },
    }
)

# Half filled in: the first parts are there, the equipment and the catch are not,
# which is what a surveyor coming back to it the next evening would find.
_ARGEN = _bestandserhebung(
    {
        "datum": "2026-09-18",
        "bearbeiter": {
            "name": "Lena Hofmann",
            "firma": "",
            "email": "l.hofmann@example.org",
            "ort": "Wangen im Allgäu",
        },
        "probestrecke": {
            "ortsangabe": "Bei der Kläranlage, flussabwärts",
            "gewaesser": {
                "gewaessername": "Obere Argen",
                "vorfluter1": "Argen",
                "vorfluter2": "Bodensee-Obersee",
                "vorfluter3": "Rhein",
            },
        },
    }
)
for _teil in ("ausruestung", "anodenfuehrer", "befischte_bereiche", "arten", "bemerkungen"):
    del _ARGEN[_teil]

BEISPIELE: tuple[Beispiel, ...] = (
    Beispiel(antworten=_ARGEN, status=Status.DRAFT),
    Beispiel(antworten=_MURR, status=Status.SUBMITTED),
    Beispiel(
        antworten=_ELZ,
        status=Status.NEEDS_CHANGES,
        kommentar=(
            "Bitte die Länge der Probestrecke prüfen: 110 m passen nicht zu den"
            " Koordinaten der beiden Grenzen."
        ),
    ),
    Beispiel(antworten=copy.deepcopy(VOLLSTAENDIG), status=Status.LOCKED),
)
