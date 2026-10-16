"""The role check, proved against a route that exists only in this file.

Nothing in the application requires a role yet: the only routes are health,
readiness and the three account ones, and none of them may be gated. So the
dependency is exercised on a throwaway app here.

That is deliberate rather than a gap. Features 3, 11, 12, 13 and 16 all need this
same check, and building it once with its own tests is what stops five features
each growing a permission check that is subtly different from the others.
"""

from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from typing import Annotated

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import anmeldung
from app.api.abhaengigkeiten import erfordert_rollen
from app.api.fehler_http import registriere_fehlerbehandlung
from app.benutzer.dienst import setze_aktiv
from app.db import get_session
from app.models.benutzer import Rolle, User

Anlegen = Callable[..., Awaitable[User]]
Anmelden = Callable[..., Awaitable[Response]]


def _testanwendung() -> FastAPI:
    """A small app with the real sign-in route and two protected ones."""
    test_app = FastAPI()
    registriere_fehlerbehandlung(test_app)
    test_app.include_router(anmeldung.router)

    @test_app.get("/nur-pruefer")
    async def nur_pruefer(
        benutzer: Annotated[User, Depends(erfordert_rollen(Rolle.REVIEWER))],
    ) -> dict[str, str]:
        return {"email": benutzer.email}

    @test_app.get("/pruefer-oder-admin")
    async def pruefer_oder_admin(
        benutzer: Annotated[
            User, Depends(erfordert_rollen(Rolle.REVIEWER, Rolle.SUPER_ADMIN))
        ],
    ) -> dict[str, str]:
        return {"email": benutzer.email}

    return test_app


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    test_app = _testanwendung()

    async def _test_session() -> AsyncIterator[AsyncSession]:
        yield session

    test_app.dependency_overrides[get_session] = _test_session
    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="https://testserver"
    ) as offener_client:
        yield offener_client


async def _anlegen_und_anmelden(
    anlegen: Anlegen, anmelden: Anmelden, rollen: Sequence[Rolle]
) -> None:
    """Both fixtures come from conftest.py; anmelden picks up the client fixture
    defined above, so it signs in against this file's own application."""
    await anlegen(rollen=rollen)
    assert (await anmelden()).status_code == 200


async def test_ohne_anmeldung_ist_es_401(client: AsyncClient) -> None:
    antwort = await client.get("/nur-pruefer")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "NICHT_ANGEMELDET"


async def test_mit_der_rolle_geht_es_durch(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    await _anlegen_und_anmelden(anlegen, anmelden, [Rolle.REVIEWER])

    antwort = await client.get("/nur-pruefer")

    assert antwort.status_code == 200
    assert antwort.json() == {"email": "anna@ffs.de"}


async def test_ohne_die_rolle_ist_es_403(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    """403 and not 401. Sending somebody who is signed in to the login page is a
    loop they cannot get out of."""
    await _anlegen_und_anmelden(anlegen, anmelden, [Rolle.SUBMITTER])

    antwort = await client.get("/nur-pruefer")

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "ROLLE_FEHLT"


async def test_eine_von_mehreren_rollen_genuegt(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    await _anlegen_und_anmelden(anlegen, anmelden, [Rolle.SUPER_ADMIN])

    assert (await client.get("/pruefer-oder-admin")).status_code == 200


async def test_mehrere_rollen_am_konto_sperren_nicht_aus(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient
) -> None:
    """The any-of case that an all-of check would get wrong."""
    await _anlegen_und_anmelden(anlegen, anmelden, [Rolle.SUPER_ADMIN, Rolle.REVIEWER])

    assert (await client.get("/pruefer-oder-admin")).status_code == 200


async def test_deaktiviertes_konto_ist_401_und_nicht_403(
    anlegen: Anlegen, anmelden: Anmelden, client: AsyncClient, session: AsyncSession
) -> None:
    """Not signed in at all comes before not allowed, so a deactivated account is
    never told which roles a page wanted."""
    await _anlegen_und_anmelden(anlegen, anmelden, [Rolle.REVIEWER])
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    assert (await client.get("/nur-pruefer")).status_code == 401


async def test_ohne_rollen_ist_die_abhaengigkeit_ein_programmierfehler() -> None:
    """A route gated on nothing would refuse everybody while looking protected."""
    with pytest.raises(ValueError):
        erfordert_rollen()
