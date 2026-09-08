"""The session as the browser experiences it: /ich and /abmeldung."""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.sitzung import SITZUNGS_COOKIE
from app.benutzer.dienst import lege_benutzer_an, setze_aktiv
from app.models.benutzer import Rolle, User
from app.security.token import erstelle_token

PASSWORT = "ein gutes langes passwort"


async def _anlegen(
    session: AsyncSession,
    email: str = "anna@ffs.de",
    rollen: Sequence[Rolle] = (Rolle.SUBMITTER,),
) -> User:
    return await lege_benutzer_an(session, email=email, passwort=PASSWORT, rollen=rollen)


async def _anmelden(client: AsyncClient, email: str = "anna@ffs.de") -> None:
    antwort = await client.post(
        "/api/v1/anmeldung", json={"email": email, "passwort": PASSWORT}
    )
    assert antwort.status_code == 200


def _setze_cookie(client: AsyncClient, wert: str) -> None:
    """Replace whatever session cookie the jar holds.

    Cleared first: setting one on top of an existing cookie leaves both in the
    jar, and the request then carries the real one as well as the doctored one.
    """
    client.cookies.clear()
    client.cookies.set(SITZUNGS_COOKIE, wert, domain="testserver")


async def test_ich_gibt_das_angemeldete_konto(
    session: AsyncSession, client: AsyncClient
) -> None:
    angelegt = await _anlegen(session)
    await _anmelden(client)

    antwort = await client.get("/api/v1/ich")

    assert antwort.status_code == 200
    assert antwort.json()["id"] == str(angelegt.id)
    assert antwort.json()["email"] == "anna@ffs.de"


async def test_ich_ohne_cookie_ist_401(client: AsyncClient) -> None:
    antwort = await client.get("/api/v1/ich")

    assert antwort.status_code == 401
    assert antwort.json()["code"] == "NichtAngemeldet"


async def test_ich_mit_verfaelschtem_cookie_ist_401(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session)
    await _anmelden(client)
    # Lengthened rather than edited in place: a signature is a fixed number of
    # bytes, so one more character can never decode to a matching one, while
    # changing the last character can, because it carries spare bits.
    _setze_cookie(client, client.cookies[SITZUNGS_COOKIE] + "a")

    assert (await client.get("/api/v1/ich")).status_code == 401


async def test_ich_mit_abgelaufenem_cookie_ist_401(
    session: AsyncSession, client: AsyncClient
) -> None:
    benutzer = await _anlegen(session)
    _setze_cookie(
        client,
        erstelle_token(benutzer.id, ausgestellt_am=datetime.now(UTC) - timedelta(days=2)),
    )

    assert (await client.get("/api/v1/ich")).status_code == 401


async def test_ich_mit_unbekanntem_konto_ist_401(client: AsyncClient) -> None:
    """A correctly signed token for an account that no longer exists."""
    _setze_cookie(client, erstelle_token(uuid.uuid4()))

    assert (await client.get("/api/v1/ich")).status_code == 401


async def test_deaktivierung_wirkt_sofort(session: AsyncSession, client: AsyncClient) -> None:
    """The reason the account is loaded on every request rather than trusted from
    the token. Without it a deactivated person keeps working for up to eight hours."""
    await _anlegen(session)
    await _anmelden(client)
    assert (await client.get("/api/v1/ich")).status_code == 200

    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    assert (await client.get("/api/v1/ich")).status_code == 401


async def test_abmeldung_beendet_die_sitzung(
    session: AsyncSession, client: AsyncClient
) -> None:
    await _anlegen(session)
    await _anmelden(client)

    abmeldung = await client.post("/api/v1/abmeldung")

    assert abmeldung.status_code == 204
    assert not client.cookies.get(SITZUNGS_COOKIE)
    assert (await client.get("/api/v1/ich")).status_code == 401


async def test_abmeldung_loescht_mit_denselben_eigenschaften(
    session: AsyncSession, client: AsyncClient
) -> None:
    """A browser matches a deletion on name, path and domain. If these drift apart
    from what sign-in set, sign-out does nothing and still answers 204."""
    await _anlegen(session)
    await _anmelden(client)

    geloescht = (await client.post("/api/v1/abmeldung")).headers["set-cookie"]

    assert geloescht.startswith(f"{SITZUNGS_COOKIE}=")
    assert "Path=/" in geloescht
    assert "HttpOnly" in geloescht
    assert "Secure" in geloescht
    assert "SameSite=lax" in geloescht


async def test_abmeldung_ohne_sitzung_ist_kein_fehler(client: AsyncClient) -> None:
    """The sign-out button must work when the session has already expired, which
    is exactly when somebody is most likely to press it."""
    assert (await client.post("/api/v1/abmeldung")).status_code == 204
