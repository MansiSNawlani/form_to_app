"""The field list is read out of the seed, and a broken seed says so.

The counts below are pinned deliberately. They are what makes this a test rather
than a restatement of the code: if the seed is regenerated and comes back with a
different number of fields, that is either a new form version or a broken
extraction, and both are things somebody should look at rather than absorb
silently.
"""

import json
from pathlib import Path

import pytest

from app.config import FORMULAR_SEED
from app.formular.felder import (
    ZUSAETZLICHE_PFADE,
    FormularDefinitionFehlt,
    formular,
    lade,
)

# The extraction found 540 terminal fields in Formular_Protokoll_E-Befischung_V20260609.pdf.
FELDER_IM_PDF = 540


def schreibe(verzeichnis: Path, inhalt: object) -> Path:
    (verzeichnis / "felder.json").write_text(json.dumps(inhalt), encoding="utf-8")
    return verzeichnis


def test_liest_die_ausgelieferte_definition() -> None:
    definition = lade(FORMULAR_SEED)

    assert definition.version == "20260609"
    assert len(definition.pfade) == FELDER_IM_PDF + len(ZUSAETZLICHE_PFADE)


@pytest.mark.parametrize(
    "pfad",
    [
        # One from each shape the document has, so a change to how paths are read
        # cannot pass by leaving the common case working.
        "anlass",
        "bearbeiter.name",
        "probestrecke.gewaesser.vorfluter5",
        "messdaten.leitfaehigkeit",
        # The catch table's furthest corner: last row, last column.
        "arten.art26.klasse_10",
        # A key beginning with a digit, which the legacy form really does have.
        "arten.art26.0plus",
        # An umlaut in a field path, and the group whose name the legacy form
        # misspells as bewirschaftung. Both are kept exactly.
        "bewirschaftung.fischereiausübungsberechtigter",
        # The one field path with a capital letter anywhere in the form.
        "einfluesse.sonstige_Nutzung",
    ],
)
def test_kennt_die_pfade_des_formulars(pfad: str) -> None:
    assert pfad in lade(FORMULAR_SEED).pfade


def test_kennt_die_eingetragenen_zusaetze() -> None:
    """The additions are exactly what the module documents, and no more.

    A path quietly added to the app but never to this list would be refused on
    save; one added here but not in the app is an allowance nobody is using. Both
    are worth failing on, which is why this asserts the whole set.
    """
    assert ZUSAETZLICHE_PFADE == {"bearbeiter.ort"}
    assert ZUSAETZLICHE_PFADE <= lade(FORMULAR_SEED).pfade


def test_die_zusaetze_sind_wirklich_zusaetze() -> None:
    """Nothing on the additions list is in the PDF after all.

    If the extraction ever picks one of these up, the entry here stops being an
    addition and should be deleted rather than left as a duplicate allowance.
    """
    roh = json.loads((FORMULAR_SEED / "felder.json").read_text(encoding="utf-8"))
    aus_dem_pdf = {feld["name"] for feld in roh["felder"]}

    assert ZUSAETZLICHE_PFADE.isdisjoint(aus_dem_pdf)


def test_formular_liest_die_konfigurierte_definition() -> None:
    """The cached accessor and the plain loader agree, so nothing is misconfigured."""
    assert formular() == lade(FORMULAR_SEED)


def test_meldet_eine_fehlende_datei(tmp_path: Path) -> None:
    with pytest.raises(FormularDefinitionFehlt) as fehler:
        lade(tmp_path)

    # The message has to name the path it looked at. Whoever reads it is looking
    # at a broken deployment and has nothing else to go on.
    assert str(tmp_path / "felder.json") in str(fehler.value)


def test_meldet_eine_unlesbare_datei(tmp_path: Path) -> None:
    (tmp_path / "felder.json").write_text("{ not json", encoding="utf-8")

    with pytest.raises(FormularDefinitionFehlt):
        lade(tmp_path)


def test_meldet_eine_definition_ohne_version(tmp_path: Path) -> None:
    schreibe(tmp_path, {"felder": [], "anzahl": 0})

    with pytest.raises(FormularDefinitionFehlt):
        lade(tmp_path)


def test_meldet_eine_abgeschnittene_liste(tmp_path: Path) -> None:
    """The declared count and the list beside it must agree.

    A file that says 540 and holds 12 is a truncated copy, and accepting it would
    turn a deployment problem into hundreds of valid protocols being refused.
    """
    schreibe(
        tmp_path,
        {"version": "20260609", "anzahl": FELDER_IM_PDF, "felder": [{"name": "anlass"}]},
    )

    with pytest.raises(FormularDefinitionFehlt) as fehler:
        lade(tmp_path)

    assert str(FELDER_IM_PDF) in str(fehler.value)


def test_meldet_doppelte_namen(tmp_path: Path) -> None:
    """Two fields with one name means the extraction is wrong.

    The count check catches it, because a duplicate collapses in the set and
    leaves fewer distinct names than the file claims to hold.
    """
    schreibe(
        tmp_path,
        {
            "version": "20260609",
            "anzahl": 2,
            "felder": [{"name": "anlass"}, {"name": "anlass"}],
        },
    )

    with pytest.raises(FormularDefinitionFehlt):
        lade(tmp_path)
