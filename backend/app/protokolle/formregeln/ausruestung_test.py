"""Ported case for case from frontend/src/protokoll/regeln/ausruestung.test.ts."""

from typing import Any

import pytest

from app.formular.felder import formular
from app.protokolle.formregeln.ausruestung import (
    ANODEN_KEINE,
    BEFISCHTE_BREITE_NULL,
    BEFISCHTE_LAENGE_NULL,
    ZAHL_NEGATIV,
    ZAHLENFELDER,
    ist_leeres_paar,
    pruefe_ausruestung,
)


def dokument(**paare: str) -> dict[str, Any]:
    """An answers document built from dotted paths."""
    antworten: dict[str, Any] = {}
    for pfad, wert in paare.items():
        block, feld = pfad.split("__")
        antworten.setdefault(block, {})[feld] = wert
    return antworten


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_ausruestung(antworten)]


class TestGegenDasSeed:
    def test_jedes_zahlenfeld_gibt_es_im_formular(self) -> None:
        pfade = formular().pfade
        for pfad in ZAHLENFELDER:
            assert pfad in pfade, pfad

    def test_neun_mengenangaben(self) -> None:
        assert len(ZAHLENFELDER) == 9


class TestEinUnberuehrterAbschnitt:
    def test_sagt_nichts_zu_einem_leeren_dokument(self) -> None:
        # The legacy checks, copied literally, fire on a brand new draft. This
        # form does not do that: an unanswered question is the normal state.
        assert pruefe_ausruestung({}) == []
        assert pruefe_ausruestung({"ausruestung": {}, "befischte_bereiche": {}}) == []


class TestDieDreiPaare:
    def test_meldet_null_anoden_von_beiden_arten(self) -> None:
        # Zero ring anodes and zero strip anodes is a claim that the survey was
        # carried out with no anode at all.
        verstoesse = pruefe_ausruestung(
            dokument(ausruestung__ringanoden="0", ausruestung__streifenanoden="0")
        )
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [("paar.anoden", ANODEN_KEINE)]

    def test_nimmt_eine_angegebene_anodenart(self) -> None:
        assert pruefe_ausruestung(dokument(ausruestung__ringanoden="2")) == []
        assert (
            pruefe_ausruestung(
                dokument(ausruestung__ringanoden="0", ausruestung__streifenanoden="2")
            )
            == []
        )

    def test_meldet_eine_befischte_laenge_von_null(self) -> None:
        assert schluessel(
            dokument(
                befischte_bereiche__ges_gew_laenge="0",
                befischte_bereiche__ufer_laenge="0",
            )
        ) == [BEFISCHTE_LAENGE_NULL]

    def test_meldet_eine_befischte_breite_von_null(self) -> None:
        assert schluessel(
            dokument(
                befischte_bereiche__ges_gew_breite="0",
                befischte_bereiche__ufer_breite="0",
            )
        ) == [BEFISCHTE_BREITE_NULL]

    def test_ein_leeres_feld_neben_einer_null_ist_immer_noch_nichts(self) -> None:
        assert schluessel(dokument(ausruestung__ringanoden="0")) == [ANODEN_KEINE]

    def test_die_paare_laufen_quer_nicht_die_zeile_entlang(self) -> None:
        # A length for the whole width and a width along the bank passes,
        # leaving two half-filled rows. That is the legacy form's own pairing.
        quer = dokument(
            befischte_bereiche__ges_gew_laenge="120",
            befischte_bereiche__ufer_breite="4",
        )
        assert pruefe_ausruestung(quer) == []

    def test_meldet_alle_drei_paare(self) -> None:
        alles_null = dokument(
            ausruestung__ringanoden="0",
            ausruestung__streifenanoden="0",
            befischte_bereiche__ges_gew_laenge="0",
            befischte_bereiche__ufer_laenge="0",
            befischte_bereiche__ges_gew_breite="0",
            befischte_bereiche__ufer_breite="0",
        )
        assert [v.pfad for v in pruefe_ausruestung(alles_null)] == [
            "paar.anoden",
            "paar.befischte_laenge",
            "paar.befischte_breite",
        ]

    def test_eine_null_mit_komma_zaehlt_auch_als_nichts(self) -> None:
        assert schluessel(
            dokument(
                befischte_bereiche__ges_gew_laenge="0,0",
                befischte_bereiche__ufer_laenge="0.0",
            )
        ) == [BEFISCHTE_LAENGE_NULL]

    def test_ignoriert_antworten_die_zu_keinem_paar_gehoeren(self) -> None:
        andere = {
            "ausruestung": {"egeraet": "FEG 3000", "spannung": "0", "leistung": "0"},
            "anodenfuehrer": {"vorname": "Anna"},
        }
        assert pruefe_ausruestung(andere) == []


class TestDasVorzeichen:
    @pytest.mark.parametrize("pfad", ZAHLENFELDER)
    def test_weist_jede_negative_menge_zurueck(self, pfad: str) -> None:
        block, feld = pfad.split(".")
        verstoesse = pruefe_ausruestung({block: {feld: "-1"}})
        assert (pfad, ZAHL_NEGATIV) in [(v.pfad, v.schluessel) for v in verstoesse]

    def test_meldet_gegen_das_feld_nicht_gegen_ein_paar(self) -> None:
        # There is exactly one box the wrong number is in.
        verstoesse = pruefe_ausruestung(dokument(ausruestung__spannung="-300"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("ausruestung.spannung", ZAHL_NEGATIV)
        ]

    def test_nimmt_null_und_positive_mengen(self) -> None:
        assert pruefe_ausruestung(dokument(ausruestung__spannung="300")) == []
        assert pruefe_ausruestung(dokument(ausruestung__spannung="0")) == []

    def test_meldet_ein_minus_neben_der_paarmeldung_nicht_statt_ihrer(self) -> None:
        # -2 is not zero, so the pair is satisfied and only the sign is wrong.
        # The two rules judge different things about the same box and neither
        # suppresses the other.
        verstoesse = pruefe_ausruestung(
            dokument(ausruestung__ringanoden="-2", ausruestung__streifenanoden="0")
        )
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("ausruestung.ringanoden", ZAHL_NEGATIV)
        ]

    def test_liest_ein_negatives_komma_dezimal_wie_ein_punkt_dezimal(self) -> None:
        assert schluessel(dokument(befischte_bereiche__ufer_breite="-0,5")) == [ZAHL_NEGATIV]

    @pytest.mark.parametrize("wert", ["0", "1", "0,5", "12.75", "4000"])
    def test_laesst_null_und_positive_werte_zu(self, wert: str) -> None:
        assert ZAHL_NEGATIV not in schluessel(dokument(ausruestung__spannung=wert))

    def test_sagt_nichts_zu_einer_unlesbaren_menge(self) -> None:
        # Only the sign is judged here. A word in a voltage box is the shape
        # check's business, not this rule's.
        assert pruefe_ausruestung(dokument(ausruestung__spannung="dreihundert")) == []


class TestIstLeeresPaar:
    def test_zwei_leere_felder_sind_kein_leeres_paar(self) -> None:
        # Nobody has answered yet, which is the normal state of a draft.
        assert not ist_leeres_paar(["", "  "])

    def test_zwei_nullen_sind_ein_leeres_paar(self) -> None:
        assert ist_leeres_paar(["0", "0"])

    def test_eine_null_neben_einer_zahl_ist_kein_leeres_paar(self) -> None:
        assert not ist_leeres_paar(["0", "2"])

    def test_eine_null_neben_einem_leeren_feld_ist_ein_leeres_paar(self) -> None:
        assert ist_leeres_paar(["0", ""])
