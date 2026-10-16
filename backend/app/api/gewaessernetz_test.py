from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.beispiele import ENZ, fliess, netz, see
from app.models.benutzer import Rolle, User

PFAD = "/api/v1/gewaessernetz/suche"


@pytest.fixture
async def angemeldet(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="anna@ffs.de", rollen=(Rolle.SUBMITTER,))
    await anmelden(email="anna@ffs.de")


async def test_ohne_anmeldung_401(client: AsyncClient) -> None:
    assert (await client.get(PFAD, params={"q": "Neckar"})).status_code == 401


@pytest.mark.usefixtures("angemeldet")
class TestSuche:
    async def test_antwort(self, client: AsyncClient, session: AsyncSession) -> None:
        await netz(
            session,
            fliess("2384100000000", "Mühlbach", ENZ, "Enz", rw=501000, hw=5400000),
            see("7174", "Mühlweiher", rw=520000, hw=5400000),
        )

        antwort = await client.get(
            PFAD, params=[("q", "muehl"), ("rw", "500100"), ("hw", "5400000")]
        )

        assert antwort.status_code == 200
        assert antwort.json() == {
            "stand": "2025-05-01",
            "treffer": [
                {
                    "kennung": "2384100000000",
                    "art": "FLIESSGEWAESSER",
                    "name": "Mühlbach",
                    "vorfluter_name": "Enz",
                    "vorfluter": ["Enz", "Neckar", "Rhein"],
                    "entfernung_m": 900,
                },
                {
                    "kennung": "7174",
                    "art": "STEHENDES_GEWAESSER",
                    "name": "Mühlweiher",
                    "vorfluter_name": None,
                    "vorfluter": None,
                    "entfernung_m": 19900,
                },
            ],
        }

    async def test_zwei_punkte(self, client: AsyncClient, session: AsyncSession) -> None:
        await netz(session)

        antwort = await client.get(
            PFAD,
            params=[
                ("q", "Neckar"),
                ("rw", "500000"),
                ("hw", "5400000"),
                ("rw", "500000"),
                ("hw", "5401000"),
            ],
        )

        assert antwort.status_code == 200
        assert antwort.json()["treffer"][0]["entfernung_m"] == 0

    async def test_leeres_netz(self, client: AsyncClient) -> None:
        antwort = await client.get(PFAD, params={"q": "Neckar"})

        assert antwort.status_code == 200
        assert antwort.json() == {"stand": None, "treffer": []}

    @pytest.mark.parametrize(
        "params",
        [
            [],
            [("q", "N")],
            [("q", "  N  ")],
            [("q", "x" * 201)],
            [("q", "Neckar"), ("rw", "500000")],
            [("q", "Neckar"), ("hw", "5400000")],
            [("q", "Neckar"), ("rw", "500000"), ("hw", "1"), ("rw", "500000")],
            [("q", "Neckar")] + [("rw", "500000"), ("hw", "5400000")] * 3,
            [("q", "Neckar"), ("rw", "-1"), ("hw", "5400000")],
            [("q", "Neckar"), ("rw", "abc"), ("hw", "5400000")],
        ],
    )
    async def test_ungueltige_anfrage_422(
        self, client: AsyncClient, params: list[tuple[str, str | int | float | bool | None]]
    ) -> None:
        antwort = await client.get(PFAD, params=params)

        assert antwort.status_code == 422
        assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"
