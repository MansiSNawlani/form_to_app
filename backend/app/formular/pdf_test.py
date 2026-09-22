"""Opening a form PDF, and refusing one that is not one.

Read against the real committed forms rather than against a PDF written here. A
file we wrote proves that we can read our own output, which is not the question:
the question is whether this opens the encrypted AcroForm FFS distributes.
"""

from io import BytesIO

import pytest
from pypdf import PdfWriter

from app.formular.beispiele import formular_bytes
from app.formular.fehler import PdfGesperrt, PdfNichtLesbar, PdfOhneFormular
from app.formular.pdf import decode, felder, oeffne


def ohne_formular() -> bytes:
    """A valid PDF with a page and no AcroForm in it."""
    schreiber = PdfWriter()
    schreiber.add_blank_page(width=200, height=200)
    puffer = BytesIO()
    schreiber.write(puffer)
    return puffer.getvalue()


def mit_passwort() -> bytes:
    """A PDF locked with a password nobody gave us."""
    schreiber = PdfWriter()
    schreiber.add_blank_page(width=200, height=200)
    schreiber.encrypt("ein-passwort-das-wir-nicht-haben")
    puffer = BytesIO()
    schreiber.write(puffer)
    return puffer.getvalue()


def test_die_echte_form_laesst_sich_oeffnen() -> None:
    """Encrypted with an empty password, which is how FFS ships it."""
    leser = oeffne(formular_bytes())

    assert len(leser.pages) == 4


def test_die_echte_form_hat_ihre_540_felder() -> None:
    """The count the seed records, walked out of the file itself.

    Both numbers come from the same PDF, so this is not a tautology: it proves
    the walk still assembles the dotted paths the way the seed was generated
    with, which is what every answer path in the application depends on.
    """
    namen = [name for name, _ in felder(oeffne(formular_bytes()))]

    assert len(namen) == 540
    assert "probestrecke.gewaesser.vorfluter1" in namen
    assert "arten.art26.klasse_10" in namen


def test_ein_stueck_text_ist_keine_pdf() -> None:
    with pytest.raises(PdfNichtLesbar):
        oeffne(b"Das ist ganz sicher keine PDF-Datei.")


def test_eine_leere_datei_ist_keine_pdf() -> None:
    """Its own case in pypdf, and the likeliest accident: an upload of nothing."""
    with pytest.raises(PdfNichtLesbar):
        oeffne(b"")


def test_eine_gesperrte_pdf_wird_als_gesperrt_abgelehnt() -> None:
    """Not as unreadable. The two need different words to the person holding it."""
    with pytest.raises(PdfGesperrt):
        oeffne(mit_passwort())


def test_eine_pdf_ohne_formular_wird_abgelehnt() -> None:
    with pytest.raises(PdfOhneFormular):
        oeffne(ohne_formular())


def test_decode_liefert_echte_umlaute() -> None:
    """The whole reason decode exists.

    The form stores its strings in PDFDocEncoding and pypdf decodes them
    wrongly, so every umlaut comes back as a replacement character. This reads
    the standing-water message out of the real file, which is the longest German
    sentence in it.
    """
    felderliste = dict(felder(oeffne(formular_bytes())))
    hinweis = decode(felderliste["hydrologie_box"]["/V"])

    assert hinweis == (
        "Angaben zur Hydrologie sind bei stehenden Gewässern nicht relevant"
    )
    assert "�" not in hinweis
