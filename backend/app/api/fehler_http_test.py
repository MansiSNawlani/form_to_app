"""A protocol refusal becomes a response that names fields and never values.

No route can raise these yet, so they are handed to the handler directly. Once
step 6 gives them a route, its tests cover the path through HTTP; this file stays
because it is where the wording itself is checked.
"""

import json
from typing import Any

import pytest
from fastapi import Request, status

from app.api.fehler_http import (
    HOECHSTENS_GENANNT,
    behandle_benutzerfehler,
    behandle_protokollfehler,
)
from app.benutzer.fehler import (
    BenutzerFehler,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    LetzterSuperAdmin,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
    SelbstEntzugUnzulaessig,
)
from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    ProtokollFehler,
    Verstoss,
    Verstossgrund,
)
from app.security.passwoerter import PasswortZuKurz, PasswortZuLang

# The handler never looks at the request, so the smallest thing Starlette accepts
# as one is enough.
ANFRAGE = Request({"type": "http", "method": "PUT", "path": "/", "headers": []})


async def antworte(fehler: ProtokollFehler) -> tuple[int, dict[str, Any]]:
    antwort = await behandle_protokollfehler(ANFRAGE, fehler)
    koerper: dict[str, Any] = json.loads(bytes(antwort.body))
    return antwort.status_code, koerper


async def test_nicht_lesbare_antworten_werden_abgelehnt() -> None:
    status_code, koerper = await antworte(AntwortenNichtLesbar())

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANTWORTEN_NICHT_LESBAR"


async def test_ein_zu_grosses_protokoll_nennt_beide_zahlen() -> None:
    """The person has to know how far over it is to know what to shorten."""
    status_code, koerper = await antworte(AntwortenZuGross(250_000, 200_000))

    assert status_code == status.HTTP_413_CONTENT_TOO_LARGE
    assert koerper["code"] == "ANTWORTEN_ZU_GROSS"
    assert "250000" in koerper["nachricht"]
    assert "200000" in koerper["nachricht"]


async def test_ungueltige_antworten_nennen_die_felder() -> None:
    fehler = AntwortenUngueltig(
        (
            Verstoss("erfunden", Verstossgrund.UNBEKANNT),
            Verstoss("bearbeiter.name", Verstossgrund.KEIN_TEXT),
        )
    )

    status_code, koerper = await antworte(fehler)

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANTWORTEN_UNGUELTIG"
    assert "erfunden" in koerper["nachricht"]
    assert "bearbeiter.name" in koerper["nachricht"]


async def test_die_liste_der_felder_bleibt_lesbar() -> None:
    """Four hundred field paths in one sentence helps nobody.

    A few are named and the rest are counted, which is enough to work with and
    still fits in a message somebody will read.
    """
    verstoesse = tuple(
        Verstoss(f"erfunden{n}", Verstossgrund.UNBEKANNT) for n in range(20)
    )

    _, koerper = await antworte(AntwortenUngueltig(verstoesse))

    genannt = sum(1 for n in range(20) if f"erfunden{n}" in koerper["nachricht"])
    assert genannt == HOECHSTENS_GENANNT
    assert f"und {20 - HOECHSTENS_GENANNT} weitere" in koerper["nachricht"]


async def test_eine_ablehnung_traegt_keine_eingaben_zurueck() -> None:
    """Field paths come from our own definition; the values never leave.

    This is the whole reason app/api/fehler_http.py replaces FastAPI's own
    validation response, which quotes the rejected value straight back.
    """
    fehler = AntwortenUngueltig((Verstoss("bearbeiter.name", Verstossgrund.ZU_LANG),))

    _, koerper = await antworte(fehler)

    assert "bearbeiter.name" in koerper["nachricht"]
    # The value that was too long is nowhere in the response, because the
    # exception never carried it in the first place.
    assert not hasattr(fehler.verstoesse[0], "wert")


# Every account refusal feature 16a's routes can produce, with the code and the
# status each is contracted to answer with. The browser side branches on the
# code, so a change here is a change to a published contract rather than to a
# sentence.
KONTO_FAELLE: list[tuple[BenutzerFehler, str, int]] = [
    (
        EmailUngueltig("anna", "not an address"),
        "EMAIL_UNGUELTIG",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    ),
    (
        EmailBereitsVergeben("anna@ffs.de"),
        "EMAIL_VERGEBEN",
        status.HTTP_409_CONFLICT,
    ),
    (RollenLeer(), "ROLLEN_LEER", status.HTTP_422_UNPROCESSABLE_CONTENT),
    (
        RegierungspraesidiumFehlt(),
        "REGIERUNGSPRAESIDIUM_FEHLT",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    ),
    (
        RegierungspraesidiumUnzulaessig(2),
        "REGIERUNGSPRAESIDIUM_UNZULAESSIG",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    ),
    (
        RegierungspraesidiumAusserhalbBereich(7),
        "REGIERUNGSPRAESIDIUM_UNBEKANNT",
        status.HTTP_422_UNPROCESSABLE_CONTENT,
    ),
    (PasswortZuKurz(), "PASSWORT_ZU_KURZ", status.HTTP_422_UNPROCESSABLE_CONTENT),
    (PasswortZuLang(), "PASSWORT_ZU_LANG", status.HTTP_422_UNPROCESSABLE_CONTENT),
    (
        BenutzerNichtGefunden("anna@ffs.de"),
        "KONTO_NICHT_GEFUNDEN",
        status.HTTP_404_NOT_FOUND,
    ),
    (LetzterSuperAdmin(), "LETZTER_SUPER_ADMIN", status.HTTP_409_CONFLICT),
    (
        SelbstEntzugUnzulaessig(),
        "SELBSTENTZUG_UNZULAESSIG",
        status.HTTP_409_CONFLICT,
    ),
]


async def konto_antwort(fehler: BenutzerFehler) -> tuple[int, dict[str, Any]]:
    antwort = await behandle_benutzerfehler(ANFRAGE, fehler)
    koerper: dict[str, Any] = json.loads(bytes(antwort.body))
    return antwort.status_code, koerper


@pytest.mark.parametrize(("fehler", "code", "status_code"), KONTO_FAELLE)
async def test_jede_kontoabsage_hat_code_und_status(
    fehler: BenutzerFehler, code: str, status_code: int
) -> None:
    """Falling through to 500 would turn a refusal into a fault.

    The browser side reads the code to decide which field to mark, so a refusal
    arriving as UNBEKANNTER_FEHLER is one the screen cannot point at anything.
    """
    gemeldet, koerper = await konto_antwort(fehler)

    assert gemeldet == status_code, koerper
    assert koerper["code"] == code


@pytest.mark.parametrize(("fehler", "code", "status_code"), KONTO_FAELLE)
async def test_jede_kontoabsage_sagt_was_zu_tun_ist(
    fehler: BenutzerFehler, code: str, status_code: int
) -> None:
    """The standard set on 2026-09-06, held here for the account messages.

    A message that names the problem and stops leaves the reader stuck. Each of
    these has to end somewhere they can act, which in a browser means an
    instruction beginning with "Bitte" or a named account that can do it for
    them.
    """
    _, koerper = await konto_antwort(fehler)

    nachricht = koerper["nachricht"]
    wege_hinaus = ("Bitte", "kann es für Sie tun")
    assert any(weg in nachricht for weg in wege_hinaus), nachricht


async def test_das_letzte_super_admin_konto_nennt_den_ausweg() -> None:
    """The one refusal whose way out is a different action, not a corrected field."""
    _, koerper = await konto_antwort(LetzterSuperAdmin())

    assert "zweites Konto" in koerper["nachricht"]


async def test_eine_kontoabsage_traegt_keine_adresse_zurueck() -> None:
    """The refusals carry the email; the wording must not print it.

    A message is shown on a screen, copied into tickets and captured by logs. The
    administrator already has the address in the form in front of them, so
    repeating it buys nothing and spreads it further.
    """
    _, koerper = await konto_antwort(EmailBereitsVergeben("anna@ffs.de"))

    assert "anna@ffs.de" not in koerper["nachricht"]


async def test_eine_unbekannte_kontoabsage_faellt_auf_unbekannt() -> None:
    """The family is wider than the table, on purpose.

    A status code invented in advance for an error no route can raise is a
    contract nobody reviewed. KontoNichtInteraktiv is in the table; this uses a
    member that is not.
    """

    class NeueAbsage(BenutzerFehler):
        pass

    gemeldet, koerper = await konto_antwort(NeueAbsage())

    assert gemeldet == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert koerper["code"] == "UNBEKANNTER_FEHLER"
