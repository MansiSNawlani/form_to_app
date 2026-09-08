from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.sitzung import SITZUNGS_COOKIE
from app.benutzer.dienst import setze_aktiv
from app.models.benutzer import Rolle, User

Anlegen = Callable[..., Awaitable[User]]
Anmelden = Callable[..., Awaitable[Response]]


async def test_richtige_anmeldung_gibt_das_konto(anlegen: Anlegen, anmelden: Anmelden) -> None:
    angelegt = await anlegen(rollen=[Rolle.REVIEWER, Rolle.SUBMITTER])

    antwort = await anmelden()

    assert antwort.status_code == 200
    assert antwort.json() == {
        "id": str(angelegt.id),
        "email": "anna@ffs.de",
        "rollen": ["REVIEWER", "SUBMITTER"],
        "regierungspraesidium": None,
        "locale": "de",
        "ist_aktiv": True,
    }


async def test_antwort_enthaelt_den_hash_nicht(anlegen: Anlegen, anmelden: Anmelden) -> None:
    """The one thing that must never leave this service, checked against the whole
    body rather than field by field, so a field added later cannot smuggle it out."""
    benutzer = await anlegen()

    antwort = await anmelden()

    assert benutzer.password_hash not in antwort.text
    assert "password" not in antwort.text


async def test_anmeldung_setzt_das_sitzungscookie(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    await anlegen()

    antwort = await anmelden()

    gesetzt = antwort.headers["set-cookie"]
    assert gesetzt.startswith(f"{SITZUNGS_COOKIE}=")
    assert "HttpOnly" in gesetzt
    assert "Secure" in gesetzt
    assert "SameSite=lax" in gesetzt
    assert "Path=/" in gesetzt
    assert client.cookies[SITZUNGS_COOKIE]


async def test_cookie_enthaelt_weder_adresse_noch_passwort(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    """A JWT is readable by anyone holding it, so what goes in it matters."""
    await anlegen()

    await anmelden()

    token = client.cookies[SITZUNGS_COOKIE]
    assert "anna" not in token
    assert "passwort" not in token


async def test_falsches_passwort_wird_mit_401_abgewiesen(
    anlegen: Anlegen, anmelden: Anmelden
) -> None:
    await anlegen()

    antwort = await anmelden(passwort="etwas ganz anderes")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "ANMELDUNG_FEHLGESCHLAGEN"
    assert "set-cookie" not in antwort.headers


async def test_unbekannte_adresse_antwortet_wortgleich(
    anlegen: Anlegen, anmelden: Anmelden
) -> None:
    """The refusals have to match exactly, or the login page becomes a way of
    finding out who holds an account here."""
    await anlegen()

    falsches_passwort = await anmelden(passwort="etwas ganz anderes")
    unbekannte_adresse = await anmelden(email="niemand@ffs.de")

    assert unbekannte_adresse.status_code == falsches_passwort.status_code
    assert unbekannte_adresse.json() == falsches_passwort.json()


async def test_unbrauchbare_adresse_antwortet_ebenso(anmelden: Anmelden) -> None:
    antwort = await anmelden(email="keine adresse")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "ANMELDUNG_FEHLGESCHLAGEN"


async def test_deaktiviertes_konto_wird_mit_403_abgewiesen(
    anlegen: Anlegen, anmelden: Anmelden, session: AsyncSession
) -> None:
    await anlegen()
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    antwort = await anmelden()

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "KONTO_DEAKTIVIERT"
    assert "deaktiviert" in antwort.json()["nachricht"]
    assert "set-cookie" not in antwort.headers


async def test_integrationskonto_wird_mit_403_abgewiesen(
    anlegen: Anlegen, anmelden: Anmelden
) -> None:
    await anlegen(email="fiaka@ffs.de", rollen=[Rolle.INTEGRATION])

    antwort = await anmelden(email="fiaka@ffs.de")

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "KONTO_NICHT_INTERAKTIV"
    assert "set-cookie" not in antwort.headers


@pytest.mark.parametrize(
    "koerper",
    [
        {"email": "anna@ffs.de"},
        {"passwort": "ein gutes langes passwort"},
        {"email": "", "passwort": "ein gutes langes passwort"},
        {"email": "anna@ffs.de", "passwort": ""},
        {},
    ],
)
async def test_unvollstaendige_anfrage_wird_mit_422_abgewiesen(
    client: AsyncClient, koerper: dict[str, str]
) -> None:
    antwort = await client.post("/api/v1/anmeldung", json=koerper)

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"


async def test_unlesbarer_koerper_wird_mit_422_abgewiesen(client: AsyncClient) -> None:
    antwort = await client.post(
        "/api/v1/anmeldung",
        content=b"{kein gueltiges json",
        headers={"Content-Type": "application/json"},
    )

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"


@pytest.mark.parametrize(
    "passwort",
    ["x" * 5000, 12345],
    ids=["zu lang", "falscher Typ"],
)
async def test_abgelehnte_anfrage_gibt_das_passwort_nicht_zurueck(
    client: AsyncClient, passwort: object
) -> None:
    """FastAPI's own validation response quotes the rejected value back. On this
    route that would put the submitted password in the body, and from there into
    any log that records one."""
    antwort = await client.post(
        "/api/v1/anmeldung", json={"email": "anna@ffs.de", "passwort": passwort}
    )

    assert antwort.status_code == 422
    assert str(passwort) not in antwort.text
    assert antwort.json()["nachricht"].endswith("Bitte prüfen Sie: passwort.")


async def test_gesundheitspruefung_bleibt_offen(client: AsyncClient) -> None:
    """The platform checks these without a session, so they must stay open."""
    assert (await client.get("/api/v1/health")).status_code == 200
