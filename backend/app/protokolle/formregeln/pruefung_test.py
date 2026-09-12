"""Every rule in the package, over a whole protocol.

The individual modules are tested beside themselves. This is about the three
things only the assembled check can show: that a real protocol passes, that a
broken one is caught in every part, and that no violation can ever reach a
person as a raw key.
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.formular.pflicht import pflichtfelder
from app.protokolle.formregeln import pruefe_protokoll
from app.protokolle.formregeln.beispiele import KAPUTT, VOLLSTAENDIG
from app.protokolle.formregeln.hydrologie import MARKIERTE_FELDER, NICHT_ZUTREFFEND
from app.protokolle.regeln import pruefe_antworten

#: The required list as the application reads it, out of the seed file the browser
#: reads too. Bound at module level so the parametrised cases below can use it.
PFLICHTFELDER_ = pflichtfelder().pfade

# The browser's German locale, which is the authority on what a valid key is.
# Reached by path rather than by import for the obvious reason: this is the
# Python half and that is a TypeScript project's file.
DE_JSON = Path(__file__).resolve().parents[4] / "frontend" / "src" / "i18n" / "locales" / "de.json"


def regel_schluessel() -> set[str]:
    inhalt = json.loads(DE_JSON.read_text(encoding="utf-8"))
    return {f"protokoll.regeln.{name}" for name in inhalt["protokoll"]["regeln"]}


def alle_schluessel(antworten: dict[str, Any]) -> set[str]:
    return {verstoss.schluessel for verstoss in pruefe_protokoll(antworten)}


class TestEinEchtesProtokoll:
    def test_geht_ohne_beanstandung_durch(self) -> None:
        assert pruefe_protokoll(VOLLSTAENDIG) == []

    def test_ein_stillgewaesser_geht_mit_der_markierung_durch(self) -> None:
        # The same protocol on a pond: the hydrology block is marked as not
        # applying, which is what the browser writes by itself.
        see: dict[str, Any] = json.loads(json.dumps(VOLLSTAENDIG))
        see["probestrecke"]["gewaessertyp"] = "21"
        see["hydrologie"] = {feld: NICHT_ZUTREFFEND for feld in MARKIERTE_FELDER}
        assert pruefe_protokoll(see) == []


class TestEinLeeresProtokoll:
    def test_meldet_jedes_pflichtfeld_und_die_tabelle(self) -> None:
        gemeldet = [verstoss.pfad for verstoss in pruefe_protokoll({})]
        assert gemeldet == [*PFLICHTFELDER_, "tabelle.arten"]

    def test_meldet_sonst_nichts(self) -> None:
        # An empty document is unfinished, not wrong. Every rule but the
        # completeness check stays quiet about a blank answer, which is what
        # lets the same rules run over a half-finished draft.
        assert alle_schluessel({}) == {"protokoll.regeln.fehlt", "protokoll.regeln.fehltArt"}


class TestEinKaputtesProtokoll:
    def test_faengt_jede_eingebaute_verletzung(self) -> None:
        assert alle_schluessel(KAPUTT) == {
            "protokoll.regeln.fehlt",  # messdaten.schaumbildung
            "protokoll.regeln.monitoringnummerPflicht",
            "protokoll.regeln.vorfluterKeinEndpunkt",
            "protokoll.regeln.koordinateRechtswertAusserhalb",
            "protokoll.regeln.schaetzwertAusserhalbBand",
            "protokoll.regeln.prozentsummeNichtHundert",
            "protokoll.regeln.einfluesseKeineUndNutzung",
            "protokoll.regeln.anodenKeine",
            "protokoll.regeln.nullPlusUeberSumme",
            "protokoll.regeln.artDoppelt",
        }

    def test_meldet_was_fehlt_vor_dem_was_falsch_ist(self) -> None:
        # Somebody repairing a protocol fills the gaps before they argue with
        # the rules, and 11c shows this list as it comes.
        gemeldet = [verstoss.pfad for verstoss in pruefe_protokoll(KAPUTT)]
        assert gemeldet[0] == "messdaten.schaumbildung"

    def test_meldet_jede_zelle_hoechstens_einmal(self) -> None:
        pfade = [verstoss.pfad for verstoss in pruefe_protokoll(KAPUTT)]
        assert len(pfade) == len(set(pfade))


class TestEinFeldDasZweiRegelnBricht:
    def test_die_grundsaetzlichere_meldung_gewinnt(self) -> None:
        # A pond carrying a real width estimate trips hydrologie.py, because
        # the section does not apply to standing water at all, and
        # schaetzwert.py, because the estimate sits under a band marked as not
        # applying. Both are true and only one is worth saying.
        teich: dict[str, Any] = json.loads(json.dumps(VOLLSTAENDIG))
        teich["probestrecke"]["gewaessertyp"] = "26"
        teich["hydrologie"] = {"breite": NICHT_ZUTREFFEND, "breite_schaetzwert": "3,5"}

        schaetzwert = [
            verstoss
            for verstoss in pruefe_protokoll(teich)
            if verstoss.pfad == "hydrologie.breite_schaetzwert"
        ]
        assert [v.schluessel for v in schaetzwert] == [
            "protokoll.regeln.hydrologieBeiStillgewaesser"
        ]


class TestJederSchluesselHatEinenText:
    """No violation may reach a person as a raw key.

    The browser types its own keys against de.json, so a key it holds cannot be
    misspelled. This half has no such compiler, and a key with no text behind it
    would render as "protokoll.regeln.fehlt" on somebody's screen.
    """

    @pytest.mark.parametrize(
        "antworten", [VOLLSTAENDIG, KAPUTT, {}], ids=["vollstaendig", "kaputt", "leer"]
    )
    def test_jeder_gemeldete_schluessel_steht_in_de_json(self, antworten: dict[str, Any]) -> None:
        assert alle_schluessel(antworten) <= regel_schluessel()

    def test_jeder_schluessel_im_paket_steht_in_de_json(self) -> None:
        # Not only the ones these three documents happen to raise. Every
        # constant in the package that looks like a rule key is checked, so a
        # rule added later with a key nobody translated fails here.
        import pkgutil
        from importlib import import_module

        import app.protokolle.formregeln as paket

        deklariert: set[str] = set()
        for modul in pkgutil.iter_modules(paket.__path__):
            if modul.name.endswith("_test"):
                continue
            geladen = import_module(f"{paket.__name__}.{modul.name}")
            deklariert |= {
                wert
                for wert in vars(geladen).values()
                if isinstance(wert, str) and wert.startswith("protokoll.regeln.")
            }

        assert deklariert, "no rule keys found, so this test is proving nothing"
        assert deklariert <= regel_schluessel()


@pytest.mark.parametrize("dokument", [VOLLSTAENDIG, KAPUTT], ids=["vollstaendig", "kaputt"])
def test_die_beispiele_sind_dokumente_die_wirklich_gespeichert_werden_koennen(
    dokument: dict[str, Any],
) -> None:
    """Both fixtures have to be documents the form could really hold.

    They are not, automatically. Nothing in this package looks at a path the rules
    do not judge, so a group written as a bare string sits there unnoticed: this
    is exactly how bemerkungen was wrong from feature 11a until feature 11c saved
    the fixture through the real endpoint and app/protokolle/regeln.py refused it.

    Deliberately true of the broken fixture too. KAPUTT is meant to break rules,
    not to be a document this form cannot store, or it would be testing two
    different failures at once.
    """
    pruefe_antworten(dokument)
