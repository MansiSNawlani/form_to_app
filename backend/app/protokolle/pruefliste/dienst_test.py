"""What the Pruefliste lists, against a real database.

The question this file exists to pin down is the one in the spec's own table: the
queue is not "everything this account may look at", it is "everything that has
been handed in". The two differ by exactly one thing, the caller's own drafts, and
that difference is the first test below.
"""

import uuid
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, date, datetime, time

import pytest
from sqlalchemy import func, literal_column, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission, artcodes
from app.protokolle.pruefliste.dienst import (
    Prueffilter,
    Sortierung,
    liste_pruefliste,
    nachbarn,
)

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
        arten: Mapping[int, str] | None = None,
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

        # The catch table as the form stores it: a row per species, keyed by its
        # row number, and nothing else in it. The counts are left out on purpose.
        # The species filter must find a row by the species it names whether or
        # not anybody got as far as counting, and a fixture that always filled
        # the counts in would never say so.
        antworten: dict[str, str | dict[str, object]] = {}
        if arten is not None:
            antworten["arten"] = {f"art{nr}": {"name": code} for nr, code in arten.items()}

        eintrag = Submission(
            owner_user_id=besitzer.id,
            status=status,
            form_version="20260609",
            antworten=antworten,
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

    async def test_gibt_auf_fuenfzig_prozent_nicht_alles_zurueck(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, ortsangabe="Restwasserstrecke")
        await protokoll(surveyor, ortsangabe="Ausleitung")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="50%"))

        assert seite.zeilen == []

    async def test_findet_ein_wirkliches_prozentzeichen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The other half of the rule, and the one a mask that escaped too much
        # would break: a place really called this still has to be findable.
        treffer = await protokoll(surveyor, ortsangabe="Ausleitung, 50% Restwasser")
        await protokoll(surveyor, ortsangabe="Ausleitung, volle Wasserfuehrung")

        seite = await liste_pruefliste(session, auswahl=Prueffilter(suche="50%"))

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]

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


class TestArtfilter:
    """Searching the catch table, which is the one filter that is not a column.

    Every other filter here compares something the database indexed as a value of
    its own. This one asks whether any of up to twenty-six rows inside the
    antworten document names a species, which is why feature 12c was split out of
    12b and why these tests run against a real Postgres rather than a stand-in.
    """

    async def test_findet_das_protokoll_das_die_art_nennt(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        hecht = await protokoll(surveyor, arten={1: "HECH", 2: "BACH"})
        await protokoll(surveyor, arten={1: "AALE"})

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="HECH"))

        assert [zeile.id for zeile in seite.zeilen] == [hecht.id]

    async def test_findet_die_art_in_jeder_zeile_der_tabelle(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The twenty-sixth row is as findable as the first. A query written as one
        # comparison against arten.art1 would pass every other test in this class.
        spaet = await protokoll(surveyor, arten={1: "AALE", 26: "HECH"})

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="HECH"))

        assert [zeile.id for zeile in seite.zeilen] == [spaet.id]

    async def test_laesst_ein_protokoll_ohne_fangtabelle_draussen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # A document with no arten key at all, which is what a protocol imported
        # or written before part 6 was filled in looks like. The query has to
        # answer "no" rather than fail on the missing key.
        await protokoll(surveyor)

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="HECH"))

        assert seite.zeilen == []
        assert seite.gesamt == 0

    async def test_unterscheidet_zwei_codes_mit_gleichem_anfang(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The whole code or nothing. A filter that matched on a prefix would
        # answer "Aal" with every Aalquappe in the database.
        await protokoll(surveyor, arten={1: "AALQ"})

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="AALE"))

        assert seite.zeilen == []

    async def test_findet_kein_nachweis_wie_jede_andere_art(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # OFAN is an ordinary entry in the picker, so "which surveys found
        # nothing" is a question the queue answers with no extra code.
        ohne_fang = await protokoll(surveyor, arten={1: "OFAN"})
        await protokoll(surveyor, arten={1: "HECH"})

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="OFAN"))

        assert [zeile.id for zeile in seite.zeilen] == [ohne_fang.id]

    async def test_uebergeht_eine_zeile_ohne_art(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # A started row that names nothing is stored as an empty name, so the
        # extracted codes hold a "" that must not match a real search.
        await protokoll(surveyor, arten={1: "", 2: "HECH"})

        leer = await liste_pruefliste(session, auswahl=Prueffilter(art=""))
        treffer = await liste_pruefliste(session, auswahl=Prueffilter(art="HECH"))

        # An empty filter is no filter, the same as an empty search box.
        assert len(leer.zeilen) == 1
        assert len(treffer.zeilen) == 1

    async def test_findet_nichts_zu_einem_unbekannten_code(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # A hand-typed address rather than the picker. An empty answer, not a
        # failure: the code lists belong to a form version, and refusing anything
        # the current list lacks would refuse a code an older protocol may
        # legitimately carry.
        await protokoll(surveyor, arten={1: "HECH"})

        seite = await liste_pruefliste(session, auswahl=Prueffilter(art="GIBTESNICHT"))

        assert seite.zeilen == []
        assert seite.gesamt == 0

    async def test_zaehlt_nur_die_protokolle_mit_der_art(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        for _ in range(3):
            await protokoll(surveyor, arten={1: "HECH"})
        for _ in range(7):
            await protokoll(surveyor, arten={1: "AALE"})

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(art="HECH"), pro_seite=2
        )

        assert seite.gesamt == 3
        assert seite.seiten == 2

    async def test_engt_zusammen_mit_dem_jahr_ein(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(
            surveyor, arten={1: "HECH"}, datum=date(2026, 6, 9)
        )
        # Each of these matches one of the two conditions and must still be out.
        await protokoll(surveyor, arten={1: "HECH"}, datum=date(2025, 6, 9))
        await protokoll(surveyor, arten={1: "AALE"}, datum=date(2026, 6, 9))

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(jahr=2026, art="HECH")
        )

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]
        assert seite.gesamt == 1

    async def test_engt_zusammen_mit_dem_status_ein(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        treffer = await protokoll(
            surveyor, arten={1: "HECH"}, status=Status.SUBMITTED
        )
        await protokoll(surveyor, arten={1: "HECH"}, status=Status.REJECTED)
        await protokoll(surveyor, arten={1: "AALE"}, status=Status.SUBMITTED)

        seite = await liste_pruefliste(
            session, auswahl=Prueffilter(status=(Status.SUBMITTED,), art="HECH")
        )

        assert [zeile.id for zeile in seite.zeilen] == [treffer.id]
        assert seite.gesamt == 1


class TestArtindex:
    """That the species query can actually use the index built for it.

    The one thing about feature 12c that a passing query test says nothing about.
    Postgres decides whether an expression index applies by comparing expression
    trees, so the query in this module and ix_submissions_artcodes have to agree
    exactly. They are written in two places that cannot import each other: the
    index is created by a migration, which must not reach into app/, and the query
    is built by app/models/protokoll.py's artcodes(). If either is edited alone,
    every other test here still passes and the queue quietly goes back to reading
    every protocol on disk for each search.

    Sequential scans are discouraged rather than forbidden, because the test
    database holds a handful of rows and a full read of those is genuinely the
    cheaper plan. What is being asked is not "would the planner choose the index
    today" but "can it use it at all", which is exactly the question drift in the
    expression changes the answer to.
    """

    async def test_kann_den_index_benutzen(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        await protokoll(surveyor, arten={1: "HECH"})

        # LOCAL, so it dies with the transaction the test is rolled back in.
        await session.execute(text("SET LOCAL enable_seqscan = off"))

        # Everything spelled out rather than bound, because EXPLAIN has to see the
        # whole statement. The left side is the expression under test, built by
        # the same artcodes() the queue uses.
        anfrage = (
            select(func.count())
            .select_from(Submission)
            .where(artcodes().op("@>")(literal_column('\'["HECH"]\'::jsonb')))
        )
        # SQLAlchemy ships no annotation for postgresql.dialect(), and the dialect
        # has to be named: compiled against the default one, JSONPATH and @> would
        # not render at all.
        sql = anfrage.compile(
            dialect=postgresql.dialect(),  # type: ignore[no-untyped-call]
            compile_kwargs={"literal_binds": True},
        )
        plan = (await session.execute(text(f"EXPLAIN {sql}"))).scalars().all()

        gefunden = any("ix_submissions_artcodes" in zeile for zeile in plan)
        assert gefunden, (
            "Die Artabfrage findet ix_submissions_artcodes nicht. Der Ausdruck in"
            " app/models/protokoll.py und der im Migrationsskript sind"
            " auseinandergelaufen. Plan: " + " | ".join(plan)
        )


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


class TestNachbarn:
    """Who stands either side of one protocol, in the list as it was filtered.

    The question the reviewer's Vorheriges and Naechstes buttons ask. Every test
    here is really one assertion: that this and liste_pruefliste are the same
    list, whatever it was narrowed or ordered by.
    """

    @pytest.fixture
    async def vier(self, protokoll: Protokollfabrik, surveyor: User) -> list[uuid.UUID]:
        """Four protocols an hour apart, so the default order is the order below."""
        eintraege = [
            await protokoll(
                surveyor,
                gewaessername=name,
                submitted_at=datetime(2026, 7, 1, stunde, 0, tzinfo=UTC),
            )
            for stunde, name in enumerate(("Argen", "Brenz", "Donau", "Enz"), start=9)
        ]
        return [eintrag.id for eintrag in eintraege]

    async def test_nennt_beide_nachbarn_in_der_mitte(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        umgebung = await nachbarn(session, vier[1])

        assert umgebung.position == 2
        assert umgebung.vorheriges is not None
        assert umgebung.vorheriges.id == vier[0]
        assert umgebung.naechstes is not None
        assert umgebung.naechstes.id == vier[2]

    async def test_hat_vor_dem_ersten_nichts(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        umgebung = await nachbarn(session, vier[0])

        assert umgebung.position == 1
        assert umgebung.vorheriges is None
        assert umgebung.naechstes is not None
        assert umgebung.naechstes.id == vier[1]

    async def test_hat_nach_dem_letzten_nichts(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        umgebung = await nachbarn(session, vier[3])

        assert umgebung.position == 4
        assert umgebung.vorheriges is not None
        assert umgebung.vorheriges.id == vier[2]
        assert umgebung.naechstes is None

    async def test_hat_als_einziges_protokoll_gar_keine_nachbarn(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        allein = await protokoll(surveyor)

        umgebung = await nachbarn(session, allein.id)

        assert umgebung.position == 1
        assert umgebung.vorheriges is None
        assert umgebung.naechstes is None

    async def test_nennt_das_gewaesser_des_nachbarn(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        # The button says what it opens. Two buttons announcing only "Vorheriges"
        # and "Naechstes" tell a screen reader nothing about where they go.
        umgebung = await nachbarn(session, vier[0])

        assert umgebung.naechstes is not None
        assert umgebung.naechstes.gewaessername == "Brenz"

    async def test_kennt_ein_protokoll_ausserhalb_der_liste_nicht(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        # The everyday case: a protocol accepted a moment ago has left an "Offen"
        # queue, and the screen it is still being read on asks about it anyway.
        await protokoll(surveyor)
        angenommen = await protokoll(surveyor, status=Status.LOCKED)

        umgebung = await nachbarn(
            session, angenommen.id, auswahl=Prueffilter(status=(Status.SUBMITTED,))
        )

        assert umgebung.position is None
        assert umgebung.seite is None
        assert umgebung.vorheriges is None
        assert umgebung.naechstes is None

    async def test_kennt_einen_entwurf_nicht(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        entwurf = await protokoll(surveyor, status=Status.DRAFT)

        umgebung = await nachbarn(session, entwurf.id)

        assert umgebung.position is None

    async def test_kennt_eine_unbekannte_id_nicht(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        umgebung = await nachbarn(session, uuid.uuid4())

        assert umgebung.position is None
        assert umgebung.vorheriges is None
        assert umgebung.naechstes is None

    async def test_ueberspringt_was_der_statusfilter_auslaesst(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        erstes = await protokoll(
            surveyor, submitted_at=datetime(2026, 7, 1, 9, 0, tzinfo=UTC)
        )
        await protokoll(
            surveyor,
            status=Status.REJECTED,
            submitted_at=datetime(2026, 7, 1, 10, 0, tzinfo=UTC),
        )
        drittes = await protokoll(
            surveyor, submitted_at=datetime(2026, 7, 1, 11, 0, tzinfo=UTC)
        )

        umgebung = await nachbarn(
            session, erstes.id, auswahl=Prueffilter(status=(Status.SUBMITTED,))
        )

        assert umgebung.naechstes is not None
        assert umgebung.naechstes.id == drittes.id

    async def test_ueberspringt_was_der_artfilter_auslaesst(
        self, session: AsyncSession, protokoll: Protokollfabrik, surveyor: User
    ) -> None:
        erstes = await protokoll(
            surveyor,
            submitted_at=datetime(2026, 7, 1, 9, 0, tzinfo=UTC),
            arten={1: "HECH"},
        )
        await protokoll(
            surveyor,
            submitted_at=datetime(2026, 7, 1, 10, 0, tzinfo=UTC),
            arten={1: "AALA"},
        )
        drittes = await protokoll(
            surveyor,
            submitted_at=datetime(2026, 7, 1, 11, 0, tzinfo=UTC),
            arten={3: "HECH"},
        )

        umgebung = await nachbarn(session, erstes.id, auswahl=Prueffilter(art="HECH"))

        assert umgebung.naechstes is not None
        assert umgebung.naechstes.id == drittes.id

    @pytest.mark.parametrize(
        ("sortierung", "davor", "danach"),
        [
            (Sortierung.EINGEREICHT_ALT, "neckar", "schussen"),
            (Sortierung.EINGEREICHT_NEU, "schussen", "neckar"),
            (Sortierung.DATUM_NEU, "neckar", None),
            (Sortierung.GEWAESSER, None, "neckar"),
        ],
    )
    async def test_folgt_der_gewaehlten_ordnung(
        self,
        session: AsyncSession,
        protokoll: Protokollfabrik,
        surveyor: User,
        sortierung: Sortierung,
        davor: str | None,
        danach: str | None,
    ) -> None:
        """The same three protocols give the Argen four different neighbours."""
        drei = {
            "neckar": await protokoll(
                surveyor,
                gewaessername="Neckar",
                submitted_at=datetime(2026, 1, 1, 9, 0, tzinfo=UTC),
                datum=date(2026, 3, 1),
            ),
            "argen": await protokoll(
                surveyor,
                gewaessername="Argen",
                submitted_at=datetime(2026, 2, 1, 9, 0, tzinfo=UTC),
                datum=date(2026, 1, 15),
            ),
            "schussen": await protokoll(
                surveyor,
                gewaessername="Schussen",
                submitted_at=datetime(2026, 3, 1, 9, 0, tzinfo=UTC),
                datum=date(2026, 5, 20),
            ),
        }

        umgebung = await nachbarn(session, drei["argen"].id, sortierung=sortierung)

        vorher = None if umgebung.vorheriges is None else umgebung.vorheriges.id
        nachher = None if umgebung.naechstes is None else umgebung.naechstes.id
        assert vorher == (None if davor is None else drei[davor].id)
        assert nachher == (None if danach is None else drei[danach].id)

    @pytest.mark.parametrize("sortierung", list(Sortierung))
    async def test_steht_in_derselben_reihenfolge_wie_die_liste(
        self,
        session: AsyncSession,
        protokoll: Protokollfabrik,
        surveyor: User,
        sortierung: Sortierung,
    ) -> None:
        # Three rows agreeing on every sorted value, so only the tie-break can
        # decide. A neighbour query without it would put them in one order and
        # the list they came from in another.
        for _ in range(3):
            await protokoll(surveyor)

        seite = await liste_pruefliste(session, sortierung=sortierung)
        mitte = seite.zeilen[1].id

        umgebung = await nachbarn(session, mitte, sortierung=sortierung)

        assert umgebung.position == 2
        assert umgebung.vorheriges is not None
        assert umgebung.vorheriges.id == seite.zeilen[0].id
        assert umgebung.naechstes is not None
        assert umgebung.naechstes.id == seite.zeilen[2].id

    async def test_nennt_die_seite_auf_der_das_protokoll_steht(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        # Two to a page puts the third protocol at the top of page two, and its
        # predecessor at the bottom of page one. Getting this wrong sends the
        # reader back to a page their protocol is not on.
        umgebung = await nachbarn(session, vier[2], pro_seite=2)

        assert umgebung.seite == 2
        assert umgebung.vorheriges is not None
        assert umgebung.vorheriges.seite == 1
        assert umgebung.naechstes is not None
        assert umgebung.naechstes.seite == 2

    async def test_nennt_die_seite_die_auch_die_liste_zeigt(
        self, session: AsyncSession, vier: list[uuid.UUID]
    ) -> None:
        umgebung = await nachbarn(session, vier[2], pro_seite=2)

        assert umgebung.seite is not None
        seite = await liste_pruefliste(session, seite=umgebung.seite, pro_seite=2)
        assert vier[2] in [zeile.id for zeile in seite.zeilen]
