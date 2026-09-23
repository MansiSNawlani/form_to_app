"""Every answer the document prints has a German name, and a broken file says so.

The completeness check is the point of this file, and it is here rather than in
the frontend for one reason: which of the form's 540 fields carry an answer is
decided by name in app/protokolle/einlesen/felder.py, and asking the same
question on the other side would mean a second copy of those 55 names. The
generator runs in the frontend; the consumer checks it here.
"""

import json
from pathlib import Path

import pytest

from app.config import FORMULAR_SEED
from app.formular.felder import ZUSAETZLICHE_PFADE, FormularDefinitionFehlt, formular
from app.protokolle.ausgabe.beschriftungen import lade
from app.protokolle.einlesen.felder import ist_antwort

# The catch table, part 6. Twenty-six rows of a name, ten size classes and the
# 0+ count, which is 312 of the 485 answer fields and none of them individually
# labelled. The table names its columns once across the top, on screen and in
# the document, so these need column headings rather than labels.
FANGTABELLE = "arten."


def beschriftete_antwortfelder() -> set[str]:
    """The answer paths the document prints as a label and a value."""
    return {
        pfad
        for pfad in formular().pfade
        if pfad not in ZUSAETZLICHE_PFADE and ist_antwort(pfad) and not pfad.startswith(FANGTABELLE)
    }


def schreibe(verzeichnis: Path, inhalt: object) -> Path:
    (verzeichnis / "beschriftungen.json").write_text(json.dumps(inhalt), encoding="utf-8")
    return verzeichnis


def test_jedes_antwortfeld_hat_eine_beschriftung() -> None:
    """The one that matters.

    It fails when a field is added to the form and nobody regenerated the
    labels, which would otherwise surface as a PDF printing a dotted path at a
    surveyor months later.
    """
    beschriftungen = lade(FORMULAR_SEED).beschriftungen

    ohne = sorted(beschriftete_antwortfelder() - beschriftungen.keys())

    assert ohne == [], (
        f"{len(ohne)} Antwortfelder haben keine Beschriftung: {ohne[:10]}."
        " npm run beschriftungen im Verzeichnis frontend/ erzeugt die Datei neu."
    )


def test_beschriftet_nichts_was_kein_feld_ist() -> None:
    """The other direction, which catches a path renamed on one side only.

    bearbeiter.ort is the one legitimate extra: the printed form has a street
    and a postcode but no town, and app/formular/felder.py lists it as an
    addition of ours with a question on the record.
    """
    beschriftungen = lade(FORMULAR_SEED).beschriftungen

    unbekannt = sorted(beschriftungen.keys() - set(formular().pfade))

    assert unbekannt == []
    assert "bearbeiter.ort" in beschriftungen


def test_die_fangtabelle_ist_nicht_einzeln_beschriftet() -> None:
    """Pinned so that 312 labels cannot quietly appear here later.

    If the catch table ever does need them, that is a decision about how the
    document lays the table out, and it should change this test first.
    """
    beschriftungen = lade(FORMULAR_SEED).beschriftungen

    assert [pfad for pfad in beschriftungen if pfad.startswith(FANGTABELLE)] == []


def test_liest_die_ausgelieferte_datei() -> None:
    beschriftungen = lade(FORMULAR_SEED).beschriftungen

    assert beschriftungen["hydrologie.breite"] == "mittlere Breite"
    assert beschriftungen["probestrecke.gewaesser.gewaessername"] != ""


def test_fehlende_datei_nennt_den_erzeuger(tmp_path: Path) -> None:
    """A broken checkout should say what makes the file, not just that it is gone."""
    with pytest.raises(FormularDefinitionFehlt) as fehler:
        lade(tmp_path)

    assert "frontend/scripts/beschriftungen.ts" in str(fehler.value)


@pytest.mark.parametrize(
    ("inhalt", "grund"),
    [
        ([], "its top level is not an object"),
        ({"version": "1", "anzahl": 1}, "it has no version or no labels"),
        (
            {"version": "1", "anzahl": 1, "beschriftungen": {"a.b": ""}},
            "a label is empty or is not text",
        ),
        (
            {"version": "1", "anzahl": 2, "beschriftungen": {"a.b": "B"}},
            "claims 2 labels and holds 1",
        ),
    ],
)
def test_kaputte_datei_sagt_warum(tmp_path: Path, inhalt: object, grund: str) -> None:
    with pytest.raises(FormularDefinitionFehlt) as fehler:
        lade(schreibe(tmp_path, inhalt))

    assert grund in str(fehler.value)
