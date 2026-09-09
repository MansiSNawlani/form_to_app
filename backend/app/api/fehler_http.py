"""The one place a refusal becomes an HTTP response.

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

There are two tables, one per exception family, because the protocol refusals
have to say a number or a list of field paths and a table of fixed sentences
cannot. The field paths are safe to print: they come from our own form
definition, not from the request, so naming them cannot repeat a person's answers
back at them.

The account table below covers only what a route in this feature can raise. Every other
member of the BenutzerFehler family falls to 500, which is the right answer while
no route can produce it: a status code invented in advance is a contract nobody
reviewed, and one of them would quietly matter. Mapping BenutzerNichtGefunden to
404 would tell an unauthenticated caller that an address has no account here, and
that is exactly what melde_an goes to some trouble to keep unknowable. A feature
adding a route that raises one of those adds its line here, with the route.
"""

from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.schemas import FehlerAntwort
from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerFehler,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
    NichtAngemeldet,
    RolleFehlt,
)
from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    ProtokollFehler,
    ProtokollNichtGefunden,
    ProtokollNichtMehrEntwurf,
    ProtokollVeraendert,
    Verstossgrund,
)

AN_ADMINISTRATOR_WENDEN = "Bitte wenden Sie sich an Ihre Administratorin oder Ihren Administrator."

# Code, status and wording per error.
#
# The code is written out rather than taken from the exception's class name. It is
# what feature 2c branches on, so it is a published contract, and a name that a
# refactor is free to change cannot be one.
#
# Every message names the thing, says why in ordinary words and says what to do
# next, which is the standard this project set on 2026-09-06: a message that only
# says "no" leaves the person with nowhere to go.
UEBERSETZUNG: dict[type[BenutzerFehler], tuple[str, int, str]] = {
    AnmeldungFehlgeschlagen: (
        "ANMELDUNG_FEHLGESCHLAGEN",
        status.HTTP_401_UNAUTHORIZED,
        "E-Mail-Adresse oder Passwort ist nicht richtig. Bitte prüfen Sie die"
        " Schreibweise und die Feststelltaste. Wenn Sie Ihr Passwort nicht mehr"
        f" wissen: {AN_ADMINISTRATOR_WENDEN}",
    ),
    NichtAngemeldet: (
        "NICHT_ANGEMELDET",
        status.HTTP_401_UNAUTHORIZED,
        "Sie sind nicht angemeldet, oder Ihre Sitzung ist abgelaufen. Bitte melden"
        " Sie sich noch einmal an. Eine Sitzung gilt acht Stunden.",
    ),
    RolleFehlt: (
        "ROLLE_FEHLT",
        status.HTTP_403_FORBIDDEN,
        "Ihr Konto hat nicht die Berechtigung für diesen Bereich. Wenn Sie sie"
        f" brauchen: {AN_ADMINISTRATOR_WENDEN}",
    ),
    KontoDeaktiviert: (
        "KONTO_DEAKTIVIERT",
        status.HTTP_403_FORBIDDEN,
        "Dieses Konto ist deaktiviert und kann sich nicht anmelden."
        f" Um es wieder freischalten zu lassen: {AN_ADMINISTRATOR_WENDEN}",
    ),
    KontoNichtInteraktiv: (
        "KONTO_NICHT_INTERAKTIV",
        status.HTTP_403_FORBIDDEN,
        "Dieses Konto ist ein technisches Konto für die Datenübergabe und kann"
        " sich hier nicht anmelden. Bitte melden Sie sich mit Ihrem persönlichen"
        " Konto an.",
    ),
}

UNBEKANNT = (
    "UNBEKANNTER_FEHLER",
    status.HTTP_500_INTERNAL_SERVER_ERROR,
    "Da ist etwas schiefgegangen. Bitte versuchen Sie es noch einmal und melden"
    " Sie den Fehler, wenn er bleibt.",
)

ANFRAGE_UNGUELTIG = (
    "ANFRAGE_UNGUELTIG",
    status.HTTP_422_UNPROCESSABLE_CONTENT,
    "Die Anfrage ist unvollständig oder hat das falsche Format.",
)

# Parts of a Pydantic error location that name where the value came from rather
# than which field it was.
HERKUNFT = frozenset({"body", "query", "path", "cookie", "header"})


def _antwort(code: str, status_code: int, nachricht: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=FehlerAntwort(code=code, nachricht=nachricht).model_dump(),
    )


async def behandle_benutzerfehler(request: Request, fehler: Exception) -> Response:
    """Registered for the BenutzerFehler family, so every subclass arrives here.

    Typed as Exception because that is the signature Starlette hands a handler.

    Nothing from the exception itself reaches the response. The wording comes from
    the table, so an email address or a hash cannot leak into a body later by
    somebody putting one into an exception message.

    The walk up the inheritance chain lets a new error added to a family answer
    like its family from the day it exists.
    """
    if not isinstance(fehler, BenutzerFehler):
        # Not an assert: assertions vanish under python -O, and this is what keeps
        # an unrelated exception from being answered as though it were a refusal.
        raise fehler

    for klasse in type(fehler).__mro__:
        if klasse in UEBERSETZUNG:
            return _antwort(*UEBERSETZUNG[klasse])

    return _antwort(*UNBEKANNT)


async def behandle_anfragefehler(request: Request, fehler: Exception) -> Response:
    """A request Pydantic could not read, answered without quoting it back.

    FastAPI's own handler for this returns the rejected value in the body. On the
    sign-in route that means a password too long for its field comes straight back
    in the response, and from there into any log that records one. This replaces
    it: the names of the fields that were wrong, never their values.
    """
    if not isinstance(fehler, RequestValidationError):
        raise fehler

    felder = sorted(
        {
            str(teil)
            for einzeln in fehler.errors()
            for teil in einzeln.get("loc", ())
            if teil not in HERKUNFT
        }
    )
    code, status_code, nachricht = ANFRAGE_UNGUELTIG
    if felder:
        nachricht = f"{nachricht} Bitte prüfen Sie: {', '.join(felder)}."

    return _antwort(code, status_code, nachricht)


# The protocol refusals, kept in their own table rather than added to the one
# above. Two of them have to say a number or a list of field paths, which a table
# of fixed sentences cannot do, so this family gets a handler that builds the
# tail of its message the way behandle_anfragefehler already does.
PROTOKOLL_UEBERSETZUNG: dict[type[ProtokollFehler], tuple[str, int, str]] = {
    # 404 rather than 403, and the same answer whether the protocol is missing or
    # belongs to somebody else. app/protokolle/fehler.py says why the two must
    # stay indistinguishable. The wording follows: it names both possibilities
    # rather than claiming which one it was.
    ProtokollNichtGefunden: (
        "PROTOKOLL_NICHT_GEFUNDEN",
        status.HTTP_404_NOT_FOUND,
        "Dieses Protokoll gibt es nicht, oder es gehört zu einem anderen Konto."
        " Bitte prüfen Sie den Link, oder öffnen Sie das Protokoll über Ihre"
        " Übersicht.",
    ),
    # 409 rather than 422. Nothing about the request is malformed: it is a
    # perfectly good save that arrived after somebody else's, which is a conflict
    # about state and not about the message.
    ProtokollVeraendert: (
        "PROTOKOLL_VERAENDERT",
        status.HTTP_409_CONFLICT,
        "Dieses Protokoll wurde zwischendurch an anderer Stelle geändert, zum"
        " Beispiel in einem zweiten Browser-Tab oder auf einem anderen Gerät."
        " Ihre letzten Eingaben wurden nicht gespeichert, damit die andere"
        " Fassung nicht überschrieben wird. Bitte laden Sie die Seite neu und"
        " tragen Sie das Fehlende noch einmal ein.",
    ),
    ProtokollNichtMehrEntwurf: (
        "PROTOKOLL_NICHT_MEHR_ENTWURF",
        status.HTTP_409_CONFLICT,
        "Dieses Protokoll ist kein Entwurf mehr und kann nicht mehr geändert oder"
        " gelöscht werden. Bitte laden Sie die Seite neu, um den aktuellen Stand"
        " zu sehen.",
    ),
    AntwortenNichtLesbar: (
        "ANTWORTEN_NICHT_LESBAR",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Die Antworten dieses Protokolls konnten nicht gelesen werden. Das ist ein"
        " Fehler in der Anwendung und nicht in Ihren Eingaben. Bitte laden Sie die"
        " Seite neu; wenn es wieder passiert, melden Sie es bitte.",
    ),
    AntwortenZuGross: (
        "ANTWORTEN_ZU_GROSS",
        status.HTTP_413_CONTENT_TOO_LARGE,
        "Dieses Protokoll enthält mehr Text, als gespeichert werden kann. Bitte"
        " kürzen Sie die längeren Freitextfelder, zum Beispiel die Bemerkungen,"
        " und speichern Sie noch einmal.",
    ),
    AntwortenUngueltig: (
        "ANTWORTEN_UNGUELTIG",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Einige Angaben konnten nicht gespeichert werden. Das ist ein Fehler in"
        " der Anwendung und nicht in Ihren Eingaben. Der Rest des Protokolls ist"
        " unverändert; bitte melden Sie den Fehler mit den genannten Feldern.",
    ),
}

# What to call each kind of violation in the sentence that lists it.
VERSTOSS_WORTLAUT: dict[Verstossgrund, str] = {
    Verstossgrund.UNBEKANNT: "in diesem Formular nicht vorhanden",
    Verstossgrund.KEIN_TEXT: "kein Text",
    Verstossgrund.ZU_LANG: "zu lang",
    Verstossgrund.PUNKT_IM_SCHLUESSEL: "falsch geschrieben",
}

# Enough to work with, few enough that the message stays readable. A document
# with one wrong path usually has many, and listing four hundred of them helps
# nobody.
HOECHSTENS_GENANNT = 5


def _genannte_felder(pfade: list[str]) -> str:
    """A few field paths, and how many were left out.

    Field paths, never values. They come from our own form definition, so naming
    them cannot repeat back anything the person typed.
    """
    gezeigt = ", ".join(pfade[:HOECHSTENS_GENANNT])
    rest = len(pfade) - HOECHSTENS_GENANNT
    return f"{gezeigt} und {rest} weitere" if rest > 0 else gezeigt


def _zusatz(fehler: ProtokollFehler) -> str:
    """The part of the message that depends on this particular failure."""
    if isinstance(fehler, AntwortenZuGross):
        return f" Zurzeit sind es {fehler.zeichen} Zeichen, möglich sind {fehler.hoechstens}."

    if isinstance(fehler, AntwortenUngueltig):
        teile = [
            f"{_genannte_felder(pfade)} ({VERSTOSS_WORTLAUT[grund]})"
            for grund, pfade in sorted(fehler.nach_grund().items())
        ]
        return " Betroffen: " + "; ".join(teile) + "."

    return ""


async def behandle_protokollfehler(request: Request, fehler: Exception) -> Response:
    """Registered for the ProtokollFehler family, so every subclass arrives here."""
    if not isinstance(fehler, ProtokollFehler):
        raise fehler

    for klasse in type(fehler).__mro__:
        if klasse in PROTOKOLL_UEBERSETZUNG:
            code, status_code, nachricht = PROTOKOLL_UEBERSETZUNG[klasse]
            return _antwort(code, status_code, nachricht + _zusatz(fehler))

    return _antwort(*UNBEKANNT)


def registriere_fehlerbehandlung(app: FastAPI) -> None:
    app.add_exception_handler(BenutzerFehler, behandle_benutzerfehler)
    app.add_exception_handler(ProtokollFehler, behandle_protokollfehler)
    app.add_exception_handler(RequestValidationError, behandle_anfragefehler)
