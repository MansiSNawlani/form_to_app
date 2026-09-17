"""What a search box and a page number mean, before any database is involved."""

from datetime import date

import pytest

from app.protokolle.pruefliste.parameter import (
    PRO_SEITE_MAX,
    PRO_SEITE_MIN,
    SEITE_MAX,
    begrenze_pro_seite,
    begrenze_seite,
    jahresgrenzen,
    maskiere_platzhalter,
    seitenzahl,
    suchbegriffe,
    suchmuster,
    versatz,
)


class TestMaskierePlatzhalter:
    """The two characters that mean something to LIKE, and the one that escapes them."""

    def test_laesst_gewoehnlichen_text_in_ruhe(self) -> None:
        assert maskiere_platzhalter("Schussen") == "Schussen"

    def test_entschaerft_das_prozentzeichen(self) -> None:
        # Unescaped this is "anything", so a search for 50% would match every
        # protocol in the database and the box would look broken.
        assert maskiere_platzhalter("50%") == r"50\%"

    def test_entschaerft_den_unterstrich(self) -> None:
        # _ is LIKE's single character wildcard, so "Bach_1" would also find
        # "Bach-1" and "Bach 1".
        assert maskiere_platzhalter("Bach_1") == r"Bach\_1"

    def test_entschaerft_den_backslash_zuerst(self) -> None:
        # The escape character has to be escaped before the characters it
        # escapes, or a typed backslash would swallow the next one.
        assert maskiere_platzhalter(r"a\%b") == r"a\\\%b"

    def test_entschaerft_mehrere_vorkommen(self) -> None:
        assert maskiere_platzhalter("%_%") == r"\%\_\%"


class TestSuchbegriffe:
    """One box, several words, each of which has to find something."""

    def test_liefert_ein_einzelnes_wort(self) -> None:
        assert suchbegriffe("Schussen") == ("Schussen",)

    def test_trennt_an_leerraum(self) -> None:
        assert suchbegriffe("Schussen Weissenau") == ("Schussen", "Weissenau")

    def test_wirft_ueberzaehligen_leerraum_weg(self) -> None:
        assert suchbegriffe("  Schussen   Weissenau  ") == ("Schussen", "Weissenau")

    def test_trennt_auch_an_tabulatoren_und_zeilenumbruechen(self) -> None:
        # Pasting out of a spreadsheet brings both along.
        assert suchbegriffe("Schussen\tWeissenau\nBruecke") == (
            "Schussen",
            "Weissenau",
            "Bruecke",
        )

    def test_behandelt_reinen_leerraum_wie_keine_suche(self) -> None:
        assert suchbegriffe("   ") == ()

    def test_behandelt_den_leeren_text_wie_keine_suche(self) -> None:
        assert suchbegriffe("") == ()

    def test_behandelt_nichts_wie_keine_suche(self) -> None:
        assert suchbegriffe(None) == ()


class TestSuchmuster:
    """A term as the database is asked for it: anywhere inside the value."""

    def test_umschliesst_den_begriff(self) -> None:
        assert suchmuster("Schussen") == "%Schussen%"

    def test_maskiert_vor_dem_umschliessen(self) -> None:
        # The wrapping % are the wildcards we mean; the typed one is not.
        assert suchmuster("50%") == r"%50\%%"


class TestBegrenzeSeite:
    """A page number is 1-based, and there is no page before the first one."""

    def test_laesst_eine_gewoehnliche_seite_stehen(self) -> None:
        assert begrenze_seite(3) == 3

    def test_hebt_die_nullte_seite_auf_die_erste(self) -> None:
        assert begrenze_seite(0) == 1

    def test_hebt_eine_negative_seite_auf_die_erste(self) -> None:
        assert begrenze_seite(-3) == 1

    def test_laesst_die_erste_seite_stehen(self) -> None:
        assert begrenze_seite(1) == 1

    def test_deckelt_eine_masslose_seite(self) -> None:
        # Uncapped, the row offset this implies is larger than the database
        # driver can send, and a silly query parameter becomes a 500.
        assert begrenze_seite(10**30) == SEITE_MAX


class TestBegrenzeProSeite:
    """How many rows one request may ask for."""

    def test_laesst_eine_gewoehnliche_groesse_stehen(self) -> None:
        assert begrenze_pro_seite(25) == 25

    def test_hebt_null_auf_eine_zeile(self) -> None:
        # A page of nothing is an endless pager, not an empty list.
        assert begrenze_pro_seite(0) == PRO_SEITE_MIN

    def test_hebt_eine_negative_groesse_auf_eine_zeile(self) -> None:
        assert begrenze_pro_seite(-10) == PRO_SEITE_MIN

    def test_deckelt_eine_masslose_groesse(self) -> None:
        assert begrenze_pro_seite(5000) == PRO_SEITE_MAX

    def test_laesst_die_groesste_erlaubte_groesse_stehen(self) -> None:
        assert begrenze_pro_seite(PRO_SEITE_MAX) == PRO_SEITE_MAX


class TestVersatz:
    """How many rows to skip to reach a page."""

    def test_ueberspringt_auf_der_ersten_seite_nichts(self) -> None:
        assert versatz(1, 25) == 0

    def test_ueberspringt_eine_ganze_seite(self) -> None:
        assert versatz(2, 25) == 25

    def test_ueberspringt_mehrere_seiten(self) -> None:
        assert versatz(4, 10) == 30


class TestSeitenzahl:
    """How many pages a total makes, as a pager has to print it."""

    def test_zaehlt_eine_volle_seite(self) -> None:
        assert seitenzahl(25, 25) == 1

    def test_zaehlt_eine_angebrochene_seite_mit(self) -> None:
        assert seitenzahl(26, 25) == 2

    def test_zaehlt_weniger_als_eine_seite_als_eine(self) -> None:
        assert seitenzahl(3, 25) == 1

    def test_macht_aus_nichts_eine_seite(self) -> None:
        # "Seite 1 von 1" over an empty list, never "Seite 1 von 0".
        assert seitenzahl(0, 25) == 1

    def test_ueberlebt_eine_seitengroesse_von_null(self) -> None:
        # begrenze_pro_seite keeps this from arriving, but a divide by zero is
        # not the way to find out that something slipped past it.
        assert seitenzahl(10, 0) == 1


class TestJahresgrenzen:
    """A year, as the two days a date column is compared against."""

    def test_spannt_ein_gewoehnliches_jahr_auf(self) -> None:
        assert jahresgrenzen(2026) == (date(2026, 1, 1), date(2026, 12, 31))

    def test_reicht_im_schaltjahr_bis_zum_einunddreissigsten(self) -> None:
        # The end is 31 December, not "365 days on", so a leap year needs no
        # special case and cannot lose its extra day.
        assert jahresgrenzen(2024) == (date(2024, 1, 1), date(2024, 12, 31))

    @pytest.mark.parametrize("jahr", [2024, 2025, 2026])
    def test_faengt_den_ersten_und_den_letzten_tag_ein(self, jahr: int) -> None:
        von, bis = jahresgrenzen(jahr)
        assert von == date(jahr, 1, 1)
        assert bis == date(jahr, 12, 31)
