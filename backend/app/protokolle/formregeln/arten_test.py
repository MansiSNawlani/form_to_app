"""The counting half of the catch table.

Ported from frontend/src/protokoll/regeln/arten.test.ts, the cases about totals,
cell contents and the young-of-year column. The species cases are in
artenliste_test.py.
"""

from typing import Any

import pytest

from app.formular.felder import formular
from app.protokolle.formregeln.arten import (
    ANZAHL_KEINE_GANZE_ZAHL,
    ARTNUMMERN,
    KLASSENFELDER,
    NULL_PLUS_UEBER_SUMME,
    ZAEHLFELDER,
    art_pfad,
    pruefe_anzahlen,
    pruefe_null_plus,
    summe_aus_werten,
)


def zeile(nr: int, *klassen: str, null_plus: str = "", name: str = "") -> dict[str, Any]:
    """One catch row, given its size classes in ascending order."""
    felder: dict[str, str] = dict(zip(KLASSENFELDER, klassen, strict=False))
    if null_plus:
        felder["0plus"] = null_plus
    if name:
        felder["name"] = name
    return {"arten": {f"art{nr}": felder}}


def schluessel_anzahlen(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_anzahlen(antworten)]


class TestGegenDasSeed:
    def test_jedes_zaehlfeld_gibt_es_im_formular(self) -> None:
        pfade = formular().pfade
        for nr in ARTNUMMERN:
            for feld in ZAEHLFELDER:
                assert art_pfad(nr, feld) in pfade, art_pfad(nr, feld)

    def test_sechsundzwanzig_zeilen_zu_zehn_klassen(self) -> None:
        # Both numbers are the printed form's.
        assert len(ARTNUMMERN) == 26
        assert len(KLASSENFELDER) == 10
        assert len(ZAEHLFELDER) == 11


class TestSummeAusWerten:
    def test_zaehlt_eine_zeile_zusammen(self) -> None:
        assert summe_aus_werten(["12", "34", "18", "6", "2"]) == 72

    def test_eine_leere_zelle_ist_nichts(self) -> None:
        assert summe_aus_werten(["12", "", "  ", "6"]) == 18

    def test_eine_leere_zeile_ist_null(self) -> None:
        assert summe_aus_werten([]) == 0
        assert summe_aus_werten(["", "  "]) == 0

    def test_eine_unlesbare_zelle_macht_die_summe_unbekannt(self) -> None:
        # Reporting the sum of the readable cells would put a confident wrong
        # number under a column.
        assert summe_aus_werten(["12", "viele"]) is None

    def test_eine_kommazahl_macht_die_summe_unbekannt(self) -> None:
        # 2.5 is not a smaller answer than 3, it is not an answer.
        assert summe_aus_werten(["2,5"]) is None

    def test_ein_tausenderpunkt_macht_die_summe_unbekannt(self) -> None:
        # The one place a shared number parser could quietly lose 999 fish:
        # "1.200" reads as 1.2.
        assert summe_aus_werten(["1.200"]) is None


class TestUnmoeglicheAnzahlen:
    def test_sagt_nichts_zu_einer_leeren_tabelle(self) -> None:
        assert pruefe_anzahlen({}) == []
        assert pruefe_anzahlen({"arten": {}}) == []

    def test_nimmt_ganze_zahlen_ab_null(self) -> None:
        assert pruefe_anzahlen(zeile(1, "0", "12", "34")) == []

    @pytest.mark.parametrize("wert", ["-1", "2,5", "2.5", "1.200", "viele", "3 Stueck"])
    def test_weist_etwas_zurueck_das_keine_anzahl_ist(self, wert: str) -> None:
        verstoesse = pruefe_anzahlen(zeile(1, wert))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("arten.art1.klasse_1", ANZAHL_KEINE_GANZE_ZAHL)
        ]

    def test_prueft_auch_die_null_plus_zelle(self) -> None:
        verstoesse = pruefe_anzahlen(zeile(1, "5", null_plus="-2"))
        assert [v.pfad for v in verstoesse] == ["arten.art1.0plus"]

    def test_meldet_jede_schlechte_zelle(self) -> None:
        assert schluessel_anzahlen(zeile(1, "-1", "abc")) == [
            ANZAHL_KEINE_GANZE_ZAHL,
            ANZAHL_KEINE_GANZE_ZAHL,
        ]

    def test_prueft_alle_sechsundzwanzig_zeilen(self) -> None:
        letzte = zeile(26, "-1")
        assert [v.pfad for v in pruefe_anzahlen(letzte)] == ["arten.art26.klasse_1"]


class TestNullPlus:
    def test_sagt_nichts_wenn_null_plus_leer_ist(self) -> None:
        assert pruefe_null_plus(zeile(1, "12", "34")) == []

    def test_nimmt_null_plus_unter_der_zeilensumme(self) -> None:
        assert pruefe_null_plus(zeile(1, "12", "34", null_plus="41")) == []

    def test_nimmt_null_plus_genau_auf_der_zeilensumme(self) -> None:
        # Every fish in the row is young-of-year, which is an ordinary result.
        assert pruefe_null_plus(zeile(1, "12", "34", null_plus="46")) == []

    def test_meldet_null_plus_ueber_der_zeilensumme(self) -> None:
        verstoesse = pruefe_null_plus(zeile(1, "12", "34", null_plus="47"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("arten.art1.0plus", NULL_PLUS_UEBER_SUMME)
        ]

    def test_meldet_null_plus_in_einer_sonst_leeren_zeile(self) -> None:
        # A row total of nothing cannot contain three fish.
        assert [v.pfad for v in pruefe_null_plus(zeile(1, null_plus="3"))] == ["arten.art1.0plus"]

    def test_nimmt_null_plus_von_null_in_einer_leeren_zeile(self) -> None:
        assert pruefe_null_plus(zeile(1, null_plus="0")) == []

    def test_schweigt_ueber_eine_zeile_die_es_nicht_beurteilen_kann(self) -> None:
        # The cell that broke the total has already said so; a second message
        # about the consequence would bury the cause.
        ueberzaehlt_und_kaputt = zeile(1, "abc", null_plus="99")
        assert pruefe_null_plus(ueberzaehlt_und_kaputt) == []
        assert len(pruefe_anzahlen(ueberzaehlt_und_kaputt)) == 1

    def test_zaehlt_null_plus_nicht_zur_zeilensumme(self) -> None:
        # "davon" means the young-of-year are already counted in the classes
        # beside them, so a row of 5 with 5 in 0+ is consistent.
        assert pruefe_null_plus(zeile(1, "5", null_plus="5")) == []

    def test_prueft_jede_zeile_einzeln(self) -> None:
        beide = zeile(1, "2", null_plus="7")
        beide["arten"]["art2"] = {"klasse_1": "10", "0plus": "3"}
        assert [v.pfad for v in pruefe_null_plus(beide)] == ["arten.art1.0plus"]
