"""The review queue over HTTP: who gets in, and what comes back.

app/protokolle/pruefliste/dienst_test.py proves what the query lists. What is
proved here is the half that cannot be proved there: that the queue is closed to
everybody whose job it is not.

That half is not optional. coding-standards.md requires a test proving a submitter
cannot read another submitter's work, and this endpoint is the one that would hand
over every protocol FFS holds in a single request if its role requirement were
ever dropped.
"""

from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient, Response

from app.models.benutzer import Rolle, User
from app.protokolle.pruefliste.dienst import Sortierung
from app.protokolle.pruefliste.parameter import PRO_SEITE_MAX, PRO_SEITE_STANDARD

PFAD = "/api/v1/pruefliste"

SURVEYOR = "bergmann@ffs.de"


@pytest.fixture
def eingereichtes_protokoll(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
    einreichen: Callable[[], Awaitable[str]],
) -> Callable[[], Awaitable[str]]:
    """One protocol handed in by somebody who is not FFS staff.

    Through the real endpoints, so it has been past the rules and past feature
    11b's matching and therefore has a real Probestrecke behind it. The signed-in
    account is left as the surveyor; a test wanting the queue signs in again as
    whoever it is about.
    """

    async def _eingereicht() -> str:
        await anlegen(email=SURVEYOR)
        await anmelden(email=SURVEYOR)
        return await einreichen()

    return _eingereicht


@pytest.fixture
def als(
    anlegen: Callable[..., Awaitable[User]],
    anmelden: Callable[..., Awaitable[Response]],
) -> Callable[..., Awaitable[None]]:
    """Sign in as a fresh account holding exactly these roles."""

    async def _als(email: str, *rollen: Rolle, **felder: object) -> None:
        await anlegen(email=email, rollen=rollen, **felder)
        await anmelden(email=email)

    return _als


class TestWerHineindarf:
    @pytest.mark.parametrize(
        "rolle", [Rolle.REVIEWER, Rolle.DATA_STEWARD, Rolle.SUPER_ADMIN]
    )
    async def test_laesst_ffs_personal_hinein(
        self, client: AsyncClient, als: Callable[..., Awaitable[None]], rolle: Rolle
    ) -> None:
        await als("lehmann@ffs.de", rolle)

        antwort = await client.get(PFAD)

        assert antwort.status_code == 200

    async def test_weist_einen_gewoehnlichen_einreicher_ab(
        self, client: AsyncClient, als: Callable[..., Awaitable[None]]
    ) -> None:
        await als(SURVEYOR, Rolle.SUBMITTER)

        antwort = await client.get(PFAD)

        assert antwort.status_code == 403

    async def test_weist_ein_regierungspraesidium_ab(
        self, client: AsyncClient, als: Callable[..., Awaitable[None]]
    ) -> None:
        # Feature 13 gives this role its own narrowed view. Until it exists the
        # answer is no, because letting it see everything now and narrowing it
        # later would be a leak with a date on it.
        await als("rp4@rp.bwl.de", Rolle.REGIERUNGSPRAESIDIUM, regierungspraesidium=4)

        antwort = await client.get(PFAD)

        assert antwort.status_code == 403

    async def test_laesst_ein_maschinenkonto_gar_nicht_erst_herein(
        self,
        client: AsyncClient,
        anlegen: Callable[..., Awaitable[User]],
        anmelden: Callable[..., Awaitable[Response]],
    ) -> None:
        # An INTEGRATION account is refused at sign-in, so it never gets a
        # session and never reaches this endpoint to be refused a second time.
        # Asserted here rather than assumed, because it is the reason the role
        # list on this route does not have to mention it.
        await anlegen(email="fiaka@integration.de", rollen=(Rolle.INTEGRATION,))
        anmeldung = await anmelden(email="fiaka@integration.de")

        assert anmeldung.status_code == 403
        assert (await client.get(PFAD)).status_code == 401

    async def test_weist_ohne_sitzung_ab(self, client: AsyncClient) -> None:
        # 401 and not 403. Sending somebody who is not signed in to a page that
        # says "you may not" is a dead end; the login page is the way out.
        antwort = await client.get(PFAD)

        assert antwort.status_code == 401

    async def test_gibt_einem_abgewiesenen_konto_keine_zeilen(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        # A refusal rather than an empty list, and this is what says the refusal
        # leaks nothing: there really was a protocol to find.
        await eingereichtes_protokoll()
        await als("neu@ffs.de", Rolle.SUBMITTER)

        antwort = await client.get(PFAD)

        assert antwort.status_code == 403
        assert "zeilen" not in antwort.json()


class TestWasZurueckkommt:
    async def test_antwortet_mit_dem_umschlag_einer_seite(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        protokoll_id = await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        antwort = await client.get(PFAD)

        assert antwort.status_code == 200
        seite = antwort.json()
        assert [zeile["id"] for zeile in seite["zeilen"]] == [protokoll_id]
        assert seite["gesamt"] == 1
        assert seite["seite"] == 1
        assert seite["pro_seite"] == PRO_SEITE_STANDARD
        assert seite["seiten"] == 1

    async def test_traegt_die_strecke_und_das_einreichende_konto(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        (zeile,) = (await client.get(PFAD)).json()["zeilen"]

        assert zeile["eingereicht_von"] == SURVEYOR
        assert zeile["status"] == "SUBMITTED"
        assert zeile["gewaessername"]
        assert zeile["ortsangabe"]
        assert zeile["regierungspraesidium"] in (1, 2, 3, 4)
        assert zeile["datum"]
        assert zeile["anlass"]
        assert zeile["bearbeiter_name"]

    async def test_traegt_die_antworten_nicht_mit(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        # The queue draws rows. Twenty protocols carrying 338 answers each is a
        # large response for a table nobody is reading the answers out of.
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        (zeile,) = (await client.get(PFAD)).json()["zeilen"]

        assert "antworten" not in zeile

    async def test_meldet_eine_leere_liste_als_eine_seite(
        self, client: AsyncClient, als: Callable[..., Awaitable[None]]
    ) -> None:
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        seite = (await client.get(PFAD)).json()

        assert seite["zeilen"] == []
        assert seite["gesamt"] == 0
        assert seite["seiten"] == 1


class TestSeitenparameter:
    @pytest.fixture
    async def pruefer(self, als: Callable[..., Awaitable[None]]) -> None:
        await als("lehmann@ffs.de", Rolle.REVIEWER)

    async def test_deckelt_eine_masslose_seitengroesse_statt_sie_abzuweisen(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        antwort = await client.get(PFAD, params={"pro_seite": 500})

        assert antwort.status_code == 200
        assert antwort.json()["pro_seite"] == PRO_SEITE_MAX

    async def test_hebt_die_nullte_seite_auf_die_erste(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        antwort = await client.get(PFAD, params={"seite": 0})

        assert antwort.status_code == 200
        assert antwort.json()["seite"] == 1

    async def test_ueberlebt_eine_masslose_seitenzahl(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        # Uncapped this is an OFFSET the database driver cannot send, and a silly
        # query parameter becomes a 500.
        antwort = await client.get(PFAD, params={"seite": 10**30})

        assert antwort.status_code == 200
        assert antwort.json()["zeilen"] == []

    async def test_weist_eine_seite_zurueck_die_keine_zahl_ist(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        antwort = await client.get(PFAD, params={"seite": "zwei"})

        assert antwort.status_code == 422


class TestFilterparameter:
    @pytest.fixture
    async def pruefer(self, als: Callable[..., Awaitable[None]]) -> None:
        await als("lehmann@ffs.de", Rolle.REVIEWER)

    async def test_weist_die_frage_nach_entwuerfen_zurueck(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        # Refused, not answered with nothing. The queue never lists a draft, and
        # an empty page would read like a database with no protocols in it.
        antwort = await client.get(PFAD, params={"status": "DRAFT"})

        assert antwort.status_code == 422

    async def test_weist_einen_unbekannten_zustand_zurueck(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        antwort = await client.get(PFAD, params={"status": "ERLEDIGT"})

        assert antwort.status_code == 422

    async def test_nimmt_mehrere_zustaende_auf_einmal(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        # The screen's own default: the protocols nobody has decided on yet.
        protokoll_id = await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        antwort = await client.get(
            PFAD, params=[("status", "SUBMITTED"), ("status", "IN_REVIEW")]
        )

        assert antwort.status_code == 200
        assert [zeile["id"] for zeile in antwort.json()["zeilen"]] == [protokoll_id]

    async def test_engt_auf_einen_zustand_ein(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        antwort = await client.get(PFAD, params={"status": "REJECTED"})

        assert antwort.json()["zeilen"] == []
        assert antwort.json()["gesamt"] == 0

    async def test_reicht_die_suche_durch(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        gefunden = (await client.get(PFAD)).json()["zeilen"][0]
        treffer = await client.get(PFAD, params={"suche": gefunden["gewaessername"]})
        daneben = await client.get(PFAD, params={"suche": "Donau Kinzig Jagst"})

        assert [zeile["id"] for zeile in treffer.json()["zeilen"]] == [gefunden["id"]]
        assert daneben.json()["zeilen"] == []

    async def test_reicht_den_anlass_durch(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        gefunden = (await client.get(PFAD)).json()["zeilen"][0]
        treffer = await client.get(PFAD, params={"anlass": gefunden["anlass"]})
        daneben = await client.get(PFAD, params={"anlass": "gibtesnicht"})

        assert [zeile["id"] for zeile in treffer.json()["zeilen"]] == [gefunden["id"]]
        assert daneben.json()["zeilen"] == []

    async def test_reicht_das_jahr_durch(
        self,
        client: AsyncClient,
        als: Callable[..., Awaitable[None]],
        eingereichtes_protokoll: Callable[[], Awaitable[str]],
    ) -> None:
        await eingereichtes_protokoll()
        await als("lehmann@ffs.de", Rolle.REVIEWER)

        gefunden = (await client.get(PFAD)).json()["zeilen"][0]
        jahr = int(str(gefunden["datum"])[:4])

        treffer = await client.get(PFAD, params={"jahr": jahr})
        daneben = await client.get(PFAD, params={"jahr": jahr - 1})

        assert [zeile["id"] for zeile in treffer.json()["zeilen"]] == [gefunden["id"]]
        assert daneben.json()["zeilen"] == []

    async def test_weist_ein_jahr_zurueck_das_kein_datum_sein_kann(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        # Unbounded, date() raises on this and a query parameter becomes a 500.
        antwort = await client.get(PFAD, params={"jahr": 99999})

        assert antwort.status_code == 422

    async def test_weist_eine_masslos_lange_suche_zurueck(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        antwort = await client.get(PFAD, params={"suche": "x" * 5000})

        assert antwort.status_code == 422


class TestSortierparameter:
    @pytest.fixture
    async def pruefer(self, als: Callable[..., Awaitable[None]]) -> None:
        await als("lehmann@ffs.de", Rolle.REVIEWER)

    @pytest.mark.parametrize("sortierung", [s.value for s in Sortierung])
    async def test_nimmt_jede_bekannte_ordnung_an(
        self, client: AsyncClient, pruefer: None, sortierung: str
    ) -> None:
        antwort = await client.get(PFAD, params={"sortierung": sortierung})

        assert antwort.status_code == 200

    async def test_weist_eine_unbekannte_ordnung_zurueck(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        # Refused rather than quietly falling back to the default. A screen
        # asking for an order it does not get is a bug that hides itself.
        antwort = await client.get(PFAD, params={"sortierung": "zufaellig"})

        assert antwort.status_code == 422

    async def test_weist_einen_spaltennamen_zurueck(
        self, client: AsyncClient, pruefer: None
    ) -> None:
        # The four orders are a closed list, not a column name the caller picks.
        antwort = await client.get(PFAD, params={"sortierung": "owner_user_id"})

        assert antwort.status_code == 422
