import secrets
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.sitzung import SITZUNGS_COOKIE
from app.benutzer.dienst import setze_aktiv
from app.config import get_settings
from app.models.benutzer import Rolle, User

Anlegen = Callable[..., Awaitable[User]]


@pytest.fixture
def demo_an(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "demo_modus", True)


@pytest.fixture
def demo_aus(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "demo_modus", False)


async def _demokonten(anlegen: Anlegen) -> None:
    await anlegen(
        email="demo-einreicher@befischung.example",
        rollen=[Rolle.SUBMITTER],
        passwort=secrets.token_urlsafe(32),
    )
    await anlegen(
        email="demo-pruefer@befischung.example",
        rollen=[Rolle.REVIEWER],
        passwort=secrets.token_urlsafe(32),
    )


async def test_status_sagt_aus_wenn_der_schalter_aus_ist(
    demo_aus: None, client: AsyncClient
) -> None:
    antwort = await client.get("/api/v1/anmeldung/demo")

    assert antwort.status_code == 200
    assert antwort.json() == {"aktiv": False}


async def test_status_sagt_an_wenn_der_schalter_an_ist(
    demo_an: None, client: AsyncClient
) -> None:
    antwort = await client.get("/api/v1/anmeldung/demo")

    assert antwort.json() == {"aktiv": True}


async def test_ohne_schalter_gibt_es_die_demo_anmeldung_nicht(
    demo_aus: None, anlegen: Anlegen, client: AsyncClient
) -> None:
    """Even with the accounts present, which is the case of a demo database that
    somebody switched off: the switch alone decides."""
    await _demokonten(anlegen)

    antwort = await client.post("/api/v1/anmeldung/demo", json={"rolle": "SUBMITTER"})

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "DEMO_AUS"
    assert "set-cookie" not in antwort.headers


@pytest.mark.parametrize(
    ("rolle", "email"),
    [
        ("SUBMITTER", "demo-einreicher@befischung.example"),
        ("REVIEWER", "demo-pruefer@befischung.example"),
    ],
)
async def test_demo_anmeldung_meldet_als_das_demokonto_an(
    demo_an: None, anlegen: Anlegen, client: AsyncClient, rolle: str, email: str
) -> None:
    await _demokonten(anlegen)

    antwort = await client.post("/api/v1/anmeldung/demo", json={"rolle": rolle})

    assert antwort.status_code == 200
    assert antwort.json()["email"] == email
    assert antwort.json()["rollen"] == [rolle]
    assert client.cookies[SITZUNGS_COOKIE]

    ich = await client.get("/api/v1/ich")
    assert ich.json()["email"] == email


async def test_super_admin_gibt_es_als_demo_nicht(
    demo_an: None, anlegen: Anlegen, client: AsyncClient
) -> None:
    await _demokonten(anlegen)

    antwort = await client.post("/api/v1/anmeldung/demo", json={"rolle": "SUPER_ADMIN"})

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "DEMO_ROLLE_UNZULAESSIG"
    assert "set-cookie" not in antwort.headers


async def test_fehlende_demokonten_werden_benannt(
    demo_an: None, client: AsyncClient
) -> None:
    antwort = await client.post("/api/v1/anmeldung/demo", json={"rolle": "REVIEWER"})

    assert antwort.status_code == 503
    assert antwort.json()["code"] == "DEMO_NICHT_EINGERICHTET"


async def test_ein_gesperrtes_demokonto_zaehlt_als_nicht_eingerichtet(
    demo_an: None, anlegen: Anlegen, client: AsyncClient, session: AsyncSession
) -> None:
    """Locking a demo account with the ordinary command is how somebody would
    close one door of the demo without switching the whole thing off."""
    await _demokonten(anlegen)
    await setze_aktiv(session, "demo-pruefer@befischung.example", aktiv=False)

    antwort = await client.post("/api/v1/anmeldung/demo", json={"rolle": "REVIEWER"})

    assert antwort.status_code == 503
    assert "set-cookie" not in antwort.headers
