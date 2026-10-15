from datetime import date

import pytest
from geoalchemy2 import WKTElement
from sqlalchemy import literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.gewaessernetz.suche import (
    MAX_TREFFER,
    kette_fuer_formular,
    suche,
    suchform,
    suchform_sql,
)
from app.models.gewaessernetz import SRID, Gewaessernetz, GewaessernetzStand, Netzart

MAI_2025 = date(2025, 5, 1)
MAI_2026 = date(2026, 5, 1)

RHEIN = "2000000000000"
NECKAR = "2380000000000"
ENZ = "2384000000000"


class TestSuchform:
    @pytest.mark.parametrize(
        ("eingabe", "erwartet"),
        [
            ("Mühlbach", "muehlbach"),
            ("  MÜHLBACH ", "muehlbach"),
            ("Muehlbach", "muehlbach"),
            ("Weißach", "weissach"),
            ("Schwäbische Rezat", "schwaebische rezat"),
            ("Bodensee - Obersee", "bodensee - obersee"),
            ("Öhringer Graben", "oehringer graben"),
        ],
    )
    def test_faltet_gross_klein_und_umlaute(self, eingabe: str, erwartet: str) -> None:
        assert suchform(eingabe) == erwartet


class TestKetteFuerFormular:
    def test_eine_kette_die_am_rhein_endet(self) -> None:
        assert kette_fuer_formular(["Enz", "Neckar", "Rhein"]) == ("Enz", "Neckar", "Rhein")

    def test_endet_beim_ersten_endpunkt(self) -> None:
        assert kette_fuer_formular(["Rhein", "Irgendwas"]) == ("Rhein",)

    def test_fuenf_glieder_passen(self) -> None:
        kette = ["A", "B", "C", "D", "Donau"]
        assert kette_fuer_formular(kette) == tuple(kette)

    def test_sechs_glieder_passen_nicht(self) -> None:
        assert kette_fuer_formular(["A", "B", "C", "D", "E", "Rhein"]) is None

    def test_eine_kette_ohne_endpunkt(self) -> None:
        assert kette_fuer_formular(["A", "B"]) is None

    def test_keine_kette(self) -> None:
        assert kette_fuer_formular([]) is None


async def stand(session: AsyncSession, tag: date = MAI_2025) -> None:
    session.add(GewaessernetzStand(stand=tag, anzahl_fliessgewaesser=0, anzahl_stehende=0))
    await session.flush()


def fliess(
    kennung: str,
    name: str,
    vorfluter: str | None = None,
    vorfluter_name: str | None = None,
    rw: int = 500000,
    hw: int = 5400000,
    tag: date = MAI_2025,
) -> Gewaessernetz:
    return Gewaessernetz(
        stand=tag,
        art=Netzart.FLIESSGEWAESSER,
        kennung=kennung,
        name=name,
        vorfluter_kennung=vorfluter,
        vorfluter_name=vorfluter_name,
        geometrie=WKTElement(f"MULTILINESTRING(({rw} {hw}, {rw + 100} {hw}))", srid=SRID),
    )


def see(kennung: str, name: str, rw: int = 500000, hw: int = 5400000) -> Gewaessernetz:
    return Gewaessernetz(
        stand=MAI_2025,
        art=Netzart.STEHENDES_GEWAESSER,
        kennung=kennung,
        name=name,
        geometrie=WKTElement(
            f"MULTIPOLYGON((({rw} {hw}, {rw} {hw + 50}, {rw + 50} {hw + 50}, {rw} {hw})))",
            srid=SRID,
        ),
    )


def flussnetz() -> list[Gewaessernetz]:
    return [
        fliess(RHEIN, "Rhein"),
        fliess(NECKAR, "Neckar", RHEIN, "Rhein"),
        fliess(ENZ, "Enz", NECKAR, "Neckar"),
    ]


async def netz(session: AsyncSession, *gewaesser: Gewaessernetz) -> None:
    await stand(session)
    session.add_all([*flussnetz(), *gewaesser])
    await session.flush()


class TestSuchformInSql:
    @pytest.mark.parametrize(
        "name", ["Mühlbach", "  MÜHLBACH ", "Weißach", "Öhringer Graben", "Bodensee - Obersee"]
    )
    async def test_faltet_wie_python(self, session: AsyncSession, name: str) -> None:
        gefaltet = (await session.execute(select(suchform_sql(literal(name))))).scalar_one()
        assert gefaltet == suchform(name)


class TestSuche:
    async def test_ohne_geladenen_stand(self, session: AsyncSession) -> None:
        ergebnis = await suche(session, "Neckar")
        assert ergebnis.stand is None
        assert ergebnis.treffer == []

    async def test_findet_ohne_umlaut_und_gross_klein(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384100000000", "Mühlbach", ENZ, "Enz"))

        ergebnis = await suche(session, "MUEHLB")

        assert ergebnis.stand == MAI_2025
        assert [t.name for t in ergebnis.treffer] == ["Mühlbach"]

    async def test_anfang_vor_mitte(self, session: AsyncSession) -> None:
        await netz(
            session,
            fliess("2384100000000", "Oberer Mühlbach", ENZ, "Enz"),
            fliess("2384200000000", "Mühlbach", ENZ, "Enz"),
            fliess("2384300000000", "Mühlkanal", ENZ, "Enz"),
        )

        ergebnis = await suche(session, "mühl")

        assert [t.name for t in ergebnis.treffer] == ["Mühlbach", "Mühlkanal", "Oberer Mühlbach"]

    async def test_platzhalter_bleiben_weg(self, session: AsyncSession) -> None:
        await netz(session, see("7174", "NN-YBP"), see("7175", "Nonnensee"))

        ergebnis = await suche(session, "n")

        assert "NN-YBP" not in [t.name for t in ergebnis.treffer]
        assert "Nonnensee" in [t.name for t in ergebnis.treffer]

    async def test_prozent_ist_kein_platzhalter(self, session: AsyncSession) -> None:
        await netz(session)
        assert (await suche(session, "%")).treffer == []

    async def test_hoechstens_zwanzig(self, session: AsyncSession) -> None:
        await netz(
            session,
            *(fliess(f"23841{i:02d}000000", f"Mühlbach {i}", ENZ, "Enz") for i in range(25)),
        )
        assert len((await suche(session, "Mühlbach")).treffer) == MAX_TREFFER

    async def test_naechste_zuerst_mit_entfernung(self, session: AsyncSession) -> None:
        await netz(
            session,
            fliess("2384100000000", "Mühlbach", ENZ, "Enz", rw=510000, hw=5400000),
            fliess("2384200000000", "Mühlbach", ENZ, "Enz", rw=501000, hw=5400000),
        )

        ergebnis = await suche(session, "Mühlbach", [(500100, 5400000), (530000, 5400000)])

        assert [t.kennung for t in ergebnis.treffer] == ["2384200000000", "2384100000000"]
        assert [t.entfernung_m for t in ergebnis.treffer] == [900, 9900]

    async def test_ohne_punkt_keine_entfernung(self, session: AsyncSession) -> None:
        await netz(session)
        assert all(t.entfernung_m is None for t in (await suche(session, "Neckar")).treffer)

    async def test_nur_der_neueste_stand(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384100000000", "Alter Bach", ENZ, "Enz"))
        await stand(session, MAI_2026)
        session.add(fliess("2384100000000", "Neuer Bach", tag=MAI_2026))
        await session.flush()

        ergebnis = await suche(session, "bach")

        assert ergebnis.stand == MAI_2026
        assert [t.name for t in ergebnis.treffer] == ["Neuer Bach"]

    async def test_kette_und_vorfluter(self, session: AsyncSession) -> None:
        await netz(session, fliess("2384100000000", "Mühlbach", ENZ, "Enz"))

        (treffer,) = (await suche(session, "Mühlbach")).treffer

        assert treffer.art is Netzart.FLIESSGEWAESSER
        assert treffer.vorfluter_name == "Enz"
        assert treffer.vorfluter == ("Enz", "Neckar", "Rhein")

    async def test_zu_lange_kette(self, session: AsyncSession) -> None:
        # Mühlbach, a, b, c, d into the Enz: Enz, Neckar and Rhein make seven links.
        kette = [ENZ, *(f"23849{i}0000000" for i in range(4))]
        glieder = [fliess(kette[i + 1], f"Glied {i}", kette[i], "x") for i in range(len(kette) - 1)]
        await netz(session, *glieder, fliess("2384100000000", "Mühlbach", kette[-1], "Glied 3"))

        (treffer,) = (await suche(session, "Mühlbach")).treffer

        assert treffer.vorfluter is None

    async def test_stehendes_gewaesser(self, session: AsyncSession) -> None:
        await netz(session, see("7174", "Rechentshofener Weiher"))

        (treffer,) = (await suche(session, "Rechentshofener")).treffer

        assert treffer.art is Netzart.STEHENDES_GEWAESSER
        assert treffer.vorfluter_name is None
        assert treffer.vorfluter is None
