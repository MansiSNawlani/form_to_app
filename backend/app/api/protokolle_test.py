"""The protocol routes, over HTTP, with a real session cookie.

app/protokolle/dienst_test.py proves the ownership rule at the layer it lives in.
What is proved here is that the rule survives the trip through HTTP: the right
status code, the same 404 for a stranger's protocol as for one that does not
exist, and no answers reaching anybody who should not have them.
"""

import uuid
from collections.abc import Awaitable, Callable

from httpx import AsyncClient, Response
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncConnection

from app.formular.felder import formular
from app.models.benutzer import Rolle, User
from app.models.protokoll import Status


async def test_ohne_anmeldung_kein_protokoll(client: AsyncClient) -> None:
    """There is no anonymous access to a protocol of any kind."""
    angelegt = await client.post("/api/v1/protokolle")
    gelesen = await client.get(f"/api/v1/protokolle/{uuid.uuid4()}")

    assert angelegt.status_code == 401
    assert angelegt.json()["code"] == "NICHT_ANGEMELDET"
    assert gelesen.status_code == 401


async def test_legt_ein_leeres_protokoll_an(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")

    antwort = await client.post("/api/v1/protokolle")

    assert antwort.status_code == 201
    koerper = antwort.json()
    assert koerper["status"] == Status.DRAFT.value
    assert koerper["antworten"] == {}
    assert koerper["version"] == 1
    assert koerper["form_version"] == formular().version
    assert uuid.UUID(koerper["id"])


async def test_die_antwort_zaehlt_ihre_felder_auf(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The response model lists its fields, so nothing appears here by itself.

    This used to assert that the owner was absent, on the grounds that every
    route answering with this model had already filtered on the caller. Feature
    11d ended that reasoning and feature 11e needs the envelope for the reviewer's
    summary bar, so the owner is now here on purpose. What the test still guards
    is the other half: a column added to submissions later must not turn up in an
    API response without somebody deciding it should.
    """
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")

    koerper = (await client.post("/api/v1/protokolle")).json()

    assert set(koerper) == {
        "id",
        "status",
        "form_version",
        "version",
        "antworten",
        "created_at",
        "updated_at",
        "eingereicht_von",
        "submitted_at",
        "locked_at",
        "bearbeiter_name",
        "anlass",
        "regierungspraesidium",
    }


async def test_ein_entwurf_traegt_nur_seinen_einreicher(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """Nothing in the envelope exists yet except who started it.

    A draft has no Probestrecke, because feature 11b matches one at submit, and it
    has been handed in to nobody. Every one of these is filled in by an action
    that has not happened.
    """
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    angelegt = (await client.post("/api/v1/protokolle")).json()

    koerper = (await client.get(f"/api/v1/protokolle/{angelegt['id']}")).json()

    assert koerper["eingereicht_von"] == "bergmann@ffs.de"
    assert koerper["submitted_at"] is None
    assert koerper["locked_at"] is None
    assert koerper["bearbeiter_name"] is None
    assert koerper["anlass"] is None
    assert koerper["regierungspraesidium"] is None


async def test_liest_das_eigene_protokoll_zurueck(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    angelegt = (await client.post("/api/v1/protokolle")).json()

    antwort = await client.get(f"/api/v1/protokolle/{angelegt['id']}")

    assert antwort.status_code == 200
    assert antwort.json() == angelegt


async def test_ein_unbekanntes_protokoll_ist_404(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")

    antwort = await client.get(f"/api/v1/protokolle/{uuid.uuid4()}")

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "PROTOKOLL_NICHT_GEFUNDEN"


async def test_eine_unlesbare_id_ist_kein_serverfehler(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """A path that is not a uuid at all is a bad request, not a crash."""
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")

    antwort = await client.get("/api/v1/protokolle/kein-uuid")

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"


async def test_ein_einreicher_bekommt_das_protokoll_eines_anderen_nicht(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The permission test, over HTTP.

    The answer is a 404 and not a 403, so it is the same answer an id that never
    existed gets. A 403 would confirm the id is real, and somebody could collect
    which surveys exist by trying ids and watching which refusal came back.
    """
    await anlegen(email="keller@buero-keller.de")
    await anlegen(email="bergmann@ffs.de")

    await anmelden(email="keller@buero-keller.de")
    fremd = (await client.post("/api/v1/protokolle")).json()

    await anmelden(email="bergmann@ffs.de")
    antwort = await client.get(f"/api/v1/protokolle/{fremd['id']}")

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "PROTOKOLL_NICHT_GEFUNDEN"
    # The refusal carries no trace of the protocol it refused.
    assert fremd["id"] not in antwort.text


async def test_ohne_anmeldung_keine_liste(client: AsyncClient) -> None:
    antwort = await client.get("/api/v1/protokolle")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "NICHT_ANGEMELDET"


async def test_die_liste_eines_neuen_kontos_ist_leer(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")

    antwort = await client.get("/api/v1/protokolle")

    assert antwort.status_code == 200
    assert antwort.json() == []


async def test_die_liste_traegt_keine_antworten(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """Twenty protocols of 338 answers each is a large response for a table.

    The five display values are read out of the document in the query, so the
    document itself never crosses the wire for a list.
    """
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    await client.post("/api/v1/protokolle")

    zeile = (await client.get("/api/v1/protokolle")).json()[0]

    assert "antworten" not in zeile
    assert set(zeile) == {
        "id",
        "status",
        "form_version",
        "version",
        "created_at",
        "updated_at",
        "gewaessername",
        "ortsangabe",
        "laenge",
        "datum",
        "anlass",
    }


async def test_die_liste_zeigt_die_protokolle_anderer_nicht(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The permission test for the list, over HTTP.

    Worse than a leak on one protocol if it went wrong: this hands over every
    survey at once rather than the one whose id somebody guessed.
    """
    await anlegen(email="keller@buero-keller.de")
    await anlegen(email="bergmann@ffs.de")

    await anmelden(email="keller@buero-keller.de")
    fremd = (await client.post("/api/v1/protokolle")).json()

    await anmelden(email="bergmann@ffs.de")
    eigen = (await client.post("/api/v1/protokolle")).json()
    antwort = await client.get("/api/v1/protokolle")

    assert [zeile["id"] for zeile in antwort.json()] == [eigen["id"]]
    assert fremd["id"] not in antwort.text


async def test_ein_eingereichtes_protokoll_traegt_seinen_umschlag(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
    einreichen: Callable[..., Awaitable[str]],
) -> None:
    """Everything the reviewer's summary bar prints, off a really submitted protocol.

    Handed in through the real endpoints rather than written as a row, so the
    Probestrecke behind it is the one feature 11b's matching created and the
    Regierungspraesidium is the one it read out of the answers.
    """
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    protokoll_id = await einreichen()

    koerper = (await client.get(f"/api/v1/protokolle/{protokoll_id}")).json()

    assert koerper["eingereicht_von"] == "bergmann@ffs.de"
    assert koerper["submitted_at"] is not None
    assert koerper["bearbeiter_name"] == "Dr. Anne Krüger"
    assert koerper["anlass"] == "wrrl"
    assert koerper["regierungspraesidium"] == 4
    # Nothing has been decided, so nothing has locked it.
    assert koerper["locked_at"] is None


async def test_eine_pruefende_liest_denselben_umschlag(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
    einreichen: Callable[..., Awaitable[str]],
) -> None:
    """The envelope is the same for somebody who did not file it.

    The point of the whole field set: a reviewer opening a protocol has to be told
    whose it is, and this is the only place they are told.
    """
    await anlegen(email="bergmann@ffs.de")
    await anlegen(email="lehmann@ffs.de", rollen=(Rolle.REVIEWER,))

    await anmelden(email="bergmann@ffs.de")
    protokoll_id = await einreichen()

    await anmelden(email="lehmann@ffs.de")
    antwort = await client.get(f"/api/v1/protokolle/{protokoll_id}")

    assert antwort.status_code == 200
    koerper = antwort.json()
    assert koerper["eingereicht_von"] == "bergmann@ffs.de"
    assert koerper["regierungspraesidium"] == 4
    assert koerper["bearbeiter_name"] == "Dr. Anne Krüger"


async def test_das_protokoll_wird_in_einer_abfrage_gelesen(
    client: AsyncClient,
    connection: AsyncConnection,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
    einreichen: Callable[..., Awaitable[str]],
) -> None:
    """The owner and the Probestrecke are joined in, not read off afterwards.

    Reading protokoll.owner.email after the load would be a lazy load, and a lazy
    load in async context surfaces as a MissingGreenlet error rather than as
    anything about protocols. Counting the statements is what keeps a later
    reading route from quietly reintroducing one.
    """
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    protokoll_id = await einreichen()

    anweisungen: list[str] = []

    def _mitschreiben(
        conn: object, cursor: object, statement: str, *rest: object
    ) -> None:
        anweisungen.append(statement)

    ziel = connection.sync_connection
    assert ziel is not None
    event.listen(ziel, "before_cursor_execute", _mitschreiben)
    try:
        antwort = await client.get(f"/api/v1/protokolle/{protokoll_id}")
    finally:
        event.remove(ziel, "before_cursor_execute", _mitschreiben)

    assert antwort.status_code == 200
    gelesen = [
        anweisung
        for anweisung in anweisungen
        if "FROM submissions" in anweisung or "FROM probestrecken" in anweisung
    ]
    assert len(gelesen) == 1, anweisungen
