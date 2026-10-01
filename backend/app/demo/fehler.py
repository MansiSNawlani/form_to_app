"""What can go wrong with a demo sign-in.

Part of the account family, so the one translator in app/api/fehler_http.py
answers them and no second error handler has to exist for three errors.
"""

from app.benutzer.fehler import BenutzerFehler


class DemoAus(BenutzerFehler):
    """This deployment has no demo, because DEMO_MODUS is not switched on."""


class DemoRolleUnzulaessig(BenutzerFehler):
    """A demo was asked for with a role the demo does not offer."""


class DemoNichtEingerichtet(BenutzerFehler):
    """The switch is on, but the demo account is missing or locked.

    The command that creates it has not been run on this database, or somebody
    locked the account on purpose to close that one door.
    """
