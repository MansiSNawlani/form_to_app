"""Turning one uploaded file into a draft, against a real database.

Two things have to be true at once here, and they pull in opposite directions: a
protocol with problems in it has to be stored anyway, because that is what an
import is for, and a file that cannot be read has to leave nothing at all behind.

The protocols come from `app/protokolle/formregeln/beispiele.py` by way of
`als_formularwerte`, so the one the form rules are known to be happy with and the
one that breaks a rule in every part are the same two documents the rules
themselves are tested against. Transcribing a second copy into the form's own
writing would leave two fixtures to keep in step.
"""

import logging
from collections.abc import Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.beispiele import (
    FEHLT,
    formular_bytes,
    gefuellt,
    mit_bild,
    mit_zusatzfeld,
    vorhanden,
)
from app.formular.fehler import PdfNichtLesbar
from app.formular.felder import formular
from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.protokolle.einlesen.beispiele import als_formularwerte
from app.protokolle.einlesen.dienst import importiere
from app.protokolle.einlesen.protokoll import lies_protokoll
from app.protokolle.formregeln.beispiele import KAPUTT, VOLLSTAENDIG

# The forms are not in the repository, so a checkout without them skips this
# module rather than failing it. The database fixtures skip on their own.
pytestmark = pytest.mark.skipif(not vorhanden(), reason=FEHLT)


def _sauberes_protokoll() -> bytes:
    """A filled-in form the rules have nothing to say about."""
    return gefuellt(als_formularwerte(VOLLSTAENDIG))


def _kaputtes_protokoll() -> bytes:
    """A filled-in form that breaks a rule in every part of the protocol."""
    return gefuellt(als_formularwerte(KAPUTT))


async def _anzahl(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(Submission)) or 0


async def test_ein_import_ist_ein_entwurf_dieses_kontos(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")

    entwurf, _ = await importiere(
        session, daten=_sauberes_protokoll(), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert entwurf.owner_user_id == besitzer.id
    assert entwurf.status is Status.DRAFT


async def test_das_protokoll_traegt_unsere_formularversion_nicht_die_der_datei(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Every import is a new survey, held to today's rules.

    The file here is filled in on a 2023 template, which is what all three real
    protocols FFS supplied turned out to be. The report says so; the protocol is
    stamped with the version this deployment serves, because nothing imported is
    a historical record being preserved.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    werte = {**als_formularwerte(VOLLSTAENDIG), "version": "Version 2023-02-25"}

    entwurf, bericht = await importiere(
        session, daten=gefuellt(werte), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert entwurf.form_version == formular().version
    assert bericht.version == "20230225"
    assert bericht.version != entwurf.form_version


async def test_die_antworten_sind_die_des_lesers(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Stored exactly as 23a read them, with nothing added and nothing dropped."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    daten = _sauberes_protokoll()

    entwurf, _ = await importiere(
        session, daten=daten, dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert entwurf.antworten == lies_protokoll(daten).antworten


async def test_der_bericht_nennt_was_die_regeln_bemaengeln(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """And the protocol is stored all the same.

    The whole design of the import in one test: a protocol with problems is
    exactly what this produces, so the problems are reported beside it rather
    than instead of it.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    entwurf, bericht = await importiere(
        session, daten=_kaputtes_protokoll(), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert bericht.verstoesse
    assert entwurf.status is Status.DRAFT
    assert await _anzahl(session) == 1


async def test_ein_fehlerfreies_protokoll_hat_nichts_zu_berichten(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """An empty list is a real answer, and means the protocol may be submitted."""
    besitzer = await anlegen(email="bergmann@ffs.de")

    _, bericht = await importiere(
        session, daten=_sauberes_protokoll(), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert bericht.verstoesse == ()


async def test_das_leere_formular_wird_eingelesen_und_nicht_abgelehnt(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The likeliest mistaken upload, and it still lands as a draft.

    Somebody uploads the form they downloaded rather than the one they filled in.
    Refusing it would be a judgement about the contents, which the import never
    makes; what they get instead is a draft whose report lists everything still
    missing, which is the same list Absenden would have shown them.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    entwurf, bericht = await importiere(
        session, daten=formular_bytes(), dateiname="leeres-formular.pdf", besitzer=besitzer
    )

    assert entwurf.status is Status.DRAFT
    assert len(bericht.verstoesse) > 10


async def test_eine_unlesbare_datei_hinterlaesst_kein_protokoll(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Not even an empty one.

    `lege_entwurf_an` and `speichere_antworten` each commit on their own, so
    creating a draft and then filling it would leave an empty protocol behind
    whenever the second half failed. That is the litter feature 3c went and
    removed, and counting the rows is what stops an import putting it back.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    vorher = await _anzahl(session)

    with pytest.raises(PdfNichtLesbar) as gefangen:
        await importiere(
            session, daten=b"Das ist keine PDF.", dateiname="urlaubsfoto.jpg", besitzer=besitzer
        )

    assert await _anzahl(session) == vorher
    # The reader takes bytes and never knew what the file was called. The import
    # puts the name onto whatever it raised, so the refusal can open with it.
    assert gefangen.value.dateiname == "urlaubsfoto.jpg"


async def test_ein_zweiter_import_ist_ein_zweites_protokoll(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Nothing reuses or overwrites the protocol imported a moment ago.

    A surveyor with a morning's worth of forms uploads them one after another,
    and each is its own survey.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    erstes, _ = await importiere(
        session, daten=_sauberes_protokoll(), dateiname="protokoll.pdf", besitzer=besitzer
    )
    zweites, _ = await importiere(
        session, daten=_kaputtes_protokoll(), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert erstes.id != zweites.id
    assert erstes.antworten != zweites.antworten
    assert await _anzahl(session) == 2


async def test_ein_unlesbares_datum_wird_gemeldet_und_das_protokoll_trotzdem_angelegt(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """An answer that could not be taken over is named, not dropped.

    The value is in the protocol exactly as the file wrote it, so nothing is
    lost; what the report says is that somebody has to look at it. Refusing the
    whole import over one date would be the import making a judgement about the
    contents, which it never does.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    werte = {**als_formularwerte(VOLLSTAENDIG), "datum": "irgendwann im Mai"}

    entwurf, bericht = await importiere(
        session, daten=gefuellt(werte), dateiname="protokoll.pdf", besitzer=besitzer
    )

    assert "datum" in bericht.unbrauchbar
    assert entwurf.antworten["datum"] == "irgendwann im Mai"


async def test_die_bilder_der_datei_werden_gezaehlt(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Separately from the violations, and deliberately so.

    An attachment is part of the protocol rather than a decoration on it, so
    somebody whose map excerpt did not come across has to be told. It is not a
    rule being broken: the rules know nothing about the file the answers came
    out of. Feature 23d is what reads the picture out into a real Anlage.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    _, bericht = await importiere(
        session,
        daten=mit_bild("fotos.kartenausschnitt_image"),
        dateiname="protokoll-mit-karte.pdf",
        besitzer=besitzer,
    )

    assert bericht.bilder == 1


async def test_ein_unbekanntes_feld_wird_protokolliert(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Where the people who can do something about it will find it.

    A field this application has no home for means our definition and the file
    disagree. Nobody uploading a protocol can act on that, so it is not in the
    report; the same name on every import is FFS having changed the form.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")

    with caplog.at_level(logging.WARNING):
        _, bericht = await importiere(
            session,
            daten=mit_zusatzfeld("neue_frage", "eine Antwort"),
            dateiname="protokoll.pdf",
            besitzer=besitzer,
        )

    assert bericht.unbekannt == ("neue_frage",)
    assert "neue_frage" in caplog.text
    # The name, never the value. Field paths are our own; answers are not.
    assert "eine Antwort" not in caplog.text
