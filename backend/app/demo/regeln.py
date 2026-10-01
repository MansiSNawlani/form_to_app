"""Which demo accounts exist, and when one may be used."""

from app.demo.fehler import DemoAus, DemoRolleUnzulaessig
from app.models.benutzer import Rolle

# Two roles and no more. Everybody holding the link shares these accounts, so
# neither may reach anything beyond one protocol's worth of harm: above all not
# SUPER_ADMIN, whose screen creates accounts. The .example domain is reserved
# (RFC 2606), so no real mailbox can ever be behind either address.
DEMO_KONTEN: dict[Rolle, str] = {
    Rolle.SUBMITTER: "demo-einreicher@befischung.example",
    Rolle.REVIEWER: "demo-pruefer@befischung.example",
}


def demo_adresse(rolle: Rolle, *, demo_modus: bool) -> str:
    """The address of the demo account for this role, or the reason there is none.

    The switch is checked before the role, so a deployment without the demo
    answers every request the same way.
    """
    if not demo_modus:
        raise DemoAus
    adresse = DEMO_KONTEN.get(rolle)
    if adresse is None:
        raise DemoRolleUnzulaessig
    return adresse
