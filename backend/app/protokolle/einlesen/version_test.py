"""Deciding whether a file is a protocol this application can import.

Against the two real forms rather than against anything built here. The Krebs
protocol is the interesting one: it is a genuine, encrypted, separately
maintained Acrobat form from the same people, so it is what somebody uploading
the wrong file would actually upload.
"""

import pytest

from app.formular.beispiele import (
    FEHLT,
    formular_bytes,
    gefuellt,
    krebs_bytes,
    ohne_feld,
    vorhanden,
)
from app.formular.pdf import oeffne
from app.protokolle.einlesen.fehler import (
    FormularversionFehlt,
    FormularversionPasstNicht,
)
from app.protokolle.einlesen.version import lies_version

# The forms are not in the repository, so a checkout without them skips this
# module rather than failing it.
pytestmark = pytest.mark.skipif(not vorhanden(), reason=FEHLT)


def test_die_echte_form_nennt_ihre_version() -> None:
    """The file says "Version 2026-06-09"; the application says "20260609"."""
    assert lies_version(oeffne(formular_bytes())) == "20260609"


def test_das_krebsprotokoll_wird_abgelehnt() -> None:
    """And the refusal names both versions, so the message can say which is which."""
    with pytest.raises(FormularversionPasstNicht) as gefangen:
        lies_version(oeffne(krebs_bytes()))

    assert gefangen.value.gefunden == "20230510"
    assert gefangen.value.erwartet == "20260609"


def test_eine_datei_ohne_versionsfeld_wird_abgelehnt() -> None:
    """Not assumed to be the right form because its other fields look familiar.

    A form we cannot identify is one whose rules we do not know, and ADR 0004
    turns on a protocol knowing which version it was filled in under.
    """
    with pytest.raises(FormularversionFehlt):
        lies_version(oeffne(ohne_feld("version")))


def test_eine_unlesbare_version_wird_abgelehnt() -> None:
    """Refused rather than guessed at from the rest of the file."""
    with pytest.raises(FormularversionFehlt):
        lies_version(oeffne(gefuellt({"version": "irgendein Formular"})))


def test_eine_leere_version_wird_abgelehnt() -> None:
    with pytest.raises(FormularversionFehlt):
        lies_version(oeffne(gefuellt({"version": "   "})))
