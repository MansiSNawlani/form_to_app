import pytest

from app.formular.felder import formular
from app.protokolle.formregeln.regel import (
    ANODEN_PAAR,
    ARTEN_TABELLE,
    BREITE_PAAR,
    EINFLUSS_WIDERSPRUCH,
    LAENGE_PAAR,
    SUMME_BEWUCHS,
    SUMME_NEIGUNG,
    SUMME_SOHLVERBAU,
    SUMME_SUBSTRAT,
    SUMME_UFERVERBAU,
    SUMME_UMLAND,
    Formverstoss,
    als_zahl,
    ist_leer,
    wert_aus,
)

PSEUDOPFADE = (
    SUMME_UMLAND,
    SUMME_NEIGUNG,
    SUMME_BEWUCHS,
    SUMME_UFERVERBAU,
    SUMME_SUBSTRAT,
    SUMME_SOHLVERBAU,
    EINFLUSS_WIDERSPRUCH,
    ANODEN_PAAR,
    LAENGE_PAAR,
    BREITE_PAAR,
    ARTEN_TABELLE,
)


class TestIstLeer:
    def test_nichts_ist_leer(self) -> None:
        assert ist_leer(None)
        assert ist_leer("")

    def test_nur_leerzeichen_ist_leer(self) -> None:
        assert ist_leer("   ")
        assert ist_leer("\t\n")

    def test_eine_null_ist_nicht_leer(self) -> None:
        # A count of zero is an answer. Treating it as blank would let a row
        # saying "none caught" read as a row nobody filled in.
        assert not ist_leer("0")


class TestWertAus:
    def test_holt_einen_wert_eine_ebene_tief(self) -> None:
        assert wert_aus({"anlass": "wrrl"}, "anlass") == "wrrl"

    def test_holt_einen_wert_drei_ebenen_tief(self) -> None:
        antworten = {"probestrecke": {"gewaesser": {"vorfluter1": "Schussen"}}}
        assert wert_aus(antworten, "probestrecke.gewaesser.vorfluter1") == "Schussen"

    def test_fehlender_pfad_ist_leer(self) -> None:
        assert wert_aus({}, "probestrecke.gewaesser.vorfluter1") == ""
        assert wert_aus({"probestrecke": {}}, "probestrecke.ortsangabe") == ""

    def test_ein_zweig_der_kein_objekt_ist_ist_leer(self) -> None:
        # Walking into a string rather than an object must answer "nothing
        # there", not raise. A hand-edited document can hold anything.
        assert wert_aus({"probestrecke": "Text"}, "probestrecke.ortsangabe") == ""

    def test_ein_wert_der_kein_text_ist_ist_leer(self) -> None:
        # Every answer is a string on the way in; typen.ts says why. A number
        # here came from somewhere that bypassed the form.
        assert wert_aus({"laenge": 110}, "laenge") == ""
        assert wert_aus({"laenge": None}, "laenge") == ""


class TestAlsZahl:
    def test_liest_eine_ganze_zahl(self) -> None:
        assert als_zahl("12") == 12

    def test_liest_ein_deutsches_komma(self) -> None:
        assert als_zahl("0,0") == 0
        assert als_zahl("1,5") == 1.5

    def test_liest_einen_punkt(self) -> None:
        assert als_zahl("0.0") == 0
        assert als_zahl("1.5") == 1.5

    def test_ueberliest_leerzeichen(self) -> None:
        # Whitespace survives a paste.
        assert als_zahl(" 12 ") == 12

    def test_liest_ein_negatives_vorzeichen(self) -> None:
        assert als_zahl("-3") == -3

    def test_nichts_ist_keine_zahl(self) -> None:
        assert als_zahl(None) is None
        assert als_zahl("") is None
        assert als_zahl("   ") is None

    def test_worte_sind_keine_zahl(self) -> None:
        assert als_zahl("zwoelf") is None
        assert als_zahl("12abc") is None

    def test_unendlich_ist_keine_zahl(self) -> None:
        # float("Infinity") succeeds in Python and Number("Infinity") succeeds in
        # JavaScript, and both would then pass any upper bound a rule sets.
        assert als_zahl("Infinity") is None
        assert als_zahl("-Infinity") is None
        assert als_zahl("nan") is None
        assert als_zahl("1e400") is None

    @pytest.mark.parametrize("eingabe", ["1_000", "1_0", "0x10", "0b11", "1__0"])
    def test_liest_nichts_das_javascript_anders_liest(self, eingabe: str) -> None:
        # The one place the two halves could disagree in the dangerous
        # direction. float() reads "1_000" as 1000 and Number() reads it as NaN,
        # so without the pattern the authoritative gate would be the looser of
        # the two. Number() reads "0x10" as 16, which is a disagreement the
        # other way round, and this refuses that too.
        assert als_zahl(eingabe) is None

    @pytest.mark.parametrize("eingabe", ["1e3", "-0,5", "+12", ".5", "5."])
    def test_liest_was_javascript_auch_liest(self, eingabe: str) -> None:
        assert als_zahl(eingabe) is not None


class TestFormverstoss:
    def test_traegt_pfad_und_schluessel(self) -> None:
        verstoss = Formverstoss("umland.wiese", "protokoll.regeln.prozentKeineGanzeZahl")
        assert verstoss.pfad == "umland.wiese"
        assert verstoss.schluessel == "protokoll.regeln.prozentKeineGanzeZahl"

    def test_ist_vergleichbar(self) -> None:
        # Tests below compare whole lists of violations, so two violations
        # saying the same thing must count as equal.
        assert Formverstoss("a", "b") == Formverstoss("a", "b")

    def test_kein_pseudopfad_ist_ein_echter_feldpfad(self) -> None:
        # The claim is a collision, so the form's own field list is what has to
        # be asked. ufer.neigung is a real field, the slope of a built-up dam in
        # degrees, which is why the percentage run about bank slopes could not
        # be named after itself.
        pfade = formular().pfade
        for pseudo in PSEUDOPFADE:
            assert pseudo not in pfade, pseudo
