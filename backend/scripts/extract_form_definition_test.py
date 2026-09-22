"""Tests for the label pairing in extract_form_definition.py.

Everything else this script does can be checked by reading its output: a wrong
field name or a missing option is visible in the JSON. The pairing cannot. A
label attached to the wrong export value produces a file that looks entirely
correct and stores the wrong answer, so the pairing is checked here and against
the real form rather than against the transcription that produced it.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import pytest
from extract_form_definition import (
    RADIO_LABELS,
    export_values,
    extract,
    feldformat,
    radio_options,
)
from pypdf import PdfReader
from pypdf.generic import DictionaryObject, NameObject, TextStringObject

# From its own home rather than through the script that uses it. walk moved to
# app/formular/pdf.py in feature 23a, and importing it from the script would be
# leaning on a re-export that mypy is right to refuse.
from app.formular.pdf import walk

PDF = (
    Path(__file__).resolve().parents[2]
    / "Resources"
    / "Fiaka_Resources"
    / "Formular_Protokoll_E-Befischung_V20260609.pdf"
)


@pytest.fixture(scope="module")
def button_values() -> dict[str, list[str]]:
    """Every button group in the real form, as name to export values."""
    reader = PdfReader(str(PDF))
    catalog: Any = reader.trailer["/Root"].get_object()
    acroform: Any = catalog["/AcroForm"].get_object()
    return {
        name: export_values(field)
        for name, field in walk(acroform["/Fields"])
        if str(field.get("/FT", "")) == "/Btn"
    }


def test_options_follow_the_printed_order_not_the_export_order() -> None:
    """Strömung reads 5 to 1 across the page, which is the order surveyors see."""
    options = radio_options("hydrologie.stroemung", ["5", "4", "3", "2", "1", "0"])

    assert [o["wert"] for o in options] == ["5", "4", "3", "2", "1"]
    assert options[0] == {"wert": "5", "label": "reißend"}


def test_an_unlabelled_value_is_never_offered() -> None:
    """0 means "hydrology does not apply", so it is not an answer anybody picks."""
    options = radio_options("hydrologie.breite", ["1", "2", "3", "4", "5", "6", "7", "0"])

    assert "0" not in [o["wert"] for o in options]
    assert len(options) == 7


def test_a_value_the_transcription_does_not_cover_raises() -> None:
    with pytest.raises(ValueError, match="Not labelled: \\['9'\\]"):
        radio_options("messdaten.truebung", ["1", "2", "3", "9"])


def test_a_label_the_form_does_not_export_raises() -> None:
    with pytest.raises(ValueError, match="Not exported: \\['3'\\]"):
        radio_options("messdaten.truebung", ["1", "2"])


@pytest.mark.parametrize("field_name", sorted(RADIO_LABELS))
def test_every_transcribed_group_matches_the_real_form(
    field_name: str, button_values: dict[str, list[str]]
) -> None:
    """The guard that matters: the transcription describes this form, not a memory of it."""
    assert field_name in button_values, f"{field_name} is not a button group in the form"

    radio_options(field_name, button_values[field_name])


def test_the_hydrology_groups_all_carry_the_not_applicable_value(
    button_values: dict[str, list[str]],
) -> None:
    """If a future form version drops it, feature 5b's suppression has nothing to write."""
    hydrologie = [name for name in RADIO_LABELS if name.startswith("hydrologie.")]

    assert len(hydrologie) == 9
    for name in hydrologie:
        assert "0" in button_values[name]
        assert RADIO_LABELS[name]["0"] is None


def feld_mit_format(script: str) -> Any:
    """A field dictionary carrying one format action, as the real ones do."""
    return DictionaryObject(
        {
            NameObject("/AA"): DictionaryObject(
                {
                    NameObject("/F"): DictionaryObject(
                        {NameObject("/JS"): TextStringObject(script)}
                    )
                }
            )
        }
    )


def test_erkennt_die_drei_formate_der_form() -> None:
    """A number, a date and a time, which is all this form has."""
    assert feldformat(feld_mit_format('AFNumber_Format(1, 2, 0, 0, "", true);')) == {
        "art": "zahl",
        "stellen": 1,
        "trennung": 2,
    }
    assert feldformat(feld_mit_format('AFDate_FormatEx("dd.mm.yyyy");')) == {
        "art": "datum",
        "muster": "dd.mm.yyyy",
    }
    assert feldformat(feld_mit_format("AFTime_Format(0);")) == {"art": "zeit"}


def test_ein_feld_ohne_formatskript_hat_kein_format() -> None:
    assert feldformat(DictionaryObject()) is None
    assert feldformat(DictionaryObject({NameObject("/AA"): DictionaryObject()})) is None


def test_ein_unbekanntes_datumsmuster_haelt_die_extraktion_an() -> None:
    """Rather than landing in the seed for the importer to guess at.

    A pattern read as dd.mm.yyyy when it is really mm/dd/yyyy stores the fourth
    of May as the fifth of April, and nothing downstream would notice.
    """
    with pytest.raises(ValueError, match="unknown date pattern"):
        feldformat(feld_mit_format('AFDate_FormatEx("mm/dd/yyyy");'))


def test_ein_unbekanntes_formatskript_haelt_die_extraktion_an() -> None:
    """The same rule radio_options follows for an unlabelled button.

    Every format script in this form is one of three kinds. A fourth means FFS
    changed something, and a seed that shrugs at it would claim to know how a
    field is written when it does not.
    """
    with pytest.raises(ValueError, match="unrecognised format script"):
        feldformat(feld_mit_format("AFPercent_Format(2, 0);"))


def test_jedes_formatskript_der_echten_form_wird_erkannt() -> None:
    """Against the real file: 383 numbers, one date, one time, 155 with none."""
    reader = PdfReader(str(PDF))
    catalog: Any = reader.trailer["/Root"].get_object()
    acroform: Any = catalog["/AcroForm"].get_object()

    formate = [feldformat(field) for _, field in walk(acroform["/Fields"])]
    arten = Counter(f["art"] for f in formate if f is not None)

    assert len(formate) == 540
    assert arten == {"zahl": 383, "datum": 1, "zeit": 1}


def test_die_ausgelieferte_definition_ist_die_erzeugte() -> None:
    """The committed seed is what this script produces from the committed PDF.

    The generator and its output, checked against each other. Two things this
    catches, and both have happened to generated files elsewhere: a seed
    hand-edited rather than regenerated, and a change to this script that nobody
    re-ran it after. It also holds the claim feature 23a made when it added the
    formats, that regenerating changed nothing else.
    """
    seed = Path(__file__).resolve().parents[2] / "database" / "seed" / "form_version_20260609"
    _, felder = extract(PDF)
    committed = json.loads((seed / "felder.json").read_text(encoding="utf-8"))

    assert felder == committed


def test_die_ausgelieferten_optionslisten_sind_die_erzeugten() -> None:
    """The same for the option lists, which the whole form depends on."""
    seed = Path(__file__).resolve().parents[2] / "database" / "seed" / "form_version_20260609"
    optionslisten, _ = extract(PDF)
    committed = json.loads((seed / "optionslisten.json").read_text(encoding="utf-8"))

    assert optionslisten == committed
