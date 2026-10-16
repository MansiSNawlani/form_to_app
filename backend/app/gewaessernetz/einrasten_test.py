import pytest
from geoalchemy2 import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.beispiele import ENZ, MAI_2025, MAI_2026, fliess, netz, see, stand
from app.gewaessernetz.einrasten import (
    WARNABSTAND_M,
    Gewaehlt,
    abstand_m,
    einrasten,
    ist_fern,
)
from app.models.gewaessernetz import SRID, Gewaessernetz, Netzart

# flussnetz() lays the Rhein, Neckar and Enz all along 500000..500100 at
# 5400000, so these tests put the waters they snap to somewhere of their own.
WEIT_WEG = 600000


class TestAbstand:
    def test_gerade_strecke(self) -> None:
        assert abstand_m((500000, 5400000), (500030, 5400040)) == 50

    def test_rundet_auf_ganze_meter(self) -> None:
        assert abstand_m((500000, 5400000), (500001, 5400001)) == 1

    def test_derselbe_punkt(self) -> None:
        assert abstand_m((500000, 5400000), (500000, 5400000)) == 0


class TestIstFern:
    def test_genau_die_grenze_ist_nicht_fern(self) -> None:
        assert not ist_fern(WARNABSTAND_M)

    def test_ein_meter_mehr_ist_fern(self) -> None:
        assert ist_fern(WARNABSTAND_M + 1)

    def test_die_grenze_ist_hundert_meter(self) -> None:
        assert WARNABSTAND_M == 100


class TestEinrasten:
    async def test_ohne_geladenen_stand(self, session: AsyncSession) -> None:
        ergebnis = await einrasten(session, (500050, 5400010))
        assert ergebnis.stand is None
        assert ergebnis.treffer is None

    async def test_rastet_auf_die_linie_ein(self, session: AsyncSession) -> None:
        await netz(session)

        ergebnis = await einrasten(session, (500050, 5400030))

        assert ergebnis.stand == MAI_2025
        assert ergebnis.treffer is not None
        assert (ergebnis.treffer.rw, ergebnis.treffer.hw) == (500050, 5400000)
        assert ergebnis.treffer.entfernung_m == 30
        assert ergebnis.treffer.art is Netzart.FLIESSGEWAESSER

    async def test_naechstes_gewaesser_gewinnt(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384100000000", "Mühlbach", ENZ, "Enz", WEIT_WEG, 5400000))

        ergebnis = await einrasten(session, (WEIT_WEG + 50, 5400020))

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.name == "Mühlbach"
        assert ergebnis.treffer.kennung == "2384100000000"

    async def test_das_gewaehlte_gewinnt_vor_dem_naechsten(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384100000000", "Mühlbach", ENZ, "Enz", WEIT_WEG, 5400000))

        ergebnis = await einrasten(
            session, (WEIT_WEG + 50, 5400020), Gewaehlt(ENZ, "Enz", MAI_2025)
        )

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.kennung == ENZ
        assert (ergebnis.treffer.rw, ergebnis.treffer.hw) == (500100, 5400000)

    async def test_die_wahl_vergleicht_den_namen_locker(self, session: AsyncSession) -> None:
        await netz(session)

        ergebnis = await einrasten(session, (500050, 5400010), Gewaehlt(ENZ, " ENZ ", MAI_2025))

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.kennung == ENZ

    async def test_eine_unbekannte_wahl_findet_nichts(self, session: AsyncSession) -> None:
        await netz(session)

        ergebnis = await einrasten(
            session, (500050, 5400010), Gewaehlt("2399999999999", "Enz", MAI_2025)
        )

        assert ergebnis.stand == MAI_2025
        assert ergebnis.treffer is None

    async def test_eine_wahl_mit_fremdem_namen_findet_nichts(self, session: AsyncSession) -> None:
        await netz(session)

        ergebnis = await einrasten(session, (500050, 5400010), Gewaehlt(ENZ, "Nagold", MAI_2025))

        assert ergebnis.treffer is None

    async def test_eine_wahl_aus_einem_nicht_geladenen_stand(self, session: AsyncSession) -> None:
        await netz(session)

        ergebnis = await einrasten(session, (500050, 5400010), Gewaehlt(ENZ, "Enz", MAI_2026))

        assert ergebnis.stand is None
        assert ergebnis.treffer is None

    async def test_ein_punkt_im_see_bleibt_wo_er_ist(self, session: AsyncSession) -> None:
        # see() is the triangle (rw, hw), (rw, hw + 50), (rw + 50, hw + 50).
        await netz(session, see("7174", "Rechentshofener Weiher", WEIT_WEG, 5400000))

        ergebnis = await einrasten(session, (WEIT_WEG + 10, 5400040))

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.art is Netzart.STEHENDES_GEWAESSER
        assert (ergebnis.treffer.rw, ergebnis.treffer.hw) == (WEIT_WEG + 10, 5400040)
        assert ergebnis.treffer.entfernung_m == 0

    async def test_ein_punkt_neben_dem_see_rastet_ans_ufer_ein(self, session: AsyncSession) -> None:
        await netz(session, see("7174", "Rechentshofener Weiher", WEIT_WEG, 5400000))

        ergebnis = await einrasten(session, (WEIT_WEG + 20, 5400080))

        assert ergebnis.treffer is not None
        assert (ergebnis.treffer.rw, ergebnis.treffer.hw) == (WEIT_WEG + 20, 5400050)
        assert ergebnis.treffer.entfernung_m == 30

    async def test_ein_namenloser_graben_wird_gefunden(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384110000000", "NN-YBP", ENZ, "Enz", WEIT_WEG, 5400000))

        ergebnis = await einrasten(session, (WEIT_WEG + 50, 5400005))

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.name == "NN-YBP"

    async def test_ohne_wahl_der_neueste_stand(self, session: AsyncSession) -> None:
        await netz(session)
        await stand(session, MAI_2026)
        session.add(
            Gewaessernetz(
                stand=MAI_2026,
                art=Netzart.FLIESSGEWAESSER,
                kennung=ENZ,
                name="Enz",
                geometrie=WKTElement(
                    f"MULTILINESTRING(({WEIT_WEG} 5400000, {WEIT_WEG + 100} 5400000))", srid=SRID
                ),
            )
        )
        await session.flush()

        ergebnis = await einrasten(session, (500050, 5400010))

        assert ergebnis.stand == MAI_2026
        assert ergebnis.treffer is not None
        assert ergebnis.treffer.rw == WEIT_WEG

    @pytest.mark.parametrize("rw", [500000, 500100])
    async def test_ein_punkt_auf_dem_wasser_ist_null_meter_entfernt(
        self, session: AsyncSession, rw: int
    ) -> None:
        await netz(session)

        ergebnis = await einrasten(session, (rw, 5400000))

        assert ergebnis.treffer is not None
        assert ergebnis.treffer.entfernung_m == 0
