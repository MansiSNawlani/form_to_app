"""What a finished protocol has to contain.

No TypeScript twin to port from: requiredness has never been enforced in either
half of the app.
"""

from typing import Any

import pytest

from app.formular.felder import formular
from app.formular.pflicht import pflichtfelder
from app.protokolle.formregeln.einfluesse import KEINE_EINFLUESSE, UNBEKANNT_EINFLUESSE
from app.protokolle.formregeln.hydrologie import NICHT_ZUTREFFEND
from app.protokolle.formregeln.prozent import PROZENTGRUPPEN
from app.protokolle.formregeln.vollstaendigkeit import (
    BEWIRTSCHAFTUNG_BLOCK,
    DAMM_NEIGUNG,
    EINFLUSS_BLOCK,
    FEHLT,
    FEHLT_ART,
    FEHLT_BEWIRTSCHAFTUNG,
    FEHLT_EINFLUSS,
    FEHLT_METHODE,
    FEHLT_PROZENTGRUPPE,
    FEHLT_RICHTUNG,
    RINGANODEN,
    RINGANODEN_DURCHMESSER,
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
    """A protocol with every required answer given, plus one named species.

    The six percentage blocks are answered as well, each with a single share of
    100. They are not in the required list, because what they need is a set of
    numbers totalling 100 rather than a value in a named field, so they are a rule
    of their own; a protocol without them is not complete either way.
    """
    antworten: dict[str, Any] = {}
    for pfad in PFLICHTFELDER_:
        setze(antworten, pfad, "1")
    for gruppe in PROZENTGRUPPEN:
        setze(antworten, gruppe.felder[0], "100")
    # The loop above puts a 1 in the dam's share, so this stretch has a dam and
    # owes a slope. Given here rather than zeroing the share, so the helper
    # exercises the conditional rather than stepping around it.
    setze(antworten, DAMM_NEIGUNG, "45")
    # The two tick blocks of part 4. One tick each is the whole requirement: an
    # unticked box is already an answer, so all that can be asked is that
    # somebody went through the block.
    # The loop above rates "sonstige Strukturen" a 1, so the protocol asserts
    # there are some and owes a word about what they are.
    setze(antworten, "strukturen.sonstige_strukturen_text", "Totholzstapel")
    setze(antworten, KEINE_EINFLUESSE, "Ja")
    setze(antworten, "bewirschaftung.angelfischerei", "Ja")
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

    def test_die_liste_hat_die_vereinbarte_laenge(self) -> None:
        """Pinned, so widening the gate stays a deliberate act.

        Was 31 until 2026-09-12, when the required set was widened to cover all
        six parts of the protocol. The number moves when
        blueprint/context/pflichtfelder-vorschlag.md says it moves, and this test
        is what makes that a decision rather than a drift.
        """
        assert len(PFLICHTFELDER_) == 50

    @pytest.mark.parametrize(
        "pfad", ["probestrecke.untere", "probestrecke.obere", "ausruestung.leistung"]
    )
    def test_die_drei_offenen_fragen_sind_jetzt_pflicht(self, pfad: str) -> None:
        # Feature 11a left these three out and recorded them as questions for
        # FFS: the two landmarks describing each end of the stretch, and the
        # device's power output. Answered on 2026-09-12: all three are required.
        # A landmark is what somebody uses to stand in the right place next year,
        # and a coordinate alone is harder to stand in front of.
        assert pfad in PFLICHTFELDER_

    @pytest.mark.parametrize(
        "pfad",
        [
            "bearbeiter.firma",
            "bearbeiter.strasse",
            "bearbeiter.plz",
            "bearbeiter.ort",
            "bearbeiter.telefon",
            "z.quelle",
            "z.ps_nummer",
            "probestrecke.gewaesser.vorfluter2",
        ],
    )
    def test_was_bewusst_freiwillig_bleibt(self, pfad: str) -> None:
        """Decided on 2026-09-12, together with the widening.

        The Bearbeiter's postal address and telephone: the e-mail is required and
        is how the person is identified. The PS-Nummer is not always known, and
        the Quelle is FFS's to assign. Vorfluter 2 to 5: the chain is as long as
        it is, and vorfluter.py already demands it has no gaps and ends at the
        Rhein or the Donau.
        """
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
        # The flat list first, then the six percentage blocks, then the two tick
        # blocks, then the catch table. The dam's slope is absent: its share is
        # unanswered too, and one unanswered question earns one message.
        assert gemeldet == [
            *PFLICHTFELDER_,
            *(gruppe.id for gruppe in PROZENTGRUPPEN),
            EINFLUSS_BLOCK,
            BEWIRTSCHAFTUNG_BLOCK,
            "tabelle.arten",
        ]

    def test_meldet_in_formularreihenfolge(self) -> None:
        # The panel in 11c lists these, so they come in the order somebody
        # walks the protocol.
        gemeldet = fehlende_pfade({})
        assert gemeldet[0] == "anlass"
        assert gemeldet[-1] == "tabelle.arten"

    def test_jede_meldung_traegt_denselben_schluessel(self) -> None:
        verstoesse = pruefe_vollstaendigkeit({})
        assert {v.schluessel for v in verstoesse} == {
            FEHLT,
            FEHLT_ART,
            FEHLT_PROZENTGRUPPE,
            FEHLT_EINFLUSS,
            FEHLT_BEWIRTSCHAFTUNG,
        }


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
    def test_verlangt_aus_teil_3_nur_was_vereinbart_ist(self) -> None:
        """Part 3's shares are a rule, not list entries.

        Reversed on 2026-09-12: part 3 used to require nothing at all. It now
        requires all six percentage blocks, but through pruefe_vollstaendigkeit's
        own group rule rather than through this list, because what a block needs
        is a set of numbers totalling 100 and not a value in one named field.
        Only the three standalone answers are listed.
        """
        aus_teil_3 = [
            pfad
            for pfad in PFLICHTFELDER_
            if pfad.startswith(("umland.", "ufer.", "gewaessersohle."))
        ]

        assert aus_teil_3 == [
            "ufer.randstreifen",
            "ufer.streckenanteil_geschuetteter_damm",
            "ufer.wurzeln",
        ]

    def test_verlangt_aus_teil_4_nur_was_vereinbart_ist(self) -> None:
        """Reversed on 2026-09-12: part 4 used to require nothing at all.

        The eight ratings are listed, because each is one answer in one field.
        The two tick blocks are not, because a list cannot say "at least one of
        these": they are rules, and so are the stocking rows, which stay optional
        until somebody starts one.
        """
        aus_teil_4 = [
            pfad
            for pfad in PFLICHTFELDER_
            if pfad.startswith(("strukturen.", "einfluesse.", "bewirschaftung."))
        ]

        assert aus_teil_4 == [
            "strukturen.totholz",
            "strukturen.wurzeln_strukturen",
            "strukturen.aeste",
            "strukturen.schilf",
            "strukturen.submerse_makrophyten",
            "strukturen.schwimmblattpflanzen",
            "strukturen.emerse_makrophyten",
            "strukturen.sonstige_strukturen",
        ]

    def test_verlangt_keine_bemerkungen(self) -> None:
        assert not [pfad for pfad in PFLICHTFELDER_ if "bemerkung" in pfad]


class TestTeil3:
    """Part 3 required nothing at all until 2026-09-12.

    A protocol could be submitted describing a stretch's surroundings, its bank
    and its bed not at all, which is most of what a habitat survey is for.
    """

    def test_ein_leeres_protokoll_meldet_alle_sechs_bloecke(self) -> None:
        gemeldet = [
            verstoss.pfad
            for verstoss in pruefe_vollstaendigkeit({})
            if verstoss.schluessel == FEHLT_PROZENTGRUPPE
        ]

        assert gemeldet == [
            "summe.umland",
            "summe.neigung",
            "summe.bewuchs",
            "summe.uferverbau",
            "summe.substrat",
            "summe.sohlverbau",
        ]

    def test_ein_angefasster_block_gilt_als_beantwortet(self) -> None:
        """Touched is enough here; totalling 100 is prozent.py's half.

        The two rules are deliberately separate. This one insists the block was
        started, that one insists it adds up, and neither could do the other's job
        without saying the same thing twice on one screen.
        """
        antworten: dict[str, Any] = {}
        setze(antworten, "umland.wiese", "100")

        gemeldet = [
            verstoss.pfad
            for verstoss in pruefe_vollstaendigkeit(antworten)
            if verstoss.schluessel == FEHLT_PROZENTGRUPPE
        ]

        assert "summe.umland" not in gemeldet

    def test_eine_einzige_null_zaehlt_als_angefasst(self) -> None:
        # A share of 0 is an answer: "none of this stretch is that". The block
        # will still be told to reach 100 by the other rule.
        antworten: dict[str, Any] = {}
        setze(antworten, "umland.siedlungsgebiet", "0")

        gemeldet = [
            verstoss.pfad
            for verstoss in pruefe_vollstaendigkeit(antworten)
            if verstoss.schluessel == FEHLT_PROZENTGRUPPE
        ]

        assert "summe.umland" not in gemeldet


class TestDammneigung:
    """The one conditional in part 3: a slope exists only where there is a dam."""

    def test_ohne_damm_wird_keine_neigung_verlangt(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "ufer.streckenanteil_geschuetteter_damm", "0")

        assert DAMM_NEIGUNG not in fehlende_pfade(antworten)

    def test_ein_leerer_anteil_verlangt_noch_keine_neigung(self) -> None:
        # The share itself is required and will be reported as missing. Demanding
        # the slope as well would put two messages on one unanswered question.
        assert DAMM_NEIGUNG not in fehlende_pfade({})

    def test_mit_damm_wird_die_neigung_verlangt(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "ufer.streckenanteil_geschuetteter_damm", "30")

        assert DAMM_NEIGUNG in fehlende_pfade(antworten)

    def test_mit_damm_und_neigung_ist_nichts_offen(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "ufer.streckenanteil_geschuetteter_damm", "30")
        setze(antworten, DAMM_NEIGUNG, "45")

        assert DAMM_NEIGUNG not in fehlende_pfade(antworten)


class TestTeil4:
    """Part 4 required nothing at all until 2026-09-12."""

    def test_die_acht_strukturen_werden_verlangt(self) -> None:
        gemeldet = fehlende_pfade({})

        assert [pfad for pfad in gemeldet if pfad.startswith("strukturen.")] == [
            "strukturen.totholz",
            "strukturen.wurzeln_strukturen",
            "strukturen.aeste",
            "strukturen.schilf",
            "strukturen.submerse_makrophyten",
            "strukturen.schwimmblattpflanzen",
            "strukturen.emerse_makrophyten",
            "strukturen.sonstige_strukturen",
        ]

    def test_eine_null_ist_eine_antwort(self) -> None:
        # The scale is 0 = keine, 1 = wenig, 2 = verbreitet, 3 = dominierend, so
        # a stretch with no dead wood answers 0 rather than leaving it blank.
        antworten: dict[str, Any] = {}
        setze(antworten, "strukturen.totholz", "0")

        assert "strukturen.totholz" not in fehlende_pfade(antworten)


class TestHakenbloecke:
    """At least one tick, never all of them.

    An unticked box is already an answer: leaving Badebetrieb alone says there is
    no bathing here. Requiring every box would demand that every stretch carries
    every influence at once.
    """

    def test_ein_leerer_einflussblock_wird_gemeldet(self) -> None:
        assert EINFLUSS_BLOCK in fehlende_pfade({})

    def test_eine_genannte_nutzung_reicht(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "einfluesse.wasserkraft", "Ja")

        assert EINFLUSS_BLOCK not in fehlende_pfade(antworten)

    def test_keine_erkennbar_ist_auch_eine_antwort(self) -> None:
        # The whole reason that box exists. A stretch with nothing on it is
        # answered, not skipped.
        antworten: dict[str, Any] = {}
        setze(antworten, KEINE_EINFLUESSE, "Ja")

        assert EINFLUSS_BLOCK not in fehlende_pfade(antworten)

    def test_unbekannt_ist_auch_eine_antwort(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, UNBEKANNT_EINFLUESSE, "Ja")

        assert EINFLUSS_BLOCK not in fehlende_pfade(antworten)

    def test_ein_leerer_bewirtschaftungsblock_wird_gemeldet(self) -> None:
        assert BEWIRTSCHAFTUNG_BLOCK in fehlende_pfade({})

    def test_ein_haken_bei_der_bewirtschaftung_reicht(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "bewirschaftung.angelfischerei", "Ja")

        assert BEWIRTSCHAFTUNG_BLOCK not in fehlende_pfade(antworten)


class TestBesatzzeilen:
    """The rows stay optional; a row somebody started has to be finished."""

    def test_leere_zeilen_werden_nicht_verlangt(self) -> None:
        gemeldet = fehlende_pfade({})

        assert not [pfad for pfad in gemeldet if "besatz" in pfad]

    def test_eine_angefangene_zeile_muss_fertig_werden(self) -> None:
        # "2024" with no species and no size class is a record nobody can use,
        # and it reads as a complete answer to whoever receives it.
        antworten: dict[str, Any] = {}
        setze(antworten, "bewirschaftung.besatz1_jahr", "2024")

        gemeldet = fehlende_pfade(antworten)

        assert "bewirschaftung.besatz_fischart1" in gemeldet
        assert "bewirschaftung.besatz1_groessenklassen" in gemeldet
        assert "bewirschaftung.besatz1_jahr" not in gemeldet

    def test_eine_vollstaendige_zeile_ist_in_ordnung(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "bewirschaftung.besatz_fischart1", "BFOR")
        setze(antworten, "bewirschaftung.besatz1_groessenklassen", "Brut")
        setze(antworten, "bewirschaftung.besatz1_jahr", "2024")

        assert not [pfad for pfad in fehlende_pfade(antworten) if "besatz" in pfad]

    def test_eine_angefangene_zeile_zieht_die_anderen_nicht_mit(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "bewirschaftung.besatz1_jahr", "2024")

        gemeldet = fehlende_pfade(antworten)

        assert not [pfad for pfad in gemeldet if "besatz2" in pfad or "fischart2" in pfad]


class TestBedingteFelder:
    """One rule, six pairs: something above says this exists, so describe it."""

    @pytest.mark.parametrize(
        ("ausloeser", "feld"),
        [
            ("ufer.sonstiger_bewuchs", "ufer.sonstiger_bewuchs_text"),
            ("ufer.sonstiger_uferverbau", "ufer.sonstiger_uferverbau_text"),
            ("strukturen.sonstige_strukturen", "strukturen.sonstige_strukturen_text"),
            ("einfluesse.sonstige_Nutzung", "einfluesse.sonstige_nutzung_text"),
        ],
    )
    def test_ein_sonstiges_ohne_welches_wird_gemeldet(self, ausloeser: str, feld: str) -> None:
        # Left alone the box is correctly empty. The moment somebody says there
        # is some other vegetation, or some other structure, the protocol asserts
        # a thing exists and does not say what, which reads to whoever gets it
        # later as a complete answer.
        antworten: dict[str, Any] = {}
        setze(antworten, ausloeser, "1")

        assert feld in fehlende_pfade(antworten)

    @pytest.mark.parametrize(
        ("ausloeser", "feld"),
        [
            ("ufer.sonstiger_bewuchs", "ufer.sonstiger_bewuchs_text"),
            ("strukturen.sonstige_strukturen", "strukturen.sonstige_strukturen_text"),
        ],
    )
    def test_eine_null_verlangt_nichts(self, ausloeser: str, feld: str) -> None:
        # 0 % of the bank, or a rating of "keine". Both mean there is none of it.
        antworten: dict[str, Any] = {}
        setze(antworten, ausloeser, "0")

        assert feld not in fehlende_pfade(antworten)

    def test_ein_unangetastetes_sonstiges_verlangt_nichts(self) -> None:
        assert "einfluesse.sonstige_nutzung_text" not in fehlende_pfade({})

    def test_ein_haken_zaehlt_als_ja(self) -> None:
        # A checkbox holds "Ja", which is neither blank nor a zero.
        antworten: dict[str, Any] = {}
        setze(antworten, "einfluesse.sonstige_Nutzung", "Ja")

        assert "einfluesse.sonstige_nutzung_text" in fehlende_pfade(antworten)

    def test_mit_text_ist_nichts_offen(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "einfluesse.sonstige_Nutzung", "Ja")
        setze(antworten, "einfluesse.sonstige_nutzung_text", "Viehtritt")

        assert "einfluesse.sonstige_nutzung_text" not in fehlende_pfade(antworten)

    def test_ohne_ringanoden_wird_kein_durchmesser_verlangt(self) -> None:
        # A survey done with strip anodes has no ring diameter to give, and
        # ausruestung.py already insists on one kind or the other.
        antworten: dict[str, Any] = {}
        setze(antworten, "ausruestung.streifenanoden", "2")

        assert RINGANODEN_DURCHMESSER not in fehlende_pfade(antworten)

    def test_null_ringanoden_verlangen_keinen_durchmesser(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, RINGANODEN, "0")

        assert RINGANODEN_DURCHMESSER not in fehlende_pfade(antworten)

    def test_mit_ringanoden_wird_der_durchmesser_verlangt(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, RINGANODEN, "2")

        assert RINGANODEN_DURCHMESSER in fehlende_pfade(antworten)


class TestBefischteBereiche:
    """A row that was fished owes a direction and a method; one that was not owes
    nothing. A survey may well cover the whole width and never work the bank."""

    def test_ein_unbenutzter_bereich_verlangt_nichts(self) -> None:
        gemeldet = fehlende_pfade({})

        assert not [pfad for pfad in gemeldet if pfad.startswith("bereich.")]

    def test_eine_laenge_ohne_richtung_und_methode_wird_gemeldet(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "befischte_bereiche.ges_gew_laenge", "110")

        schluessel = {
            verstoss.schluessel
            for verstoss in pruefe_vollstaendigkeit(antworten)
            if verstoss.pfad == "bereich.gesamte_breite"
        }

        assert schluessel == {FEHLT_RICHTUNG, FEHLT_METHODE}

    def test_richtung_und_methode_reichen(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "befischte_bereiche.ges_gew_laenge", "110")
        setze(antworten, "befischte_bereiche.ges_gew_stromauf", "Ja")
        setze(antworten, "befischte_bereiche.ges_gew_watend", "Ja")

        assert not [
            pfad for pfad in fehlende_pfade(antworten) if pfad == "bereich.gesamte_breite"
        ]

    def test_der_zweite_bereich_wird_getrennt_beurteilt(self) -> None:
        # The whole width fished properly, the bank row untouched. Only the
        # first row is judged, and it passes.
        antworten: dict[str, Any] = {}
        setze(antworten, "befischte_bereiche.ges_gew_laenge", "110")
        setze(antworten, "befischte_bereiche.ges_gew_stromauf", "Ja")
        setze(antworten, "befischte_bereiche.ges_gew_watend", "Ja")

        assert not [pfad for pfad in fehlende_pfade(antworten) if pfad.startswith("bereich.")]

    def test_eine_laenge_von_null_gilt_als_nicht_befischt(self) -> None:
        antworten: dict[str, Any] = {}
        setze(antworten, "befischte_bereiche.ufer_laenge", "0")

        assert "bereich.entlang_ufer" not in fehlende_pfade(antworten)
