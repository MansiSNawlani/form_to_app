import pytest

from app.benutzer.fehler import (
    EmailUngueltig,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
)
from app.benutzer.regeln import (
    normalisiere_email,
    normalisiere_rollen,
    pruefe_regierungspraesidium,
)
from app.models.benutzer import Rolle


def test_email_wird_klein_geschrieben() -> None:
    assert normalisiere_email("Anna.Bergmann@FFS.de") == "anna.bergmann@ffs.de"


def test_bereits_kleine_email_bleibt_unveraendert() -> None:
    assert normalisiere_email("anna@ffs.de") == "anna@ffs.de"


def test_leerzeichen_werden_entfernt() -> None:
    """Copying an address out of an email signature brings spaces with it."""
    assert normalisiere_email("  anna@ffs.de \n") == "anna@ffs.de"


def test_umlaut_in_der_domain_wird_akzeptiert() -> None:
    """German addresses exist and must not be refused for being German."""
    assert normalisiere_email("anna@fischerei-tübingen.de").endswith("@fischerei-tübingen.de")


def test_text_ohne_at_ist_keine_email() -> None:
    with pytest.raises(EmailUngueltig):
        normalisiere_email("anna")


def test_email_ohne_domain_wird_abgelehnt() -> None:
    with pytest.raises(EmailUngueltig):
        normalisiere_email("anna@")


def test_leere_email_wird_abgelehnt() -> None:
    with pytest.raises(EmailUngueltig):
        normalisiere_email("   ")


def test_ungueltige_email_nennt_die_eingabe() -> None:
    """The command line prints this back, so it has to know what was typed."""
    with pytest.raises(EmailUngueltig) as fehler:
        normalisiere_email("anna")
    assert fehler.value.email == "anna"


def test_rollen_bleiben_in_der_reihenfolge() -> None:
    assert normalisiere_rollen([Rolle.REVIEWER, Rolle.SUBMITTER]) == [
        Rolle.REVIEWER,
        Rolle.SUBMITTER,
    ]


def test_doppelte_rolle_wird_entfernt() -> None:
    """The table's constraint has nothing to say about a repeat, so this does."""
    assert normalisiere_rollen([Rolle.SUBMITTER, Rolle.SUBMITTER]) == [Rolle.SUBMITTER]


def test_doppelte_rolle_behaelt_die_erste_stelle() -> None:
    assert normalisiere_rollen([Rolle.REVIEWER, Rolle.SUBMITTER, Rolle.REVIEWER]) == [
        Rolle.REVIEWER,
        Rolle.SUBMITTER,
    ]


def test_keine_rollen_wird_abgelehnt() -> None:
    """An account with no roles could do nothing at all."""
    with pytest.raises(RollenLeer):
        normalisiere_rollen([])


def test_regionales_konto_ohne_nummer_wird_abgelehnt() -> None:
    """Without a number it would see every region, which is the opposite of
    what the role is for."""
    with pytest.raises(RegierungspraesidiumFehlt):
        pruefe_regierungspraesidium([Rolle.REGIERUNGSPRAESIDIUM], None)


def test_regionales_konto_mit_nummer_wird_angenommen() -> None:
    pruefe_regierungspraesidium([Rolle.REGIERUNGSPRAESIDIUM], 3)


@pytest.mark.parametrize("nummer", [1, 2, 3, 4])
def test_alle_vier_regierungspraesidien_sind_zulaessig(nummer: int) -> None:
    pruefe_regierungspraesidium([Rolle.REGIERUNGSPRAESIDIUM], nummer)


@pytest.mark.parametrize("nummer", [0, 5, -1, 99])
def test_nummer_ausserhalb_von_eins_bis_vier_wird_abgelehnt(nummer: int) -> None:
    with pytest.raises(RegierungspraesidiumAusserhalbBereich):
        pruefe_regierungspraesidium([Rolle.REGIERUNGSPRAESIDIUM], nummer)


def test_submitter_mit_nummer_wird_abgelehnt() -> None:
    with pytest.raises(RegierungspraesidiumUnzulaessig):
        pruefe_regierungspraesidium([Rolle.SUBMITTER], 2)


def test_submitter_ohne_nummer_wird_angenommen() -> None:
    pruefe_regierungspraesidium([Rolle.SUBMITTER], None)


def test_falsche_rolle_wird_vor_dem_zahlenbereich_gemeldet() -> None:
    """A submitter given the number 9 is told they should not have one at all.

    Telling them the number is out of range would send them to fix the wrong
    thing: correcting it to 3 still leaves an account carrying a number that
    scopes nothing.
    """
    with pytest.raises(RegierungspraesidiumUnzulaessig):
        pruefe_regierungspraesidium([Rolle.SUBMITTER], 9)


def test_regionale_rolle_neben_anderen_verlangt_weiterhin_eine_nummer() -> None:
    """Somebody can hold the regional role alongside another one."""
    with pytest.raises(RegierungspraesidiumFehlt):
        pruefe_regierungspraesidium([Rolle.REVIEWER, Rolle.REGIERUNGSPRAESIDIUM], None)


def test_super_admin_bekommt_keine_nummer() -> None:
    with pytest.raises(RegierungspraesidiumUnzulaessig):
        pruefe_regierungspraesidium([Rolle.SUPER_ADMIN], 1)
