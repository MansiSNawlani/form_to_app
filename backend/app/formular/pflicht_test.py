"""Reading the required list out of the seed directory.

The same shape as felder_test.py and optionen_test.py, because the three files
describe one form version and fail the same way. What is different here is that
this one is hand-authored, so the failure it has to guard against is a typo
rather than a truncated download.
"""

import json
from pathlib import Path

import pytest

from app.formular.felder import FormularDefinitionFehlt, formular
from app.formular.pflicht import PFLICHT_DATEI, lade_pflichtfelder, pflichtfelder


def schreibe(verzeichnis: Path, inhalt: object) -> Path:
    verzeichnis.mkdir(parents=True, exist_ok=True)
    datei = verzeichnis / PFLICHT_DATEI
    datei.write_text(json.dumps(inhalt, ensure_ascii=False), encoding="utf-8")
    return verzeichnis


def test_liest_die_pfade_in_ihrer_reihenfolge(tmp_path: Path) -> None:
    """Order is form order, and the panel in the browser lists them as they come."""
    verzeichnis = schreibe(
        tmp_path, {"version": "20260609", "pflichtfelder": ["anlass", "datum", "z.rp"]}
    )

    geladen = lade_pflichtfelder(verzeichnis)

    assert geladen.version == "20260609"
    assert geladen.pfade == ("anlass", "datum", "z.rp")


def test_eine_fehlende_datei_nennt_ihren_pfad(tmp_path: Path) -> None:
    with pytest.raises(FormularDefinitionFehlt) as erhoben:
        lade_pflichtfelder(tmp_path)

    assert str(tmp_path / PFLICHT_DATEI) in str(erhoben.value)


def test_kaputtes_json_wird_nicht_stillschweigend_uebergangen(tmp_path: Path) -> None:
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / PFLICHT_DATEI).write_text("{nicht json", encoding="utf-8")

    with pytest.raises(FormularDefinitionFehlt):
        lade_pflichtfelder(tmp_path)


@pytest.mark.parametrize(
    "inhalt",
    [
        {"version": "20260609"},
        {"pflichtfelder": ["anlass"]},
        {"version": 20260609, "pflichtfelder": ["anlass"]},
        {"version": "20260609", "pflichtfelder": "anlass"},
    ],
    ids=["ohne Liste", "ohne Version", "Version keine Zeichenkette", "Liste keine Liste"],
)
def test_eine_unvollstaendige_datei_wird_abgelehnt(tmp_path: Path, inhalt: object) -> None:
    verzeichnis = schreibe(tmp_path, inhalt)

    with pytest.raises(FormularDefinitionFehlt):
        lade_pflichtfelder(verzeichnis)


def test_ein_eintrag_der_kein_pfad_ist_wird_abgelehnt(tmp_path: Path) -> None:
    verzeichnis = schreibe(tmp_path, {"version": "20260609", "pflichtfelder": ["anlass", 7]})

    with pytest.raises(FormularDefinitionFehlt):
        lade_pflichtfelder(verzeichnis)


def test_ein_doppelter_pfad_wird_abgelehnt(tmp_path: Path) -> None:
    """A hand-authored list is exactly where a path gets pasted in twice.

    Harmless to the check itself, since a field is either filled in or not, but it
    would report the same missing answer twice in the panel, which reads as two
    different problems.
    """
    verzeichnis = schreibe(
        tmp_path, {"version": "20260609", "pflichtfelder": ["anlass", "datum", "anlass"]}
    )

    with pytest.raises(FormularDefinitionFehlt):
        lade_pflichtfelder(verzeichnis)


def test_die_ausgelieferte_liste_nennt_nur_felder_die_es_gibt() -> None:
    """The guard that matters for a file somebody edits by hand.

    A required field the form does not have could never be filled in, so it would
    refuse every protocol ever submitted. A typo is exactly how that happens, and
    it would be found by a surveyor rather than by us.
    """
    assert set(pflichtfelder().pfade) <= formular().pfade


def test_die_ausgelieferte_liste_gehoert_zu_dieser_formularversion() -> None:
    assert pflichtfelder().version == formular().version
