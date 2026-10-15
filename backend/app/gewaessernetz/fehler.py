"""What can go wrong loading the water body network, as types rather than strings.

The same arrangement as app/benutzer/fehler.py: these carry the facts and no
wording, and app/cli.py, the only place they reach a person, phrases them. Every
one of them is something an administrator can fix by fetching the right file, so
each carries what the message needs to say which file and why.
"""

from datetime import date

from app.models.gewaessernetz import Netzart


class GewaessernetzFehler(Exception):
    """Base for everything in this module, so a caller can catch the family."""


class NetzdateiNichtGefunden(GewaessernetzFehler):
    def __init__(self, pfad: str) -> None:
        self.pfad = pfad
        super().__init__(f"Nicht gefunden: {pfad}")


class ShapefileNichtEindeutig(GewaessernetzFehler):
    """The archive or folder holds no shapefile, or more than one.

    anzahl is 0 for none. More than one is refused rather than guessed between,
    because the two AWGN downloads are separate archives and a folder holding
    both is exactly where picking the wrong one would go unnoticed.
    """

    def __init__(self, pfad: str, anzahl: int) -> None:
        self.pfad = pfad
        self.anzahl = anzahl
        super().__init__(f"{anzahl} Shapefiles in {pfad}")


class FalscheNetzdatei(GewaessernetzFehler):
    """The shapefile is not the one asked for.

    gefunden is the other kind when the file is recognisably the other AWGN
    download, which is the mistake that actually happens: the two arguments
    swapped. It is None for a shapefile that is not AWGN at all.
    """

    def __init__(self, pfad: str, erwartet: Netzart, gefunden: Netzart | None) -> None:
        self.pfad = pfad
        self.erwartet = erwartet
        self.gefunden = gefunden
        super().__init__(f"{pfad}: erwartet {erwartet}, gefunden {gefunden}")


class FalschesKoordinatensystem(GewaessernetzFehler):
    """The .prj does not say ETRS89 / UTM zone 32N, or there is no .prj.

    Loading coordinates in another system would put every water in the wrong
    place without any error at all, so a file that cannot show it is in
    EPSG:25832 is refused rather than assumed to be.
    """

    def __init__(self, pfad: str, gefunden: str | None) -> None:
        self.pfad = pfad
        self.gefunden = gefunden
        super().__init__(f"{pfad}: Koordinatensystem {gefunden!r}")


class UngueltigerEintrag(GewaessernetzFehler):
    """One record cannot be loaded: a malformed identifier or no usable geometry.

    satz counts from 1, the way a person counting rows in a GIS program would.
    """

    def __init__(self, pfad: str, satz: int, grund: str) -> None:
        self.pfad = pfad
        self.satz = satz
        self.grund = grund
        super().__init__(f"{pfad}, Satz {satz}: {grund}")


class StandBereitsGeladen(GewaessernetzFehler):
    def __init__(self, stand: date) -> None:
        self.stand = stand
        super().__init__(f"Stand {stand} ist bereits geladen")


class StandPasstNicht(GewaessernetzFehler):
    """The release date given does not match what the files say they are.

    staende is every STAND_FACH value found in the two files, so the message can
    say what the files do claim to be.
    """

    def __init__(self, stand: date, staende: frozenset[str]) -> None:
        self.stand = stand
        self.staende = staende
        super().__init__(f"Stand {stand} passt nicht zu {sorted(staende)}")
