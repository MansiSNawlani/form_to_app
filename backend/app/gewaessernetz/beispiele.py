"""Tiny AWGN-shaped shapefiles, for tests.

Here rather than in a test file because the reader's tests and the loader's both
need them. They carry the same columns, codepage and shape types as LUBW's real
2025-05-01 release, inspected on 2026-10-14, so no test needs the 90 MB download
that Resources/ would otherwise have to hold.
"""

from pathlib import Path
from typing import Any

import shapefile

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


def schreibe_prj(basis: Path, prj: str | None) -> None:
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
    schreibe_prj(basis, prj)
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
    schreibe_prj(basis, prj)
    return basis.with_suffix(".shp")
