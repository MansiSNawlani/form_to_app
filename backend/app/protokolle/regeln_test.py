"""A draft may be empty and half-finished, but it may not hold what the form has no field for."""

import pytest

from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    Verstoss,
    Verstossgrund,
)
from app.protokolle.regeln import (
    MAX_ZEICHEN_GESAMT,
    MAX_ZEICHEN_PRO_ANTWORT,
    finde_verstoesse,
    pruefe_antworten,
    zaehle_zeichen,
)

# A document using one path from each shape the form has: a top level answer, a
# two level one, a three level one, and the catch table's odd key that begins
# with a digit.
GUELTIG = {
    "anlass": "wrrl_monitoring",
    "bearbeiter": {"name": "M. Bergmann", "ort": "Langenargen"},
    "probestrecke": {"gewaesser": {"gewaessername": "Schussen"}},
    "arten": {"art1": {"name": "BFOR", "klasse_3": "12", "0plus": "4"}},
}


def test_ein_ausgefuelltes_protokoll_geht_durch() -> None:
    assert finde_verstoesse(GUELTIG) == ()


def test_ein_leeres_protokoll_geht_durch() -> None:
    """A draft is incomplete by definition, and a brand new one holds nothing."""
    assert finde_verstoesse({}) == ()


def test_eine_leere_gruppe_geht_durch() -> None:
    """React Hook Form hands back untouched groups as empty objects.

    Refusing them would fail an ordinary save for holding nothing at all.
    """
    assert finde_verstoesse({"bearbeiter": {}, "probestrecke": {"gewaesser": {}}}) == ()


def test_meldet_einen_unbekannten_pfad() -> None:
    verstoesse = finde_verstoesse({"bearbeiter": {"lieblingsfarbe": "blau"}})

    assert verstoesse == (Verstoss("bearbeiter.lieblingsfarbe", Verstossgrund.UNBEKANNT),)


def test_meldet_eine_unbekannte_gruppe() -> None:
    """A group used as if it were a field is an unknown path, not a type error.

    "bearbeiter" alone is not a field: the form has bearbeiter.name and its
    siblings, so writing to the group itself has no meaning.
    """
    verstoesse = finde_verstoesse({"bearbeiter": "M. Bergmann"})

    assert verstoesse == (Verstoss("bearbeiter", Verstossgrund.UNBEKANNT),)


@pytest.mark.parametrize("wert", [7, 7.5, True, None, ["BFOR"], {"tief": {"er": "x"}}])
def test_meldet_was_kein_text_ist(wert: object) -> None:
    """Every answer is text on the way in, including the numbers.

    frontend/src/protokoll/entwurf/typen.ts explains why: a number input holds
    "54" mid-typing and "" when cleared, and neither of those is a number.
    """
    verstoesse = finde_verstoesse({"bearbeiter": {"name": wert}})

    assert verstoesse == (Verstoss("bearbeiter.name", Verstossgrund.KEIN_TEXT),)


def test_laesst_eine_lange_antwort_bis_zur_grenze_zu() -> None:
    lang = "x" * MAX_ZEICHEN_PRO_ANTWORT

    assert finde_verstoesse({"bemerkungen": {"sonstige_bemerkungen": lang}}) == ()


def test_meldet_eine_zu_lange_antwort() -> None:
    zu_lang = "x" * (MAX_ZEICHEN_PRO_ANTWORT + 1)

    verstoesse = finde_verstoesse({"bemerkungen": {"sonstige_bemerkungen": zu_lang}})

    assert verstoesse == (
        Verstoss("bemerkungen.sonstige_bemerkungen", Verstossgrund.ZU_LANG),
    )


def test_meldet_einen_punkt_im_schluessel() -> None:
    """A flat key would be a second spelling of a nested path.

    With both in one document nothing decides which wins, so only the nested
    spelling is allowed to exist.
    """
    verstoesse = finde_verstoesse({"bearbeiter.name": "M. Bergmann"})

    assert verstoesse == (Verstoss("bearbeiter.name", Verstossgrund.PUNKT_IM_SCHLUESSEL),)


def test_meldet_alle_verstoesse_nicht_nur_den_ersten() -> None:
    """A client sending one wrong path is usually sending several."""
    verstoesse = finde_verstoesse(
        {"erfunden": "a", "bearbeiter": {"name": 7, "firma": "Ok"}}
    )

    assert set(verstoesse) == {
        Verstoss("erfunden", Verstossgrund.UNBEKANNT),
        Verstoss("bearbeiter.name", Verstossgrund.KEIN_TEXT),
    }


def test_steigt_nicht_tiefer_als_das_formular_reicht() -> None:
    """Nesting past the deepest real field cannot be a field, so the walk stops.

    An untrusted document must not be able to decide how deep we go, which is
    also why the walk uses a stack rather than recursion.
    """
    tief: dict[str, object] = {"blatt": "x"}
    for _ in range(500):
        tief = {"ebene": tief}

    verstoesse = finde_verstoesse(tief)

    assert verstoesse == (Verstoss("ebene.ebene.ebene", Verstossgrund.UNBEKANNT),)


def test_zaehlt_die_zeichen_ueber_das_ganze_dokument() -> None:
    assert zaehle_zeichen(GUELTIG) == sum(
        len(wert)
        for wert in ["wrrl_monitoring", "M. Bergmann", "Langenargen", "Schussen", "BFOR", "12", "4"]
    )


def test_zaehlen_ueberspringt_was_kein_text_ist() -> None:
    """Counting must not raise on its way to reporting that a value is wrong."""
    assert zaehle_zeichen({"bearbeiter": {"name": 7, "firma": "Ok"}}) == 2


def test_pruefen_laesst_ein_gueltiges_dokument_durch() -> None:
    pruefe_antworten(GUELTIG)


@pytest.mark.parametrize("dokument", [[], "text", 7, None])
def test_pruefen_weist_zurueck_was_kein_dokument_ist(dokument: object) -> None:
    with pytest.raises(AntwortenNichtLesbar):
        pruefe_antworten(dokument)


def test_pruefen_weist_ein_zu_grosses_dokument_zurueck() -> None:
    """Size is reported before the violations, and on purpose.

    A runaway document would otherwise produce a violation list as long as
    itself, and "this protocol is too big" is the useful thing to say either way.
    """
    viele = {
        "bemerkungen": {"sonstige_bemerkungen": "x" * MAX_ZEICHEN_PRO_ANTWORT},
        "erfunden": "x" * MAX_ZEICHEN_GESAMT,
    }

    with pytest.raises(AntwortenZuGross) as fehler:
        pruefe_antworten(viele)

    assert fehler.value.hoechstens == MAX_ZEICHEN_GESAMT
    assert fehler.value.zeichen > MAX_ZEICHEN_GESAMT


def test_pruefen_weist_unbekannte_pfade_zurueck() -> None:
    with pytest.raises(AntwortenUngueltig) as fehler:
        pruefe_antworten({"erfunden": "a"})

    assert fehler.value.verstoesse == (Verstoss("erfunden", Verstossgrund.UNBEKANNT),)


def test_gruppiert_verstoesse_nach_grund() -> None:
    """Grouped and sorted, so the same broken document always reads the same way."""
    with pytest.raises(AntwortenUngueltig) as fehler:
        pruefe_antworten({"zebra": "a", "anton": "b", "bearbeiter": {"name": 7}})

    assert fehler.value.nach_grund() == {
        Verstossgrund.UNBEKANNT: ["anton", "zebra"],
        Verstossgrund.KEIN_TEXT: ["bearbeiter.name"],
    }
