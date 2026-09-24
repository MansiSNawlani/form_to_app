"""Account administration over HTTP: who gets in, and what each route does.

app/benutzer/dienst_test.py proves what the service does to a row. What is proved
here is the half that cannot be proved there: that these routes are closed to
everybody except a Super Admin, and that the two safety rules survive the trip
through HTTP rather than only holding when the service is called directly.

That half is not optional. coding-standards.md requires permission tests, and
these are the routes that hand out roles: dropping the requirement on any one of
them would let a Reviewer make themselves a Super Admin.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response

from app.models.benutzer import Locale, Rolle, User

PFAD = "/api/v1/benutzer"

PASSWORT = "ein gutes langes passwort"
NEUES_PASSWORT = "ein anderes langes passwort"

ADMIN = "chefin@ffs.de"

# Every account that is not a Super Admin, with the roles that make it. Used to
# prove each route refuses all of them rather than only the one a test happened
# to pick.
FREMDE_ROLLEN: list[tuple[str, tuple[Rolle, ...], int | None]] = [
    ("submitter@buero.de", (Rolle.SUBMITTER,), None),
    ("pruefer@ffs.de", (Rolle.REVIEWER,), None),
    ("pflege@ffs.de", (Rolle.DATA_STEWARD,), None),
    ("rp@rp-tuebingen.de", (Rolle.REGIERUNGSPRAESIDIUM,), 4),
]


@pytest.fixture
def als(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> Callable[..., Awaitable[User]]:
    """Sign in as a fresh account holding exactly these roles."""

    async def _als(email: str, *rollen: Rolle, **felder: object) -> User:
        konto = await anlegen(email=email, rollen=rollen, **felder)
        await anmelden(email=email)
        return konto

    return _als


@pytest.fixture
def als_admin(als: Callable[..., Awaitable[User]]) -> Callable[[], Awaitable[User]]:
    """The signed-in Super Admin nearly every test here starts from."""

    async def _als_admin() -> User:
        return await als(ADMIN, Rolle.SUPER_ADMIN)

    return _als_admin


def _neues_konto(**felder: object) -> dict[str, object]:
    return {
        "email": "neu@ffs.de",
        "passwort": PASSWORT,
        "rollen": ["SUBMITTER"],
        **felder,
    }


async def test_die_liste_zeigt_jedes_konto(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    await als_admin()
    await anlegen(email="extern@buero.de")

    antwort = await client.get(PFAD)

    assert antwort.status_code == 200, antwort.text
    adressen = [konto["email"] for konto in antwort.json()]
    assert adressen == [ADMIN, "extern@buero.de"]


async def test_kein_konto_traegt_den_passwort_hash(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    """The guarantee BenutzerAntwort exists for, checked on the wire.

    A response model that lists its fields is what keeps the hash out, and this
    is what fails if somebody ever builds one from the row instead.
    """
    await als_admin()

    antwort = await client.get(PFAD)

    assert "password_hash" not in antwort.text
    assert "$argon2" not in antwort.text


async def test_ein_konto_wird_einzeln_gelesen(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    admin = await als_admin()

    antwort = await client.get(f"{PFAD}/{admin.id}")

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["email"] == ADMIN
    assert antwort.json()["created_at"]


async def test_ein_unbekanntes_konto_ist_nicht_gefunden(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.get(f"{PFAD}/{uuid.uuid4()}")

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "KONTO_NICHT_GEFUNDEN"


@pytest.mark.parametrize(("email", "rollen", "region"), FREMDE_ROLLEN)
async def test_ohne_super_admin_ist_jede_route_verschlossen(
    client: AsyncClient,
    als: Callable[..., Awaitable[User]],
    email: str,
    rollen: tuple[Rolle, ...],
    region: int | None,
) -> None:
    """The test coding-standards.md asks for, over every route at once.

    A Regierungspraesidium account is among them on purpose. It is read-only over
    its own region by design, and feature 13 gives it a view of protocols, never
    of accounts.
    """
    konto = await als(email, *rollen, regierungspraesidium=region)

    antworten = [
        await client.get(PFAD),
        await client.get(f"{PFAD}/{konto.id}"),
        await client.post(PFAD, json=_neues_konto()),
        await client.patch(f"{PFAD}/{konto.id}", json={"rollen": ["SUPER_ADMIN"]}),
        await client.put(f"{PFAD}/{konto.id}/passwort", json={"passwort": NEUES_PASSWORT}),
    ]

    for antwort in antworten:
        assert antwort.status_code == 403, (antwort.request.url, antwort.text)
        assert antwort.json()["code"] == "ROLLE_FEHLT"


async def test_wer_sich_nicht_anmeldet_bekommt_401_und_nicht_403(
    client: AsyncClient,
) -> None:
    """401 and 403 have to stay different answers all the way up.

    Feature 2c sends a 401 to the login page. Answering 403 here would leave
    somebody signed out with no way to sign in, and answering 404 would tell an
    unauthenticated caller whether an account exists.
    """
    fremde_id = uuid.uuid4()
    antworten = [
        await client.get(PFAD),
        await client.get(f"{PFAD}/{fremde_id}"),
        await client.post(PFAD, json=_neues_konto()),
        await client.patch(f"{PFAD}/{fremde_id}", json={"ist_aktiv": False}),
        await client.put(f"{PFAD}/{fremde_id}/passwort", json={"passwort": NEUES_PASSWORT}),
    ]

    # All five, not only the ones that read. The two that write are where a 404
    # leaking to an unauthenticated caller would matter most, because the caller
    # chooses the id and could walk a list of them.
    assert len(antworten) == 5
    for antwort in antworten:
        assert antwort.status_code == 401, (antwort.request.url, antwort.text)
        assert antwort.json()["code"] == "NICHT_ANGEMELDET"


async def test_ein_konto_wird_angelegt_und_kann_sich_anmelden(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await als_admin()

    angelegt = await client.post(PFAD, json=_neues_konto())

    assert angelegt.status_code == 201, angelegt.text
    assert angelegt.json()["email"] == "neu@ffs.de"
    assert "passwort" not in angelegt.text

    anmeldung = await anmelden(email="neu@ffs.de", passwort=PASSWORT)
    assert anmeldung.status_code == 200, anmeldung.text


async def test_eine_vergebene_adresse_wird_abgelehnt(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.post(PFAD, json=_neues_konto(email=ADMIN))

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "EMAIL_VERGEBEN"


async def test_eine_regionale_rolle_ohne_nummer_wird_abgelehnt(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.post(PFAD, json=_neues_konto(rollen=["REGIERUNGSPRAESIDIUM"]))

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "REGIERUNGSPRAESIDIUM_FEHLT"


async def test_eine_nummer_ohne_die_regionale_rolle_wird_abgelehnt(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.post(PFAD, json=_neues_konto(regierungspraesidium=2))

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "REGIERUNGSPRAESIDIUM_UNZULAESSIG"


async def test_ein_zu_kurzes_passwort_wird_abgelehnt(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.post(PFAD, json=_neues_konto(passwort="kurz"))

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "PASSWORT_ZU_KURZ"


async def test_eine_rollenaenderung_wirkt_bei_der_naechsten_anfrage(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    """The property the whole feature leans on.

    aktueller_benutzer loads the account row on every request rather than reading
    the roles out of the token, which is what makes a role taken away take effect
    at once instead of whenever a session happens to expire, up to eight hours
    later. This fails if somebody ever moves the roles into the token for speed.
    """
    await als_admin()
    frisch = await anlegen(email="pruefer@ffs.de", rollen=(Rolle.REVIEWER,))

    await client.patch(f"{PFAD}/{frisch.id}", json={"rollen": ["SUPER_ADMIN"]})

    await anmelden(email="pruefer@ffs.de")
    antwort = await client.get(PFAD)
    assert antwort.status_code == 200, antwort.text


async def test_ein_gesperrtes_konto_kommt_nicht_mehr_hinein(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    gesperrt = await client.patch(f"{PFAD}/{frisch.id}", json={"ist_aktiv": False})
    assert gesperrt.status_code == 200, gesperrt.text

    antwort = await anmelden(email="extern@buero.de")
    assert antwort.status_code == 403
    assert antwort.json()["code"] == "KONTO_DEAKTIVIERT"


async def test_eine_aenderung_ohne_angaben_aendert_nichts(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    antwort = await client.patch(f"{PFAD}/{frisch.id}", json={})

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["email"] == "extern@buero.de"
    assert antwort.json()["rollen"] == ["SUBMITTER"]


async def test_die_region_wird_mit_der_rolle_zusammen_geleert(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """The absent-versus-null distinction, end to end.

    A sent null is what clears the region. Without it the account would keep a
    region for a role it no longer holds, and feature 13 would read it.
    """
    await als_admin()
    regional = await anlegen(
        email="rp@rp-tuebingen.de",
        rollen=(Rolle.REGIERUNGSPRAESIDIUM,),
        regierungspraesidium=4,
    )

    antwort = await client.patch(
        f"{PFAD}/{regional.id}",
        json={"rollen": ["SUBMITTER"], "regierungspraesidium": None},
    )

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["regierungspraesidium"] is None


async def test_eine_uebrig_gebliebene_region_wird_abgelehnt(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    await als_admin()
    regional = await anlegen(
        email="rp@rp-tuebingen.de",
        rollen=(Rolle.REGIERUNGSPRAESIDIUM,),
        regierungspraesidium=4,
    )

    antwort = await client.patch(f"{PFAD}/{regional.id}", json={"rollen": ["SUBMITTER"]})

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "REGIERUNGSPRAESIDIUM_UNZULAESSIG"


async def test_die_sprache_wird_geaendert(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    antwort = await client.patch(f"{PFAD}/{frisch.id}", json={"locale": "en"})

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["locale"] == Locale.EN.value


async def test_ein_zweiter_super_admin_darf_gesperrt_werden(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """Locking somebody else who holds the role is allowed, and always will be.

    Worth stating as a test because of what follows from it. The caller has to be
    an active Super Admin to reach this route at all, so whenever the target is
    somebody else there is by definition still one left: the caller. Over HTTP,
    LetzterSuperAdmin can therefore only ever fire on the caller's own account.

    That does not make the rule redundant. It is what holds the command line,
    where there is no caller, and it is the check that would still refuse if this
    route's role requirement were ever loosened. But a test claiming to lock
    "the last Super Admin" through this route would be testing a state it cannot
    reach, so this states the reachable half instead.
    """
    await als_admin()
    vertretung = await anlegen(email="vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    antwort = await client.patch(f"{PFAD}/{vertretung.id}", json={"ist_aktiv": False})

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["ist_aktiv"] is False


async def test_niemand_sperrt_das_eigene_konto(
    client: AsyncClient,
    als: Callable[..., Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    admin = await als(ADMIN, Rolle.SUPER_ADMIN)
    await anlegen(email="vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    antwort = await client.patch(f"{PFAD}/{admin.id}", json={"ist_aktiv": False})

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "SELBSTENTZUG_UNZULAESSIG"


async def test_niemand_gibt_die_eigene_super_admin_rolle_ab(
    client: AsyncClient,
    als: Callable[..., Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    admin = await als(ADMIN, Rolle.SUPER_ADMIN)
    await anlegen(email="vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    antwort = await client.patch(f"{PFAD}/{admin.id}", json={"rollen": ["REVIEWER"]})

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "SELBSTENTZUG_UNZULAESSIG"


async def test_der_alleinige_super_admin_hoert_die_nuetzlichere_absage(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    """Both rules apply, and the order decides which message arrives.

    "Create a second one first" is something the only administrator can act on.
    "Ask another Super Admin" names somebody who does not exist.
    """
    admin = await als_admin()

    antwort = await client.patch(f"{PFAD}/{admin.id}", json={"rollen": ["REVIEWER"]})

    assert antwort.status_code == 409
    assert antwort.json()["code"] == "LETZTER_SUPER_ADMIN"


async def test_am_eigenen_konto_bleibt_alles_andere_aenderbar(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    admin = await als_admin()

    antwort = await client.patch(f"{PFAD}/{admin.id}", json={"locale": "en"})

    assert antwort.status_code == 200, antwort.text
    assert antwort.json()["locale"] == Locale.EN.value


async def test_ein_neues_passwort_ersetzt_das_alte(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    gesetzt = await client.put(
        f"{PFAD}/{frisch.id}/passwort", json={"passwort": NEUES_PASSWORT}
    )
    assert gesetzt.status_code == 200, gesetzt.text
    assert NEUES_PASSWORT not in gesetzt.text

    mit_neuem = await anmelden(email="extern@buero.de", passwort=NEUES_PASSWORT)
    assert mit_neuem.status_code == 200, mit_neuem.text

    mit_altem = await anmelden(email="extern@buero.de", passwort=PASSWORT)
    assert mit_altem.status_code == 401


async def test_ein_zu_kurzes_neues_passwort_wird_abgelehnt(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> None:
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    antwort = await client.put(f"{PFAD}/{frisch.id}/passwort", json={"passwort": "kurz"})

    assert antwort.status_code == 422
    assert antwort.json()["code"] == "PASSWORT_ZU_KURZ"

    unveraendert = await anmelden(email="extern@buero.de", passwort=PASSWORT)
    assert unveraendert.status_code == 200, unveraendert.text


async def test_ein_passwort_fuer_ein_unbekanntes_konto_ist_nicht_gefunden(
    client: AsyncClient, als_admin: Callable[[], Awaitable[User]]
) -> None:
    await als_admin()

    antwort = await client.put(
        f"{PFAD}/{uuid.uuid4()}/passwort", json={"passwort": NEUES_PASSWORT}
    )

    assert antwort.status_code == 404
    assert antwort.json()["code"] == "KONTO_NICHT_GEFUNDEN"


async def test_ohne_rollen_wird_mit_eigener_meldung_abgelehnt(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """ROLLEN_LEER is a published code, so it has to be one a caller can receive.

    Refusing the empty list in the request model instead would answer with the
    generic "wrong format" sentence, and 16c could not tell this apart from any
    other malformed body. Nothing is written before the rule runs either way.
    """
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    angelegt = await client.post(PFAD, json=_neues_konto(rollen=[]))
    geaendert = await client.patch(f"{PFAD}/{frisch.id}", json={"rollen": []})

    for antwort in (angelegt, geaendert):
        assert antwort.status_code == 422, antwort.text
        assert antwort.json()["code"] == "ROLLEN_LEER"
        assert "Rolle" in antwort.json()["nachricht"]


async def test_ein_ausdrueckliches_null_nennt_das_feld(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """Null is refused on the four fields where it means nothing, and the refusal
    has to name which one. A model-wide validator produces an error with no field
    location, and the reply then names nothing at all."""
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    antwort = await client.patch(f"{PFAD}/{frisch.id}", json={"rollen": None})

    assert antwort.status_code == 422
    assert "rollen" in antwort.json()["nachricht"]


async def test_ein_unbekanntes_feld_wird_abgelehnt(
    client: AsyncClient,
    als_admin: Callable[[], Awaitable[User]],
    anlegen: Callable[..., Awaitable[User]],
) -> None:
    """A misspelled field name must not be quietly ignored.

    Sending "ist_activ" and having nothing happen is the kind of bug that looks
    like the server losing the change.
    """
    await als_admin()
    frisch = await anlegen(email="extern@buero.de")

    antwort = await client.patch(f"{PFAD}/{frisch.id}", json={"ist_activ": False})

    assert antwort.status_code == 422
