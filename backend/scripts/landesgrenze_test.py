"""The committed border file, and whether it still matches what the script makes.

The second test needs the two downloads in Resources/Geodaten/, which is not in
the repository, and skips without them the way extract_form_definition_test.py
does without the form. The first always runs, because the application reads the
committed file and a hand edit that broke its shape would otherwise only show as
a coordinate check that quietly accepts everything.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from landesgrenze import (
    FEHLT,
    STEHENDE,
    VERBREITERUNG_M,
    VG250,
    ZIEL,
    als_json,
    landesflaeche,
    schreibe,
    vorhanden,
)

# The old rectangle from formregeln/koordinaten.py, which every point of a
# Baden-Wuerttemberg border widened by 2 km has to fall inside.
RECHTSWERT = (380_000, 620_000)
HOCHWERT = (5_255_000, 5_525_000)


def test_die_datei_hat_die_erwartete_form() -> None:
    daten = json.loads(ZIEL.read_text(encoding="utf-8"))

    assert daten["srid"] == 25832
    assert daten["verbreiterung_m"] == VERBREITERUNG_M
    assert "BKG" in daten["quelle"] and "LUBW" in daten["quelle"]
    assert daten["polygone"], "keine einzige Fläche"
    for polygon in daten["polygone"]:
        for ring in polygon:
            assert len(ring) >= 4
            assert ring[0] == ring[-1], "ein Ring ist nicht geschlossen"
            for x, y in ring:
                assert isinstance(x, int) and isinstance(y, int)
                assert RECHTSWERT[0] <= x <= RECHTSWERT[1]
                assert HOCHWERT[0] <= y <= HOCHWERT[1]
    # Small enough to ship to the browser without anybody noticing.
    assert ZIEL.stat().st_size < 100_000


@pytest.mark.skipif(not vorhanden(), reason=FEHLT)
def test_die_datei_entspricht_dem_was_das_skript_erzeugt(tmp_path: Path) -> None:
    neu = tmp_path / "landesgrenze_bw.json"
    schreibe(als_json(landesflaeche(VG250, STEHENDE)), neu)

    assert neu.read_text(encoding="utf-8") == ZIEL.read_text(encoding="utf-8")
