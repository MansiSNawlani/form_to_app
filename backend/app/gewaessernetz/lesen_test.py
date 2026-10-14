"""The reader, against tiny shapefiles written here rather than LUBW's real ones.

Resources/ is not in the repository, so these build the same columns, codepage
and shape types the real 2025-05-01 release has (inspected on 2026-10-14) and
never need the 90 MB download. Reading the real archives is recorded as evidence
in the feature spec instead.
"""

import zipfile
from pathlib import Path
from typing import Any

import pytest
import shapefile
from shapely import wkb
from shapely.geometry import MultiLineString, MultiPolygon

from app.gewaessernetz.fehler import (
    FalscheNetzdatei,
    FalschesKoordinatensystem,
    NetzdateiNichtGefunden,
    ShapefileNichtEindeutig,
    UngueltigerEintrag,
)
from app.gewaessernetz.lesen import Netzeintrag, oeffne
from app.models.gewaessernetz import Netzart

# What LUBW ships, shortened. ArcGIS writes the ESRI form of the name.
PRJ_UTM32 = (
    'PROJCS["ETRS_1989_UTM_Zone_32N",GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",'
    'SPHEROID["GRS_1980",6378137.0,298.257222101]]]]'
)
PRJ_WGS84 = (
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]]]'
)

FLIESS_SPALTEN = [
    ("GEW_ID", "N", 11, 0),
    ("GEW_KENNZA", "F", 31, 15),
    ("GEW_NAME", "C", 80, 0),
    ("VOR_GEW_KE", "F", 31, 15),
    ("VOR_GEW_NA", "C", 80, 0),
    ("STAND_FACH", "C", 20, 0),
]
STEH_SPALTEN = [
    ("SEE_ID", "F", 31, 15),
    ("LANGNAME", "C", 80, 0),
    ("STAND_FACH", "C", 20, 0),
]


def _prj(basis: Path, prj: str | None) -> None:
    if prj is not None:
        basis.with_suffix(".prj").write_text(prj, encoding="ascii")


def fliessgewaesser(
    ordner: Path,
    saetze: list[dict[str, Any]],
    prj: str | None = PRJ_UTM32,
    name: str = "Gewässernetz (AWGN)",
) -> Path:
    """A PolyLineM file, as LUBW's is, one line per entry in saetze."""
    basis = ordner / name
    with shapefile.Writer(str(basis), shapeType=shapefile.POLYLINEM, encoding="cp1252") as w:
        for spalte in FLIESS_SPALTEN:
            w.field(*spalte)
        for satz in saetze:
            teile = satz.get("teile", [[(500000, 5400000, 0.0), (500100, 5400100, 141.4)]])
            w.linem(teile)
            w.record(
                GEW_ID=1,
                GEW_KENNZA=satz.get("kennzahl", 2381333920000.0),
                GEW_NAME=satz.get("name", "Herrgottsbächle"),
                VOR_GEW_KE=satz.get("vorfluter_kennzahl", 2380000000000.0),
                VOR_GEW_NA=satz.get("vorfluter_name", "Neckar"),
                STAND_FACH=satz.get("stand", "Mai 2025"),
            )
    _prj(basis, prj)
    return basis.with_suffix(".shp")


def stehende(
    ordner: Path,
    saetze: list[dict[str, Any]],
    prj: str | None = PRJ_UTM32,
    name: str = "Stehendes Gewässer (AWGN)",
) -> Path:
    basis = ordner / name
    with shapefile.Writer(str(basis), shapeType=shapefile.POLYGON, encoding="cp1252") as w:
        for spalte in STEH_SPALTEN:
            w.field(*spalte)
        for satz in saetze:
            # Outer rings clockwise, holes counter-clockwise: the shapefile rule,
            # and what the reader relies on to tell them apart.
            ringe = satz.get(
                "ringe",
                [
                    [
                        (500000, 5400000),
                        (500000, 5400100),
                        (500100, 5400100),
                        (500100, 5400000),
                        (500000, 5400000),
                    ]
                ],
            )
            w.poly(ringe)
            w.record(
                SEE_ID=satz.get("see_id", 7174.0),
                LANGNAME=satz.get("name", "Rechentshofener Weiher"),
                STAND_FACH=satz.get("stand", "Mai 2025"),
            )
    _prj(basis, prj)
    return basis.with_suffix(".shp")


def lies(pfad: Path, art: Netzart) -> list[Netzeintrag]:
    with oeffne(pfad, art) as datei:
        return list(datei.eintraege())


class TestFliessgewaesser:
    def test_liest_kennzahl_name_und_vorfluter(self, tmp_path: Path) -> None:
        [eintrag] = lies(fliessgewaesser(tmp_path, [{}]), Netzart.FLIESSGEWAESSER)

        assert eintrag.art is Netzart.FLIESSGEWAESSER
        assert eintrag.kennung == "2381333920000"
        assert eintrag.name == "Herrgottsbächle"
        assert eintrag.vorfluter_kennung == "2380000000000"
        assert eintrag.vorfluter_name == "Neckar"

    def test_der_rhein_hat_keinen_vorfluter(self, tmp_path: Path) -> None:
        # In the real file the Rhein and the Donau leave both columns empty.
        satz = {
            "kennzahl": 2000000000000.0,
            "name": "Rhein",
            "vorfluter_kennzahl": None,
            "vorfluter_name": "",
        }
        [eintrag] = lies(fliessgewaesser(tmp_path, [satz]), Netzart.FLIESSGEWAESSER)

        assert eintrag.vorfluter_kennung is None
        assert eintrag.vorfluter_name is None

    def test_wirft_das_m_weg_und_liefert_eine_multilinie(self, tmp_path: Path) -> None:
        teile = [
            [(500000, 5400000, 0.0), (500100, 5400100, 141.4)],
            [(500200, 5400200, 0.0), (500300, 5400300, 141.4), (500400, 5400300, 241.4)],
        ]
        [eintrag] = lies(fliessgewaesser(tmp_path, [{"teile": teile}]), Netzart.FLIESSGEWAESSER)

        geometrie = wkb.loads(eintrag.wkb)
        assert isinstance(geometrie, MultiLineString)
        assert not geometrie.has_z and not geometrie.has_m
        assert [list(teil.coords) for teil in geometrie.geoms] == [
            [(500000, 5400000), (500100, 5400100)],
            [(500200, 5400200), (500300, 5400300), (500400, 5400300)],
        ]

    @pytest.mark.parametrize(
        ("kennzahl", "grund"),
        [
            (238133392000.0, "zwoelf Stellen"),
            (2381333920000.5, "ein Bruch"),
            (None, "leer"),
        ],
    )
    def test_weist_eine_kennzahl_ab_die_keine_ist(
        self, tmp_path: Path, kennzahl: float | None, grund: str
    ) -> None:
        pfad = fliessgewaesser(tmp_path, [{}, {"kennzahl": kennzahl}])

        with pytest.raises(UngueltigerEintrag) as fehler:
            lies(pfad, Netzart.FLIESSGEWAESSER)
        assert fehler.value.satz == 2, grund


class TestStehendeGewaesser:
    def test_liest_see_id_und_namen(self, tmp_path: Path) -> None:
        [eintrag] = lies(stehende(tmp_path, [{}]), Netzart.STEHENDES_GEWAESSER)

        assert eintrag.art is Netzart.STEHENDES_GEWAESSER
        assert eintrag.kennung == "7174"
        assert eintrag.name == "Rechentshofener Weiher"
        assert eintrag.vorfluter_kennung is None
        assert eintrag.vorfluter_name is None

    def test_behaelt_platzhalternamen_wie_sie_sind(self, tmp_path: Path) -> None:
        [eintrag] = lies(stehende(tmp_path, [{"name": "NN-YBP"}]), Netzart.STEHENDES_GEWAESSER)
        assert eintrag.name == "NN-YBP"

    def test_liefert_eine_multiflaeche_mit_loch_und_zwei_teilen(self, tmp_path: Path) -> None:
        aussen = [(0, 0), (0, 100), (100, 100), (100, 0), (0, 0)]
        loch = [(40, 40), (60, 40), (60, 60), (40, 60), (40, 40)]
        insel = [(200, 0), (200, 50), (250, 50), (250, 0), (200, 0)]
        verschoben = [
            [(500000 + x, 5400000 + y) for x, y in ring] for ring in (aussen, loch, insel)
        ]
        [eintrag] = lies(stehende(tmp_path, [{"ringe": verschoben}]), Netzart.STEHENDES_GEWAESSER)

        geometrie = wkb.loads(eintrag.wkb)
        assert isinstance(geometrie, MultiPolygon)
        assert len(geometrie.geoms) == 2
        mit_loch = max(geometrie.geoms, key=lambda teil: teil.area)
        assert len(mit_loch.interiors) == 1
        assert mit_loch.area == 100 * 100 - 20 * 20

    def test_weist_eine_see_id_mit_bruch_ab(self, tmp_path: Path) -> None:
        with pytest.raises(UngueltigerEintrag):
            lies(stehende(tmp_path, [{"see_id": 7174.5}]), Netzart.STEHENDES_GEWAESSER)


class TestDieDatei:
    def test_nennt_den_stand_und_die_anzahl(self, tmp_path: Path) -> None:
        with oeffne(fliessgewaesser(tmp_path, [{}, {}, {}]), Netzart.FLIESSGEWAESSER) as datei:
            assert datei.anzahl == 3
            assert datei.staende == frozenset({"Mai 2025"})

    def test_liest_aus_einem_zip_mit_verdrehten_dateinamen(self, tmp_path: Path) -> None:
        # LUBW's archives unpack as "Gew+ñssernetz", so the reader may never look
        # for a file by its name.
        ordner = tmp_path / "quelle"
        ordner.mkdir()
        fliessgewaesser(ordner, [{}], name="Gew+ñssernetz (AWGN)")
        archiv = tmp_path / "Fliessgewaessernetz.zip"
        with zipfile.ZipFile(archiv, "w") as z:
            for datei in ordner.iterdir():
                z.write(datei, f"unterordner/{datei.name}")

        [eintrag] = lies(archiv, Netzart.FLIESSGEWAESSER)
        assert eintrag.kennung == "2381333920000"

    def test_liest_aus_einem_ordner(self, tmp_path: Path) -> None:
        fliessgewaesser(tmp_path, [{}])
        assert len(lies(tmp_path, Netzart.FLIESSGEWAESSER)) == 1


class TestAbweisungen:
    def test_eine_datei_die_es_nicht_gibt(self, tmp_path: Path) -> None:
        with pytest.raises(NetzdateiNichtGefunden):
            lies(tmp_path / "fehlt.zip", Netzart.FLIESSGEWAESSER)

    def test_ein_ordner_ohne_shapefile(self, tmp_path: Path) -> None:
        with pytest.raises(ShapefileNichtEindeutig) as fehler:
            lies(tmp_path, Netzart.FLIESSGEWAESSER)
        assert fehler.value.anzahl == 0

    def test_ein_ordner_mit_beiden_shapefiles(self, tmp_path: Path) -> None:
        fliessgewaesser(tmp_path, [{}])
        stehende(tmp_path, [{}])
        with pytest.raises(ShapefileNichtEindeutig) as fehler:
            lies(tmp_path, Netzart.FLIESSGEWAESSER)
        assert fehler.value.anzahl == 2

    def test_vertauschte_dateien(self, tmp_path: Path) -> None:
        with pytest.raises(FalscheNetzdatei) as fehler:
            lies(stehende(tmp_path, [{}]), Netzart.FLIESSGEWAESSER)
        assert fehler.value.erwartet is Netzart.FLIESSGEWAESSER
        assert fehler.value.gefunden is Netzart.STEHENDES_GEWAESSER

    def test_ein_shapefile_das_kein_awgn_ist(self, tmp_path: Path) -> None:
        basis = tmp_path / "irgendwas"
        with shapefile.Writer(str(basis), shapeType=shapefile.POINT) as w:
            w.field("NAME", "C", 20)
            w.point(500000, 5400000)
            w.record(NAME="x")
        _prj(basis, PRJ_UTM32)

        with pytest.raises(FalscheNetzdatei) as fehler:
            lies(basis.with_suffix(".shp"), Netzart.STEHENDES_GEWAESSER)
        assert fehler.value.gefunden is None

    def test_ein_anderes_koordinatensystem(self, tmp_path: Path) -> None:
        with pytest.raises(FalschesKoordinatensystem) as fehler:
            lies(fliessgewaesser(tmp_path, [{}], prj=PRJ_WGS84), Netzart.FLIESSGEWAESSER)
        assert fehler.value.gefunden is not None
        assert "WGS_1984" in fehler.value.gefunden

    def test_kein_koordinatensystem(self, tmp_path: Path) -> None:
        with pytest.raises(FalschesKoordinatensystem) as fehler:
            lies(fliessgewaesser(tmp_path, [{}], prj=None), Netzart.FLIESSGEWAESSER)
        assert fehler.value.gefunden is None
