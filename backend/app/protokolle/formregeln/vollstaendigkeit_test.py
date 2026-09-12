"""What a finished protocol has to contain.

No TypeScript twin to port from: requiredness has never been enforced in either
half of the app.
"""

from typing import Any

import pytest

from app.formular.felder import formular
from app.formular.pflicht import pflichtfelder
from app.protokolle.formregeln.hydrologie import NICHT_ZUTREFFEND
from app.protokolle.formregeln.vollstaendigkeit import (
    FEHLT,
    FEHLT_ART,
    pruefe_vollstaendigkeit,
)

#: The required list as the application reads it, out of the seed file the browser
#: reads too. Bound at module level so the parametrised cases below can use it.
PFLICHTFELDER_ = pflichtfelder().pfade

#: The nine hydrology pickers among them, which several cases below work with as a
#: group. Derived rather than listed, so a band added to the block cannot be
#: required in one place and forgotten here.
HYDROLOGIE_PFLICHT = tuple(
    pfad for pfad in PFLICHTFELDER_ if pfad.startswith("hydrologie.")
)


def setze(antworten: dict[str, Any], pfad: str, wert: str) -> None:
    teile = pfad.split(".")
    zweig = antworten
    for teil in teile[:-1]:
        zweig = zweig.setdefault(teil, {})
    zweig[teile[-1]] = wert


def vollstaendig(**abweichungen: str) -> dict[str, Any]:
    """A protocol with every required answer given, plus one named species."""
    antworten: dict[str, Any] = {}
    for pfad in PFLICHTFELDER_:
        setze(antworten, pfad, "1")
    setze(antworten, "arten.art1.name", "SATR")
    for pfad, wert in abweichungen.items():
        setze(antworten, pfad.replace("__", "."), wert)
    return antworten


def fehlende_pfade(antworten: dict[str, Any]) -> list[str]:
    return [verstoss.pfad for verstoss in pruefe_vollstaendigkeit(antworten)]


class TestGegenDasSeed:
    def test_jedes_pflichtfeld_gibt_es_im_formular(self) -> None:
        pfade = formular().pfade
        for pfad in PFLICHTFELDER_:
            assert pfad in pfade, pfad

    def test_kein_feld_steht_zweimal_in_der_liste(self) -> None:
        assert len(set(PFLICHTFELDER_)) == len(PFLICHTFELDER_)

    def test_die_monitoringnummer_steht_nicht_in_der_liste(self) -> None:
        # monitoring.py already demands it for a WRRL or FFH occasion, and
        # listing it here too would put two messages on one empty box.
        assert "probestrecke.monitoringnummer" not in PFLICHTFELDER_

    def test_so_viele_felder_wie_sterne_im_formular(self) -> None:
        # 32 pflicht markers in the block components, minus the
        # Monitoringstrecken-Nr., which monitoring.py owns.
        assert len(PFLICHTFELDER_) == 31

    @pytest.mark.parametrize(
        "pfad", ["probestrecke.untere", "probestrecke.obere", "ausruestung.leistung"]
    )
    def test_ein_feld_ohne_stern_wird_nicht_verlangt(self, pfad: str) -> None:
        # These three look like they belong and carry no asterisk. Requiring
        # them would widen the gate past what the form promises, which is how
        # the two halves would start disagreeing about what a finished protocol
        # is. Worth asking FFS rather than deciding here.
        assert pfad not in PFLICHTFELDER_

    def test_die_schaetzwerte_stehen_nicht_in_der_liste(self) -> None:
        # An estimate only ever refines a band.
        assert not [pfad for pfad in PFLICHTFELDER_ if pfad.endswith("_schaetzwert")]

    def test_neun_hydrologiefelder(self) -> None:
        assert len(HYDROLOGIE_PFLICHT) == 9


class TestEinVollstaendigesProtokoll:
    def test_meldet_nichts(self) -> None:
        assert pruefe_vollstaendigkeit(vollstaendig()) == []


class TestEinLeeresProtokoll:
    def test_meldet_jedes_pflichtfeld(self) -> None:
        gemeldet = fehlende_pfade({})
        assert gemeldet == [*PFLICHTFELDER_, "tabelle.arten"]

    def test_meldet_in_formularreihenfolge(self) -> None:
        # The panel in 11c lists these, so they come in the order somebody
        # walks the protocol.
        gemeldet = fehlende_pfade({})
        assert gemeldet[0] == "anlass"
        assert gemeldet[-1] == "tabelle.arten"

    def test_jede_meldung_traegt_denselben_schluessel(self) -> None:
        verstoesse = pruefe_vollstaendigkeit({})
        assert {v.schluessel for v in verstoesse} == {FEHLT, FEHLT_ART}


class TestEinzelneFehlendeAntworten:
    @pytest.mark.parametrize("pfad", PFLICHTFELDER_)
    def test_meldet_jedes_einzelne_geleerte_feld(self, pfad: str) -> None:
        antworten = vollstaendig()
        setze(antworten, pfad, "")
        assert fehlende_pfade(antworten) == [pfad]

    def test_behandelt_lauter_leerzeichen_als_fehlend(self) -> None:
        antworten = vollstaendig()
        setze(antworten, "bearbeiter.name", "   ")
        assert fehlende_pfade(antworten) == ["bearbeiter.name"]

    def test_eine_null_ist_eine_antwort(self) -> None:
        # A conductivity of 0 is a reading, not a blank.
        antworten = vollstaendig()
        setze(antworten, "messdaten.leitfaehigkeit", "0")
        assert pruefe_vollstaendigkeit(antworten) == []


class TestDieHydrologieAmStillgewaesser:
    def test_verlangt_die_neun_felder_auch_am_see(self) -> None:
        # The browser writes the marking by itself. Requiring the fields is
        # what makes the marking actually have to be there.
        antworten = vollstaendig(probestrecke__gewaessertyp="21")
        for pfad in HYDROLOGIE_PFLICHT:
            setze(antworten, pfad, "")
        assert fehlende_pfade(antworten) == list(HYDROLOGIE_PFLICHT)

    def test_die_markierung_zaehlt_als_antwort(self) -> None:
        antworten = vollstaendig(probestrecke__gewaessertyp="26")
        for pfad in HYDROLOGIE_PFLICHT:
            setze(antworten, pfad, NICHT_ZUTREFFEND)
        assert pruefe_vollstaendigkeit(antworten) == []


class TestDieFangtabelle:
    def test_verlangt_mindestens_eine_genannte_art(self) -> None:
        antworten = vollstaendig()
        setze(antworten, "arten.art1.name", "")
        verstoesse = pruefe_vollstaendigkeit(antworten)
        assert [(v.pfad, v.schluessel) for v in verstoesse] == [("tabelle.arten", FEHLT_ART)]

    def test_ein_kein_nachweis_code_reicht(self) -> None:
        # A survey that caught nothing still records a result.
        assert pruefe_vollstaendigkeit(vollstaendig(arten__art1__name="OFAN")) == []

    def test_eine_art_in_irgendeiner_zeile_reicht(self) -> None:
        antworten = vollstaendig()
        setze(antworten, "arten.art1.name", "")
        setze(antworten, "arten.art17.name", "HECH")
        assert pruefe_vollstaendigkeit(antworten) == []

    def test_zahlen_ohne_art_reichen_nicht(self) -> None:
        antworten = vollstaendig()
        setze(antworten, "arten.art1.name", "")
        setze(antworten, "arten.art1.klasse_3", "7")
        assert fehlende_pfade(antworten) == ["tabelle.arten"]


class TestWasNichtVerlangtWird:
    def test_verlangt_nichts_aus_teil_3(self) -> None:
        # Decided on 2026-09-11: requiring the habitat blocks would be new
        # policy FFS never asked for.
        assert not [pfad for pfad in PFLICHTFELDER_ if pfad.startswith(("umland.", "ufer."))]
        assert not [pfad for pfad in PFLICHTFELDER_ if pfad.startswith("gewaessersohle.")]

    def test_verlangt_nichts_aus_teil_4(self) -> None:
        assert not [
            pfad
            for pfad in PFLICHTFELDER_
            if pfad.startswith(("strukturen.", "einfluesse.", "bewirschaftung.", "besatz"))
        ]

    def test_verlangt_keine_bemerkungen(self) -> None:
        assert not [pfad for pfad in PFLICHTFELDER_ if "bemerkung" in pfad]
