"""Response models pinned against the things they mirror.

Not a test of Pydantic. A test of the one place a model restates a fact that
lives somewhere else, where the copy can drift without anything failing.
"""

import pytest
from pydantic import ValidationError

from app.api.schemas import BenutzerAntwort, KontoAendernAnfrage, Pruefstatus
from app.models.benutzer import User
from app.models.protokoll import Status


class TestPruefstatus:
    def test_kennt_jeden_zustand_ausser_entwurf(self) -> None:
        # A status added to the protocol later has to be decided about here too:
        # either the queue can be asked for it, or it cannot and somebody said so.
        # Without this, a new state would silently become unaskable.
        assert {zustand.value for zustand in Pruefstatus} == {
            zustand.value for zustand in Status
        } - {Status.DRAFT.value}

    def test_laesst_sich_in_einen_echten_status_uebersetzen(self) -> None:
        # The queue is asked in these and queried in Status, so every value here
        # has to be a value there.
        assert [Status(zustand.value) for zustand in Pruefstatus] == [
            Status.SUBMITTED,
            Status.IN_REVIEW,
            Status.NEEDS_CHANGES,
            Status.REJECTED,
            Status.ACCEPTED,
            Status.LOCKED,
        ]


class TestKontoAendernAnfrage:
    """The one model in this file whose behaviour, not only its shape, matters.

    regierungspraesidium is genuinely nullable, so "leave the region alone" and
    "clear the region" have to stay different instructions all the way from the
    browser to the service. A default of None collapses them, and the collapse
    would show up as an account quietly keeping a region for a role it no longer
    has.
    """

    def test_ein_nicht_gesendetes_feld_gilt_als_nicht_gesetzt(self) -> None:
        anfrage = KontoAendernAnfrage.model_validate({"rollen": ["SUBMITTER"]})

        assert anfrage.wurde_gesetzt("rollen")
        assert not anfrage.wurde_gesetzt("regierungspraesidium")

    def test_ein_ausdruecklich_gesendetes_null_gilt_als_gesetzt(self) -> None:
        anfrage = KontoAendernAnfrage.model_validate(
            {"rollen": ["SUBMITTER"], "regierungspraesidium": None}
        )

        assert anfrage.wurde_gesetzt("regierungspraesidium")
        assert anfrage.regierungspraesidium is None

    def test_eine_leere_anfrage_setzt_nichts(self) -> None:
        anfrage = KontoAendernAnfrage.model_validate({})

        assert not any(
            anfrage.wurde_gesetzt(feld)
            for feld in ("email", "rollen", "regierungspraesidium", "locale", "ist_aktiv")
        )

    def test_eine_leere_rollenliste_kommt_bis_zur_regel_durch(self) -> None:
        """Deliberately not refused here, which was the first draft's mistake.

        A min_length bound on the field refuses the empty list with the generic
        "wrong format" message, and ROLLEN_LEER then becomes a documented code no
        caller can ever receive. normalisiere_rollen refuses it instead, with the
        message that says what to do about it, and nothing is written before it
        runs, so the round trip the bound appeared to save did not exist.
        """
        anfrage = KontoAendernAnfrage.model_validate({"rollen": []})

        assert anfrage.rollen == []

    def test_ein_ausdrueckliches_null_auf_einem_pflichtfeld_wird_abgelehnt(self) -> None:
        """Null means nothing on these four, so it is a mistake rather than an
        instruction. Ignoring it would be worse than refusing it: the change
        would look accepted and nothing would happen."""
        for feld in ("email", "rollen", "locale", "ist_aktiv"):
            with pytest.raises(ValidationError):
                KontoAendernAnfrage.model_validate({feld: None})

    def test_ein_unbekanntes_feld_wird_abgelehnt(self) -> None:
        """extra="forbid", so a misspelled field name is refused rather than
        silently ignored. Sending "ist_activ" and having nothing happen is the
        kind of bug that looks like the server losing the change."""
        with pytest.raises(ValidationError):
            KontoAendernAnfrage.model_validate({"ist_activ": False})


class TestBenutzerAntwort:
    def test_traegt_niemals_den_passwort_hash(self) -> None:
        """The guarantee the module docstring claims, held rather than assumed.

        A model built from the whole row would gain any column added later,
        including this one. Listing the fields is what makes it a guarantee, and
        this is what would fail if somebody swapped the listing for the row.
        """
        assert "password_hash" not in BenutzerAntwort.model_fields
        assert "password_hash" in User.__mapper__.columns

    def test_traegt_das_anlagedatum_aber_nicht_updated_at(self) -> None:
        """updated_at moves whenever a sign in upgrades the stored hash, so it is
        not a "last edited" date and must not be offered to a screen as one."""
        assert "created_at" in BenutzerAntwort.model_fields
        assert "updated_at" not in BenutzerAntwort.model_fields
