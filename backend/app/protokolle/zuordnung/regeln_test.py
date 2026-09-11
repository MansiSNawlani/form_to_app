"""Reading a finished protocol into the values its envelope needs.

No database anywhere in this file. Everything under test is a plain function from
the answers document to typed values, which is what coding-standards.md asks of
a domain rule and what makes these cheap enough to cover properly.

The two halves worth watching are the normalisation, where comparing loosely
while storing faithfully is the whole point, and the parsing, where an answer
that reached the document round the form has to be refused rather than guessed
at.
"""

import pytest

from app.protokolle.fehler import UmschlagUnvollstaendig
from app.protokolle.zuordnung.regeln import (
    lies_umschlag,
    normalisiert,
)

VOLLSTAENDIG = {
    "anlass": "wrrl",
    "datum": "2026-06-09",
    "z": {"rp": "4"},
    "messdaten": {"uhrzeit": "14:30"},
    "bearbeiter": {
        "name": "Anna Weber",
        "email": "Weber@FFS.de",
        "firma": "Buero Weber",
        "telefon": "07541 12345",
    },
    "probestrecke": {
        "gewaesser": {"gewaessername": "Schussen", "vorfluter1": "Bodensee", "vorfluter2": "Rhein"},
        "ortsangabe": "unterhalb der Bruecke",
        "gewaessertyp": "13",
        "laenge": "450",
        "utm_rw_unten": "512340",
        "utm_hw_unten": "5398120",
        "utm_rw_oben": "512890",
        "utm_hw_oben": "5398450",
    },
}


def mit(**aenderungen: object) -> dict[str, object]:
    """The complete document with one branch replaced, merged one level deep."""
    kopie: dict[str, object] = {**VOLLSTAENDIG}
    for schluessel, wert in aenderungen.items():
        vorher = kopie.get(schluessel)
        if isinstance(vorher, dict) and isinstance(wert, dict):
            kopie[schluessel] = {**vorher, **wert}
        else:
            kopie[schluessel] = wert
    return kopie


def ohne(pfad: str) -> dict[str, object]:
    """The complete document with one dotted path removed."""
    teile = pfad.split(".")
    kopie: dict[str, object] = {
        schluessel: dict(wert) if isinstance(wert, dict) else wert
        for schluessel, wert in VOLLSTAENDIG.items()
    }
    aktuell: object = kopie
    for teil in teile[:-1]:
        assert isinstance(aktuell, dict)
        aktuell[teil] = dict(aktuell[teil])
        aktuell = aktuell[teil]
    assert isinstance(aktuell, dict)
    del aktuell[teile[-1]]
    return kopie


def test_liest_die_getippten_werte_als_typen() -> None:
    umschlag = lies_umschlag(VOLLSTAENDIG)

    assert umschlag.anlass == "wrrl"
    assert umschlag.datum.isoformat() == "2026-06-09"
    assert umschlag.uhrzeit.isoformat() == "14:30:00"
    assert umschlag.bearbeiter_name == "Anna Weber"
    assert umschlag.probestrecke.gewaessertyp == 13
    assert umschlag.probestrecke.laenge_m == 450
    assert umschlag.probestrecke.regierungspraesidium == 4
    assert umschlag.probestrecke.untere_grenze_rechtswert == 512340
    assert umschlag.probestrecke.obere_grenze_hochwert == 5398450


def test_speichert_die_schreibweise_wie_getippt() -> None:
    """Defect 2 is the legacy form lowercasing names. Nothing here repeats it."""
    umschlag = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "gewaesser": {"gewaessername": "  Schussen  ", "vorfluter1": "BODENSEE"},
            }
        )
    )

    assert umschlag.gewaesser.name == "  Schussen  "
    assert umschlag.gewaesser.vorfluter == ("BODENSEE",)
    assert umschlag.person.email == "Weber@FFS.de"


def test_vergleicht_ohne_ruecksicht_auf_schreibweise() -> None:
    """The same water typed two ways is one water.

    Loose comparison and faithful storage are the same rule seen from two sides,
    and formregeln/vorfluter.py already works this way.
    """
    getippt = lies_umschlag(VOLLSTAENDIG)
    anders = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "gewaesser": {
                    "gewaessername": " schussen ",
                    "vorfluter1": "BODENSEE",
                    "vorfluter2": "rhein",
                },
            }
        )
    )

    assert getippt.gewaesser.schluessel == anders.gewaesser.schluessel
    assert getippt.gewaesser.name != anders.gewaesser.name


def test_derselbe_name_in_einem_anderen_einzugsgebiet_ist_ein_anderes_gewaesser() -> None:
    """Baden-Wuerttemberg has many a Muehlbach.

    The name alone is not an identity, and amtliche_id, which would settle it,
    stays empty until feature 18. The chain is what places the water.
    """
    zum_rhein = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "gewaesser": {"gewaessername": "Muehlbach", "vorfluter1": "Neckar"},
            }
        )
    )
    zur_donau = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "gewaesser": {"gewaessername": "Muehlbach", "vorfluter1": "Iller"},
            }
        )
    )

    assert zum_rhein.gewaesser.schluessel != zur_donau.gewaesser.schluessel


def test_die_kette_behaelt_ihre_reihenfolge_und_verliert_die_luecken() -> None:
    """The order is the chain, so it is not sorted or deduplicated.

    Trailing blanks are dropped: five boxes with two filled in is a chain of two,
    not a chain of two and three empties.
    """
    umschlag = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "gewaesser": {
                    "gewaessername": "Schussen",
                    "vorfluter1": "Bodensee",
                    "vorfluter2": "Rhein",
                    "vorfluter3": "   ",
                },
            }
        )
    )

    assert umschlag.gewaesser.vorfluter == ("Bodensee", "Rhein")


def test_eine_monitoringstrecke_wird_ueber_ihre_nummer_erkannt() -> None:
    ohne_nummer = lies_umschlag(VOLLSTAENDIG)
    mit_nummer = lies_umschlag(
        mit(
            probestrecke={
                **VOLLSTAENDIG["probestrecke"],  # type: ignore[dict-item]
                "monitoringnummer": "MS-4711",
            }
        )
    )

    assert ohne_nummer.probestrecke.monitoringstrecke_nr is None
    assert mit_nummer.probestrecke.monitoringstrecke_nr == "MS-4711"
    # The decision of 2026-09-11: the two keys never cross, so a numbered stretch
    # and an identically placed unnumbered one are different records.
    assert ohne_nummer.probestrecke.schluessel != mit_nummer.probestrecke.schluessel


@pytest.mark.parametrize(
    ("pfad", "wert"),
    [
        # A month of 13 and a day of 45. The picker cannot produce either, so a
        # document holding one came from somewhere that went round the form.
        ("datum", "2026-13-45"),
        ("datum", "09.06.2026"),
        ("messdaten.uhrzeit", "25:00"),
        ("messdaten.uhrzeit", "halb drei"),
        ("probestrecke.laenge", "450,5"),
        ("probestrecke.laenge", "0"),
        ("probestrecke.gewaessertyp", "31"),
        ("probestrecke.utm_rw_unten", "512340.7"),
        ("z.rp", "5"),
    ],
)
def test_weist_werte_zurueck_die_kein_typ_sind(pfad: str, wert: str) -> None:
    """Refused, never guessed at.

    Interpreting "09.06.2026" as a date would be choosing between the 9th of June
    and the 6th of September on somebody else's behalf, and the wrong choice is
    silently wrong data in a state database.
    """
    teile = pfad.split(".")
    dokument: dict[str, object] = {
        schluessel: dict(inhalt) if isinstance(inhalt, dict) else inhalt
        for schluessel, inhalt in VOLLSTAENDIG.items()
    }
    ziel: object = dokument
    for teil in teile[:-1]:
        assert isinstance(ziel, dict)
        ziel[teil] = dict(ziel[teil])
        ziel = ziel[teil]
    assert isinstance(ziel, dict)
    ziel[teile[-1]] = wert

    with pytest.raises(UmschlagUnvollstaendig) as fehler:
        lies_umschlag(dokument)

    assert fehler.value.pfade == (pfad,)


@pytest.mark.parametrize(
    "pfad",
    [
        "anlass",
        "datum",
        "messdaten.uhrzeit",
        "z.rp",
        "bearbeiter.name",
        "bearbeiter.email",
        "probestrecke.gewaesser.gewaessername",
        "probestrecke.gewaesser.vorfluter1",
        "probestrecke.ortsangabe",
        "probestrecke.gewaessertyp",
        "probestrecke.laenge",
        "probestrecke.utm_rw_unten",
        "probestrecke.utm_hw_unten",
        "probestrecke.utm_rw_oben",
        "probestrecke.utm_hw_oben",
    ],
)
def test_ein_fehlender_pflichtwert_wird_benannt_statt_halb_geschrieben(pfad: str) -> None:
    """11c runs the completeness rules before this, so reaching here means a bug.

    It still fails loudly rather than writing a partial row, because the rows
    this feeds are shared between protocols and half of one is worse than none.
    """
    with pytest.raises(UmschlagUnvollstaendig) as fehler:
        lies_umschlag(ohne(pfad))

    assert fehler.value.pfade == (pfad,)


def test_nennt_jeden_fehlenden_wert_nicht_nur_den_ersten() -> None:
    """A document missing one value is usually missing several."""
    dokument = ohne("anlass")
    del dokument["datum"]

    with pytest.raises(UmschlagUnvollstaendig) as fehler:
        lies_umschlag(dokument)

    assert fehler.value.pfade == ("anlass", "datum")


def test_die_optionalen_angaben_duerfen_fehlen() -> None:
    """Five of the Bearbeiter's seven fields carry no asterisk on the form.

    Requiring them in the database while the rules leave them open would be the
    two halves disagreeing about what a finished protocol is.
    """
    umschlag = lies_umschlag(ohne("bearbeiter.firma"))

    assert umschlag.person.firma is None
    assert umschlag.person.telefon == "07541 12345"


def test_die_monitoringnummer_darf_fehlen() -> None:
    """Only a monitoring programme assigns one, and most surveys belong to none."""
    assert lies_umschlag(VOLLSTAENDIG).probestrecke.monitoringstrecke_nr is None


@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        ("Schussen", "schussen"),
        ("  Schussen  ", "schussen"),
        ("SCHUSSEN", "schussen"),
        ("Weber@FFS.de", "weber@ffs.de"),
        # Casefold rather than lower, so the German sharp s compares equal to the
        # spelling somebody else used.
        ("Weißach", "weissach"),
        ("WEISSACH", "weissach"),
    ],
)
def test_normalisiert_fuer_den_vergleich(roh: str, erwartet: str) -> None:
    assert normalisiert(roh) == erwartet
