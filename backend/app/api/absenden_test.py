"""Submitting over HTTP.

app/protokolle/absenden_test.py proves the decision where it lives. What is
proved here is the trip through HTTP: the status codes, the small answer a
successful submit comes back with, and above all the shape of the refusal, since
that body is what the panel on the form draws.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response

from app.models.benutzer import User
from app.protokolle.formregeln.beispiele import VOLLSTAENDIG


@pytest.fixture
async def angemeldet(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> AsyncClient:
    """A client signed in as an ordinary submitter, which is all these need."""
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    return client


async def _entwurf(
    client: AsyncClient, antworten: dict[str, object] | None = None
) -> tuple[str, int]:
    """A draft on the server, and the version to submit it from.

    Through the real endpoints rather than the database, because the version a
    browser holds is the one a save gave it, and getting that wrong here would
    hide exactly the mistake this argument exists to catch.
    """
    angelegt = (await client.post("/api/v1/protokolle")).json()
    if antworten is None:
        return str(angelegt["id"]), int(angelegt["version"])

    gespeichert = await client.put(
        f"/api/v1/protokolle/{angelegt['id']}/antworten",
        json={"version": angelegt["version"], "antworten": antworten},
    )
    return str(angelegt["id"]), int(gespeichert.json()["version"])


async def test_ohne_anmeldung_wird_nichts_abgesendet(client: AsyncClient) -> None:
    antwort = await client.post(
        f"/api/v1/protokolle/{uuid.uuid4()}/absenden", json={"version": 1}
    )

    assert antwort.status_code == 401


async def test_ein_vollstaendiges_protokoll_wird_angenommen(angemeldet: AsyncClient) -> None:
    protokoll_id, version = await _entwurf(angemeldet, dict(VOLLSTAENDIG))

    antwort = await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version}
    )

    assert antwort.status_code == 200
    koerper = antwort.json()
    assert koerper["status"] == "SUBMITTED"
    assert koerper["version"] == version + 1
    assert koerper["submitted_at"] is not None
    # The answers stay where they are. The browser is leaving the form for Meine
    # Protokolle, which fetches its own rows.
    assert "antworten" not in koerper


async def test_ein_unvollstaendiges_protokoll_wird_mit_liste_abgelehnt(
    angemeldet: AsyncClient,
) -> None:
    """The refusal the panel draws.

    Every entry is a path and a key. A sentence here could not be put next to the
    field it concerns, and could not be translated by feature 17.
    """
    protokoll_id, version = await _entwurf(angemeldet)

    antwort = await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version}
    )

    assert antwort.status_code == 422
    koerper = antwort.json()
    assert koerper["code"] == "PROTOKOLL_UNVOLLSTAENDIG"
    assert koerper["nachricht"]
    verstoesse = koerper["verstoesse"]
    assert len(verstoesse) >= 31
    assert all(set(v) == {"pfad", "schluessel"} for v in verstoesse)
    assert all(v["schluessel"].startswith("protokoll.regeln.") for v in verstoesse)


async def test_eine_ablehnung_laesst_den_entwurf_stehen(angemeldet: AsyncClient) -> None:
    """The message promises the draft is unchanged, so this is that promise."""
    protokoll_id, version = await _entwurf(angemeldet)

    await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version}
    )

    danach = (await angemeldet.get(f"/api/v1/protokolle/{protokoll_id}")).json()
    assert danach["status"] == "DRAFT"
    assert danach["version"] == version


async def test_andere_ablehnungen_tragen_keine_liste(angemeldet: AsyncClient) -> None:
    """verstoesse is absent everywhere else, so the widened shape breaks nothing.

    A client reading the old two-field body still finds exactly what it expects
    from every refusal but this one.
    """
    antwort = await angemeldet.get(f"/api/v1/protokolle/{uuid.uuid4()}")

    assert antwort.status_code == 404
    assert antwort.json()["verstoesse"] is None


async def test_ein_fremdes_protokoll_ist_nicht_zu_finden(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The permission test. A 404, the same as for a protocol that does not exist.

    A 403 would confirm the id is real, which is a fact about another surveyor's
    work that a stranger has no business collecting.
    """
    await anlegen(email="bergmann@ffs.de")
    await anlegen(email="keller@ffs.de")

    await anmelden(email="bergmann@ffs.de")
    protokoll_id, version = await _entwurf(client, dict(VOLLSTAENDIG))

    await anmelden(email="keller@ffs.de")
    antwort = await client.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version}
    )

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "PROTOKOLL_NICHT_GEFUNDEN"


async def test_zweimal_absenden_ist_ein_konflikt(angemeldet: AsyncClient) -> None:
    """What a lost answer on the way back to the browser looks like."""
    protokoll_id, version = await _entwurf(angemeldet, dict(VOLLSTAENDIG))

    erste = await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version}
    )
    zweite = await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden",
        json={"version": erste.json()["version"]},
    )

    assert erste.status_code == 200
    assert zweite.status_code == 409
    assert zweite.json()["code"] == "PROTOKOLL_NICHT_MEHR_ENTWURF"


async def test_ein_veralteter_stand_ist_ein_konflikt(angemeldet: AsyncClient) -> None:
    """A tab left open across somebody else's editing session."""
    protokoll_id, version = await _entwurf(angemeldet, dict(VOLLSTAENDIG))

    antwort = await angemeldet.post(
        f"/api/v1/protokolle/{protokoll_id}/absenden", json={"version": version - 1}
    )

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "PROTOKOLL_VERAENDERT"


async def test_ohne_version_wird_nicht_abgesendet(angemeldet: AsyncClient) -> None:
    """The version is required, not defaulted.

    A submit with no version would be one that silently wins every race, which is
    the thing it exists to prevent.
    """
    protokoll_id, _ = await _entwurf(angemeldet, dict(VOLLSTAENDIG))

    antwort = await angemeldet.post(f"/api/v1/protokolle/{protokoll_id}/absenden", json={})

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"
