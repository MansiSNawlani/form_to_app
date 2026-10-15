"""Reads LUBW's two AWGN shapefiles into plain records.

The only module that knows AWGN's column names. If FFS answers
docs/ffs-questions.md question 16 with another dataset, that is a new reader
beside this one, and the table and the loader stay as they are.

What the real 2025-05-01 release holds, inspected on 2026-10-14 before this was
written:

- Flowing waters are PolyLineM, one record per water, identified by GEW_KENNZA,
  the 13-digit Gewaesserkennzahl, stored in the DBF as a float.
- Standing waters are polygons, some in several parts, identified by SEE_ID,
  also a float.
- Both are ETRS89 / UTM zone 32N and encoded in Windows-1252.
- The file names inside the zips hold an a-umlaut that unpacks as "+ñ", so a file
  is found by its extension and never by its name.
"""

import re
import struct
import tempfile
import zipfile
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import shapefile

from app.gewaessernetz.fehler import (
    FalscheNetzdatei,
    FalschesKoordinatensystem,
    NetzdateiNichtGefunden,
    ShapefileNichtEindeutig,
    UngueltigerEintrag,
)
from app.models.gewaessernetz import Netzart

# The DBF's codepage byte says 0x58, Windows ANSI. Read strictly: a name that does
# not decode is a file that is not what it claims, not something to paper over.
KODIERUNG = "cp1252"

FLIESS_SPALTEN = frozenset({"GEW_KENNZA", "GEW_NAME", "VOR_GEW_KE", "VOR_GEW_NA", "STAND_FACH"})
STEH_SPALTEN = frozenset({"SEE_ID", "LANGNAME", "STAND_FACH"})

LINIEN = frozenset({shapefile.POLYLINE, shapefile.POLYLINEM, shapefile.POLYLINEZ})
FLAECHEN = frozenset({shapefile.POLYGON, shapefile.POLYGONM, shapefile.POLYGONZ})

GKZ_STELLEN = 13

Punkt = tuple[float, float]
Ring = list[Punkt]
Ungueltig = Callable[[str], UngueltigerEintrag]


@dataclass(frozen=True)
class Netzeintrag:
    art: Netzart
    kennung: str
    name: str
    vorfluter_kennung: str | None
    vorfluter_name: str | None
    #: Little-endian WKB, always a MULTILINESTRING or MULTIPOLYGON in 2D.
    wkb: bytes


class Netzdatei:
    """One opened AWGN shapefile, already checked to be the kind asked for."""

    def __init__(self, pfad: Path, art: Netzart, reader: Any) -> None:
        self.pfad = pfad
        self.art = art
        self._reader = reader

    @property
    def anzahl(self) -> int:
        return int(len(self._reader))

    @property
    def staende(self) -> frozenset[str]:
        """Every STAND_FACH value in the file, "Mai 2025" for the first release.

        A set, so a file that mixes releases shows it rather than being read as
        whichever one happens to come first.
        """
        index = self._spaltenindex("STAND_FACH")
        return frozenset(str(satz[index]).strip() for satz in self._reader.iterRecords())

    def eintraege(self) -> Iterator[Netzeintrag]:
        for nummer, form_und_satz in enumerate(self._reader.iterShapeRecords(), start=1):
            yield self._eintrag(nummer, form_und_satz.shape, form_und_satz.record.as_dict())

    def _spaltenindex(self, name: str) -> int:
        # Not iterRecords(fields=[...]): that hands the values back in the file's
        # column order rather than the order asked for, which reads the wrong
        # column without any error.
        namen = [feld[0] for feld in self._reader.fields if feld[0] != "DeletionFlag"]
        return namen.index(name)

    def _eintrag(self, nummer: int, form: Any, satz: dict[str, Any]) -> Netzeintrag:
        def ungueltig(grund: str) -> UngueltigerEintrag:
            return UngueltigerEintrag(str(self.pfad), nummer, grund)

        if self.art is Netzart.FLIESSGEWAESSER:
            kennung = _kennung(satz["GEW_KENNZA"], GKZ_STELLEN)
            if kennung is None:
                raise ungueltig(f"GEW_KENNZA {satz['GEW_KENNZA']!r} ist keine Gewässerkennzahl")
            vorfluter = satz["VOR_GEW_KE"]
            vorfluter_kennung = _kennung(vorfluter, GKZ_STELLEN)
            if vorfluter_kennung is None and vorfluter not in (None, 0, 0.0):
                raise ungueltig(f"VOR_GEW_KE {vorfluter!r} ist keine Gewässerkennzahl")
            return Netzeintrag(
                art=self.art,
                kennung=kennung,
                name=_text(satz["GEW_NAME"]) or "",
                vorfluter_kennung=vorfluter_kennung,
                vorfluter_name=_text(satz["VOR_GEW_NA"]),
                wkb=_multilinie(form, ungueltig),
            )

        kennung = _kennung(satz["SEE_ID"], None)
        if kennung is None:
            raise ungueltig(f"SEE_ID {satz['SEE_ID']!r} ist keine ganze Zahl")
        return Netzeintrag(
            art=self.art,
            kennung=kennung,
            name=_text(satz["LANGNAME"]) or "",
            vorfluter_kennung=None,
            vorfluter_name=None,
            wkb=_multiflaeche(form, ungueltig),
        )


@contextmanager
def oeffne(pfad: Path, art: Netzart) -> Iterator[Netzdatei]:
    """Opens a .zip, a folder or a .shp holding one AWGN shapefile of kind art.

    A zip is unpacked into a temporary folder that is removed again afterwards,
    rather than read in place: pyshp needs to seek, and seeking inside a
    compressed member of 110 MB means decompressing it again from the start.
    """
    if not pfad.exists():
        raise NetzdateiNichtGefunden(str(pfad))

    if pfad.is_file() and pfad.suffix.lower() == ".zip":
        with tempfile.TemporaryDirectory() as ordner:
            with zipfile.ZipFile(pfad) as archiv:
                archiv.extractall(ordner)
            with _oeffne_shapefile(_einziges_shapefile(Path(ordner), pfad), pfad, art) as datei:
                yield datei
        return

    shp = pfad if pfad.is_file() else _einziges_shapefile(pfad, pfad)
    with _oeffne_shapefile(shp, pfad, art) as datei:
        yield datei


def _einziges_shapefile(ordner: Path, angegeben: Path) -> Path:
    gefunden = [datei for datei in ordner.rglob("*") if datei.suffix.lower() == ".shp"]
    if len(gefunden) != 1:
        raise ShapefileNichtEindeutig(str(angegeben), len(gefunden))
    return gefunden[0]


@contextmanager
def _oeffne_shapefile(shp: Path, angegeben: Path, art: Netzart) -> Iterator[Netzdatei]:
    _pruefe_koordinatensystem(shp, angegeben)

    with shapefile.Reader(str(shp), encoding=KODIERUNG) as reader:
        spalten = {feld[0] for feld in reader.fields}
        gefunden = _erkenne(spalten, reader.shapeType)
        if gefunden is not art:
            raise FalscheNetzdatei(str(angegeben), art, gefunden)
        yield Netzdatei(angegeben, art, reader)


def _erkenne(spalten: set[str], form: int) -> Netzart | None:
    if FLIESS_SPALTEN <= spalten and form in LINIEN:
        return Netzart.FLIESSGEWAESSER
    if STEH_SPALTEN <= spalten and form in FLAECHEN:
        return Netzart.STEHENDES_GEWAESSER
    return None


def _pruefe_koordinatensystem(shp: Path, angegeben: Path) -> None:
    prj = next(
        (
            datei
            for datei in shp.parent.iterdir()
            if datei.stem == shp.stem and datei.suffix.lower() == ".prj"
        ),
        None,
    )
    if prj is None:
        raise FalschesKoordinatensystem(str(angegeben), None)

    inhalt = prj.read_text(encoding="latin-1").strip()
    # ArcGIS writes ETRS_1989_UTM_Zone_32N, the EPSG registry ETRS89 / UTM zone
    # 32N. Both are the same system, and comparing without spaces, underscores
    # and case accepts either.
    verdichtet = re.sub(r"[\s_/]", "", inhalt).lower()
    if "etrs" not in verdichtet or "utmzone32n" not in verdichtet:
        raise FalschesKoordinatensystem(str(angegeben), inhalt[:200])


def _kennung(wert: object, stellen: int | None) -> str | None:
    """A whole number read out of a DBF float, as text, or None if it is not one.

    Never str() of the float: that turns 2381333920000.0 into "2381333920000.0",
    which is not a Gewaesserkennzahl. A double holds every 13-digit integer
    exactly, so going through int() loses nothing.
    """
    if isinstance(wert, bool) or not isinstance(wert, int | float):
        return None
    if isinstance(wert, float) and not wert.is_integer():
        return None
    zahl = int(wert)
    if zahl <= 0:
        return None
    text = str(zahl)
    if stellen is not None and len(text) != stellen:
        return None
    return text


def _text(wert: object) -> str | None:
    if not isinstance(wert, str):
        return None
    return wert.strip() or None


def _punkte(punkte: Sequence[Sequence[float]]) -> list[Punkt]:
    # The measure of a PolyLineM, and a Z if one ever appears, are dropped here.
    return [(float(punkt[0]), float(punkt[1])) for punkt in punkte]


def _teile(form: Any) -> list[list[Punkt]]:
    grenzen = [*form.parts, len(form.points)]
    return [_punkte(form.points[von:bis]) for von, bis in zip(grenzen, grenzen[1:], strict=False)]


def _multilinie(form: Any, ungueltig: Ungueltig) -> bytes:
    # A part of a single point is not a line, and PostGIS refuses one.
    linien = [teil for teil in _teile(form) if len(teil) >= 2]
    if not linien:
        raise ungueltig("keine Linie mit mindestens zwei Punkten")
    return _wkb_multi(WKB_MULTILINESTRING, [_wkb_linie(linie) for linie in linien])


def _multiflaeche(form: Any, ungueltig: Ungueltig) -> bytes:
    geo: dict[str, Any] = form.__geo_interface__ if form.points else {"type": None}
    polygone: list[Any]
    if geo["type"] == "Polygon":
        polygone = [geo["coordinates"]]
    elif geo["type"] == "MultiPolygon":
        polygone = geo["coordinates"]
    else:
        raise ungueltig("keine Fläche")
    return _wkb_multi(
        WKB_MULTIPOLYGON,
        [_wkb_polygon([_punkte(ring) for ring in polygon]) for polygon in polygone],
    )


# Well-known binary, little-endian, written out by hand because it is twenty lines
# and the alternative is a geometry library at run time for the sake of them.
# Type codes from the OGC Simple Features specification.
WKB_LITTLE_ENDIAN = 1
WKB_LINESTRING = 2
WKB_POLYGON = 3
WKB_MULTILINESTRING = 5
WKB_MULTIPOLYGON = 6


def _wkb_punkte(punkte: list[Punkt]) -> bytes:
    return struct.pack("<I", len(punkte)) + b"".join(struct.pack("<dd", x, y) for x, y in punkte)


def _wkb_linie(punkte: list[Punkt]) -> bytes:
    return struct.pack("<BI", WKB_LITTLE_ENDIAN, WKB_LINESTRING) + _wkb_punkte(punkte)


def _wkb_polygon(ringe: list[Ring]) -> bytes:
    kopf = struct.pack("<BII", WKB_LITTLE_ENDIAN, WKB_POLYGON, len(ringe))
    return kopf + b"".join(_wkb_punkte(ring) for ring in ringe)


def _wkb_multi(typ: int, teile: list[bytes]) -> bytes:
    return struct.pack("<BII", WKB_LITTLE_ENDIAN, typ, len(teile)) + b"".join(teile)
