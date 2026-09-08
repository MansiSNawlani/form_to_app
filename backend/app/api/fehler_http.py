"""The one place a domain error becomes an HTTP response.

coding-standards.md asks for typed domain exceptions translated in a single
place, and this is it. The errors in app/benutzer/fehler.py deliberately carry no
wording: the command line turns them into German sentences of its own, and this
turns them into responses. Keeping the wording out of the exceptions is also what
lets feature 17 translate these without touching the rules.

Two things follow from having one handler rather than a raise per route. A route
cannot quietly answer 500 for something that is really a refusal, and the
difference between 401 and 403 is decided once. That difference matters more than
it looks: feature 2c sends a 401 to the login page, and must not do that for a
403, or somebody without a role gets bounced to a login form they are already
past.
"""

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.schemas import FehlerAntwort
from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerFehler,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
    NichtAngemeldet,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RolleFehlt,
    RollenLeer,
)
from app.security.passwoerter import (
    HOECHSTLAENGE,
    MINDESTLAENGE,
    PasswortZuKurz,
    PasswortZuLang,
)

ADMINISTRATOR = (
    "Bitte wenden Sie sich an Ihre Administratorin oder Ihren Administrator."
)

# Status code and wording per error. Every message names the thing, says why in
# ordinary words and says what to do next, which is the standard this project set
# on 2026-09-06: a message that only says "no" leaves the person with nowhere to go.
UEBERSETZUNG: dict[type[BenutzerFehler], tuple[int, str]] = {
    AnmeldungFehlgeschlagen: (
        status.HTTP_401_UNAUTHORIZED,
        "E-Mail-Adresse oder Passwort ist nicht richtig. Bitte prüfen Sie die"
        " Schreibweise und die Feststelltaste. Wenn Sie Ihr Passwort nicht mehr"
        f" wissen: {ADMINISTRATOR}",
    ),
    KontoDeaktiviert: (
        status.HTTP_403_FORBIDDEN,
        "Dieses Konto ist deaktiviert und kann sich nicht anmelden."
        f" Um es wieder freischalten zu lassen: {ADMINISTRATOR}",
    ),
    NichtAngemeldet: (
        status.HTTP_401_UNAUTHORIZED,
        "Sie sind nicht angemeldet, oder Ihre Sitzung ist abgelaufen. Bitte melden"
        " Sie sich noch einmal an. Eine Sitzung gilt acht Stunden.",
    ),
    RolleFehlt: (
        status.HTTP_403_FORBIDDEN,
        "Ihr Konto hat nicht die Berechtigung für diesen Bereich. Wenn Sie sie"
        f" brauchen: {ADMINISTRATOR}",
    ),
    KontoNichtInteraktiv: (
        status.HTTP_403_FORBIDDEN,
        "Dieses Konto ist ein technisches Konto für die Datenübergabe und kann"
        " sich hier nicht anmelden. Bitte melden Sie sich mit Ihrem persönlichen"
        " Konto an.",
    ),
    BenutzerNichtGefunden: (
        status.HTTP_404_NOT_FOUND,
        "Es gibt kein Konto mit dieser E-Mail-Adresse. Bitte prüfen Sie die"
        " Schreibweise.",
    ),
    EmailBereitsVergeben: (
        status.HTTP_409_CONFLICT,
        "Es gibt schon ein Konto mit dieser E-Mail-Adresse. Jede Adresse kann nur"
        " einmal vergeben werden, also nehmen Sie eine andere oder lassen Sie das"
        " vorhandene Konto wieder freischalten.",
    ),
    EmailUngueltig: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Das ist keine gültige E-Mail-Adresse. Erwartet wird eine Adresse in der"
        " Form name@einrichtung.de.",
    ),
    RollenLeer: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Ein Konto braucht mindestens eine Rolle, sonst kann es nichts tun."
        " Bitte wählen Sie eine aus.",
    ),
    RegierungspraesidiumFehlt: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Für ein Konto des Regierungspräsidiums fehlt die Nummer des"
        " Regierungspräsidiums: 1 Stuttgart, 2 Karlsruhe, 3 Freiburg, 4 Tübingen."
        " Ohne sie würde das Konto alle Regionen sehen.",
    ),
    RegierungspraesidiumUnzulaessig: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Eine Nummer des Regierungspräsidiums gehört nur zu einem Konto mit der"
        " Rolle REGIERUNGSPRAESIDIUM. Bitte lassen Sie sie hier weg.",
    ),
    RegierungspraesidiumAusserhalbBereich: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Es gibt vier Regierungspräsidien. Bitte geben Sie 1 Stuttgart,"
        " 2 Karlsruhe, 3 Freiburg oder 4 Tübingen an.",
    ),
    PasswortZuKurz: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        f"Das Passwort ist zu kurz. Es braucht mindestens {MINDESTLAENGE} Zeichen."
        " Ein Satz, den Sie sich merken können, ist dafür gut geeignet.",
    ),
    PasswortZuLang: (
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        f"Das Passwort ist zu lang. Höchstens {HOECHSTLAENGE} Zeichen sind"
        " möglich.",
    ),
}

UNBEKANNT = (
    status.HTTP_500_INTERNAL_SERVER_ERROR,
    "Da ist etwas schiefgegangen. Bitte versuchen Sie es noch einmal und melden"
    " Sie den Fehler, wenn er bleibt.",
)


def _antwort(fehler: BenutzerFehler) -> JSONResponse:
    """Look the error up by its own class, then by what it inherits from.

    The walk up the inheritance chain means a new error added to a family answers
    sensibly from the day it exists rather than falling to 500 until somebody
    remembers this table. An error belonging to no family still lands on 500,
    which is honest: nobody decided what it should say.
    """
    for klasse in type(fehler).__mro__:
        if klasse in UEBERSETZUNG:
            code, nachricht = UEBERSETZUNG[klasse]
            break
    else:
        code, nachricht = UNBEKANNT

    return JSONResponse(
        status_code=code,
        content=FehlerAntwort(code=type(fehler).__name__, nachricht=nachricht).model_dump(),
    )


async def behandle_benutzerfehler(request: Request, fehler: Exception) -> Response:
    """Registered for the BenutzerFehler family, so every subclass arrives here.

    Typed as Exception because that is the signature Starlette hands handlers.
    Nothing from the exception itself reaches the response: the wording comes from
    the table above, so an email address or a hash cannot leak into a body by
    somebody putting it in an exception message later.
    """
    assert isinstance(fehler, BenutzerFehler)
    return _antwort(fehler)


def registriere_fehlerbehandlung(app: FastAPI) -> None:
    app.add_exception_handler(BenutzerFehler, behandle_benutzerfehler)
