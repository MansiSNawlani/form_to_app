"""The whole reader: bytes in, an importable protocol or a refusal out.

What 23b will call. Everything below it has its own tests; these are about the
four things being in the right order, and about the file's pictures being
counted rather than passed over in silence.
"""

import pytest

from app.formular.beispiele import formular_bytes, gefuellt, krebs_bytes, mit_bild
from app.formular.fehler import PdfNichtLesbar
from app.protokolle.einlesen.antworten_test import AUSGEFUELLT, VORBELEGT
from app.protokolle.einlesen.fehler import FormularversionPasstNicht
from app.protokolle.einlesen.leser import lies_protokoll


def test_ein_ausgefuelltes_protokoll_wird_eingelesen() -> None:
    ergebnis = lies_protokoll(gefuellt(AUSGEFUELLT))

    assert ergebnis.version == "20260609"
    assert ergebnis.antworten["arten"]["art1"]["klasse_3"] == "1234"
    assert ergebnis.antworten["datum"] == "2026-05-04"
    assert ergebnis.unbekannt == ()
    assert ergebnis.unbrauchbar == ()
    assert ergebnis.bilder == 0


def test_die_leere_form_liefert_ihre_vorbelegung() -> None:
    ergebnis = lies_protokoll(formular_bytes())

    assert ergebnis.antworten == VORBELEGT
    assert ergebnis.bilder == 0


def test_bilder_werden_gezaehlt_und_die_antworten_trotzdem_gelesen() -> None:
    """23d's absence costs the pictures and nothing else.

    An attachment is part of the protocol rather than a decoration on it, so a
    file that carries two photographs must not import as though it carried none.
    Counting them here is what lets 23b say so before anybody opens the draft.
    """
    ergebnis = lies_protokoll(mit_bild("fotos.bild1", "fotos.kartenausschnitt_image"))

    assert ergebnis.bilder == 2
    assert ergebnis.antworten == VORBELEGT


def test_ein_krebsprotokoll_wird_abgelehnt_bevor_etwas_gelesen_wird() -> None:
    """The version gate comes first, and this proves the order.

    A Krebs protocol has 350 fields with familiar-looking names. Reading its
    answers and then deciding would mean a document half-built out of the wrong
    form, and a refusal that arrives with somebody's data already in hand.
    """
    with pytest.raises(FormularversionPasstNicht):
        lies_protokoll(krebs_bytes())


def test_etwas_das_keine_pdf_ist_wird_abgelehnt() -> None:
    with pytest.raises(PdfNichtLesbar):
        lies_protokoll(b"Das ist keine PDF.")
