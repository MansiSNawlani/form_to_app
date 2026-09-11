"""Ported case for case from frontend/src/protokoll/regeln/prozent.test.ts."""

from typing import Any

import pytest

from app.formular.felder import formular
from app.protokolle.formregeln.prozent import (
    KEINE_GANZE_ZAHL,
    PROZENTGRUPPEN,
    SUBSTRAT,
    SUMME_NICHT_HUNDERT,
    UFERNEIGUNG,
    UMLAND,
    Prozentgruppe,
    bewerte_anteile,
    pruefe_prozentgruppen,
)


def dokument(*paare: tuple[str, str]) -> dict[str, Any]:
    """An answers document built from dotted paths, the way a form writes one."""
    antworten: dict[str, Any] = {}
    for pfad, wert in paare:
        block, feld = pfad.split(".")
        antworten.setdefault(block, {})[feld] = wert
    return antworten


def gefuellt(gruppe: Prozentgruppe, *anteile: str) -> dict[str, Any]:
    return dokument(*zip(gruppe.felder, anteile, strict=False))


def zusammen(*dokumente: dict[str, Any]) -> dict[str, Any]:
    """Several runs in one document.

    A merge one level down rather than dict.update, because three of the six
    runs live under ufer: the bank's slope, its vegetation and its reinforcement
    are separate runs on the printed form and one block in the document.
    """
    zusammengelegt: dict[str, Any] = {}
    for teil in dokumente:
        for block, felder in teil.items():
            zusammengelegt.setdefault(block, {}).update(felder)
    return zusammengelegt


def schluessel(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.schluessel for verstoss in pruefe_prozentgruppen(antworten)]


class TestDieGruppenGegenDasSeed:
    def test_jedes_feld_gibt_es_im_formular(self) -> None:
        # The runs are a fact about the legacy form, not a choice this half
        # gets to make. The browser pins its own copy the same way.
        pfade = formular().pfade
        for gruppe in PROZENTGRUPPEN:
            for feld in gruppe.felder:
                assert feld in pfade, feld

    def test_die_sechs_gruppen_haben_die_erwarteten_groessen(self) -> None:
        assert [len(gruppe.felder) for gruppe in PROZENTGRUPPEN] == [8, 4, 9, 8, 8, 6]

    def test_kein_feld_steht_in_zwei_gruppen(self) -> None:
        alle = [feld for gruppe in PROZENTGRUPPEN for feld in gruppe.felder]
        assert len(set(alle)) == len(alle)


class TestEinUnberuehrterLauf:
    def test_sagt_nichts_zu_einem_leeren_dokument(self) -> None:
        assert pruefe_prozentgruppen({}) == []

    def test_sagt_nichts_zu_einem_lauf_aus_lauter_leerzeichen(self) -> None:
        assert pruefe_prozentgruppen(gefuellt(UFERNEIGUNG, "", "  ", "", "")) == []


class TestDieSummeVonHundert:
    def test_nimmt_einen_lauf_der_auf_hundert_kommt(self) -> None:
        assert pruefe_prozentgruppen(gefuellt(UFERNEIGUNG, "25", "25", "25", "25")) == []

    def test_nimmt_einen_einzigen_anteil_von_hundert(self) -> None:
        # A bank that is entirely one thing: one share of 100 and three blanks.
        assert pruefe_prozentgruppen(gefuellt(UFERNEIGUNG, "100")) == []

    def test_meldet_neunundneunzig(self) -> None:
        verstoesse = pruefe_prozentgruppen(gefuellt(UFERNEIGUNG, "25", "25", "25", "24"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("summe.neigung", SUMME_NICHT_HUNDERT)
        ]

    def test_meldet_hunderteins(self) -> None:
        assert schluessel(gefuellt(UFERNEIGUNG, "25", "25", "25", "26")) == [SUMME_NICHT_HUNDERT]

    def test_meldet_gegen_die_gruppe_nicht_gegen_ein_feld(self) -> None:
        # Turning every box in a run red for one total is noise.
        verstoesse = pruefe_prozentgruppen(gefuellt(UMLAND, "50"))
        assert [v.pfad for v in verstoesse] == ["summe.umland"]

    def test_ignoriert_leerzeichen_um_einen_anteil(self) -> None:
        # Whitespace survives a paste.
        assert pruefe_prozentgruppen(gefuellt(UMLAND, " 100 ")) == []

    def test_eine_null_ist_eine_antwort(self) -> None:
        # Zero is not blank. A run answered as all zeroes totals 0, which is
        # not 100, and saying nothing about it would let it through.
        assert schluessel(gefuellt(UFERNEIGUNG, "0", "0", "0", "0")) == [SUMME_NICHT_HUNDERT]


class TestKeineGanzeZahl:
    @pytest.mark.parametrize("eingabe", ["25,5", "25.5", "-25", "abc", "1e2", " ½ ", "1000"])
    def test_weist_etwas_zurueck_das_kein_ganzer_prozentwert_ist(self, eingabe: str) -> None:
        verstoesse = pruefe_prozentgruppen(gefuellt(UFERNEIGUNG, eingabe, "25", "25", "25"))
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [
            ("ufer.flachufer", KEINE_GANZE_ZAHL)
        ]

    def test_weist_einen_anteil_ueber_hundert_zurueck(self) -> None:
        assert schluessel(gefuellt(UFERNEIGUNG, "101")) == [KEINE_GANZE_ZAHL]

    def test_schweigt_ueber_die_summe_wenn_ein_anteil_unlesbar_ist(self) -> None:
        # Two messages for one mistake is noise.
        assert schluessel(gefuellt(UFERNEIGUNG, "abc", "25")) == [KEINE_GANZE_ZAHL]

    def test_meldet_jeden_unlesbaren_anteil(self) -> None:
        assert schluessel(gefuellt(UFERNEIGUNG, "abc", "def")) == [
            KEINE_GANZE_ZAHL,
            KEINE_GANZE_ZAHL,
        ]


class TestAlleSechsGruppen:
    def test_prueft_die_substratverteilung_wie_jede_andere(self) -> None:
        # Defect 1: the legacy form reads five of its six indicators at submit
        # and leaves this one out, so a substrate distribution totalling 43 is
        # accepted today.
        assert schluessel(gefuellt(SUBSTRAT, "43")) == [SUMME_NICHT_HUNDERT]

    def test_prueft_jede_gruppe_einzeln(self) -> None:
        alle_falsch = zusammen(*(gefuellt(gruppe, "1") for gruppe in PROZENTGRUPPEN))
        gemeldet = [v.pfad for v in pruefe_prozentgruppen(alle_falsch)]
        assert gemeldet == [gruppe.id for gruppe in PROZENTGRUPPEN]

    def test_eine_falsche_gruppe_beruehrt_die_anderen_nicht(self) -> None:
        gemischt = zusammen(gefuellt(UFERNEIGUNG, "25", "25", "25", "25"), gefuellt(SUBSTRAT, "43"))
        assert [v.pfad for v in pruefe_prozentgruppen(gemischt)] == ["summe.substrat"]


class TestBewerteAnteile:
    def test_urteilt_ueber_werte_ohne_ein_dokument(self) -> None:
        # The running total on screen and the document's validity have to be
        # the same arithmetic, so the browser half judges values directly.
        assert bewerte_anteile(UFERNEIGUNG, ["25", "25", "25", "25"]) == []
        assert len(bewerte_anteile(UFERNEIGUNG, ["25", "25", "25", "24"])) == 1

    def test_verlangt_einen_wert_je_feld(self) -> None:
        # A short list would silently judge a run the caller only half handed
        # over, so it raises rather than guessing.
        with pytest.raises(ValueError, match="argument"):
            bewerte_anteile(UFERNEIGUNG, ["25", "25"])
