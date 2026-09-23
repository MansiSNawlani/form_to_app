"""Deciding whether a file is a protocol this application can import.

Against the two real forms rather than against anything built here. The Krebs
protocol is the interesting one: it is a genuine, encrypted, separately
maintained Acrobat form from the same people, so it is what somebody uploading
the wrong file would actually upload.

**The old template is the other interesting case**, and it cannot be tested
against a real file: FFS supplied three protocols filled in on the 2023 and 2024
templates, and none of them is in the repository, because each carries a
surveyor's name and home address. What stands in for them is the real form with
its own version stamp rewritten, which exercises the thing that actually
changed: the version a file declares no longer decides whether it is accepted.
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
    KeinBefischungsformular,
)
from app.protokolle.einlesen.version import pruefe_formular

# The forms are not in the repository, so a checkout without them skips this
# module rather than failing it.
pytestmark = pytest.mark.skipif(not vorhanden(), reason=FEHLT)


def test_die_echte_form_wird_angenommen() -> None:
    """The file says "Version 2026-06-09"; the application says "20260609"."""
    assert pruefe_formular(oeffne(formular_bytes())) == "20260609"


def test_eine_aeltere_vorlage_wird_angenommen() -> None:
    """A 2023 template is our form, so it is imported and its version reported.

    The whole point of feature 23b's first step. People fill in whatever copy of
    the PDF they downloaded years ago, and all three real protocols FFS supplied
    record surveys carried out in 2026 on templates from 2023 and 2024. An old
    template is not an old survey.
    """
    assert pruefe_formular(oeffne(gefuellt({"version": "Version 2023-02-25"}))) == "20230225"


def test_das_krebsprotokoll_wird_abgelehnt() -> None:
    """A real Acrobat form from the same people, and the wrong one.

    Refused for its fields rather than for its version, which is what lets the
    message say this is a different form rather than an old one.
    """
    with pytest.raises(KeinBefischungsformular) as gefangen:
        pruefe_formular(oeffne(krebs_bytes()))

    assert "fields" in str(gefangen.value)


def test_ein_formular_ohne_eines_unserer_felder_wird_abgelehnt() -> None:
    """Our own version stamp is not enough; the names are what is trusted.

    Without this the widened gate would accept anything carrying the right
    version string, which is a string anybody can type into a field.
    """
    with pytest.raises(KeinBefischungsformular):
        pruefe_formular(oeffne(ohne_feld("bemerkungen")))


def test_eine_datei_ohne_versionsfeld_wird_abgelehnt() -> None:
    """Every copy FFS distributes stamps its own version in and locks the field.

    So a file without one has been through something other than Acrobat, whatever
    its other fields are called.
    """
    with pytest.raises(FormularversionFehlt):
        pruefe_formular(oeffne(ohne_feld("version")))


def test_eine_unlesbare_version_wird_abgelehnt() -> None:
    """Refused rather than guessed at from the rest of the file."""
    with pytest.raises(FormularversionFehlt):
        pruefe_formular(oeffne(gefuellt({"version": "irgendein Formular"})))


def test_eine_leere_version_wird_abgelehnt() -> None:
    with pytest.raises(FormularversionFehlt):
        pruefe_formular(oeffne(gefuellt({"version": "   "})))
