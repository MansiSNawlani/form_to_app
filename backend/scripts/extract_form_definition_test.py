"""Tests for the label pairing in extract_form_definition.py.

Everything else this script does can be checked by reading its output: a wrong
field name or a missing option is visible in the JSON. The pairing cannot. A
label attached to the wrong export value produces a file that looks entirely
correct and stores the wrong answer, so the pairing is checked here and against
the real form rather than against the transcription that produced it.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from extract_form_definition import (
    RADIO_LABELS,
    export_values,
    radio_options,
    walk,
)
from pypdf import PdfReader

PDF = (
    Path(__file__).resolve().parents[2]
    / "Resources"
    / "Fiaka_Resources"
    / "Formular_Protokoll_E-Befischung_V20260609.pdf"
)


@pytest.fixture(scope="module")
def exportwerte() -> dict[str, list[str]]:
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


@pytest.mark.parametrize("feldname", sorted(RADIO_LABELS))
def test_every_transcribed_group_matches_the_real_form(
    feldname: str, exportwerte: dict[str, list[str]]
) -> None:
    """The guard that matters: the transcription describes this form, not a memory of it."""
    assert feldname in exportwerte, f"{feldname} is not a button group in the form"

    radio_options(feldname, exportwerte[feldname])


def test_the_hydrology_groups_all_carry_the_not_applicable_value(
    exportwerte: dict[str, list[str]],
) -> None:
    """If a future form version drops it, feature 5b's suppression has nothing to write."""
    hydrologie = [name for name in RADIO_LABELS if name.startswith("hydrologie.")]

    assert len(hydrologie) == 9
    for name in hydrologie:
        assert "0" in exportwerte[name]
        assert RADIO_LABELS[name]["0"] is None
