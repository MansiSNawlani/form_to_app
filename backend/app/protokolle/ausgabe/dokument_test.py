"""The document says what the protocol holds, and leaves out what it does not.

Read back with pypdf rather than compared against a stored file. A byte
comparison against a golden PDF would fail on the build date ReportLab writes
into every file, and it would say "the bytes differ" where what matters is
whether a surveyor can read their own answers off the page.
"""

import io
from dataclasses import replace
from datetime import date, time

import pytest
from pypdf import PdfReader

from app.models.anlage import Anlagenart
from app.protokolle.ausgabe.dokument import Bild, Protokollkopf, baue

KOPF = Protokollkopf(
    gewaesser="Neckar",
    ortsangabe="bei Rottenburg",
    datum=date(2026, 8, 14),
    uhrzeit=time(9, 30),
    status="Eingereicht",
    bearbeiter="A. Muster",
    form_version="20260609",
)

ANTWORTEN = {
    "anlass": "wrrl",
    "messdaten": {"temperatur": "12.5", "leitfaehigkeit": "420"},
    "hydrologie": {"breite": "2"},
    "umland": {"nadelwald": "40", "wiese": "60"},
    "arten": {
        "art1": {"name": "BFOR", "klasse_1": "12", "klasse_2": "3", "0plus": "5"},
        "art2": {"name": "AAAL", "klasse_4": "2"},
    },
}


def text_von(pdf: bytes) -> str:
    return "\n".join(seite.extract_text() for seite in PdfReader(io.BytesIO(pdf)).pages)


def seitenzahl(pdf: bytes) -> int:
    return len(PdfReader(io.BytesIO(pdf)).pages)


def bild_bytes(breite: int = 400, hoehe: int = 300) -> bytes:
    """A real PNG rather than a made-up blob, because the point is that
    ReportLab can measure and place it."""
    from PIL import Image

    puffer = io.BytesIO()
    Image.new("RGB", (breite, hoehe), (30, 90, 160)).save(puffer, format="PNG")
    return puffer.getvalue()


def test_ist_eine_lesbare_pdf() -> None:
    pdf = baue(KOPF, ANTWORTEN)

    assert pdf.startswith(b"%PDF-")
    assert seitenzahl(pdf) >= 1


def test_nennt_gewaesser_datum_und_status() -> None:
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "Neckar" in text
    assert "bei Rottenburg" in text
    assert "14.08.2026" in text
    assert "Eingereicht" in text
    assert "A. Muster" in text


def test_druckt_abschnitt_block_und_beschriftung() -> None:
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "Messdaten und Hydrologie" in text
    assert "Wassertemperatur" in text
    assert "12.5" in text


def test_loest_eine_option_in_ihren_text_auf() -> None:
    """A protocol stores wrrl; nobody reading a printout knows what that is."""
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "wrrl" not in text
    assert "WRRL" in text


def test_laesst_unbeantwortete_felder_weg() -> None:
    """A page of empty labels hides the answers among them."""
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "Schaumbildung" not in text
    assert "Sichttiefe" not in text


def test_laesst_einen_ganzen_abschnitt_weg_wenn_nichts_beantwortet_ist() -> None:
    text = text_von(baue(KOPF, {"anlass": "best"}))

    assert "Messdaten und Hydrologie" not in text
    assert "Anlass und Probestrecke" in text


def test_zahlen_bleiben_in_unserer_schreibweise() -> None:
    """12.5, never 12,5. The legacy form's writing stays in the legacy form."""
    text = text_von(baue(KOPF, {"messdaten": {"temperatur": "12.5"}}))

    assert "12.5" in text
    assert "12,5" not in text


def test_druckt_die_summe_einer_prozentgruppe() -> None:
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "Summe: 100 %" in text


def test_druckt_eine_summe_die_nicht_aufgeht_trotzdem() -> None:
    """No rule runs during a download. A draft that does not add up says so."""
    text = text_von(baue(KOPF, {"umland": {"nadelwald": "40"}}))

    assert "Summe: 40 %" in text


def test_fangtabelle_zeigt_klassen_und_zeilensummen() -> None:
    text = text_von(baue(KOPF, ANTWORTEN))

    assert "BFOR" in text
    assert "AAAL" in text
    # 12 + 3, and the five 0+ fish are already among them rather than extra.
    assert "15" in text
    assert "Gesamtsumme: 17" in text


def test_fangtabelle_ohne_arten_sagt_das() -> None:
    text = text_von(baue(KOPF, {"arten": {}}))

    assert "Keine Arten eingetragen." in text


def test_fangtabelle_ueberspringt_leere_zeilen() -> None:
    text = text_von(baue(KOPF, {"arten": {"art1": {"name": "BFOR"}, "art2": {}}}))

    assert "BFOR" in text
    assert "ohne Artangabe" not in text


def test_bilder_kommen_mit() -> None:
    ohne = baue(KOPF, ANTWORTEN)
    mit = baue(
        replace(KOPF, anlagen=2),
        ANTWORTEN,
        [
            Bild(Anlagenart.KARTENAUSSCHNITT, "karte.png", bild_bytes()),
            Bild(Anlagenart.FOTO, "foto.png", bild_bytes()),
        ],
    )

    assert seitenzahl(mit) > seitenzahl(ohne)
    text = text_von(mit)
    assert "Karte und Fotos" in text
    assert "karte.png" in text
    assert "2 Anlage(n) am Protokoll, 2 davon hier abgedruckt." in text


def test_ohne_anlagen_gibt_es_den_abschnitt_nicht() -> None:
    assert "Karte und Fotos" not in text_von(baue(KOPF, ANTWORTEN))


def test_ein_unlesbares_bild_nimmt_nicht_das_dokument_mit() -> None:
    """A picture whose bytes are gone or corrupt still leaves a protocol to hand
    over, and names the file that did not come."""
    pdf = baue(
        replace(KOPF, anlagen=1),
        ANTWORTEN,
        [Bild(Anlagenart.FOTO, "kaputt.png", b"kein bild")],
    )

    text = text_von(pdf)
    assert "kaputt.png (nicht darstellbar)" in text


def test_fehlende_datei_wird_als_hinweis_genannt() -> None:
    pdf = baue(
        replace(KOPF, anlagen=1, hinweise=("foto.png fehlt im Speicher.",)),
        ANTWORTEN,
    )

    assert "foto.png fehlt im Speicher." in text_von(pdf)


@pytest.mark.parametrize("antworten", [{}, {"arten": {}}, {"messdaten": {}}])
def test_ein_leeres_protokoll_baut_trotzdem(antworten: dict[str, object]) -> None:
    """A draft is incomplete by definition, and a copy of an empty one is still
    a copy somebody asked for."""
    pdf = baue(KOPF, antworten)

    assert pdf.startswith(b"%PDF-")
    assert "Neckar" in text_von(pdf)
