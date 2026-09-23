"""Which of the form's 540 fields carry an answer.

The list under test is written by hand, so these tests are what stop it drifting
from the form. Three of them cross-check it against a structural property of the
file rather than against itself, which is the only kind of check worth having
here: a hand list tested against a hand list agrees with itself forever.
"""

import json
from typing import Any

from app.config import get_settings
from app.protokolle.einlesen.felder import (
    AKTIONEN,
    ANZEIGEN,
    BILDER,
    FORMULARINTERN,
    KEINE_ANTWORT,
    SUMMEN,
    ist_antwort,
)


def felder_aus_dem_seed() -> list[dict[str, Any]]:
    """Every field as the generated seed records it, `werte` included."""
    pfad = get_settings().formular_seed_dir / "felder.json"
    roh = json.loads(pfad.read_text(encoding="utf-8"))
    felder: list[dict[str, Any]] = roh["felder"]
    return felder


def test_genau_485_der_540_felder_sind_antworten() -> None:
    """A number, deliberately, rather than a proportion.

    If FFS issues a form with a field more or a field less, this fails and
    somebody has to look at it and decide. That is the point: a new question
    appearing in the form must not be imported or ignored by accident.
    """
    namen = [feld["name"] for feld in felder_aus_dem_seed()]

    assert len(namen) == 540
    assert len([name for name in namen if ist_antwort(name)]) == 485
    assert len(KEINE_ANTWORT) == 55


def test_jeder_ausgeschlossene_name_gibt_es_wirklich() -> None:
    """No typos, and nothing left behind by a form that has moved on."""
    namen = {feld["name"] for feld in felder_aus_dem_seed()}

    assert KEINE_ANTWORT <= namen


def test_kein_druckknopf_ist_eine_antwort() -> None:
    """The cross-check that matters most.

    A push button is recognisable in the file: its export values are the keys of
    an appearance stream, so they come out as BBox, Filter, FormType and the
    rest. Nothing typed that list, so if a later form version adds a button, this
    fails rather than importing a page of PDF dictionary keys as an answer.
    """
    knoepfe = {
        feld["name"]
        for feld in felder_aus_dem_seed()
        if "BBox" in feld.get("werte", [])
    }

    assert len(knoepfe) == 12
    assert knoepfe == AKTIONEN | BILDER
    assert not any(ist_antwort(name) for name in knoepfe)


def test_keine_anzeige_und_keine_summe_ist_eine_antwort() -> None:
    """The other two cross-checks, both by naming pattern in the file."""
    namen = [feld["name"] for feld in felder_aus_dem_seed()]

    anzeigen = {name for name in namen if name.startswith("check_")}
    summen = {name for name in namen if name.endswith(".summe")}

    assert anzeigen == ANZEIGEN
    assert summen | {"arten.gesamtsumme"} == SUMMEN
    assert not any(ist_antwort(name) for name in anzeigen | summen)


def test_die_gruppen_ueberschneiden_sich_nicht() -> None:
    """55 names in five groups, each named once.

    A name in two groups would still be excluded, so nothing would break, but the
    count above would quietly stop meaning what it says.
    """
    gruppen = [AKTIONEN, BILDER, ANZEIGEN, SUMMEN, FORMULARINTERN]

    assert sum(len(gruppe) for gruppe in gruppen) == 55
    assert len(KEINE_ANTWORT) == 55


def test_die_z_felder_sind_antworten() -> None:
    """They look like FiaKa bookkeeping, and the form still asks for them.

    entwurf/typen.ts stores all three, by the decision of 2026-09-01, so an
    import that dropped them would lose answers the application shows a field
    for.
    """
    assert ist_antwort("z.rp")
    assert ist_antwort("z.quelle")
    assert ist_antwort("z.ps_nummer")


def test_eine_artzeile_ohne_ihre_summe() -> None:
    """The catch table's cells are answers; the total it works out is not."""
    assert ist_antwort("arten.art7.klasse_3")
    assert ist_antwort("arten.art7.0plus")
    assert ist_antwort("arten.art7.name")
    assert not ist_antwort("arten.art7.summe")
    assert not ist_antwort("arten.gesamtsumme")


def test_die_bilder_sind_keine_antworten() -> None:
    """They are attachments, which 23d turns into real Anlagen."""
    assert not ist_antwort("fotos.kartenausschnitt_image")
    assert not ist_antwort("fotos.bild1")
    assert len(BILDER) == 5
