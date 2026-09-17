"""What the Pruefliste lists, against a real database.

The question this file exists to pin down is the one in the spec's own table: the
queue is not "everything this account may look at", it is "everything that has
been handed in". The two differ by exactly one thing, the caller's own drafts, and
that difference is the first test below.
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, time

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.protokolle.pruefliste.dienst import liste_pruefliste

EINGEREICHT = datetime(2026, 7, 1, 9, 0, tzinfo=UTC)


@pytest.fixture
async def pruefer(anlegen: Callable[..., Awaitable[User]]) -> User:
    return await anlegen(email="lehmann@ffs.de", rollen=(Rolle.REVIEWER,))


@pytest.fixture
async def surveyor(anlegen: Callable[..., Awaitable[User]]) -> User:
    return await anlegen(email="bergmann@ffs.de")


@pytest.fixture
def protokoll(session: AsyncSession) -> Callable[..., Awaitable[Submission]]:
    """One protocol with a stretch and a water of its own.

    Deliberately not the shared `umschlag` fixture. That one builds the same
    Schussen every time, and every test here turns on two rows differing: two
    waters, two places, two hand-in times. Each call gets its own Gewaesser,
    Probestrecke and Person so a test can say what it is about.
    """

    async def _protokoll(
        besitzer: User,
        *,
        status: Status = Status.SUBMITTED,
        gewaessername: str = "Schussen",
        ortsangabe: str = "unterhalb der Bruecke",
        monitoringstrecke_nr: str | None = None,
        regierungspraesidium: int = 4,
        laenge_m: int = 450,
        anlass: str = "wrrl",
        datum: date = date(2026, 6, 9),
        submitted_at: datetime = EINGEREICHT,
        bearbeiter_name: str = "Anna Weber",
    ) -> Submission:
        gewaesser = Gewaesser(
            id=uuid.uuid4(), name=gewaessername, vorfluter=["Bodensee", "Rhein"]
        )
        strecke = Probestrecke(
            id=uuid.uuid4(),
            gewaesser_id=gewaesser.id,
            monitoringstrecke_nr=monitoringstrecke_nr,
            ortsangabe=ortsangabe,
            gewaessertyp=13,
            laenge_m=laenge_m,
            untere_grenze_rechtswert=512340,
            untere_grenze_hochwert=5398120,
            obere_grenze_rechtswert=512890,
            obere_grenze_hochwert=5398450,
            regierungspraesidium=regierungspraesidium,
        )
        # A fresh address per call. personen.email is unique, so a test building
        # two protocols would otherwise fail on the second Bearbeiter rather than
        # on anything it was about.
        person = Person(
            id=uuid.uuid4(), name=bearbeiter_name, email=f"{uuid.uuid4().hex}@ffs.de"
        )
        session.add_all([gewaesser, strecke, person])
        await session.flush()

        # A draft carries none of the envelope, which is what the
        # umschlag_bei_abgabe constraint insists on.
        umschlag: dict[str, object] = (
            {}
            if status is Status.DRAFT
            else {
                "probestrecke_id": strecke.id,
                "person_id": person.id,
                "bearbeiter_name": bearbeiter_name,
                "anlass": anlass,
                "datum": datum,
                "uhrzeit": time(14, 30),
                "submitted_at": submitted_at,
                # Locked and the moment of locking are one fact, which
                # gesperrt_hat_zeitpunkt insists on.
                **({"locked_at": submitted_at} if status is Status.LOCKED else {}),
            }
        )

        eintrag = Submission(
            owner_user_id=besitzer.id,
            status=status,
            form_version="20260609",
            antworten={},
            **umschlag,
        )
        session.add(eintrag)
        await session.flush()
        return eintrag

    return _protokoll


Protokollfabrik = Callable[..., Awaitable[Submission]]


class TestWasGelistetWird:
    async def test_zeigt_das_protokoll_eines_anderen_kontos(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        eingereicht = await protokoll(surveyor)

        seite = await liste_pruefliste(session)

        assert [zeile.id for zeile in seite.zeilen] == [eingereicht.id]

    async def test_zeigt_keinen_entwurf(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, status=Status.DRAFT)

        seite = await liste_pruefliste(session)

        assert seite.zeilen == []
        assert seite.gesamt == 0

    async def test_zeigt_auch_den_eigenen_entwurf_des_pruefers_nicht(
        self, session: AsyncSession, protokoll: Protokollfabrik, pruefer: User
    ) -> None:
        # The difference between this query and _sichtbar. A protocol somebody is
        # still writing is not work waiting for FFS, whoever is writing it.
        await protokoll(pruefer, status=Status.DRAFT)

        seite = await liste_pruefliste(session)

        assert seite.zeilen == []

    async def test_zeigt_das_eigene_eingereichte_protokoll_des_pruefers(
        self, session: AsyncSession, protokoll: Protokollfabrik, pruefer: User
    ) -> None:
        # It is real work waiting for somebody. 11f is what stops that somebody
        # being the reviewer who filed it.
        eigenes = await protokoll(pruefer)

        seite = await liste_pruefliste(session)

        assert [zeile.id for zeile in seite.zeilen] == [eigenes.id]

    @pytest.mark.parametrize(
        "status",
        [
            Status.SUBMITTED,
            Status.IN_REVIEW,
            Status.NEEDS_CHANGES,
            Status.REJECTED,
            Status.LOCKED,
        ],
    )
    async def test_zeigt_jeden_zustand_ausser_entwurf(
        self,
        session: AsyncSession,
        protokoll: Protokollfabrik,
        surveyor: User,
        status: Status,
    ) -> None:
        await protokoll(surveyor, status=status)

        seite = await liste_pruefliste(session)

        assert [zeile.status for zeile in seite.zeilen] == [status]


class TestWasEineZeileTraegt:
    async def test_traegt_den_umschlag_und_die_strecke(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        eingereicht = await protokoll(
            surveyor,
            gewaessername="Argen",
            ortsangabe="Wangen, oberhalb des Wehrs",
            monitoringstrecke_nr="1001000001",
            regierungspraesidium=4,
            laenge_m=320,
            anlass="ffh",
            datum=date(2026, 5, 18),
        )

        (zeile,) = (await liste_pruefliste(session)).zeilen

        assert zeile.id == eingereicht.id
        assert zeile.gewaessername == "Argen"
        assert zeile.ortsangabe == "Wangen, oberhalb des Wehrs"
        assert zeile.monitoringstrecke_nr == "1001000001"
        assert zeile.regierungspraesidium == 4
        assert zeile.laenge_m == 320
        assert zeile.anlass == "ffh"
        assert zeile.datum == date(2026, 5, 18)
        assert zeile.bearbeiter_name == "Anna Weber"
        assert zeile.form_version == "20260609"

    async def test_nennt_das_konto_das_eingereicht_hat(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor)

        (zeile,) = (await liste_pruefliste(session)).zeilen

        assert zeile.eingereicht_von == "bergmann@ffs.de"

    async def test_laesst_eine_fehlende_monitoringnummer_leer(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor)

        (zeile,) = (await liste_pruefliste(session)).zeilen

        assert zeile.monitoringstrecke_nr is None


class TestReihenfolge:
    async def test_stellt_die_laengste_wartezeit_nach_vorn(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # A work queue, not a news feed. The protocol waiting longest is the one
        # somebody has to get to first.
        neu = await protokoll(
            surveyor, submitted_at=datetime(2026, 7, 20, 8, 0, tzinfo=UTC)
        )
        alt = await protokoll(
            surveyor, submitted_at=datetime(2026, 6, 2, 8, 0, tzinfo=UTC)
        )
        mittel = await protokoll(
            surveyor, submitted_at=datetime(2026, 7, 1, 8, 0, tzinfo=UTC)
        )

        seite = await liste_pruefliste(session)

        assert [zeile.id for zeile in seite.zeilen] == [alt.id, mittel.id, neu.id]

    async def test_ordnet_gleichzeitig_eingereichte_stabil(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # Two rows written in one transaction share a timestamp to the
        # microsecond, so without the id as a tie-break the order is whatever the
        # database felt like and this test would fail now and then.
        eins = await protokoll(surveyor)
        zwei = await protokoll(surveyor)

        erste = [zeile.id for zeile in (await liste_pruefliste(session)).zeilen]
        zweite = [zeile.id for zeile in (await liste_pruefliste(session)).zeilen]

        assert erste == zweite
        assert set(erste) == {eins.id, zwei.id}


class TestSeiten:
    @pytest.fixture
    async def fuenf(
        self, protokoll: Protokollfabrik, surveyor: User
    ) -> list[uuid.UUID]:
        """Five protocols, handed in an hour apart, oldest first."""
        eingereicht = [
            await protokoll(
                surveyor, submitted_at=datetime(2026, 7, 1, 8 + stunde, tzinfo=UTC)
            )
            for stunde in range(5)
        ]
        return [eintrag.id for eintrag in eingereicht]

    async def test_schneidet_die_zweite_seite_heraus(
        self, session: AsyncSession, fuenf: list[uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, seite=2, pro_seite=2)

        assert [zeile.id for zeile in seite.zeilen] == fuenf[2:4]

    async def test_zaehlt_alle_und_nicht_nur_die_seite(
        self, session: AsyncSession, fuenf: list[uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, seite=2, pro_seite=2)

        assert seite.gesamt == 5
        assert seite.seiten == 3
        assert seite.seite == 2
        assert seite.pro_seite == 2

    async def test_gibt_hinter_der_letzten_seite_nichts_zurueck(
        self, session: AsyncSession, fuenf: list[uuid.UUID]
    ) -> None:
        # Not a refusal. The screen says there is nothing here and the pager
        # offers the way back, which a 404 would not.
        seite = await liste_pruefliste(session, seite=9, pro_seite=2)

        assert seite.zeilen == []
        assert seite.gesamt == 5

    async def test_faengt_eine_unsinnige_seitenzahl_ab(
        self, session: AsyncSession, fuenf: list[uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, seite=0, pro_seite=0)

        assert seite.seite == 1
        assert seite.pro_seite == 1
        assert [zeile.id for zeile in seite.zeilen] == fuenf[:1]

    async def test_meldet_bei_leerer_liste_eine_seite(self, session: AsyncSession) -> None:
        seite = await liste_pruefliste(session)

        assert seite.zeilen == []
        assert seite.gesamt == 0
        assert seite.seiten == 1
