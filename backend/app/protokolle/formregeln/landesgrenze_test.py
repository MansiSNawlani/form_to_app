"""Ported case for case to frontend/src/protokoll/regeln/landesgrenze.test.ts."""

import pytest

from app.protokolle.formregeln.landesgrenze import (
    Landesgrenze,
    aktuelle_landesgrenze,
    liegt_im_land,
)

# A 100 by 100 square with a 20 by 20 hole in the middle, and a second square
# beside it: enough to show holes and separate parts both count.
QUADRAT = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
LOCH = [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]
INSEL = [[200, 0], [250, 0], [250, 50], [200, 50], [200, 0]]
BEISPIEL = Landesgrenze(polygone=((QUADRAT, LOCH), (INSEL,)))


class TestPunktInFlaeche:
    @pytest.mark.parametrize(
        ("rw", "hw", "drin"),
        [
            (10, 10, True),
            (50, 50, False),  # in the hole
            (225, 25, True),  # in the second part
            (150, 50, False),  # between the two
            (-1, 50, False),
            (0, 50, True),  # on an edge counts as inside
            (100, 100, True),  # on a corner too
            (40, 50, True),  # and on the edge of the hole
            (50, 0, True),  # on a horizontal edge
        ],
    )
    def test_beispiel(self, rw: int, hw: int, drin: bool) -> None:
        assert liegt_im_land(BEISPIEL, rw, hw) is drin


class TestEchteGrenze:
    """Against the committed file, so these name real places.

    Every coordinate was projected from WGS84 to EPSG:25832 with PostGIS on
    2026-10-15. The distances are to the edge of the widened border.
    """

    @pytest.mark.parametrize(
        ("ort", "rw", "hw"),
        [
            ("Stuttgart, Schlossplatz", 513224, 5402838),
            ("Kehl, französische Hälfte des Rheins, 1.7 km innen", 411403, 5380353),
            ("Bodensee, Mitte des Obersees", 530074, 5270810),
            ("Bodensee, Mitte des Untersees", 502252, 5280735),
            ("Neu-Ulm, 1.1 km innen", 574841, 5360476),
            ("Büsingen", 476740, 5282670),
            ("Wertheim am Main", 537215, 5511953),
        ],
    )
    def test_liegt_im_land(self, ort: str, rw: int, hw: int) -> None:
        assert liegt_im_land(aktuelle_landesgrenze(), rw, hw), ort

    @pytest.mark.parametrize(
        ("ort", "rw", "hw"),
        [
            ("Straßburg, Münster, 1.6 km außerhalb", 407876, 5381721),
            ("Colmar", 377741, 5326429),
            ("München", 691603, 5334780),
            ("Würzburg", 566895, 5515841),
            ("Frankfurt am Main", 477270, 5551010),
            ("Zürich", 465403, 5247151),
        ],
    )
    def test_liegt_nicht_im_land(self, ort: str, rw: int, hw: int) -> None:
        assert not liegt_im_land(aktuelle_landesgrenze(), rw, hw), ort
