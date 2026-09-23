"""Naming the file, and reading the title block out of the answers.

Plain functions over plain values, so they are tested here without a database
or an HTTP request. What happens over HTTP is app/api/ausgabe_test.py's job.

The file name is worth its own tests because it is the one part of this feature
that leaves the application and lands on somebody's filesystem, where a
character we passed through unthinkingly is somebody else's problem.
"""

from datetime import date, time

import pytest

from app.protokolle.ausgabe.dienst import _datum, _text, _uhrzeit, dateiname
from app.protokolle.ausgabe.dokument import Protokollkopf


def kopf(gewaesser: str = "Neckar", tag: date | None = date(2026, 8, 14)) -> Protokollkopf:
    return Protokollkopf(gewaesser=gewaesser, datum=tag)


def test_der_name_nennt_gewaesser_und_datum() -> None:
    assert dateiname(kopf()) == "Protokoll_Neckar_2026-08-14.pdf"


def test_umlaute_werden_umschrieben() -> None:
    """Not stripped. "Weienau" would be a worse name than "Weissenau"."""
    assert dateiname(kopf("Weißenau")) == "Protokoll_Weissenau_2026-08-14.pdf"
    assert dateiname(kopf("Möhlin")) == "Protokoll_Moehlin_2026-08-14.pdf"


@pytest.mark.parametrize(
    ("gewaesser", "erwartet"),
    [
        ("Alte Argen", "Protokoll_Alte-Argen_2026-08-14.pdf"),
        ("Neckar/Enz", "Protokoll_Neckar-Enz_2026-08-14.pdf"),
        ("..\\..\\etc", "Protokoll_etc_2026-08-14.pdf"),
        ("Rhein (links)", "Protokoll_Rhein-links_2026-08-14.pdf"),
    ],
)
def test_nichts_ausser_buchstaben_und_ziffern_ueberlebt(gewaesser: str, erwartet: str) -> None:
    """Whatever somebody typed into the Gewaesser field ends up in a file name,
    so anything that is not a letter or a digit becomes a hyphen. A path
    separator reaching a Downloads folder is not something to find out about."""
    assert dateiname(kopf(gewaesser)) == erwartet


def test_ein_entwurf_ohne_angaben_heisst_trotzdem_etwas() -> None:
    """A draft has no water and no date yet, and is still downloadable."""
    assert dateiname(Protokollkopf(gewaesser="")) == "Protokoll.pdf"


def test_ein_sehr_langer_name_wird_gekuerzt() -> None:
    lang = dateiname(kopf("A" * 200))

    assert lang.startswith("Protokoll_" + "A" * 60 + "_")
    assert len(lang) < 100


@pytest.mark.parametrize(
    ("gespeichert", "erwartet"),
    [
        ("2026-08-14", date(2026, 8, 14)),
        ("14.08.2026", date(2026, 8, 14)),
        ("", None),
        ("irgendwann", None),
        ("32.13.2026", None),
    ],
)
def test_das_datum_wird_in_beiden_schreibweisen_gelesen(
    gespeichert: str, erwartet: date | None
) -> None:
    """The legacy form writes dd.mm.yyyy and the application stores ISO, and a
    half-finished draft holds whatever somebody has typed so far."""
    assert _datum(gespeichert) == erwartet


@pytest.mark.parametrize(
    ("gespeichert", "erwartet"),
    [("09:30", time(9, 30)), ("", None), ("halb zehn", None), ("25:00", None)],
)
def test_die_uhrzeit_ueberlebt_unsinn(gespeichert: str, erwartet: time | None) -> None:
    assert _uhrzeit(gespeichert) == erwartet


def test_ein_wert_wird_durch_den_verschachtelten_pfad_gefunden() -> None:
    antworten = {"probestrecke": {"gewaesser": {"gewaessername": "  Schussen  "}}}

    assert _text(antworten, "probestrecke.gewaesser.gewaessername") == "Schussen"


@pytest.mark.parametrize(
    "antworten",
    [{}, {"probestrecke": {}}, {"probestrecke": "kein Objekt"}, {"probestrecke": None}],
)
def test_ein_fehlender_pfad_ist_leer_und_kein_fehler(antworten: dict[str, object]) -> None:
    """A draft is incomplete by definition, so half the paths are missing."""
    assert _text(antworten, "probestrecke.gewaesser.gewaessername") == ""
