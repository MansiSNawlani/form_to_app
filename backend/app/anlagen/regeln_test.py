import re
from pathlib import Path

import pytest

from app.anlagen.fehler import (
    AnlageInhaltKeinBild,
    AnlagenartVoll,
    AnlageTypUnzulaessig,
    AnlageZuGross,
    sicherer_name,
)
from app.anlagen.regeln import (
    ERLAUBTE_TYPEN,
    KOPFGROESSE,
    MAX_BYTES,
    MAX_FOTOS,
    MAX_KARTENAUSSCHNITTE,
    erkenne_typ,
    hoechstzahl,
    pruefe_gemeldeten_typ,
    pruefe_groesse,
    pruefe_inhalt,
    pruefe_platz,
)
from app.models.anlage import Anlagenart

# Real first bytes, not invented ones. A signature test written from the same
# constant it is testing proves only that the constant equals itself.
JPEG_KOPF = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01"
PNG_KOPF = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
WEBP_KOPF = b"RIFF\x24\x00\x00\x00WEBPVP8 "


class TestErkenneTyp:
    """What the bytes say, which is the only trustworthy evidence in a request."""

    @pytest.mark.parametrize(
        ("kopf", "erwartet"),
        [
            (JPEG_KOPF, "image/jpeg"),
            (PNG_KOPF, "image/png"),
            (WEBP_KOPF, "image/webp"),
        ],
    )
    def test_erkennt_die_drei_formate(self, kopf: bytes, erwartet: str) -> None:
        assert erkenne_typ(kopf) == erwartet

    @pytest.mark.parametrize(
        ("name", "kopf"),
        [
            ("html", b"<!DOCTYPE html><html><script>"),
            ("plain text", b"Guten Tag, das ist kein Bild.\n"),
            ("a PDF", b"%PDF-1.7\n%\xe2\xe3\xcf\xd3"),
            ("a zip or an office document", b"PK\x03\x04\x14\x00\x00\x00\x08\x00"),
            ("HEIC, which no browser renders", b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00"),
            ("a GIF, which we do not serve", b"GIF89a\x01\x00\x01\x00\x00\x00\x00"),
            ("an SVG, which is script in a picture's clothing", b"<svg xmlns='http://"),
            ("nothing at all", b""),
        ],
    )
    def test_erkennt_nichts_anderes(self, name: str, kopf: bytes) -> None:
        assert erkenne_typ(kopf) is None

    def test_riff_allein_ist_kein_webp(self) -> None:
        """A WAV file is RIFF too. The name at offset 8 is what separates them."""
        assert erkenne_typ(b"RIFF\x24\x00\x00\x00WAVEfmt ") is None

    def test_kommt_mit_weniger_bytes_zurecht_als_eine_signatur_lang_ist(self) -> None:
        """An empty or nearly empty upload must be refused, not crash the read."""
        assert erkenne_typ(b"\xff") is None
        assert erkenne_typ(b"RIFF") is None

    def test_kopfgroesse_reicht_fuer_jede_signatur(self) -> None:
        """The constant the service reads before it decides has to be big enough."""
        assert erkenne_typ(WEBP_KOPF[:KOPFGROESSE]) == "image/webp"
        assert erkenne_typ(PNG_KOPF[:KOPFGROESSE]) == "image/png"
        assert erkenne_typ(JPEG_KOPF[:KOPFGROESSE]) == "image/jpeg"


class TestGemeldeterTyp:
    """The cheap half, mirroring what the browser checks."""

    @pytest.mark.parametrize("typ", sorted(ERLAUBTE_TYPEN))
    def test_nimmt_die_drei_erlaubten(self, typ: str) -> None:
        pruefe_gemeldeten_typ("karte.jpg", typ)

    def test_nimmt_auch_eine_andere_schreibweise(self) -> None:
        """A browser may send IMAGE/JPEG. Case is not what this rule is about."""
        pruefe_gemeldeten_typ("karte.jpg", "IMAGE/JPEG")

    @pytest.mark.parametrize(
        "typ",
        ["text/plain", "application/pdf", "image/heic", "image/gif", "image/svg+xml", ""],
    )
    def test_weist_alles_andere_ab(self, typ: str) -> None:
        with pytest.raises(AnlageTypUnzulaessig) as gefangen:
            pruefe_gemeldeten_typ("notizen.txt", typ)

        assert gefangen.value.dateiname == "notizen.txt"

    def test_ein_fehlender_typ_ist_kein_beweis(self) -> None:
        """A browser that never heard of the format sends nothing at all."""
        with pytest.raises(AnlageTypUnzulaessig):
            pruefe_gemeldeten_typ("foto.xyz", None)


class TestInhalt:
    """The real gate, and the one check a browser could not make even in principle."""

    def test_gibt_den_typ_zurueck_den_die_bytes_haben(self) -> None:
        assert pruefe_inhalt("karte.jpg", JPEG_KOPF) == "image/jpeg"

    def test_html_das_sich_als_jpeg_ausgibt_kommt_nicht_durch(self) -> None:
        """The case this rule exists for.

        The request declares image/jpeg and passes the cheap check. If the bytes
        were not looked at, this would be stored and later served from our own
        origin, where it could read the session cookie of whoever opened it.
        """
        pruefe_gemeldeten_typ("karte.jpg", "image/jpeg")

        with pytest.raises(AnlageInhaltKeinBild) as gefangen:
            pruefe_inhalt("karte.jpg", b"<!DOCTYPE html><script>fetch('/api/v1")

        assert gefangen.value.dateiname == "karte.jpg"

    def test_ein_echtes_jpeg_das_sich_png_nennt_wird_als_jpeg_gespeichert(self) -> None:
        """A photograph somebody renamed. Accepted, and stored as what it is.

        Refusing this would fail an honest upload to prove a point. Since the
        stored type comes from the bytes rather than from the request, there is
        nothing left that could be wrong about it afterwards.
        """
        pruefe_gemeldeten_typ("foto.png", "image/png")

        assert pruefe_inhalt("foto.png", JPEG_KOPF) == "image/jpeg"


class TestGroesse:
    def test_nimmt_eine_datei_genau_auf_der_grenze(self) -> None:
        pruefe_groesse("foto.jpg", MAX_BYTES)

    def test_weist_ein_byte_darueber_ab(self) -> None:
        with pytest.raises(AnlageZuGross) as gefangen:
            pruefe_groesse("riesig.jpg", MAX_BYTES + 1)

        assert gefangen.value.dateiname == "riesig.jpg"
        assert gefangen.value.hoechstens == MAX_BYTES
        assert gefangen.value.gelesen == MAX_BYTES + 1


class TestPlatz:
    def test_kennt_die_beiden_hoechstzahlen(self) -> None:
        assert hoechstzahl(Anlagenart.FOTO) == MAX_FOTOS
        assert hoechstzahl(Anlagenart.KARTENAUSSCHNITT) == MAX_KARTENAUSSCHNITTE

    def test_nimmt_das_zwanzigste_foto(self) -> None:
        pruefe_platz("foto.jpg", Anlagenart.FOTO, MAX_FOTOS - 1)

    def test_weist_das_einundzwanzigste_foto_ab(self) -> None:
        with pytest.raises(AnlagenartVoll) as gefangen:
            pruefe_platz("foto21.jpg", Anlagenart.FOTO, MAX_FOTOS)

        assert gefangen.value.dateiname == "foto21.jpg"
        assert gefangen.value.vorhanden == MAX_FOTOS
        assert gefangen.value.hoechstens == MAX_FOTOS

    def test_weist_den_zweiten_kartenausschnitt_ab(self) -> None:
        with pytest.raises(AnlagenartVoll) as gefangen:
            pruefe_platz("karte2.jpg", Anlagenart.KARTENAUSSCHNITT, 1)

        assert gefangen.value.hoechstens == MAX_KARTENAUSSCHNITTE

    def test_wird_vor_allem_anderen_gefragt(self) -> None:
        """Order matters, and regeln.ts settles it the same way.

        No amount of converting or shrinking a photograph makes room for it, so a
        full slot has to be reported as a full slot even when the file is also
        the wrong type. Any other message sends somebody off to fix the wrong
        thing.
        """
        with pytest.raises(AnlagenartVoll):
            pruefe_platz("notizen.txt", Anlagenart.FOTO, MAX_FOTOS)


class TestSichererName:
    """A filename is user input on its way back into a message."""

    def test_laesst_einen_gewoehnlichen_namen_in_ruhe(self) -> None:
        """It is what the surveyor looks for on their own machine.

        Umlauts and spaces included: a "cleaned up" name helps nobody find the
        file they have to go back for.
        """
        assert sicherer_name("Schussen Weißenau 3.jpg") == "Schussen Weißenau 3.jpg"

    def test_nimmt_zeilenumbrueche_heraus(self) -> None:
        """A name carrying a newline could make one refusal look like several."""
        assert "\n" not in sicherer_name("foto\n\nGuten Tag.jpg")

    def test_kuerzt_einen_sehr_langen_namen(self) -> None:
        gekuerzt = sicherer_name("a" * 500 + ".jpg")

        assert len(gekuerzt) < 200
        assert gekuerzt.endswith("...")

    def test_kein_name_bleibt_kein_name(self) -> None:
        """A refusal about no particular file must not open with a prefix.

        AnlageNichtGefunden knows nothing about a file, so "(ohne Namen): Diese
        Anlage gibt es nicht mehr" would be inventing a subject for the sentence.
        """
        assert sicherer_name("") == ""

    def test_ein_unlesbarer_name_wird_zum_platzhalter(self) -> None:
        """Here the message really is about one file, so saying nothing reads as a bug."""
        assert sicherer_name("\x00\x01") == "(ohne Namen)"


def test_die_werte_stimmen_mit_der_browserseite_ueberein() -> None:
    """The two halves of every rule have to hold the same numbers.

    coding-standards.md asks for validation twice, browser and server, and warns
    that they must be changed together. Read out of regeln.ts rather than copied
    into this test, so the day somebody edits one and not the other, this fails
    instead of the two quietly disagreeing until a surveyor finds it.
    """
    quelle = (
        Path(__file__).resolve().parents[3]
        / "frontend"
        / "src"
        / "protokoll"
        / "anlagen"
        / "regeln.ts"
    ).read_text(encoding="utf-8")

    def konstante(name: str) -> str:
        treffer = re.search(rf"^(?:export )?const {name} = (.+?)$", quelle, re.MULTILINE)
        assert treffer is not None, f"{name} is gone from regeln.ts"
        return treffer.group(1).rstrip()

    assert konstante("MAX_BYTES") == "10 * 1024 * 1024"
    assert konstante("MAX_FOTOS") == f"{MAX_FOTOS}"
    assert konstante("MAX_KARTENAUSSCHNITTE") == f"{MAX_KARTENAUSSCHNITTE}"

    typen = set(re.findall(r"\{ typ: '([^']+)'", quelle))
    assert typen == set(ERLAUBTE_TYPEN)
