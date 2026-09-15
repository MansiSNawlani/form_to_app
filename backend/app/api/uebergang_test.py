"""The reviewer's routes over HTTP.

app/protokolle/uebergang/ proves the rules and the writing where they live. What
is proved here is the trip through HTTP: the status codes, who is let through,
and the shape of the two things the browser draws, which are the decision's
answer and the Verlauf.

**The permission tests are the point of this file.** coding-standards.md calls
them not optional, and this is the feature they matter most in: every refusal
here is the difference between a survey record being decided by the right person
and by anybody who found the URL.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response

from app.models.benutzer import Rolle, User
from app.protokolle.formregeln.beispiele import VOLLSTAENDIG

BEGRUENDUNG = "Bitte die Leitfaehigkeit nachtragen, das Feld ist leer geblieben."

# Enough of a JPEG for the attachment route to reach its ownership check. Written
# from hex rather than as escapes so the header stays readable as a signature.
JPEG = bytes.fromhex("ffd8ffe00010") + b"JFIF" + bytes.fromhex("0001") + bytes(64)

EINREICHER = "bergmann@ffs.de"
PRUEFERIN = "lehmann@ffs.de"


@pytest.fixture
def konten(anlegen: Callable[..., Awaitable[User]]) -> Callable[..., Awaitable[User]]:
    """Whoever a test needs, created on demand."""
    return anlegen


@pytest.fixture
def als(
    client: AsyncClient, anmelden: Callable[..., Awaitable[Response]]
) -> Callable[[str], Awaitable[AsyncClient]]:
    """Sign the one client in as somebody.

    One client throughout, signed in and out again, because the cookie is what
    carries the session and a second client would need a second cookie jar for no
    gain.
    """

    async def _als(email: str) -> AsyncClient:
        await anmelden(email=email)
        return client

    return _als


async def _eingereicht(client: AsyncClient) -> str:
    """A protocol handed in by whoever is signed in, through the real endpoints."""
    angelegt = (await client.post("/api/v1/protokolle")).json()
    gespeichert = await client.put(
        f"/api/v1/protokolle/{angelegt['id']}/antworten",
        json={"version": angelegt["version"], "antworten": dict(VOLLSTAENDIG)},
    )
    abgesendet = await client.post(
        f"/api/v1/protokolle/{angelegt['id']}/absenden",
        json={"version": gespeichert.json()["version"]},
    )
    assert abgesendet.status_code == 200
    return str(angelegt["id"])


@pytest.fixture
async def protokoll(
    konten: Callable[..., Awaitable[User]], als: Callable[[str], Awaitable[AsyncClient]]
) -> str:
    """One submitted protocol, filed by an ordinary submitter.

    The reviewer account is created here too, so every test can simply sign in as
    one or the other.
    """
    await konten(email=EINREICHER)
    await konten(email=PRUEFERIN, rollen=(Rolle.REVIEWER,))
    return await _eingereicht(await als(EINREICHER))


async def test_ohne_anmeldung_entscheidet_niemand(client: AsyncClient) -> None:
    antwort = await client.post(
        f"/api/v1/protokolle/{uuid.uuid4()}/entscheidung",
        json={"entscheidung": "ANNEHMEN"},
    )

    assert antwort.status_code == 401


@pytest.mark.parametrize(
    ("entscheidung", "erwartet"),
    [
        ("ANNEHMEN", "LOCKED"),
        ("AENDERUNG_ANFORDERN", "NEEDS_CHANGES"),
        ("ABLEHNEN", "REJECTED"),
    ],
)
async def test_jede_entscheidung_kommt_mit_ihrem_status_zurueck(
    protokoll: str,
    als: Callable[[str], Awaitable[AsyncClient]],
    entscheidung: str,
    erwartet: str,
) -> None:
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": entscheidung, "kommentar": BEGRUENDUNG},
    )

    assert antwort.status_code == 200
    assert antwort.json()["status"] == erwartet


async def test_annehmen_meldet_den_sperrzeitpunkt(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The browser needs it: accepted and locked are one action, and the screen
    says when."""
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung", json={"entscheidung": "ANNEHMEN"}
    )

    assert antwort.json()["locked_at"] is not None


async def test_in_pruefung_nehmen_braucht_keinen_koerper(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(f"/api/v1/protokolle/{protokoll}/pruefung")

    assert antwort.status_code == 200
    assert antwort.json()["status"] == "IN_REVIEW"


async def test_ein_zweiter_entscheid_ist_ein_konflikt(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """Two reviewers with the same protocol open, or one impatient one."""
    pruefer = await als(PRUEFERIN)
    await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung", json={"entscheidung": "ANNEHMEN"}
    )

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "ABLEHNEN", "kommentar": BEGRUENDUNG},
    )

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "UEBERGANG_NICHT_MOEGLICH"


@pytest.mark.parametrize("entscheidung", ["AENDERUNG_ANFORDERN", "ABLEHNEN"])
async def test_ohne_begruendung_wird_nicht_abgewiesen(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]], entscheidung: str
) -> None:
    """The surveyor reads that text and learns from nothing else what to do."""
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung", json={"entscheidung": entscheidung}
    )

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "BEGRUENDUNG_FEHLT"


async def test_eine_begruendung_ueber_der_grenze_wird_abgewiesen(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """Anything near four thousand characters is a pasted document."""
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "ABLEHNEN", "kommentar": "x" * 4001},
    )

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "ANFRAGE_UNGUELTIG"


async def test_absenden_ist_keine_entscheidung(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The route takes the three decisions and not the whole Aktion enum, so a
    client cannot reach the owner's transition through the reviewer's door."""
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung", json={"entscheidung": "ABSENDEN"}
    )

    assert antwort.status_code == 422


@pytest.mark.parametrize("rollen", [(Rolle.SUBMITTER,), (Rolle.DATA_STEWARD,)])
async def test_wer_nicht_pruefen_darf_bekommt_403(
    protokoll: str,
    konten: Callable[..., Awaitable[User]],
    als: Callable[[str], Awaitable[AsyncClient]],
    rollen: tuple[Rolle, ...],
) -> None:
    """A Data Steward may read a submitted protocol and may not decide on it."""
    await konten(email="kern@ffs.de", rollen=rollen)
    fremder = await als("kern@ffs.de")

    antwort = await fremder.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung", json={"entscheidung": "ANNEHMEN"}
    )

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "ROLLE_FEHLT"


async def test_niemand_entscheidet_ueber_sein_eigenes(
    konten: Callable[..., Awaitable[User]], als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """Somebody who reviews and also fishes. Chosen with the user on 2026-09-14.

    403 rather than 404: this is a protocol they may perfectly well read, and
    pretending it does not exist would be a riddle rather than a refusal.
    """
    await konten(email=PRUEFERIN, rollen=(Rolle.REVIEWER, Rolle.SUBMITTER))
    pruefer = await als(PRUEFERIN)
    eigenes = await _eingereicht(pruefer)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{eigenes}/entscheidung", json={"entscheidung": "ANNEHMEN"}
    )

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "EIGENES_PROTOKOLL"


async def test_ein_unbekanntes_protokoll_ist_nicht_gefunden(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{uuid.uuid4()}/entscheidung", json={"entscheidung": "ANNEHMEN"}
    )

    assert antwort.status_code == 404


async def test_ein_pruefer_darf_ein_eingereichtes_protokoll_lesen(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """Feature 11d widened this. A reviewer who cannot read a protocol cannot
    decide on it."""
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.get(f"/api/v1/protokolle/{protokoll}")

    assert antwort.status_code == 200
    assert antwort.json()["status"] == "SUBMITTED"


async def test_ein_pruefer_sieht_den_entwurf_eines_anderen_nicht(
    konten: Callable[..., Awaitable[User]], als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The line the widening must not cross.

    A draft is somebody's unfinished work, seen by nobody else, which is what
    CONTEXT.md says a draft is. The answer is the same 404 a stranger gets for an
    id that does not exist, so nobody can map out which ids are real.
    """
    await konten(email=EINREICHER)
    await konten(email=PRUEFERIN, rollen=(Rolle.REVIEWER,))
    einreicher = await als(EINREICHER)
    entwurf = (await einreicher.post("/api/v1/protokolle")).json()["id"]

    pruefer = await als(PRUEFERIN)
    antwort = await pruefer.get(f"/api/v1/protokolle/{entwurf}")

    assert antwort.status_code == 404


async def test_ein_fremder_einreicher_sieht_weiterhin_nichts(
    protokoll: str,
    konten: Callable[..., Awaitable[User]],
    als: Callable[[str], Awaitable[AsyncClient]],
) -> None:
    """Widening it for FFS staff must not have widened it for everybody."""
    await konten(email="fremd@example.org")
    fremder = await als("fremd@example.org")

    antwort = await fremder.get(f"/api/v1/protokolle/{protokoll}")

    assert antwort.status_code == 404


async def test_ein_pruefer_darf_ein_fremdes_protokoll_nicht_speichern(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """Reading and writing were widened apart deliberately.

    hole_sichtbares_protokoll is a second loader rather than a wider clause on the
    first, precisely so that this stays a 404.
    """
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.put(
        f"/api/v1/protokolle/{protokoll}/antworten",
        json={"version": 2, "antworten": {"anlass": "wrrl"}},
    )

    assert antwort.status_code == 404


async def test_ein_pruefer_darf_ein_fremdes_protokoll_nicht_loeschen(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.delete(f"/api/v1/protokolle/{protokoll}")

    assert antwort.status_code == 404


async def test_der_verlauf_kommt_neueste_zuerst(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The order the reviewer mockup prints it in, and the order anybody reads a
    history: what happened last is what you need."""
    pruefer = await als(PRUEFERIN)
    await pruefer.post(f"/api/v1/protokolle/{protokoll}/pruefung")
    await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "AENDERUNG_ANFORDERN", "kommentar": BEGRUENDUNG},
    )

    antwort = await pruefer.get(f"/api/v1/protokolle/{protokoll}/verlauf")

    assert antwort.status_code == 200
    eintraege = antwort.json()
    assert [(e["von_status"], e["nach_status"]) for e in eintraege] == [
        ("IN_REVIEW", "NEEDS_CHANGES"),
        ("SUBMITTED", "IN_REVIEW"),
        ("DRAFT", "SUBMITTED"),
    ]
    assert eintraege[0]["kommentar"] == BEGRUENDUNG
    assert eintraege[0]["akteur_name"] == PRUEFERIN


async def test_der_einreicher_liest_seinen_eigenen_verlauf(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """He needs it more than anybody: it is where he reads what to correct."""
    pruefer = await als(PRUEFERIN)
    await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "AENDERUNG_ANFORDERN", "kommentar": BEGRUENDUNG},
    )

    einreicher = await als(EINREICHER)
    antwort = await einreicher.get(f"/api/v1/protokolle/{protokoll}/verlauf")

    assert antwort.status_code == 200
    assert antwort.json()[0]["kommentar"] == BEGRUENDUNG


async def test_ein_fremder_liest_keinen_verlauf(
    protokoll: str,
    konten: Callable[..., Awaitable[User]],
    als: Callable[[str], Awaitable[AsyncClient]],
) -> None:
    """Asking for the history is exactly as revealing as asking for the protocol,
    and no more."""
    await konten(email="fremd@example.org")
    fremder = await als("fremd@example.org")

    antwort = await fremder.get(f"/api/v1/protokolle/{protokoll}/verlauf")

    assert antwort.status_code == 404


async def test_ein_zurueckgegebenes_protokoll_geht_wieder_raus(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The whole round trip, over HTTP: sent, sent back, corrected, sent again."""
    pruefer = await als(PRUEFERIN)
    await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "AENDERUNG_ANFORDERN", "kommentar": BEGRUENDUNG},
    )

    einreicher = await als(EINREICHER)
    gelesen = (await einreicher.get(f"/api/v1/protokolle/{protokoll}")).json()
    assert gelesen["status"] == "NEEDS_CHANGES"

    gespeichert = await einreicher.put(
        f"/api/v1/protokolle/{protokoll}/antworten",
        json={"version": gelesen["version"], "antworten": dict(VOLLSTAENDIG)},
    )
    wieder = await einreicher.post(
        f"/api/v1/protokolle/{protokoll}/absenden",
        json={"version": gespeichert.json()["version"]},
    )

    assert wieder.status_code == 200
    assert wieder.json()["status"] == "SUBMITTED"


async def test_ein_zurueckgegebenes_protokoll_sagt_beim_loeschen_die_wahrheit(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The message has to match the screen it appears on.

    A protocol sent back for correction may be changed and may not be deleted, so
    the old "can no longer be changed or deleted" would have contradicted the form
    the surveyor was typing into when they saw it.
    """
    pruefer = await als(PRUEFERIN)
    await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/entscheidung",
        json={"entscheidung": "AENDERUNG_ANFORDERN", "kommentar": BEGRUENDUNG},
    )

    einreicher = await als(EINREICHER)
    antwort = await einreicher.delete(f"/api/v1/protokolle/{protokoll}")

    assert antwort.status_code == 409
    koerper = antwort.json()
    assert koerper["code"] == "PROTOKOLL_NICHT_LOESCHBAR"
    assert "weiter bearbeiten" in koerper["nachricht"]


async def test_ein_pruefer_darf_an_ein_fremdes_protokoll_nichts_anhaengen(
    protokoll: str, als: Callable[[str], Awaitable[AsyncClient]]
) -> None:
    """The third of the three write routes, and the one most easily forgotten.

    Attachments reach a protocol through hole_protokoll, the owner-only loader, so
    widening who may read one did not widen this. That is worth a test rather than
    an assumption: it is a different module, and the next person to widen
    something will look for the proof here.
    """
    pruefer = await als(PRUEFERIN)

    antwort = await pruefer.post(
        f"/api/v1/protokolle/{protokoll}/anlagen",
        data={"art": "FOTO"},
        files={"datei": ("schussen.jpg", JPEG, "image/jpeg")},
    )

    assert antwort.status_code == 404


@pytest.mark.parametrize("rollen", [(Rolle.SUBMITTER,), (Rolle.DATA_STEWARD,)])
async def test_wer_nicht_pruefen_darf_nimmt_auch_nichts_in_pruefung(
    protokoll: str,
    konten: Callable[..., Awaitable[User]],
    als: Callable[[str], Awaitable[AsyncClient]],
    rollen: tuple[Rolle, ...],
) -> None:
    """Both reviewer routes carry the same requirement, and both are tested for
    it. One of them having been left open would be the quiet kind of hole."""
    await konten(email="kern@ffs.de", rollen=rollen)
    fremder = await als("kern@ffs.de")

    antwort = await fremder.post(f"/api/v1/protokolle/{protokoll}/pruefung")

    assert antwort.status_code == 403
    assert antwort.json()["code"] == "ROLLE_FEHLT"


@pytest.mark.parametrize("weg", ["pruefung", "entscheidung"])
async def test_ein_super_admin_kommt_durch_beide_tueren(
    protokoll: str,
    konten: Callable[..., Awaitable[User]],
    als: Callable[[str], Awaitable[AsyncClient]],
    weg: str,
) -> None:
    """The role that is meant to be able to do everything, over HTTP.

    The table says so and regeln_test.py proves the table; this proves the routes
    were given the table's answer rather than a hand-typed Rolle.REVIEWER.
    """
    await konten(email="chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    admin = await als("chefin@ffs.de")

    koerper = {"entscheidung": "ANNEHMEN"} if weg == "entscheidung" else None
    antwort = await admin.post(f"/api/v1/protokolle/{protokoll}/{weg}", json=koerper)

    assert antwort.status_code == 200
