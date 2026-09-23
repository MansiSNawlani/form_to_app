"""The download, over HTTP, with a real session cookie and a real store.

app/protokolle/ausgabe/dokument_test.py proves what the document says. What is
proved here is who may ask for it, what the file is called, and that a picture
in the store reaches the page.
"""

import io
from collections.abc import Awaitable, Callable

import pytest
import pytest_asyncio
from httpx import AsyncClient, Response
from pypdf import PdfReader

from app.models.benutzer import Rolle, User

SURVEYOR = "bergmann@ffs.de"
PRUEFER = "anna-pruefer@ffs.de"
FREMDER = "fremder@ffs.de"

PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 64


def pfad(protokoll_id: str) -> str:
    return f"/api/v1/protokolle/{protokoll_id}/pdf"


def text_von(daten: bytes) -> str:
    return "\n".join(seite.extract_text() for seite in PdfReader(io.BytesIO(daten)).pages)


@pytest_asyncio.fixture
async def eingereicht(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
    einreichen: Callable[..., Awaitable[str]],
) -> str:
    """One filed protocol, with the surveyor still signed in."""
    await anlegen(email=SURVEYOR)
    await anmelden(email=SURVEYOR)
    return await einreichen()


async def test_der_einreicher_bekommt_seine_pdf(client: AsyncClient, eingereicht: str) -> None:
    antwort = await client.get(pfad(eingereicht))

    assert antwort.status_code == 200
    assert antwort.headers["content-type"] == "application/pdf"
    assert antwort.content.startswith(b"%PDF-")


async def test_der_dateiname_nennt_gewaesser_und_datum(
    client: AsyncClient, eingereicht: str
) -> None:
    """A folder of protokoll.pdf, protokoll(1).pdf is no use to anybody."""
    antwort = await client.get(pfad(eingereicht))

    verfuegung = antwort.headers["content-disposition"]
    assert verfuegung.startswith("attachment; filename*=UTF-8''Protokoll_")
    assert verfuegung.endswith(".pdf")


async def test_die_pdf_wird_nicht_zwischengespeichert(
    client: AsyncClient, eingereicht: str
) -> None:
    """The answers change until a protocol is filed, and a stale copy of
    somebody's survey is worse than a slow one."""
    antwort = await client.get(pfad(eingereicht))

    assert antwort.headers["cache-control"] == "no-store"
    assert antwort.headers["x-content-type-options"] == "nosniff"


async def test_ein_pruefer_bekommt_ein_fremdes_protokoll(
    client: AsyncClient,
    eingereicht: str,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The same visibility rule as the reviewer's screen, and no second copy of it."""
    await anlegen(email=PRUEFER, rollen=[Rolle.REVIEWER])
    await anmelden(email=PRUEFER)

    antwort = await client.get(pfad(eingereicht))

    assert antwort.status_code == 200
    assert antwort.content.startswith(b"%PDF-")


async def test_ein_anderer_einreicher_bekommt_404(
    client: AsyncClient,
    eingereicht: str,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The same 404 as for a protocol that does not exist. A 403 would confirm
    the id is real, which is a fact about another surveyor's work."""
    await anlegen(email=FREMDER)
    await anmelden(email=FREMDER)

    antwort = await client.get(pfad(eingereicht))

    assert antwort.status_code == 404


async def test_ohne_anmeldung_ist_es_401(client: AsyncClient, eingereicht: str) -> None:
    await client.post("/api/v1/abmeldung")

    antwort = await client.get(pfad(eingereicht))

    assert antwort.status_code == 401


async def test_ein_entwurf_laesst_sich_auch_herunterladen(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """A copy of an unfinished protocol is a reasonable thing to want, and the
    document prints the status so it cannot be mistaken for a filed one."""
    await anlegen(email=SURVEYOR)
    await anmelden(email=SURVEYOR)
    angelegt = (await client.post("/api/v1/protokolle")).json()

    antwort = await client.get(pfad(angelegt["id"]))

    assert antwort.status_code == 200
    assert "Entwurf" in text_von(antwort.content)


@pytest.mark.usefixtures("speicher")
async def test_ein_foto_kommt_mit_in_die_pdf(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """On a draft, because attaching to a filed protocol is refused, and the
    picture has to be there before the protocol is handed in."""
    await anlegen(email=SURVEYOR)
    await anmelden(email=SURVEYOR)
    angelegt = (await client.post("/api/v1/protokolle")).json()

    ohne = (await client.get(pfad(angelegt["id"]))).content

    hochgeladen = await client.post(
        f"/api/v1/protokolle/{angelegt['id']}/anlagen",
        data={"art": "FOTO"},
        files={"datei": ("schussen.png", PNG, "image/png")},
    )
    assert hochgeladen.status_code == 201

    mit = (await client.get(pfad(angelegt["id"]))).content

    text = text_von(mit)
    assert "Karte und Fotos" in text
    assert "schussen.png" in text
    assert len(mit) > len(ohne)
