"""An attachment refusal becomes a response that names the file and a way out.

Beside the rules rather than in app/api/, because what is checked here is the
wording of these particular refusals. The route tests in step 4 cover the path
through HTTP; this is where the sentences themselves are held to feature 10's
standard, set on 2026-09-06: name the file, say why in ordinary words, and say
what to do instead. A message that only says no is not finished.

Rendered through the real handler rather than read out of the table, so a message
whose interpolation is broken fails here rather than reaching a field office as
"{max}".
"""

import json
from typing import Any

import pytest
from fastapi import Request, status

from app.anlagen.fehler import (
    AnlageFehler,
    AnlageInhaltKeinBild,
    AnlagenartVoll,
    AnlageNichtGefunden,
    AnlageTypUnzulaessig,
    AnlageZuGross,
)
from app.anlagen.regeln import MAX_BYTES, MAX_FOTOS
from app.api.fehler_http import behandle_anlagenfehler

# The handler never looks at the request, so the smallest thing Starlette accepts
# as one is enough.
ANFRAGE = Request({"type": "http", "method": "POST", "path": "/", "headers": []})

DATEI = "IMG_4471.HEIC"


async def antworte(fehler: AnlageFehler) -> tuple[int, dict[str, Any]]:
    antwort = await behandle_anlagenfehler(ANFRAGE, fehler)
    koerper: dict[str, Any] = json.loads(bytes(antwort.body))
    return antwort.status_code, koerper


ALLE = [
    AnlageTypUnzulaessig(DATEI, "image/heic"),
    AnlageInhaltKeinBild(DATEI),
    AnlageZuGross(DATEI, MAX_BYTES + 1, MAX_BYTES),
    AnlagenartVoll(DATEI, "FOTO", MAX_FOTOS, MAX_FOTOS),
]


@pytest.mark.parametrize("fehler", ALLE, ids=lambda f: type(f).__name__)
async def test_jede_absage_nennt_die_datei(fehler: AnlageFehler) -> None:
    """A pick can hold twenty files, so "the file" is not an answer."""
    _, koerper = await antworte(fehler)

    assert koerper["nachricht"].startswith(f"{DATEI}: ")


@pytest.mark.parametrize("fehler", ALLE, ids=lambda f: type(f).__name__)
async def test_jede_absage_sagt_was_zu_tun_ist(fehler: AnlageFehler) -> None:
    """The way out is the useful half, and the half usually missing.

    Checked by looking for "Bitte", which is how every one of these phrases the
    next step. Crude, and it is still the difference between a message that
    stops at "no" and one somebody can act on.
    """
    _, koerper = await antworte(fehler)

    assert "Bitte" in koerper["nachricht"]


@pytest.mark.parametrize("fehler", ALLE, ids=lambda f: type(f).__name__)
async def test_keine_absage_laesst_eine_luecke_stehen(fehler: AnlageFehler) -> None:
    """An unfilled placeholder is how "{max}" reaches a field office."""
    _, koerper = await antworte(fehler)

    assert "{" not in koerper["nachricht"]
    assert "}" not in koerper["nachricht"]


async def test_der_falsche_dateityp_nennt_die_formate_die_gehen() -> None:
    status_code, koerper = await antworte(AnlageTypUnzulaessig(DATEI, "image/heic"))

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANLAGE_TYP_UNZULAESSIG"
    for format_ in ("JPG", "PNG", "WEBP"):
        assert format_ in koerper["nachricht"]


async def test_der_gemeldete_typ_kommt_nicht_zurueck() -> None:
    """It came out of the request, and no message here is improved by quoting it.

    A surveyor cannot act on "image/heic" and it is not a word they used.
    """
    _, koerper = await antworte(AnlageTypUnzulaessig(DATEI, "image/heic"))

    assert "image/heic" not in koerper["nachricht"]


async def test_ein_kaputtes_bild_wird_nicht_als_vorwurf_formuliert() -> None:
    """The common way here is a damaged copy, not somebody trying something on."""
    status_code, koerper = await antworte(AnlageInhaltKeinBild(DATEI))

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANLAGE_INHALT_KEIN_BILD"
    assert "kopieren" in koerper["nachricht"].lower()


async def test_zu_gross_nennt_die_grenze_in_megabyte() -> None:
    status_code, koerper = await antworte(AnlageZuGross(DATEI, MAX_BYTES + 1, MAX_BYTES))

    assert status_code == status.HTTP_413_CONTENT_TOO_LARGE
    assert koerper["code"] == "ANLAGE_ZU_GROSS"
    assert "10 MB" in koerper["nachricht"]


async def test_zu_gross_erfindet_keine_dateigroesse() -> None:
    """The read stops at the cap, so what was counted is not what the file holds.

    Printing that number would be telling somebody their 200 MB photograph is
    10.3 MB, which sends them off to shrink it by a third of a megabyte.
    """
    _, koerper = await antworte(AnlageZuGross(DATEI, MAX_BYTES + 1, MAX_BYTES))

    assert str(MAX_BYTES + 1) not in koerper["nachricht"]


async def test_ein_volles_protokoll_sagt_wie_viele_schon_da_sind() -> None:
    """ "Limit exceeded" leaves nothing to decide about. A number does."""
    status_code, koerper = await antworte(AnlagenartVoll(DATEI, "FOTO", 20, 20))

    assert status_code == status.HTTP_409_CONFLICT
    assert koerper["code"] == "ANLAGENART_VOLL"
    assert "20" in koerper["nachricht"]
    assert "entfernen" in koerper["nachricht"].lower()


async def test_der_zweite_kartenausschnitt_bekommt_seinen_eigenen_wortlaut() -> None:
    """One stretch has one excerpt of it, so "bis zu 1 Fotos" would be nonsense."""
    _, koerper = await antworte(AnlagenartVoll(DATEI, "KARTENAUSSCHNITT", 1, 1))

    assert "Kartenausschnitt" in koerper["nachricht"]
    assert "Fotos" not in koerper["nachricht"]


async def test_eine_fehlende_anlage_ist_ein_404_und_nennt_keine_datei() -> None:
    """Nothing is known about it, so there is no name to give.

    The message must still say what to do, and reloading is the honest answer:
    somebody else's tab, or this one, is showing a state that has moved on.
    """
    status_code, koerper = await antworte(AnlageNichtGefunden())

    assert status_code == status.HTTP_404_NOT_FOUND
    assert koerper["code"] == "ANLAGE_NICHT_GEFUNDEN"
    assert "Bitte" in koerper["nachricht"]


async def test_ein_dateiname_mit_zeilenumbruch_bleibt_eine_zeile() -> None:
    """A refused pick shows twenty of these at once.

    A name carrying newlines would make one of them look like several.
    """
    _, koerper = await antworte(AnlageInhaltKeinBild("foto\n\nGuten Tag.jpg"))

    assert "\n" not in koerper["nachricht"]
