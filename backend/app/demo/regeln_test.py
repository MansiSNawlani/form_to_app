import pytest

from app.demo.fehler import DemoAus, DemoRolleUnzulaessig
from app.demo.regeln import DEMO_KONTEN, demo_adresse
from app.models.benutzer import Rolle


def test_einreicher_und_pruefer_haben_je_eine_adresse() -> None:
    assert demo_adresse(Rolle.SUBMITTER, demo_modus=True) == "demo-einreicher@befischung.example"
    assert demo_adresse(Rolle.REVIEWER, demo_modus=True) == "demo-pruefer@befischung.example"


def test_ohne_demo_modus_gibt_es_keine_demo() -> None:
    with pytest.raises(DemoAus):
        demo_adresse(Rolle.SUBMITTER, demo_modus=False)


@pytest.mark.parametrize("rolle", [r for r in Rolle if r not in DEMO_KONTEN])
def test_jede_andere_rolle_wird_abgewiesen(rolle: Rolle) -> None:
    """Above all SUPER_ADMIN: a link anybody can open must never hand out the
    screen that creates accounts."""
    with pytest.raises(DemoRolleUnzulaessig):
        demo_adresse(rolle, demo_modus=True)


def test_ohne_demo_modus_wird_auch_eine_fremde_rolle_als_aus_abgewiesen() -> None:
    """The switch is checked first, so a site without the demo says the same
    thing whatever is asked for and gives nothing away about what would work."""
    with pytest.raises(DemoAus):
        demo_adresse(Rolle.SUPER_ADMIN, demo_modus=False)
