from datetime import date
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.beispiele import fliessgewaesser, stehende
from app.gewaessernetz.dienst import lade_stand, liste_staende, stand_passt
from app.gewaessernetz.fehler import StandBereitsGeladen, StandPasstNicht, UngueltigerEintrag
from app.gewaessernetz.lesen import oeffne
from app.models.gewaessernetz import Gewaessernetz, GewaessernetzStand, Netzart

MAI_2025 = date(2025, 5, 1)


def dateien(
    ordner: Path,
    fliess: list[dict[str, Any]] | None = None,
    steh: list[dict[str, Any]] | None = None,
    stand: str = "Mai 2025",
) -> tuple[Path, Path]:
    (ordner / "fg").mkdir()
    (ordner / "sg").mkdir()
    fliess = (
        fliess if fliess is not None else [{"kennzahl": 2381333920000.0 + i * 10} for i in range(3)]
    )
    steh = steh if steh is not None else [{"see_id": 7174.0 + i} for i in range(2)]
    return (
        fliessgewaesser(ordner / "fg", [{**satz, "stand": stand} for satz in fliess]),
        stehende(ordner / "sg", [{**satz, "stand": stand} for satz in steh]),
    )


async def laden(session: AsyncSession, stand: date, fg: Path, sg: Path) -> GewaessernetzStand:
    with oeffne(fg, Netzart.FLIESSGEWAESSER) as f, oeffne(sg, Netzart.STEHENDES_GEWAESSER) as s:
        return await lade_stand(session, stand, f, s)


async def zaehle(session: AsyncSession, stand: date | None = None) -> int:
    abfrage = select(func.count()).select_from(Gewaessernetz)
    if stand is not None:
        abfrage = abfrage.where(Gewaessernetz.stand == stand)
    return int((await session.execute(abfrage)).scalar_one())


class TestStandPasst:
    @pytest.mark.parametrize(
        ("stand", "staende", "passt"),
        [
            (date(2025, 5, 1), {"Mai 2025"}, True),
            (date(2025, 5, 20), {"Mai 2025"}, True),
            (date(2025, 3, 1), {"März 2025"}, True),
            (date(2025, 6, 1), {"Mai 2025"}, False),
            (date(2026, 5, 1), {"Mai 2025"}, False),
            (date(2025, 5, 1), {"Mai 2025", "Juni 2025"}, False),
            (date(2025, 5, 1), {"irgendwann"}, False),
            (date(2025, 5, 1), set(), False),
        ],
    )
    def test_vergleicht_monat_und_jahr(self, stand: date, staende: set[str], passt: bool) -> None:
        assert stand_passt(stand, frozenset(staende)) is passt


class TestLaden:
    async def test_laedt_beide_arten_mit_ihren_anzahlen(
        self, session: AsyncSession, tmp_path: Path
    ) -> None:
        geladen = await laden(session, MAI_2025, *dateien(tmp_path))

        assert geladen.stand == MAI_2025
        assert (geladen.anzahl_fliessgewaesser, geladen.anzahl_stehende) == (3, 2)
        assert await zaehle(session) == 5

        geometrie = await session.execute(
            select(func.ST_AsText(Gewaessernetz.geometrie), func.ST_SRID(Gewaessernetz.geometrie))
            .where(Gewaessernetz.art == Netzart.FLIESSGEWAESSER)
            .limit(1)
        )
        wkt, srid = geometrie.one()
        assert wkt.startswith("MULTILINESTRING")
        assert srid == 25832

    async def test_weist_einen_stand_ab_der_schon_geladen_ist(
        self, session: AsyncSession, tmp_path: Path
    ) -> None:
        fg, sg = dateien(tmp_path)
        await laden(session, MAI_2025, fg, sg)

        with pytest.raises(StandBereitsGeladen):
            await laden(session, MAI_2025, fg, sg)
        assert await zaehle(session) == 5

    async def test_weist_einen_stand_ab_der_nicht_zur_datei_passt(
        self, session: AsyncSession, tmp_path: Path
    ) -> None:
        with pytest.raises(StandPasstNicht) as fehler:
            await laden(session, date(2026, 5, 1), *dateien(tmp_path))
        assert fehler.value.staende == frozenset({"Mai 2025"})
        assert await zaehle(session) == 0

    async def test_hinterlaesst_nichts_wenn_ein_satz_scheitert(
        self, session: AsyncSession, tmp_path: Path
    ) -> None:
        # The bad record comes last, so the good ones have already been sent.
        steh = [{"see_id": 7174.0}, {"see_id": 7175.5}]
        with pytest.raises(UngueltigerEintrag):
            await laden(session, MAI_2025, *dateien(tmp_path, steh=steh))

        assert await zaehle(session) == 0
        assert await session.get(GewaessernetzStand, MAI_2025) is None

    async def test_zwei_staende_liegen_nebeneinander(
        self, session: AsyncSession, tmp_path: Path
    ) -> None:
        (tmp_path / "a").mkdir()
        (tmp_path / "b").mkdir()
        await laden(session, MAI_2025, *dateien(tmp_path / "a"))
        await laden(session, date(2026, 4, 1), *dateien(tmp_path / "b", stand="April 2026"))

        assert await zaehle(session, MAI_2025) == 5
        assert await zaehle(session, date(2026, 4, 1)) == 5
        assert [s.stand for s in await liste_staende(session)] == [date(2026, 4, 1), MAI_2025]

    async def test_die_datenbank_haelt_die_kennzahl_in_form(self, session: AsyncSession) -> None:
        # The reader never produces "2381333920000.0", and the table refuses it
        # if anything else ever does.
        await session.execute(
            text(
                "INSERT INTO gewaessernetz_stand (stand, anzahl_fliessgewaesser, anzahl_stehende)"
                " VALUES ('2025-05-01', 0, 0)"
            )
        )
        with pytest.raises(Exception, match="kennung_form"):
            await session.execute(
                text(
                    "INSERT INTO gewaessernetz (id, stand, art, kennung, name, geometrie) VALUES"
                    " (gen_random_uuid(), '2025-05-01', 'FLIESSGEWAESSER', '2381333920000.0', 'x',"
                    " ST_GeomFromText('MULTILINESTRING((0 0, 1 1))', 25832))"
                )
            )
