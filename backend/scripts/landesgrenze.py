"""Build the Baden-Wuerttemberg border the coordinate check tests against.

    python scripts/landesgrenze.py

Reads two downloads from Resources/Geodaten/, which is not in the repository:

- BKG's VG250 (Verwaltungsgebiete 1:250 000, Stand 01.01., UTM32s, Ebenen), from
  https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.shape.ebenen.zip
- LUBW's standing waters, from
  https://rips-datenlink.lubw.de/UDO_download/StehendeGewaesser.zip

and writes database/seed/landesgrenze/landesgrenze_bw.json, which is committed,
so neither the application nor its container needs either download.

What it does, and why each part is there:

1. **Every VG250_LAN record with ARS 08.** The state is several records there:
   the land, its water areas, and a separate "Baden-Wuerttemberg (Bodensee)".
2. **Joined with AWGN's Obersee and Untersee.** The international part of the
   Bodensee belongs to no state in VG250, and FFS sits on its shore.
3. **Widened by 2 000 m**, decided by Mansi on 2026-10-14. A stretch on the
   Rhein, Main, Tauber or Iller can have a boundary point on the far bank, and
   VG250 is drawn at 1:250 000, so the line itself is only good to about 100 m.
4. **Simplified to within 100 m**, so the margin never shrinks below 1.9 km and
   the file stays small enough to ship to the browser.
5. **Rounded to whole metres**, which is all a typed coordinate can hold anyway.

Re-run it when BKG publishes a VG250 with a changed state border, which in
practice is never, or if the margin is ever changed.
"""

from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import shapefile
from shapely import wkb
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from app.config import REPO_WURZEL
from app.gewaessernetz.lesen import oeffne
from app.models.gewaessernetz import SRID, Netzart

GEODATEN = REPO_WURZEL / "Resources" / "Geodaten"
VG250 = GEODATEN / "vg250_01-01.utm32s.shape.ebenen.zip"
STEHENDE = GEODATEN / "StehendeGewaesser.zip"
ZIEL = REPO_WURZEL / "database" / "seed" / "landesgrenze" / "landesgrenze_bw.json"

#: The Amtlicher Regionalschluessel of Baden-Wuerttemberg.
ARS_BW = "08"
#: AWGN's SEE_ID for "Bodensee - Obersee" and "Bodensee - Untersee".
BODENSEE = frozenset({"38252", "38253"})

VERBREITERUNG_M = 2000
VEREINFACHUNG_M = 100

QUELLE = (
    "Verwaltungsgebiete 1:250 000 (VG250), Stand 01.01.2026, © GeoBasis-DE / BKG (2026), "
    "dl-de/by-2-0 (https://www.govdata.de/dl-de/by-2-0); Bodensee aus dem Amtlichen "
    "Digitalen Wasserwirtschaftlichen Gewässernetz (AWGN), Stand 2025-05-01, LUBW, CC BY 4.0"
)
VERAENDERUNG = (
    f"Landesfläche Baden-Württemberg mit Ober- und Untersee vereinigt, um {VERBREITERUNG_M} m "
    f"erweitert, auf {VEREINFACHUNG_M} m vereinfacht und auf ganze Meter gerundet"
)

FEHLT = (
    "Resources/Geodaten/ fehlt oder ist unvollständig. Dorthin gehören, unverändert "
    f"heruntergeladen: {VG250.name} von BKG und {STEHENDE.name} von LUBW. "
    "Die Adressen stehen in backend/scripts/landesgrenze.py."
)


def vorhanden() -> bool:
    return VG250.exists() and STEHENDE.exists()


@contextmanager
def _vg250_lan(archiv: Path) -> Iterator[Any]:
    with tempfile.TemporaryDirectory() as ordner:
        with zipfile.ZipFile(archiv) as z:
            mitglieder = [n for n in z.namelist() if Path(n).stem.upper() == "VG250_LAN"]
            z.extractall(ordner, mitglieder)
        [shp] = [p for p in Path(ordner).rglob("*") if p.suffix.lower() == ".shp"]
        with shapefile.Reader(str(shp), encoding="utf-8") as reader:
            yield reader


def landesflaeche(vg250: Path, stehende: Path) -> MultiPolygon:
    with _vg250_lan(vg250) as reader:
        teile = [
            shape(eintrag.shape.__geo_interface__)
            for eintrag in reader.iterShapeRecords()
            if eintrag.record.as_dict()["ARS"] == ARS_BW
        ]
    with oeffne(stehende, Netzart.STEHENDES_GEWAESSER) as datei:
        teile += [wkb.loads(e.wkb) for e in datei.eintraege() if e.kennung in BODENSEE]
    if len(teile) < 2:
        raise SystemExit(
            f"Nur {len(teile)} Flächen gefunden, erwartet mindestens die Landesfläche."
        )

    erweitert = unary_union(teile).buffer(VERBREITERUNG_M)
    vereinfacht = erweitert.simplify(VEREINFACHUNG_M, preserve_topology=True)
    return vereinfacht if isinstance(vereinfacht, MultiPolygon) else MultiPolygon([vereinfacht])


def _ring(koordinaten: Any) -> list[list[int]]:
    return [[round(x), round(y)] for x, y in koordinaten]


def als_json(flaeche: MultiPolygon) -> dict[str, Any]:
    polygone: list[list[list[list[int]]]] = []
    for polygon in sorted(flaeche.geoms, key=lambda p: -p.area):
        # Outer ring counter-clockwise and holes clockwise, the GeoJSON order, so
        # the file reads the same whichever way GEOS happened to produce it.
        gerichtet: Polygon = orient(polygon)
        polygone.append(
            [
                _ring(gerichtet.exterior.coords),
                *(_ring(loch.coords) for loch in gerichtet.interiors),
            ]
        )
    return {
        "quelle": QUELLE,
        "veraenderung": VERAENDERUNG,
        "srid": SRID,
        "verbreiterung_m": VERBREITERUNG_M,
        "polygone": polygone,
    }


def schreibe(daten: dict[str, Any], ziel: Path) -> None:
    ziel.parent.mkdir(parents=True, exist_ok=True)
    # One ring per line keeps a change to the border readable in a diff.
    kopf = {k: v for k, v in daten.items() if k != "polygone"}
    zeilen = [json.dumps(kopf, ensure_ascii=False)[:-1] + ', "polygone": [']
    for i, polygon in enumerate(daten["polygone"]):
        ringe = ",\n  ".join(json.dumps(ring, separators=(",", ":")) for ring in polygon)
        komma = "," if i < len(daten["polygone"]) - 1 else ""
        zeilen.append(f" [\n  {ringe}\n ]{komma}")
    zeilen.append("]}")
    # newline="\n" so the file is the same bytes on Windows as everywhere else.
    ziel.write_text("\n".join(zeilen) + "\n", encoding="utf-8", newline="\n")


def main() -> int:
    if not vorhanden():
        print(FEHLT, file=sys.stderr)
        return 1
    daten = als_json(landesflaeche(VG250, STEHENDE))
    schreibe(daten, ZIEL)
    punkte = sum(len(ring) for polygon in daten["polygone"] for ring in polygon)
    print(f"{ZIEL}: {len(daten['polygone'])} Flächen, {punkte} Punkte, {ZIEL.stat().st_size} Bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
