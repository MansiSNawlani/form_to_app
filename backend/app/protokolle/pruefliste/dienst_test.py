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
from app.protokolle.pruefliste.dienst import Prueffilter, Sortierung, liste_pruefliste

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


class TestStatusfilter:
    async def test_nimmt_nur_die_genannten_zustaende(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        eingereicht = await protokoll(surveyor, status=Status.SUBMITTED)
        in_pruefung = await protokoll(surveyor, status=Status.IN_REVIEW)
        await protokoll(surveyor, status=Status.REJECTED)

        seite = await liste_pruefliste(
            session,
            auswahl=Prueffilter(status=(Status.SUBMITTED, Status.IN_REVIEW)),
        )

        assert {zeile.id for zeile in seite.zeilen} == {eingereicht.id, in_pruefung.id}

    async def test_zaehlt_nur_die_genannten_zustaende(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The count has to see the same filters the rows do, or the pager offers
        # pages that are not there.
        await protokoll(surveyor, status=Status.SUBMITTED)
        await protokoll(surveyor, status=Status.REJECTED)

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(status=(Status.SUBMITTED,))
        )

        assert seite.gesamt == 1

    async def test_nimmt_ohne_angabe_alles(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, status=Status.SUBMITTED)
        await protokoll(surveyor, status=Status.REJECTED)

        seite = await liste_pruefliste(session, auswahl=Prueffilter())

        assert seite.gesamt == 2


class TestAnlassfilter:
    async def test_nimmt_nur_den_genannten_anlass(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        monitoring = await protokoll(surveyor, anlass="wrrl")
        await protokoll(surveyor, anlass="best")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(anlass="wrrl"))

        assert [zeile.id for zeile in seite.zeilen] == [monitoring.id]


class TestJahresfilter:
    async def test_nimmt_den_letzten_tag_des_jahres_mit(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        silvester = await protokoll(surveyor, datum=date(2025, 12, 31))

        seite = await liste_pruefliste(session, auswahl=Prueffilter(jahr=2025))

        assert [zeile.id for zeile in seite.zeilen] == [silvester.id]

    async def test_laesst_den_ersten_tag_des_naechsten_jahres_draussen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, datum=date(2026, 1, 1))

        seite = await liste_pruefliste(session, auswahl=Prueffilter(jahr=2025))

        assert seite.zeilen == []

    async def test_nimmt_den_ersten_tag_des_jahres_mit(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        neujahr = await protokoll(surveyor, datum=date(2025, 1, 1))

        seite = await liste_pruefliste(session, auswahl=Prueffilter(jahr=2025))

        assert [zeile.id for zeile in seite.zeilen] == [neujahr.id]

    async def test_richtet_sich_nach_dem_tag_der_befischung(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # Not the day it was handed in. A survey done in December and filed in
        # January belongs to the year somebody stood in the water.
        await protokoll(
            surveyor,
            datum=date(2025, 12, 20),
            submitted_at=datetime(2026, 1, 8, 9, 0, tzinfo=UTC),
        )

        gefischt = await liste_pruefliste(session, auswahl=Prueffilter(jahr=2025))
        eingereicht = await liste_pruefliste(session, auswahl=Prueffilter(jahr=2026))

        assert gefischt.gesamt == 1
        assert eingereicht.gesamt == 0


class TestSuche:
    async def test_findet_ueber_den_gewaessernamen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        argen = await protokoll(surveyor, gewaessername="Argen")
        await protokoll(surveyor, gewaessername="Schussen")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="Argen"))

        assert [zeile.id for zeile in seite.zeilen] == [argen.id]

    async def test_findet_allein_ueber_die_ortsangabe(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(
            surveyor, gewaessername="Schussen", ortsangabe="Weissenau"
        )
        await protokoll(surveyor, gewaessername="Schussen", ortsangabe="Eriskirch")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="Weissenau"))

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

    async def test_findet_ueber_die_monitoringnummer(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(surveyor, monitoringstrecke_nr="1001000001")
        await protokoll(surveyor)

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="1001000001"))

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

    async def test_findet_einen_teil_eines_wortes(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(surveyor, gewaessername="Schussen")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="chuss"))

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

    async def test_achtet_nicht_auf_gross_und_kleinschreibung(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(surveyor, gewaessername="Schussen")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="SCHUSSEN"))

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

    async def test_verlangt_jedes_wort_aber_nicht_in_derselben_spalte(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The search a reviewer actually types: the water and the place.
        treffer = await protokoll(
            surveyor, gewaessername="Schussen", ortsangabe="Weissenau, an der Bruecke"
        )
        await protokoll(surveyor, gewaessername="Schussen", ortsangabe="Eriskirch")

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(suche="Schussen Weissenau")
        )

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

    async def test_findet_nichts_wenn_ein_wort_nirgends_vorkommt(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, gewaessername="Schussen", ortsangabe="Weissenau")

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(suche="Schussen Donau")
        )

        assert seite.zeilen == []

    async def test_behandelt_das_prozentzeichen_als_zeichen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # Unescaped this is LIKE's "anything" and the search hands back the whole
        # database, which is the bug this feature was most likely to ship.
        await protokoll(surveyor, gewaessername="Schussen")
        await protokoll(surveyor, gewaessername="Argen")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="%"))

        assert seite.zeilen == []
        assert seite.gesamt == 0

    async def test_behandelt_den_unterstrich_als_zeichen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, gewaessername="Bach-1")
        mit_strich = await protokoll(surveyor, gewaessername="Bach_1")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="h_1"))

        assert [zeile.id for zeile in seite.zeilen] == [mit_strich.id]

    async def test_behandelt_reinen_leerraum_wie_keine_suche(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor)

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="   "))

        assert seite.gesamt == 1


class TestFilterZusammen:
    async def test_engt_ein_statt_zu_ersetzen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(
            surveyor, gewaessername="Argen", anlass="wrrl", status=Status.SUBMITTED
        )
        # Each of these matches two of the three conditions and must still be out.
        await protokoll(
            surveyor, gewaessername="Argen", anlass="best", status=Status.SUBMITTED
        )
        await protokoll(
            surveyor, gewaessername="Argen", anlass="wrrl", status=Status.REJECTED
        )
        await protokoll(
            surveyor, gewaessername="Schussen", anlass="wrrl", status=Status.SUBMITTED
        )

        seite = await liste_pruefliste(
            session,
            auswahl=Prueffilter(status=(Status.SUBMITTED,), anlass="wrrl", suche="Argen"),
        )

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]
        assert seite.gesamt == 1

    async def test_laesst_die_seitenzahl_von_den_filtern_abhaengen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        for _ in range(3):
            await protokoll(surveyor, anlass="wrrl")
        for _ in range(7):
            await protokoll(surveyor, anlass="best")

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(anlass="wrrl"), pro_seite=2
        )

        assert seite.gesamt == 3
        assert seite.seiten == 2


class TestSortierung:
    """Four orders over three protocols chosen so that each gives a different one."""

    @pytest.fixture
    async def drei(
        self, protokoll: Protokollfabrik, surveyor: User
    ) -> dict[str, uuid.UUID]:
        neckar = await protokoll(
            surveyor,
            gewaessername="Neckar",
            submitted_at=datetime(2026, 1, 1, 9, 0, tzinfo=UTC),
            datum=date(2026, 3, 1),
        )
        argen = await protokoll(
            surveyor,
            gewaessername="Argen",
            submitted_at=datetime(2026, 2, 1, 9, 0, tzinfo=UTC),
            datum=date(2026, 1, 15),
        )
        schussen = await protokoll(
            surveyor,
            gewaessername="Schussen",
            submitted_at=datetime(2026, 3, 1, 9, 0, tzinfo=UTC),
            datum=date(2026, 5, 20),
        )
        return {"neckar": neckar.id, "argen": argen.id, "schussen": schussen.id}

    async def test_stellt_ohne_angabe_die_laengste_wartezeit_nach_vorn(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session)

        assert [zeile.id for zeile in seite.zeilen] == [
            drei["neckar"],
            drei["argen"],
            drei["schussen"],
        ]

    async def test_sortiert_nach_der_aeltesten_abgabe(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, sortierung=Sortierung.EINGEREICHT_ALT)

        assert [zeile.id for zeile in seite.zeilen] == [
            drei["neckar"],
            drei["argen"],
            drei["schussen"],
        ]

    async def test_sortiert_nach_der_neuesten_abgabe(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, sortierung=Sortierung.EINGEREICHT_NEU)

        assert [zeile.id for zeile in seite.zeilen] == [
            drei["schussen"],
            drei["argen"],
            drei["neckar"],
        ]

    async def test_sortiert_nach_dem_tag_der_befischung(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, sortierung=Sortierung.DATUM_NEU)

        assert [zeile.id for zeile in seite.zeilen] == [
            drei["schussen"],
            drei["neckar"],
            drei["argen"],
        ]

    async def test_sortiert_nach_dem_gewaesser(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        seite = await liste_pruefliste(session, sortierung=Sortierung.GEWAESSER)

        assert [zeile.id for zeile in seite.zeilen] == [
            drei["argen"],
            drei["neckar"],
            drei["schussen"],
        ]

    async def test_sortiert_gewaesser_ohne_ruecksicht_auf_grossschreibung(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # Defect 2 in docs/ffs-defect-list.md is the legacy form lowercasing water
        # names, so both spellings are really in the data. A case-sensitive sort
        # would file every lowercased name in a block of its own.
        klein = await protokoll(surveyor, gewaessername="argen")
        gross = await protokoll(surveyor, gewaessername="Brenz")

        seite = await liste_pruefliste(session, sortierung=Sortierung.GEWAESSER)

        assert [zeile.id for zeile in seite.zeilen] == [klein.id, gross.id]

    async def test_ordnet_innerhalb_eines_gewaessers_nach_der_ortsangabe(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        unten = await protokoll(surveyor, gewaessername="Argen", ortsangabe="Amtzell")
        oben = await protokoll(surveyor, gewaessername="Argen", ortsangabe="Wangen")

        seite = await liste_pruefliste(session, sortierung=Sortierung.GEWAESSER)

        assert [zeile.id for zeile in seite.zeilen] == [unten.id, oben.id]

    @pytest.mark.parametrize("sortierung", list(Sortierung))
    async def test_bleibt_in_jeder_ordnung_stabil(
        self,
        session: AsyncSession,
        protokoll: Protokollfabrik,
        surveyor: User,
        sortierung: Sortierung,
    ) -> None:
        # Three rows agreeing on every sorted value, so only the tie-break can
        # decide. Without it the order is whatever the database felt like.
        for _ in range(3):
            await protokoll(surveyor)

        erste = [z.id for z in (await liste_pruefliste(session, sortierung=sortierung)).zeilen]
        zweite = [z.id for z in (await liste_pruefliste(session, sortierung=sortierung)).zeilen]

        assert erste == zweite
        assert len(erste) == 3

    async def test_sortiert_die_seite_und_nicht_nur_die_zeilen_darauf(
        self, session: AsyncSession, drei: dict[str, uuid.UUID]
    ) -> None:
        # The slice has to come out of the sorted set, not the sort out of the
        # slice, or page two would be the first page sorted differently.
        seite = await liste_pruefliste(
            session, sortierung=Sortierung.GEWAESSER, seite=2, pro_seite=1
        )

        assert [zeile.id for zeile in seite.zeilen] == [drei["neckar"]]
