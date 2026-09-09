"""Saving and deleting over HTTP.

app/protokolle/speichern_test.py proves the rules where they live. What is proved
here is the trip through HTTP: the status codes, the small response a save comes
back with, and that a refusal still leaves the stored protocol untouched.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response

from app.models.benutzer import User


async def neuer_entwurf(client: AsyncClient) -> dict[str, object]:
    antwort = await client.post("/api/v1/protokolle")
    koerper: dict[str, object] = antwort.json()
    return koerper


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


async def test_ohne_anmeldung_wird_nichts_geaendert(client: AsyncClient) -> None:
    fremde_id = uuid.uuid4()

    gespeichert = await client.put(
        f"/api/v1/protokolle/{fremde_id}/antworten",
        json={"version": 1, "antworten": {}},
    )
    geloescht = await client.delete(f"/api/v1/protokolle/{fremde_id}")

    assert gespeichert.status_code == 401
    assert geloescht.status_code == 401


async def test_speichern_antwortet_ohne_die_antworten(angemeldet: AsyncClient) -> None:
    """Saving fires while somebody types.

    Echoing a twenty kilobyte document back on every keystroke burst would be
    pure waste; the browser already has what it just sent. What it does not have
    is the new version, and it needs that for its next save.
    """
    entwurf = await neuer_entwurf(angemeldet)

    antwort = await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": entwurf["version"], "antworten": {"datum": "2026-08-14"}},
    )

    assert antwort.status_code == 200
    assert set(antwort.json()) == {"id", "status", "version", "updated_at"}
    assert antwort.json()["version"] == 2


async def test_das_gespeicherte_kommt_beim_lesen_zurueck(angemeldet: AsyncClient) -> None:
    entwurf = await neuer_entwurf(angemeldet)
    antworten = {
        "anlass": "wrrl_monitoring",
        "probestrecke": {"gewaesser": {"gewaessername": "Schussen"}},
        "bewirschaftung": {"fischereiausübungsberechtigter": "Angelverein Langenargen"},
    }

    await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": entwurf["version"], "antworten": antworten},
    )
    gelesen = await angemeldet.get(f"/api/v1/protokolle/{entwurf['id']}")

    assert gelesen.json()["antworten"] == antworten


async def test_das_gespeicherte_erscheint_in_der_liste(angemeldet: AsyncClient) -> None:
    """The five display values the list prints come out of the saved document."""
    entwurf = await neuer_entwurf(angemeldet)

    await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={
            "version": entwurf["version"],
            "antworten": {
                "datum": "2026-08-14",
                "probestrecke": {
                    "gewaesser": {"gewaessername": "Schussen"},
                    "ortsangabe": "Weißenau, oberhalb der Brücke",
                },
            },
        },
    )
    zeile = (await angemeldet.get("/api/v1/protokolle")).json()[0]

    assert zeile["gewaessername"] == "Schussen"
    assert zeile["ortsangabe"] == "Weißenau, oberhalb der Brücke"
    assert zeile["datum"] == "2026-08-14"


async def test_eine_veraltete_version_ist_409(angemeldet: AsyncClient) -> None:
    """The second of two open tabs is refused rather than winning silently."""
    entwurf = await neuer_entwurf(angemeldet)
    await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": entwurf["version"], "antworten": {"datum": "2026-08-14"}},
    )

    zweiter_tab = await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": entwurf["version"], "antworten": {"datum": "1999-01-01"}},
    )

    assert zweiter_tab.status_code == 409
    assert zweiter_tab.json()["code"] == "PROTOKOLL_VERAENDERT"
    gelesen = await angemeldet.get(f"/api/v1/protokolle/{entwurf['id']}")
    assert gelesen.json()["antworten"] == {"datum": "2026-08-14"}


async def test_ein_unbekanntes_feld_ist_422_und_aendert_nichts(
    angemeldet: AsyncClient,
) -> None:
    entwurf = await neuer_entwurf(angemeldet)
    await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": entwurf["version"], "antworten": {"datum": "2026-08-14"}},
    )

    abgelehnt = await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"version": 2, "antworten": {"lieblingsfarbe": "blau"}},
    )

    assert abgelehnt.status_code == 422
    assert abgelehnt.json()["code"] == "ANTWORTEN_UNGUELTIG"
    # The message names the field it refused, and nothing the person typed.
    assert "lieblingsfarbe" in abgelehnt.json()["nachricht"]
    assert "blau" not in abgelehnt.json()["nachricht"]
    gelesen = await angemeldet.get(f"/api/v1/protokolle/{entwurf['id']}")
    assert gelesen.json()["antworten"] == {"datum": "2026-08-14"}


async def test_eine_speicherung_ohne_version_wird_abgewiesen(
    angemeldet: AsyncClient,
) -> None:
    """A save with no version would be a save that wins every race.

    Which is exactly the thing the version exists to prevent, so it is required
    rather than optional.
    """
    entwurf = await neuer_entwurf(angemeldet)

    antwort = await angemeldet.put(
        f"/api/v1/protokolle/{entwurf['id']}/antworten",
        json={"antworten": {"datum": "2026-08-14"}},
    )

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"
    assert "version" in antwort.json()["nachricht"]


async def test_loeschen_entfernt_den_entwurf(angemeldet: AsyncClient) -> None:
    entwurf = await neuer_entwurf(angemeldet)

    geloescht = await angemeldet.delete(f"/api/v1/protokolle/{entwurf['id']}")

    assert geloescht.status_code == 204
    assert (await angemeldet.get(f"/api/v1/protokolle/{entwurf['id']}")).status_code == 404
    assert (await angemeldet.get("/api/v1/protokolle")).json() == []


async def test_ein_fremdes_protokoll_wird_weder_gespeichert_noch_geloescht(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The permission tests for writing, over HTTP.

    Both answer 404 rather than 403, for the same reason reading does: a 403
    would confirm the id is real.
    """
    await anlegen(email="keller@buero-keller.de")
    await anlegen(email="bergmann@ffs.de")

    await anmelden(email="keller@buero-keller.de")
    fremd = await neuer_entwurf(client)

    await anmelden(email="bergmann@ffs.de")
    gespeichert = await client.put(
        f"/api/v1/protokolle/{fremd['id']}/antworten",
        json={"version": fremd["version"], "antworten": {"datum": "1999-01-01"}},
    )
    geloescht = await client.delete(f"/api/v1/protokolle/{fremd['id']}")

    assert gespeichert.status_code == 404
    assert geloescht.status_code == 404

    await anmelden(email="keller@buero-keller.de")
    unveraendert = await client.get(f"/api/v1/protokolle/{fremd['id']}")
    assert unveraendert.status_code == 200
    assert unveraendert.json()["antworten"] == {}
