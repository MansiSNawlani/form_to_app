"""Attaching and listing, over HTTP, with a real session cookie and a real disk.

app/anlagen/regeln_test.py proves each rule where it lives. What is proved here
is that the rules survive the trip through HTTP and that nothing is stored when
one of them refuses: the right status code, the same 404 for a stranger's
protocol as for one that does not exist, and no file left behind by a refusal.

The speicher fixture in conftest.py points the store at a temporary directory,
the same way the session fixture points the database at a test database, so these
tests write real files and then take them away with them. Every test here asks
for it, because without it an upload would land in the developer's own uploads
directory.
"""

import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient, Response

from app.anlagen.regeln import MAX_BYTES, MAX_FOTOS
from app.anlagen.speicher import Anlagenspeicher
from app.models.benutzer import User

# Real signatures, so what is uploaded here is what the content check judges.
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64


@pytest_asyncio.fixture
async def protokoll(
    client: AsyncClient,
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> str:
    await anlegen(email="bergmann@ffs.de")
    await anmelden(email="bergmann@ffs.de")
    antwort = await client.post("/api/v1/protokolle")
    protokoll_id: str = antwort.json()["id"]
    return protokoll_id


async def lade_hoch(
    client: AsyncClient,
    protokoll_id: str,
    *,
    inhalt: bytes = JPEG,
    dateiname: str = "schussen.jpg",
    typ: str = "image/jpeg",
    art: str = "FOTO",
) -> Response:
    return await client.post(
        f"/api/v1/protokolle/{protokoll_id}/anlagen",
        data={"art": art},
        files={"datei": (dateiname, inhalt, typ)},
    )


async def test_ohne_anmeldung_keine_anlage(client: AsyncClient) -> None:
    """A survey photograph is no more public than the answers beside it."""
    protokoll_id = str(uuid.uuid4())

    hochgeladen = await lade_hoch(client, protokoll_id)
    gelistet = await client.get(f"/api/v1/protokolle/{protokoll_id}/anlagen")

    assert hochgeladen.status_code == 401
    assert gelistet.status_code == 401


async def test_haengt_ein_foto_an(
    client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
) -> None:
    antwort = await lade_hoch(client, protokoll)

    assert antwort.status_code == 201
    koerper = antwort.json()
    assert koerper["art"] == "FOTO"
    assert koerper["dateiname"] == "schussen.jpg"
    assert koerper["mime_type"] == "image/jpeg"
    assert koerper["groesse"] == len(JPEG)
    assert koerper["submission_id"] == protokoll
    # The file is really there, with the bytes that were sent.
    assert await speicher.lies(f"{protokoll}/{koerper['id']}") == JPEG


async def test_die_antwort_nennt_den_speicherort_nicht(
    client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
) -> None:
    """storage_key is a path, and a path a client knows is one it will bend."""
    koerper = (await lade_hoch(client, protokoll)).json()

    assert set(koerper) == {
        "id",
        "submission_id",
        "art",
        "dateiname",
        "mime_type",
        "groesse",
        "created_at",
    }


@pytest.mark.parametrize(
    ("inhalt", "typ", "erwartet"),
    [
        (JPEG, "image/jpeg", "image/jpeg"),
        (PNG, "image/png", "image/png"),
        (WEBP, "image/webp", "image/webp"),
    ],
)
async def test_nimmt_alle_drei_formate(
    client: AsyncClient,
    protokoll: str,
    speicher: Anlagenspeicher,
    inhalt: bytes,
    typ: str,
    erwartet: str,
) -> None:
    antwort = await lade_hoch(client, protokoll, inhalt=inhalt, typ=typ)

    assert antwort.status_code == 201
    assert antwort.json()["mime_type"] == erwartet


async def test_der_gespeicherte_typ_kommt_aus_den_bytes(
    client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
) -> None:
    """A photograph somebody renamed is stored as what it is, not as what it claims.

    This is the property that makes serving it safe later: the type we hand back
    was decided by the file's own contents rather than by whoever uploaded it.
    """
    antwort = await lade_hoch(client, protokoll, inhalt=JPEG, dateiname="foto.png", typ="image/png")

    assert antwort.status_code == 201
    assert antwort.json()["mime_type"] == "image/jpeg"


class TestAbgelehnt:
    """A refusal must leave the protocol exactly as it was, disk included."""

    async def test_ein_textdokument(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        antwort = await lade_hoch(
            client, protokoll, inhalt=b"Guten Tag", dateiname="notizen.txt", typ="text/plain"
        )

        assert antwort.status_code == 422
        assert antwort.json()["code"] == "ANLAGE_TYP_UNZULAESSIG"
        assert dateien() == []

    async def test_html_das_sich_jpeg_nennt(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        """The case the content check exists for.

        It passes the declared-type check, so without the signature check this
        would be stored and later served from our own origin, where it could read
        the session cookie of whoever opened it.
        """
        antwort = await lade_hoch(
            client,
            protokoll,
            inhalt=b"<!DOCTYPE html><script>fetch('/api/v1/protokolle')</script>",
            dateiname="karte.jpg",
            typ="image/jpeg",
        )

        assert antwort.status_code == 422
        assert antwort.json()["code"] == "ANLAGE_INHALT_KEIN_BILD"
        assert dateien() == []

    async def test_eine_leere_datei(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        """No signature fits in nothing, so an empty upload is a failed one."""
        antwort = await lade_hoch(client, protokoll, inhalt=b"")

        assert antwort.status_code == 422
        assert dateien() == []

    async def test_eine_zu_grosse_datei(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        """And nothing of it is kept, not even the part already written.

        The write is abandoned at the cap rather than after the whole file, which
        is what keeps one request from filling the volume before being refused.
        """
        zu_gross = JPEG + b"\x00" * (MAX_BYTES + 1 - len(JPEG))

        antwort = await lade_hoch(client, protokoll, inhalt=zu_gross)

        assert antwort.status_code == 413
        assert antwort.json()["code"] == "ANLAGE_ZU_GROSS"
        assert dateien() == []

    async def test_eine_unbekannte_art(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Refused by the enum before the route runs, and without quoting it back."""
        antwort = await lade_hoch(client, protokoll, art="VIDEO")

        assert antwort.status_code == 422
        assert "VIDEO" not in antwort.text

    async def test_ein_zweiter_kartenausschnitt(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        erste = await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")
        zweite = await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")

        assert erste.status_code == 201
        assert zweite.status_code == 409
        assert zweite.json()["code"] == "ANLAGENART_VOLL"

    async def test_das_einundzwanzigste_foto(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        for _ in range(MAX_FOTOS):
            assert (await lade_hoch(client, protokoll)).status_code == 201

        antwort = await lade_hoch(client, protokoll, dateiname="foto21.jpg")

        assert antwort.status_code == 409
        assert antwort.json()["code"] == "ANLAGENART_VOLL"
        assert "foto21.jpg" in antwort.json()["nachricht"]

    async def test_die_zahl_wird_pro_art_gezaehlt(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Twenty photographs must not use up the map excerpt's own slot."""
        for _ in range(MAX_FOTOS):
            await lade_hoch(client, protokoll)

        antwort = await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")

        assert antwort.status_code == 201


class TestListe:
    async def test_ist_leer_statt_kaputt(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """A protocol nobody attached anything to is ordinary, not an error."""
        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen")

        assert antwort.status_code == 200
        assert antwort.json() == []

    async def test_haelt_beide_arten_aelteste_zuerst(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Photographs keep the order they were added rather than shuffling.

        A sharper test than it looks. Every request in this suite runs inside one
        transaction, so all four rows would share a now() timestamp and the
        ordering would fall back to a random uuid. That is what caught the
        created_at default being wrong, and it is why this stays a regression
        guard rather than an obvious assertion.
        """
        namen = ["eins.jpg", "zwei.jpg", "drei.jpg"]
        for name in namen:
            await lade_hoch(client, protokoll, dateiname=name)
        await lade_hoch(client, protokoll, dateiname="karte.jpg", art="KARTENAUSSCHNITT")

        koerper = (await client.get(f"/api/v1/protokolle/{protokoll}/anlagen")).json()

        assert [eintrag["dateiname"] for eintrag in koerper] == [*namen, "karte.jpg"]

    async def test_traegt_keine_bytes(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Twenty photographs is 200 MB, and a list draws twenty headings."""
        await lade_hoch(client, protokoll)

        koerper = (await client.get(f"/api/v1/protokolle/{protokoll}/anlagen")).json()

        assert "datei" not in koerper[0]
        assert "storage_key" not in koerper[0]

    async def test_haelt_nur_die_dieses_protokolls(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        zweites: str = (await client.post("/api/v1/protokolle")).json()["id"]
        await lade_hoch(client, protokoll, dateiname="erstes.jpg")
        await lade_hoch(client, zweites, dateiname="zweites.jpg")

        koerper = (await client.get(f"/api/v1/protokolle/{zweites}/anlagen")).json()

        assert [eintrag["dateiname"] for eintrag in koerper] == ["zweites.jpg"]


class TestBerechtigung:
    """The tests coding-standards.md calls non-optional.

    A protocol belonging to somebody else answers 404 rather than 403, exactly as
    the protocol routes do. A 403 confirms the id is real, which is a fact about
    another surveyor's work that a stranger has no business collecting.
    """

    async def test_ein_fremdes_protokoll_nimmt_keine_anlage_an(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        anlegen: Callable[..., Awaitable[User]],
        anmelden: Callable[..., Awaitable[Response]],
        dateien: Callable[[], list[Path]],
    ) -> None:
        await anlegen(email="fremde@ffs.de")
        await anmelden(email="fremde@ffs.de")

        antwort = await lade_hoch(client, protokoll)

        assert antwort.status_code == 404
        assert antwort.json()["code"] == "PROTOKOLL_NICHT_GEFUNDEN"
        assert dateien() == []

    async def test_ein_fremdes_protokoll_zeigt_seine_anlagen_nicht(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        anlegen: Callable[..., Awaitable[User]],
        anmelden: Callable[..., Awaitable[Response]],
    ) -> None:
        await lade_hoch(client, protokoll, dateiname="geheim.jpg")
        await anlegen(email="fremde@ffs.de")
        await anmelden(email="fremde@ffs.de")

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen")

        assert antwort.status_code == 404
        assert "geheim.jpg" not in antwort.text

    async def test_ein_unbekanntes_protokoll_antwortet_genauso(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """The two must stay indistinguishable from outside."""
        erfunden = uuid.uuid4()

        antwort = await client.get(f"/api/v1/protokolle/{erfunden}/anlagen")

        assert antwort.status_code == 404
        assert antwort.json()["code"] == "PROTOKOLL_NICHT_GEFUNDEN"


class TestHerunterladen:
    """How a file comes back is a security decision, not a detail.

    A picture here was uploaded by somebody and is served from our own origin,
    where anything that executes can read the session cookie of whoever opened
    it. These are the three things standing between those facts.
    """

    async def test_gibt_die_gespeicherten_bytes_zurueck(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        anlage_id = (await lade_hoch(client, protokoll, inhalt=PNG, typ="image/png")).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        assert antwort.status_code == 200
        assert antwort.content == PNG

    async def test_der_typ_kommt_aus_der_spalte_nicht_aus_der_anfrage(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Uploaded as image/png, but the bytes are a JPEG, so it comes back as one.

        The type we hand a browser was decided by the file's own first bytes. That
        is what makes the other two headers a belt rather than the only rope.
        """
        anlage_id = (
            await lade_hoch(client, protokoll, inhalt=JPEG, dateiname="foto.png", typ="image/png")
        ).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        assert antwort.headers["content-type"] == "image/jpeg"

    async def test_traegt_nosniff_und_attachment(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """nosniff stops a browser deciding the file is really HTML.

        attachment means opening the address directly downloads rather than
        renders. A preview still works, because an <img> ignores the header.
        """
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        assert antwort.headers["x-content-type-options"] == "nosniff"
        assert antwort.headers["content-disposition"].startswith("attachment")

    async def test_ein_umlaut_im_dateinamen_ueberlebt(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """A header is Latin-1, so the name travels as percent-encoded UTF-8."""
        anlage_id = (await lade_hoch(client, protokoll, dateiname="Weißenau.jpg")).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        assert "Wei%C3%9Fenau.jpg" in antwort.headers["content-disposition"]

    async def test_ein_dateiname_kann_keinen_header_erfinden(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """A newline and a quote in a name would otherwise end the header early.

        Percent-encoding the whole name is one escape doing both jobs, rather
        than an escape plus a blocklist somebody has to keep in step.
        """
        boesartig = 'a"' + chr(13) + chr(10) + "Set-Cookie: x=y.jpg"
        anlage_id = (await lade_hoch(client, protokoll, dateiname=boesartig)).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        disposition = antwort.headers["content-disposition"]
        assert chr(10) not in disposition
        assert '"' not in disposition
        assert "set-cookie" not in {name.lower() for name in antwort.headers}

    async def test_eine_anlage_eines_anderen_protokolls_wird_nicht_ausgeliefert(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """The protocol in the address is not decoration.

        Without this check anybody could name their own protocol alongside
        somebody else's attachment id and be handed the file.
        """
        anderes: str = (await client.post("/api/v1/protokolle")).json()["id"]
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]

        antwort = await client.get(f"/api/v1/protokolle/{anderes}/anlagen/{anlage_id}/datei")

        assert antwort.status_code == 404
        assert antwort.json()["code"] == "ANLAGE_NICHT_GEFUNDEN"

    async def test_eine_zeile_ohne_datei_ist_ein_404_kein_500(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """A row can outlive its file, and that is admitted rather than hidden.

        A 500 would claim the server is broken when the honest answer is that the
        picture is gone.
        """
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]
        await speicher.loesche(f"{protokoll}/{anlage_id}")

        antwort = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")

        assert antwort.status_code == 404


class TestLoeschen:
    async def test_entfernt_die_zeile_und_die_datei(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]

        antwort = await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}")

        assert antwort.status_code == 204
        assert (await client.get(f"/api/v1/protokolle/{protokoll}/anlagen")).json() == []
        assert dateien() == []

    async def test_macht_platz_fuer_einen_neuen_kartenausschnitt(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """The way out the refusal message offers has to actually work."""
        erster = (await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")).json()["id"]
        await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{erster}")

        antwort = await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")

        assert antwort.status_code == 201

    async def test_eine_unbekannte_anlage_ist_ein_404(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        antwort = await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{uuid.uuid4()}")

        assert antwort.status_code == 404

    async def test_ein_fremdes_protokoll_gibt_seine_anlage_nicht_her(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        anlegen: Callable[..., Awaitable[User]],
        anmelden: Callable[..., Awaitable[Response]],
        dateien: Callable[[], list[Path]],
    ) -> None:
        """The permission test for deleting, and the worst of them if it failed."""
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]
        await anlegen(email="fremde@ffs.de")
        await anmelden(email="fremde@ffs.de")

        gelesen = await client.get(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}/datei")
        geloescht = await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}")

        assert gelesen.status_code == 404
        assert geloescht.status_code == 404
        # And the owner's picture is untouched.
        assert len(dateien()) == 1


async def test_ein_geloeschtes_protokoll_nimmt_seine_dateien_mit(
    client: AsyncClient,
    protokoll: str,
    speicher: Anlagenspeicher,
    dateien: Callable[[], list[Path]],
) -> None:
    """The note app/protokolle/dienst.py has carried since it was written.

    The rows go with the protocol through ON DELETE CASCADE, but a cascade knows
    nothing about the volume, so without the second half the pictures would stay
    there forever with nothing pointing at them.
    """
    await lade_hoch(client, protokoll, dateiname="eins.jpg")
    await lade_hoch(client, protokoll, dateiname="zwei.jpg")
    await lade_hoch(client, protokoll, art="KARTENAUSSCHNITT")
    assert len(dateien()) == 3

    antwort = await client.delete(f"/api/v1/protokolle/{protokoll}")

    assert antwort.status_code == 204
    assert dateien() == []


async def test_ein_geloeschtes_protokoll_laesst_die_anderen_in_ruhe(
    client: AsyncClient,
    protokoll: str,
    speicher: Anlagenspeicher,
    dateien: Callable[[], list[Path]],
) -> None:
    """A delete by directory must not reach past the protocol it was asked about."""
    anderes: str = (await client.post("/api/v1/protokolle")).json()["id"]
    await lade_hoch(client, protokoll, dateiname="geht.jpg")
    await lade_hoch(client, anderes, dateiname="bleibt.jpg")

    await client.delete(f"/api/v1/protokolle/{protokoll}")

    assert len(dateien()) == 1
    liste = (await client.get(f"/api/v1/protokolle/{anderes}/anlagen")).json()
    assert liste[0]["dateiname"] == "bleibt.jpg"


class TestZuletztBearbeitet:
    """An attached photograph counts as working on the protocol.

    Found on 2026-09-11 by trying the built feature. Meine Protokolle heads each
    row with "Zuletzt bearbeitet" and sorts on it, and adding twenty photographs
    left a protocol claiming it had last been touched that morning, below
    protocols nobody had opened in days.

    The timestamp is maintained by onupdate on the submissions row, and an
    attachment is a row in another table, so nothing about writing one touched
    it.
    """

    async def test_ein_neues_foto_macht_das_protokoll_frisch_bearbeitet(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        vorher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]

        await lade_hoch(client, protokoll)

        nachher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]
        assert nachher > vorher

    async def test_ein_entferntes_foto_ebenso(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """Removing one is working on the protocol just as plainly as adding one."""
        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]
        vorher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]

        await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}")

        nachher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]
        assert nachher > vorher

    async def test_keine_von_beiden_erhoeht_die_version(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """The one thing this must not do.

        version exists so two open tabs cannot overwrite each other's answers. A
        photograph changes no answer, so raising it would make the form open in
        another tab fail its next save with a conflict that is not real.
        """
        vorher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["version"]

        anlage_id = (await lade_hoch(client, protokoll)).json()["id"]
        nach_anlegen = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["version"]

        await client.delete(f"/api/v1/protokolle/{protokoll}/anlagen/{anlage_id}")
        nach_loeschen = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["version"]

        assert nach_anlegen == vorher
        assert nach_loeschen == vorher

    async def test_ein_foto_holt_das_protokoll_an_die_spitze_der_liste(
        self, client: AsyncClient, protokoll: str, speicher: Anlagenspeicher
    ) -> None:
        """The point of the whole step: the list is sorted by that timestamp.

        Attaching a photograph has to bring the protocol back to the top, or
        somebody who has just spent ten minutes on it has to go looking for it.

        **Deliberately no assertion about the order before the upload.** Both
        protocols are created inside this test's one transaction, and
        submissions.updated_at is now(), which is the moment the transaction
        began: the two timestamps are identical to the microsecond and the
        tie-break is Submission.id, a random uuid. Asserting an order there is a
        coin toss, which is exactly how this test failed once before it was
        written this way.

        What comes after is not a coin toss. beruehre() stamps with
        clock_timestamp(), the real moment, which is strictly later than the
        transaction's own now(), so the protocol that got the photograph sorts
        first however the two ids fell.
        """
        zweites: str = (await client.post("/api/v1/protokolle")).json()["id"]

        await lade_hoch(client, protokoll)

        assert [zeile["id"] for zeile in (await client.get("/api/v1/protokolle")).json()] == [
            protokoll,
            zweites,
        ]

    async def test_eine_abgelehnte_datei_macht_nichts_frisch(
        self,
        client: AsyncClient,
        protokoll: str,
        speicher: Anlagenspeicher,
        dateien: Callable[[], list[Path]],
    ) -> None:
        """Nothing was stored, so nothing was worked on.

        A refusal moving the timestamp would tell somebody they had edited a
        protocol at a moment when the application had just told them they had not.
        """
        vorher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]

        await lade_hoch(
            client, protokoll, inhalt=b"Guten Tag", dateiname="notizen.txt", typ="text/plain"
        )

        nachher = (await client.get(f"/api/v1/protokolle/{protokoll}")).json()["updated_at"]
        assert nachher == vorher
        assert dateien() == []
