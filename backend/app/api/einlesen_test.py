"""Importing a protocol over HTTP, with a real session cookie and real files.

`app/protokolle/einlesen/dienst_test.py` proves what an import produces. What is
proved here is that it survives the trip through HTTP: that the route is behind a
session like every other protocol route, that each refusal arrives with the right
status and a message somebody can act on, and that a refusal stores nothing.

The refusal tests read the message as well as the code, because the whole point
of keeping five refusals apart rather than answering "bad file" five times is
that each one tells the person something different to try. A test that only
checked the status would let all five collapse into the same sentence without
noticing.
"""

from collections.abc import Awaitable, Callable

import pytest
import pytest_asyncio
from httpx import AsyncClient, Response

from app.formular.beispiele import (
    FEHLT,
    formular_bytes,
    gefuellt,
    krebs_bytes,
    mit_bild,
    mit_zusatzfeld,
    ohne_feld,
    vorhanden,
)
from app.models.benutzer import User
from app.protokolle.einlesen.beispiele import als_formularwerte
from app.protokolle.einlesen.dienst import MAX_PDF_BYTES
from app.protokolle.formregeln.beispiele import VOLLSTAENDIG

pytestmark = pytest.mark.skipif(not vorhanden(), reason=FEHLT)


@pytest_asyncio.fixture
async def angemeldet(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")


async def lies_ein(
    client: AsyncClient,
    inhalt: bytes,
    *,
    dateiname: str = "protokoll.pdf",
    typ: str = "application/pdf",
) -> Response:
    return await client.post(
        "/api/v1/protokolle/einlesen",
        files={"datei": (dateiname, inhalt, typ)},
    )


async def test_ein_hochgeladenes_protokoll_wird_ein_entwurf(
    client: AsyncClient, angemeldet: None
) -> None:
    """201 with the whole draft, so the browser can go straight to the form."""
    antwort = await lies_ein(client, gefuellt(als_formularwerte(VOLLSTAENDIG)))

    assert antwort.status_code == 201
    koerper = antwort.json()
    assert koerper["protokoll"]["id"]
    assert koerper["protokoll"]["status"] == "DRAFT"
    assert koerper["protokoll"]["eingereicht_von"] == "bergmann@ffs.de"
    assert koerper["bericht"]["verstoesse"] == []


async def test_das_neue_protokoll_ist_danach_abrufbar(
    client: AsyncClient, angemeldet: None
) -> None:
    """The id that comes back is a real protocol, not only an answer.

    The import goes through the ordinary save path rather than around it, and
    this is what says so from the outside: what was stored is readable by the
    route that reads any other protocol.
    """
    angelegt = await lies_ein(client, gefuellt(als_formularwerte(VOLLSTAENDIG)))
    protokoll_id = angelegt.json()["protokoll"]["id"]

    gelesen = await client.get(f"/api/v1/protokolle/{protokoll_id}")

    assert gelesen.status_code == 200
    assert gelesen.json()["antworten"] == angelegt.json()["protokoll"]["antworten"]


async def test_ohne_anmeldung_geht_nichts(client: AsyncClient) -> None:
    """A protocol is somebody's work whichever door it comes in through."""
    antwort = await lies_ein(client, formular_bytes())

    assert antwort.status_code == 401


async def test_etwas_das_keine_pdf_ist(client: AsyncClient, angemeldet: None) -> None:
    antwort = await lies_ein(client, b"Das ist keine PDF.", dateiname="urlaubsfoto.jpg")

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "PDF_NICHT_LESBAR"
    # The filename leads the message: it is what the person will look for on
    # their own machine. Nothing else from the file is ever quoted back.
    assert antwort.json()["nachricht"].startswith("urlaubsfoto.jpg: ")


async def test_ein_krebsprotokoll_sagt_was_es_ist(
    client: AsyncClient, angemeldet: None
) -> None:
    """Not "invalid form". The message names the form it probably is.

    The one refusal somebody will hit by picking the neighbouring file out of the
    same folder, so it is the one where saying what the file is saves a support
    call.
    """
    antwort = await lies_ein(client, krebs_bytes(), dateiname="krebs.pdf")

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "KEIN_BEFISCHUNGSFORMULAR"
    assert "Protokoll Krebs" in antwort.json()["nachricht"]


async def test_eine_datei_ohne_versionsangabe(client: AsyncClient, angemeldet: None) -> None:
    """Its own wording, and its own way out.

    A different sentence from the crayfish one on purpose: this file may well be
    the right protocol, run through the wrong program, and what the person has to
    do about it is different.
    """
    antwort = await lies_ein(client, ohne_feld("version"))

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "FORMULARVERSION_FEHLT"


async def test_eine_zu_grosse_datei(client: AsyncClient, angemeldet: None) -> None:
    """413, and the message says how big is too big and what usually causes it.

    Thirty megabytes of nothing in particular. The read stops at the cap, so the
    rest of it is never taken and the refusal never names a size we measured.
    """
    antwort = await lies_ein(client, b"%PDF-1.7\n" + b"\0" * (30 * 1024 * 1024))

    assert antwort.status_code == 413
    assert antwort.json()["code"] == "DATEI_ZU_GROSS"
    assert "25 MB" in antwort.json()["nachricht"]


async def test_die_grenze_selbst_geht_noch_durch(client: AsyncClient, angemeldet: None) -> None:
    """A file exactly at the cap is not over it.

    Refused for what it is rather than for its size, which is what proves the
    comparison is not off by one: 25 MB of rubbish reaches the reader.
    """
    antwort = await lies_ein(client, b"%PDF-1.7\n".ljust(MAX_PDF_BYTES, b"\0"))

    assert antwort.status_code == 422


async def test_eine_abgelehnte_datei_legt_kein_protokoll_an(
    client: AsyncClient, angemeldet: None
) -> None:
    """The refusal is the whole of what happens.

    Proved from outside the service, over the list route, because that is what a
    surveyor would actually see: a failed upload must not leave an empty protocol
    in Meine Protokolle for them to wonder about.
    """
    await lies_ein(client, krebs_bytes())

    assert (await client.get("/api/v1/protokolle")).json() == []


async def test_ein_unbekanntes_feld_steht_nicht_in_der_antwort(
    client: AsyncClient, angemeldet: None
) -> None:
    """The report carries three things, and this is deliberately not one of them.

    A field the file holds that this application has no home for means our form
    definition and the file disagree. Nobody uploading a protocol can act on
    that, and this project's rule is that a message somebody sees has to tell
    them what to do, so it is logged instead. The protocol is imported all the
    same.
    """
    antwort = await lies_ein(client, mit_zusatzfeld("neue_frage", "eine Antwort"))

    assert antwort.status_code == 201
    assert set(antwort.json()["bericht"]) == {
        "quellversion",
        "unbrauchbar",
        "bilder",
        "verstoesse",
    }


async def test_die_bilder_der_datei_werden_gemeldet(
    client: AsyncClient, angemeldet: None
) -> None:
    """Beside the violations, not among them.

    An attachment is part of the protocol, so a surveyor whose map excerpt did
    not come across has to be told rather than left to notice.
    """
    antwort = await lies_ein(client, mit_bild("fotos.kartenausschnitt_image"))

    assert antwort.json()["bericht"]["bilder"] == 1
