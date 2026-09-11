"""Submitting a protocol, against a real database.

Every test here checks the refusal as well as the pass, because this is the
decision about whether an official survey record may leave a person's hands. The
one that matters most is that a refused submit writes nothing at all: the rows
the matching creates in feature 11b are shared with every other protocol on the
same stretch, so half a submission is worse than none.
"""

import uuid
from collections.abc import Awaitable, Callable
from datetime import date, time

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.protokolle.absenden import sende_ab
from app.protokolle.fehler import (
    ProtokollNichtGefunden,
    ProtokollNichtMehrEntwurf,
    ProtokollUnvollstaendig,
    ProtokollVeraendert,
)
from app.protokolle.formregeln import pruefe_protokoll
from app.protokolle.formregeln.beispiele import KAPUTT, VOLLSTAENDIG
from app.protokolle.zuordnung.dienst import Zuordnung, ordne_zu
from app.protokolle.zuordnung.regeln import Umschlag


async def _entwurf(
    session: AsyncSession, besitzer: User, antworten: dict[str, object] | None = None
) -> Submission:
    """A draft belonging to this account, holding whatever the test needs.

    Written here rather than through lege_entwurf_an so a test can start from a
    complete document without saving it first: what the submit does with the
    answers is the subject, and how they got there is not.

    Committed rather than flushed, which is what a real draft is by the time
    anybody presses Absenden. It also matters to the rollback test below: a draft
    that had only been flushed would vanish along with the writes that test is
    actually watching.
    """
    entwurf = Submission(
        owner_user_id=besitzer.id,
        status=Status.DRAFT,
        form_version="20260609",
        antworten=antworten if antworten is not None else {},
    )
    session.add(entwurf)
    await session.commit()
    return entwurf


async def _zaehle(session: AsyncSession, modell: type[object]) -> int:
    return await session.scalar(select(func.count()).select_from(modell)) or 0


async def test_ein_unvollstaendiges_protokoll_wird_abgelehnt(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer)

    with pytest.raises(ProtokollUnvollstaendig) as erhoben:
        await sende_ab(
            session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
        )

    # An empty document is missing every required answer, so this is the whole
    # required list arriving at once, which is also the longest the panel in the
    # browser ever gets.
    assert len(erhoben.value.verstoesse) >= 31
    # Keys, never sentences. The browser owns the German, which is what lets
    # feature 17 translate these once rather than in two places.
    assert all(v.schluessel.startswith("protokoll.regeln.") for v in erhoben.value.verstoesse)


async def test_die_verstoesse_kommen_in_abschnittsreihenfolge(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The panel lists problems in the order somebody walks the form.

    pruefe_protokoll promises that order and this is the test that the submit
    hands it on unsorted rather than tidying it into something else.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(KAPUTT))

    with pytest.raises(ProtokollUnvollstaendig) as erhoben:
        await sende_ab(
            session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
        )

    assert list(erhoben.value.verstoesse) == pruefe_protokoll(KAPUTT)


async def test_eine_ablehnung_schreibt_nichts(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The test that matters most in this file.

    A refused submit must leave the protocol a draft and must not leave a
    Gewaesser, a Probestrecke or a Person behind. Those rows are shared with every
    other protocol on the same stretch, so a half-written submission is worse than
    a refused one.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(KAPUTT))
    vorher = entwurf.version

    with pytest.raises(ProtokollUnvollstaendig):
        await sende_ab(session, protokoll_id=entwurf.id, besitzer=besitzer, version=vorher)

    await session.refresh(entwurf)
    assert entwurf.status is Status.DRAFT
    assert entwurf.version == vorher
    assert entwurf.submitted_at is None
    assert entwurf.probestrecke_id is None
    assert await _zaehle(session, Gewaesser) == 0
    assert await _zaehle(session, Probestrecke) == 0
    assert await _zaehle(session, Person) == 0


async def test_ein_vollstaendiges_protokoll_wird_abgesendet(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The whole envelope arrives at once, which is what the check constraint says.

    umschlag_bei_abgabe refuses a row that is anything but DRAFT without all seven
    of these, so a promotion that forgot one would fail in the database rather
    than store half a submission. Asserting them here says which one.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))

    protokoll = await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
    )

    assert protokoll.status is Status.SUBMITTED
    assert protokoll.submitted_at is not None
    assert protokoll.probestrecke_id is not None
    assert protokoll.person_id is not None
    assert protokoll.bearbeiter_name == "Dr. Anne Krüger"
    assert protokoll.anlass == "wrrl"
    assert protokoll.datum == date(2026, 7, 15)
    assert protokoll.uhrzeit == time(8, 41)
    # Not locked. Locking is a reviewer accepting the protocol, which is feature
    # 11d, and gesperrt_hat_zeitpunkt requires the two to agree.
    assert protokoll.locked_at is None


async def test_das_abgesendete_protokoll_zeigt_auf_eine_echte_probestrecke(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """ADR 0001: the stretch is an entity, not a dozen answers in a document.

    The point of promoting it is that the row exists and carries what was typed,
    so a second survey of the same stretch in a later year can find it.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))

    protokoll = await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
    )

    strecke = await session.get(Probestrecke, protokoll.probestrecke_id)
    assert strecke is not None
    assert strecke.monitoringstrecke_nr == "1001000001"
    assert strecke.gewaessertyp == 13
    assert strecke.laenge_m == 110
    assert strecke.regierungspraesidium == 4

    gewaesser = await session.get(Gewaesser, strecke.gewaesser_id)
    assert gewaesser is not None
    # Stored exactly as typed. Lowercasing it is defect 2, one of the three
    # legacy bugs that put wrong data into FiaKa.
    assert gewaesser.name == "Wolfegger Ach"


async def test_zwei_protokolle_auf_derselben_strecke_teilen_sich_die_zeilen(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The same stretch surveyed twice is one record with two submissions.

    Proved through the submit rather than only through the matching, because this
    is the path that will actually run: if sende_ab ever created its own rows
    instead of asking, every year's survey would be a new stretch and the history
    the feature exists for would not exist.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    erstes = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))
    zweites = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))

    eins = await sende_ab(
        session, protokoll_id=erstes.id, besitzer=besitzer, version=erstes.version
    )
    zwei = await sende_ab(
        session, protokoll_id=zweites.id, besitzer=besitzer, version=zweites.version
    )

    assert eins.probestrecke_id == zwei.probestrecke_id
    assert eins.person_id == zwei.person_id
    assert await _zaehle(session, Gewaesser) == 1
    assert await _zaehle(session, Probestrecke) == 1
    assert await _zaehle(session, Person) == 1


async def test_absenden_hebt_die_version(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A tab still open on this protocol is now behind, and has to be told so."""
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))
    vorher = entwurf.version

    protokoll = await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=besitzer, version=vorher
    )

    assert protokoll.version == vorher + 1


async def test_ein_fehler_in_der_zuordnung_hinterlaesst_nichts(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One commit, at the very end, and this is what makes that observable.

    The matching is patched to do its real work and then fail, which is what a
    lost connection between the last INSERT and the commit looks like. If
    anything before the end had committed, the rows would survive the rollback.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))
    # Held before the rollback, which expires every attribute on the instance.
    # Reading entwurf.id afterwards would reload it, and a lazy load in async
    # context fails talking about greenlets rather than about anything here.
    entwurf_id = entwurf.id

    async def bricht_ab(
        offene: AsyncSession, umschlag: Umschlag, konto: User
    ) -> Zuordnung:
        await ordne_zu(offene, umschlag, konto)
        raise RuntimeError("connection lost")

    monkeypatch.setattr("app.protokolle.absenden.ordne_zu", bricht_ab)

    with pytest.raises(RuntimeError):
        await sende_ab(
            session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
        )

    await session.rollback()

    assert await _zaehle(session, Gewaesser) == 0
    assert await _zaehle(session, Probestrecke) == 0
    assert await _zaehle(session, Person) == 0
    gespeichert = await session.get(Submission, entwurf_id)
    assert gespeichert is not None
    assert gespeichert.status is Status.DRAFT


async def test_die_regeln_und_der_umschlag_sind_sich_einig(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The complete fixture passes both halves, not just the rules.

    pruefe_protokoll and lies_umschlag ask different questions of the same
    document: is every required answer there, and is every one of them the type
    its column holds. If the rules let a document through and the envelope reader
    then refuses it, the two disagree about what a finished protocol is, and that
    is worth stopping for rather than loosening this test.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))

    assert pruefe_protokoll(VOLLSTAENDIG) == []
    await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
    )


async def test_ein_fremdes_protokoll_ist_nicht_zu_finden(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """The permission test coding-standards.md calls non-optional.

    The same refusal as for a protocol that does not exist. Telling the two apart
    would let a stranger map out which ids are real, which for surveys filed by
    named external consultants is a fact about other people's work.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    fremder = await anlegen(email="keller@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))

    with pytest.raises(ProtokollNichtGefunden):
        await sende_ab(
            session, protokoll_id=entwurf.id, besitzer=fremder, version=entwurf.version
        )


async def test_ein_unbekanntes_protokoll_ist_nicht_zu_finden(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    besitzer = await anlegen(email="bergmann@ffs.de")

    with pytest.raises(ProtokollNichtGefunden):
        await sende_ab(session, protokoll_id=uuid.uuid4(), besitzer=besitzer, version=1)


async def test_ein_bereits_abgesendetes_protokoll_geht_nicht_noch_einmal(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    umschlag: Callable[..., Awaitable[dict[str, object]]],
) -> None:
    """What a lost answer on the way back to the browser looks like.

    The surveyor presses Absenden, the protocol is stored, the reply never
    arrives, and they press again. The second press must not submit anything a
    second time.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    felder = await umschlag()
    entwurf = Submission(
        owner_user_id=besitzer.id,
        status=Status.SUBMITTED,
        form_version="20260609",
        antworten=dict(VOLLSTAENDIG),
        **felder,
    )
    session.add(entwurf)
    await session.flush()

    with pytest.raises(ProtokollNichtMehrEntwurf):
        await sende_ab(
            session, protokoll_id=entwurf.id, besitzer=besitzer, version=entwurf.version
        )


async def test_ein_veralteter_stand_wird_abgelehnt(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """A tab left open across somebody else's editing session.

    Refused before the rules run, so the message is about the second tab rather
    than about fields the surveyor can see are filled in.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer, dict(VOLLSTAENDIG))
    entwurf.version = 7
    await session.flush()

    with pytest.raises(ProtokollVeraendert):
        await sende_ab(session, protokoll_id=entwurf.id, besitzer=besitzer, version=4)


async def test_ein_veralteter_stand_schlaegt_die_regeln(
    session: AsyncSession, anlegen: Callable[..., Awaitable[User]]
) -> None:
    """Order of the checks, made observable.

    A protocol that is both out of date and incomplete reports the conflict, not
    the missing fields. Repairing fields it would not have submitted anyway is the
    wrong errand to send somebody on.
    """
    besitzer = await anlegen(email="bergmann@ffs.de")
    entwurf = await _entwurf(session, besitzer)
    entwurf.version = 7
    await session.flush()

    with pytest.raises(ProtokollVeraendert):
        await sende_ab(session, protokoll_id=entwurf.id, besitzer=besitzer, version=4)
