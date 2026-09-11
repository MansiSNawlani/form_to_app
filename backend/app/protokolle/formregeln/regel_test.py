from app.protokolle.formregeln.regel import (
    ARTEN_TABELLE,
    EINFLUSS_WIDERSPRUCH,
    Formverstoss,
    als_zahl,
    ist_leer,
    wert_aus,
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


class TestFormverstoss:
    def test_traegt_pfad_und_schluessel(self) -> None:
        verstoss = Formverstoss("umland.wiese", "protokoll.regeln.prozentKeineGanzeZahl")
        assert verstoss.pfad == "umland.wiese"
        assert verstoss.schluessel == "protokoll.regeln.prozentKeineGanzeZahl"

    def test_ist_vergleichbar(self) -> None:
        # Tests below compare whole lists of violations, so two violations
        # saying the same thing must count as equal.
        assert Formverstoss("a", "b") == Formverstoss("a", "b")

    def test_pseudopfade_sind_keine_feldpfade(self) -> None:
        # A pseudo-path must never collide with a real answer path, or a
        # violation about a group would light up an unrelated box.
        assert ARTEN_TABELLE == "tabelle.arten"
        assert EINFLUSS_WIDERSPRUCH == "widerspruch.einfluesse"
