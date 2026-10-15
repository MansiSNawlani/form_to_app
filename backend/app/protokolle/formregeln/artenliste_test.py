"""The species half of the catch table.

Ported from frontend/src/protokoll/regeln/arten.test.ts, the cases about which
species a row may name. The counting cases are in arten_test.py.
"""

from typing import Any

import pytest

from app.formular.optionen import optionen
from app.protokolle.formregeln.arten import ANZAHL_KEINE_GANZE_ZAHL, KLASSENFELDER
from app.protokolle.formregeln.artenliste import (
    ART_DOPPELT,
    FANG_OHNE_NACHWEIS_CODE,
    KEIN_NACHWEIS,
    KEIN_NACHWEIS_MIT_FANG,
    KEIN_NACHWEIS_NEBEN_ART,
    OHNE_QUALIFIKATION,
    pruefe_arten,
    pruefe_doppelte_arten,
    pruefe_fang_ohne_nachweis_code,
    pruefe_kein_nachweis_mit_fang,
    pruefe_kein_nachweis_neben_art,
)


def tabelle(*zeilen: tuple[str, ...]) -> dict[str, Any]:
    """The table as rows of (species code, then counts in ascending class order)."""
    arten: dict[str, dict[str, str]] = {}
    for nr, (code, *klassen) in enumerate(zeilen, start=1):
        felder: dict[str, str] = {"name": code}
        felder.update(dict(zip(KLASSENFELDER, klassen, strict=False)))
        arten[f"art{nr}"] = felder
    return {"arten": arten}


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_arten(antworten)]


class TestGegenDasSeed:
    def test_die_vier_codes_gibt_es_wirklich(self) -> None:
        # A code renamed upstream would disable these rules silently rather
        # than fail.
        assert set(KEIN_NACHWEIS) <= optionen().werte("arten")

    def test_der_unqualifizierte_code_ist_einer_der_vier(self) -> None:
        assert OHNE_QUALIFIKATION in KEIN_NACHWEIS

    def test_hundertdreiundzwanzig_arten_im_formular(self) -> None:
        assert len(optionen().werte("arten")) == 123


class TestDoppelteArten:
    def test_nimmt_verschiedene_arten(self) -> None:
        assert pruefe_doppelte_arten(tabelle(("SATR",), ("COGO",), ("BABA",))) == []

    def test_nimmt_eine_tabelle_ohne_arten(self) -> None:
        assert pruefe_doppelte_arten({}) == []
        assert pruefe_doppelte_arten(tabelle(("",), ("",))) == []

    def test_meldet_die_zweite_nennung_nicht_die_erste(self) -> None:
        # The row named first is not the one that went wrong.
        verstoesse = pruefe_doppelte_arten(tabelle(("HECH",), ("COGO",), ("HECH",)))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("arten.art3.name", ART_DOPPELT)
        ]

    def test_meldet_jede_weitere_nennung(self) -> None:
        verstoesse = pruefe_doppelte_arten(tabelle(("HECH",), ("HECH",), ("HECH",)))
        assert [v.pfad for v in verstoesse] == ["arten.art2.name", "arten.art3.name"]

    def test_vergleicht_die_codes_genau(self) -> None:
        # The codes come from the picker, so casing carries no information and
        # normalising would hide a seed list that had drifted.
        assert pruefe_doppelte_arten(tabelle(("HECH",), ("hech",))) == []


class TestKeinNachweisMitFang:
    @pytest.mark.parametrize("code", KEIN_NACHWEIS)
    def test_meldet_jeden_code_neben_einem_fang(self, code: str) -> None:
        verstoesse = pruefe_kein_nachweis_mit_fang(tabelle((code, "7")))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("arten.art1.name", KEIN_NACHWEIS_MIT_FANG)
        ]

    def test_nimmt_einen_code_ohne_zahlen(self) -> None:
        assert pruefe_kein_nachweis_mit_fang(tabelle(("OFAF",))) == []

    def test_nimmt_einen_code_neben_lauter_nullen(self) -> None:
        # Zero caught is exactly what the code claims.
        assert pruefe_kein_nachweis_mit_fang(tabelle(("OFAF", "0", "0"))) == []

    def test_meldet_gegen_die_artzelle_nicht_gegen_die_zahl(self) -> None:
        verstoesse = pruefe_kein_nachweis_mit_fang(tabelle(("OFAF", "0", "3")))
        assert [v.pfad for v in verstoesse] == ["arten.art1.name"]

    def test_laesst_eine_unlesbare_zahl_der_zahlenregel(self) -> None:
        assert pruefe_kein_nachweis_mit_fang(tabelle(("OFAF", "viele"))) == []
        assert pruefe_kein_nachweis_mit_fang(tabelle(("OFAF", "-3"))) == []

    def test_eine_kommazahl_ist_beides(self) -> None:
        # 2,5 is both an impossible count and a catch this row says it did not
        # make, so the row carries two messages in two cells.
        assert set(schluessel(tabelle(("OFAF", "2,5")))) == {
            ANZAHL_KEINE_GANZE_ZAHL,
            KEIN_NACHWEIS_MIT_FANG,
        }


class TestKeinNachweisNebenArt:
    def test_nimmt_den_unqualifizierten_code_allein(self) -> None:
        assert pruefe_kein_nachweis_neben_art(tabelle((OHNE_QUALIFIKATION,))) == []

    def test_meldet_ihn_neben_einer_echten_art(self) -> None:
        verstoesse = pruefe_kein_nachweis_neben_art(tabelle((OHNE_QUALIFIKATION,), ("HECH", "3")))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("arten.art1.name", KEIN_NACHWEIS_NEBEN_ART)
        ]

    def test_meldet_ihn_egal_in_welcher_zeile(self) -> None:
        verstoesse = pruefe_kein_nachweis_neben_art(tabelle(("HECH", "3"), (OHNE_QUALIFIKATION,)))
        assert [v.pfad for v in verstoesse] == ["arten.art2.name"]

    @pytest.mark.parametrize("code", ["OFAF", "KNKR", "KNMU"])
    def test_laesst_die_qualifizierten_drei_neben_einer_art_stehen(self, code: str) -> None:
        # "kein Nachweis, Krebse" beside three Hechte is coherent. Telling the
        # qualified three apart from a species they contradict needs to know
        # which of the 123 entries is a fish, and the seed carries only a code
        # and a German label. Question 10 in docs/ffs-questions.md.
        assert pruefe_kein_nachweis_neben_art(tabelle((code,), ("HECH", "3"))) == []

    def test_meldet_ihn_neben_einem_anderen_nachweis_code(self) -> None:
        # OFAF is another species as far as this rule is concerned: OFAN says
        # nothing at all was found, which OFAF's presence contradicts.
        verstoesse = pruefe_kein_nachweis_neben_art(tabelle((OHNE_QUALIFIKATION,), ("OFAF",)))
        assert [v.pfad for v in verstoesse] == ["arten.art1.name"]


class TestFangOhneNachweisCode:
    def test_sagt_nichts_zu_einer_leeren_tabelle(self) -> None:
        # An empty table is unfinished, not a claim that nothing was caught.
        assert pruefe_fang_ohne_nachweis_code({}) == []
        assert pruefe_fang_ohne_nachweis_code(tabelle(("",))) == []

    def test_sagt_nichts_zu_einer_art_ohne_zahlen(self) -> None:
        # Nobody has typed a count yet.
        assert pruefe_fang_ohne_nachweis_code(tabelle(("HECH",))) == []

    def test_meldet_eine_art_mit_lauter_getippten_nullen(self) -> None:
        verstoesse = pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0", "0")))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("tabelle.arten", FANG_OHNE_NACHWEIS_CODE)
        ]

    def test_eine_einzige_getippte_null_reicht(self) -> None:
        assert len(pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0")))) == 1

    def test_sagt_nichts_wenn_etwas_gefangen_wurde(self) -> None:
        assert pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0", "3"))) == []

    def test_sagt_nichts_wenn_die_tabelle_es_schon_sagt(self) -> None:
        assert pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0"), ("OFAF",))) == []

    def test_sagt_nichts_zu_einer_unlesbaren_tabelle(self) -> None:
        # A table whose totals cannot be trusted is not evidence that nothing
        # was caught.
        assert pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0", "viele"))) == []
        assert pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0", "-1"))) == []

    def test_meldet_unter_der_tabelle_nicht_in_einer_zelle(self) -> None:
        # No single cell is the wrong one: the fix is to pick a "kein Nachweis"
        # entry in place of the species named.
        verstoesse = pruefe_fang_ohne_nachweis_code(tabelle(("HECH", "0"), ("COGO", "0")))
        assert [v.pfad for v in verstoesse] == ["tabelle.arten"]


class TestEineMeldungJeZelle:
    def test_behaelt_die_erste_meldung_einer_zelle(self) -> None:
        # An OFAN row named twice beside a real species is both a duplicate and
        # a contradiction, and only one message can be shown.
        verwirrt = tabelle((OHNE_QUALIFIKATION,), ("HECH", "3"), (OHNE_QUALIFIKATION,))
        dritte = [v for v in pruefe_arten(verwirrt) if v.pfad == "arten.art3.name"]
        assert [v.schluessel for v in dritte] == [KEIN_NACHWEIS_NEBEN_ART]

    def test_meldet_jede_zelle_hoechstens_einmal(self) -> None:
        verwirrt = tabelle((OHNE_QUALIFIKATION, "2,5"), ("HECH", "3"), (OHNE_QUALIFIKATION,))
        pfade = [v.pfad for v in pruefe_arten(verwirrt)]
        assert len(pfade) == len(set(pfade))

    def test_eine_saubere_tabelle_meldet_nichts(self) -> None:
        sauber = tabelle(("SATR", "12", "34"), ("COGO", "8", "21"))
        assert pruefe_arten(sauber) == []
