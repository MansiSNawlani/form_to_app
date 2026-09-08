from collections.abc import Sequence

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.sitzung import SITZUNGS_COOKIE
from app.benutzer.dienst import lege_benutzer_an, setze_aktiv
from app.models.benutzer import Rolle, User

PASSWORT = "ein gutes langes passwort"


async def _anlegen(
    session: AsyncSession,
    email: str = "anna@ffs.de",
    rollen: Sequence[Rolle] = (Rolle.SUBMITTER,),
) -> User:
    return await lege_benutzer_an(session, email=email, passwort=PASSWORT, rollen=rollen)


async def _anmelden(
    client: AsyncClient, email: str = "anna@ffs.de", passwort: str = PASSWORT
) -> Response:
    return await client.post("/api/v1/anmeldung", json={"email": email, "passwort": passwort})


async def test_richtige_anmeldung_gibt_das_konto(
    session: AsyncSession, client: AsyncClient
) -> None:
    angelegt = await _anlegen(session, rollen=[Rolle.REVIEWER, Rolle.SUBMITTER])

    antwort = await _anmelden(client)

    assert antwort.status_code == 200
    assert antwort.json() == {
        "id": str(angelegt.id),
        "email": "anna@ffs.de",
        "rollen": ["REVIEWER", "SUBMITTER"],
        "regierungspraesidium": None,
        "locale": "de",
        "ist_aktiv": True,
    }


async def test_antwort_enthaelt_den_hash_nicht(
    session: AsyncSession, client: AsyncClient
) -> None:
    """The one thing that must never leave this service, checked as a whole body
    rather than field by field, so a field added later cannot smuggle it out."""
    benutzer = await _anlegen(session)

    antwort = await _anmelden(client)

    assert benutzer.password_hash not in antwort.text
    assert "password" not in antwort.text


async def test_anmeldung_setzt_das_sitzungscookie(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session)

    antwort = await _anmelden(client)

    gesetzt = antwort.headers["set-cookie"]
    assert gesetzt.startswith(f"{SITZUNGS_COOKIE}=")
    assert "HttpOnly" in gesetzt
    assert "Secure" in gesetzt
    assert "SameSite=lax" in gesetzt
    assert "Path=/" in gesetzt
    assert client.cookies[SITZUNGS_COOKIE]


async def test_cookie_enthaelt_weder_adresse_noch_passwort(
    session: AsyncSession, client: AsyncClient
) -> None:
    """A JWT is readable by anyone holding it, so what goes in it matters."""
    await _anlegen(session)

    await _anmelden(client)

    token = client.cookies[SITZUNGS_COOKIE]
    assert "anna" not in token
    assert PASSWORT not in token


async def test_falsches_passwort_wird_mit_401_abgewiesen(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session)

    antwort = await _anmelden(client, passwort="etwas ganz anderes")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "AnmeldungFehlgeschlagen"
    assert "set-cookie" not in antwort.headers


async def test_unbekannte_adresse_antwortet_wortgleich(
    session: AsyncSession, client: AsyncClient
) -> None:
    """The refusals have to match exactly, or the login page becomes a way of
    finding out who holds an account here."""
    await _anlegen(session)

    falsches_passwort = await _anmelden(client, passwort="etwas ganz anderes")
    unbekannte_adresse = await _anmelden(client, email="niemand@ffs.de")

    assert unbekannte_adresse.status_code == falsches_passwort.status_code
    assert unbekannte_adresse.json() == falsches_passwort.json()


async def test_unbrauchbare_adresse_antwortet_ebenso(
    session: AsyncSession, client: AsyncClient
) -> None:
    antwort = await _anmelden(client, email="keine adresse")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "AnmeldungFehlgeschlagen"


async def test_deaktiviertes_konto_wird_mit_403_abgewiesen(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session)
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    antwort = await _anmelden(client)

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "KontoDeaktiviert"
    assert "deaktiviert" in antwort.json()["nachricht"]
    assert "set-cookie" not in antwort.headers


async def test_integrationskonto_wird_mit_403_abgewiesen(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session, email="fiaka@ffs.de", rollen=[Rolle.INTEGRATION])

    antwort = await _anmelden(client, email="fiaka@ffs.de")

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "KontoNichtInteraktiv"
    assert "set-cookie" not in antwort.headers


@pytest.mark.parametrize(
    "koerper",
    [
        {"email": "anna@ffs.de"},
        {"passwort": PASSWORT},
        {"email": "", "passwort": PASSWORT},
        {"email": "anna@ffs.de", "passwort": ""},
        {},
    ],
)
async def test_unvollstaendige_anfrage_wird_mit_422_abgewiesen(
    client: AsyncClient, koerper: dict[str, str]
) -> None:
    antwort = await client.post("/api/v1/anmeldung", json=koerper)

    assert antwort.status_code == 422


async def test_gesundheitspruefung_bleibt_offen(client: AsyncClient) -> None:
    """The platform checks these without a session, so they must stay open."""
    assert (await client.get("/api/v1/health")).status_code == 200
