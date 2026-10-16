import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.beispiele import ENZ, MAI_2025, MAI_2026, fliess, netz, stand
from app.gewaessernetz.kennung import (
    KENNUNG_PASST_NICHT,
    datensatzversion,
    pruefe_gewaesserkennung,
    stand_aus_version,
)
from app.protokolle.formregeln.regel import Formverstoss
from app.protokolle.zuordnung.regeln import GEWAESSERNAME

MUEHLBACH = "2384100000000"
FALSCH = [Formverstoss(pfad=GEWAESSERNAME, schluessel=KENNUNG_PASST_NICHT)]


def antworten(
    name: str | None = "Mühlbach",
    kennung: str | None = MUEHLBACH,
    version: str | None = "AWGN 2025-05-01",
) -> dict[str, object]:
    gewaesser = {
        "gewaessername": name,
        "amtliche_id": kennung,
        "gis_dataset_version": version,
    }
    return {"probestrecke": {"gewaesser": {k: v for k, v in gewaesser.items() if v is not None}}}


class TestVersion:
    def test_hin_und_zurueck(self) -> None:
        assert datensatzversion(MAI_2025) == "AWGN 2025-05-01"
        assert stand_aus_version("AWGN 2025-05-01") == MAI_2025

    @pytest.mark.parametrize(
        "text", ["", "AWGN", "AWGN 2025-5-1", "2025-05-01", "AWGN 2025-13-01", "awgn 2025-05-01"]
    )
    def test_alles_andere_ist_keine_version(self, text: str) -> None:
        assert stand_aus_version(text) is None


class TestPruefung:
    async def test_eine_passende_wahl(self, session: AsyncSession) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert await pruefe_gewaesserkennung(session, antworten()) == []

    async def test_der_name_zaehlt_ohne_gross_klein_und_leerzeichen(
        self, session: AsyncSession
    ) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert await pruefe_gewaesserkennung(session, antworten(name=" MÜHLBACH ")) == []

    async def test_ohne_kennung_wie_bisher(self, session: AsyncSession) -> None:
        """Nothing loaded, nothing picked: exactly as before 18c."""
        assert await pruefe_gewaesserkennung(session, antworten(kennung=None, version=None)) == []

    async def test_ein_aelterer_stand_zaehlt_weiter(self, session: AsyncSession) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        await stand(session, MAI_2026)
        assert await pruefe_gewaesserkennung(session, antworten()) == []

    async def test_ein_geaenderter_name(self, session: AsyncSession) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert await pruefe_gewaesserkennung(session, antworten(name="Mühlgraben")) == FALSCH

    async def test_eine_unbekannte_kennung(self, session: AsyncSession) -> None:
        await netz(session)
        assert await pruefe_gewaesserkennung(session, antworten()) == FALSCH

    async def test_ein_nicht_geladener_stand(self, session: AsyncSession) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert (
            await pruefe_gewaesserkennung(session, antworten(version="AWGN 2024-05-01")) == FALSCH
        )

    @pytest.mark.parametrize("version", [None, "irgendwas"])
    async def test_kennung_ohne_lesbaren_stand(
        self, session: AsyncSession, version: str | None
    ) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert await pruefe_gewaesserkennung(session, antworten(version=version)) == FALSCH

    async def test_stand_ohne_kennung(self, session: AsyncSession) -> None:
        await netz(session, fliess(MUEHLBACH, "Mühlbach", ENZ, "Enz"))
        assert await pruefe_gewaesserkennung(session, antworten(kennung=None)) == FALSCH

    async def test_kein_name_ist_sache_der_vollstaendigkeit(self, session: AsyncSession) -> None:
        """One message per field: a missing name is already reported as missing."""
        await netz(session)
        assert await pruefe_gewaesserkennung(session, antworten(name=None)) == []
