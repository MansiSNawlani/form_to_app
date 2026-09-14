"""Making a move and recording it, against a real database.

regeln_test.py already covers which moves are allowed. What is tested here is
that a move that is allowed leaves the right two rows behind, and that a move that
is refused leaves nothing at all.

The one that matters most is the second. A status that moved with no event is a
protocol whose past cannot be reconstructed, and a refused decision that moved the
status anyway is an official record changed by somebody who was told they could
not.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, time

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.benutzer.dienst import lege_benutzer_an
from app.benutzer.fehler import RolleFehlt
from app.models.benutzer import Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.models.workflow_event import WorkflowEvent
from app.protokolle.dienst import hole_sichtbares_protokoll
from app.protokolle.fehler import (
    BegruendungFehlt,
    EigenesProtokoll,
    ProtokollNichtGefunden,
    UebergangNichtMoeglich,
)
from app.protokolle.uebergang.dienst import entscheide, vermerke
from app.protokolle.uebergang.regeln import Aktion

BEGRUENDUNG = "Bitte die Leitfaehigkeit nachtragen, das Feld ist leer geblieben."


@pytest.fixture
async def besitzer(anlegen: Callable[..., Awaitable[User]]) -> User:
    return await anlegen(email="bergmann@ffs.de")


@pytest.fixture
async def pruefer(anlegen: Callable[..., Awaitable[User]]) -> User:
    return await anlegen(email="lehmann@ffs.de", rollen=(Rolle.REVIEWER,))


@pytest.fixture
def eingereicht(
    session: AsyncSession, umschlag: Callable[..., Awaitable[dict[str, object]]]
) -> Callable[..., Awaitable[Submission]]:
    """A protocol that has been handed in, in whichever state the test needs.

    The envelope comes from the shared fixture because feature 11b's check
    constraint requires the whole of it the moment a protocol is not a draft.
    """

    async def _eingereicht(besitzer: User, status: Status = Status.SUBMITTED) -> Submission:
        protokoll = Submission(
            owner_user_id=besitzer.id,
            status=status,
            form_version="20260609",
            antworten={},
            **await umschlag(),
        )
        session.add(protokoll)
        await session.commit()
        return protokoll

    return _eingereicht


async def _ereignisse(session: AsyncSession) -> list[WorkflowEvent]:
    return list(
        (await session.scalars(select(WorkflowEvent).order_by(WorkflowEvent.created_at))).all()
    )


async def _zaehle_ereignisse(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(WorkflowEvent)) or 0


@pytest.mark.parametrize(
    ("aktion", "erwartet"),
    [
        (Aktion.IN_PRUEFUNG_NEHMEN, Status.IN_REVIEW),
        (Aktion.ANNEHMEN, Status.LOCKED),
        (Aktion.AENDERUNG_ANFORDERN, Status.NEEDS_CHANGES),
        (Aktion.ABLEHNEN, Status.REJECTED),
    ],
)
async def test_jede_aktion_schreibt_ihren_status_und_genau_ein_ereignis(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
    aktion: Aktion,
    erwartet: Status,
) -> None:
    protokoll = await eingereicht(besitzer)

    ergebnis = await entscheide(
        session,
        protokoll_id=protokoll.id,
        aktion=aktion,
        akteur=pruefer,
        kommentar=BEGRUENDUNG,
    )

    assert ergebnis.status is erwartet

    ereignis = (await _ereignisse(session))[0]
    assert ereignis.von_status is Status.SUBMITTED
    assert ereignis.nach_status is erwartet
    assert ereignis.actor_user_id == pruefer.id
    assert await _zaehle_ereignisse(session) == 1


async def test_annehmen_sperrt_das_protokoll(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """Accepted and fixed in one action, which is what the reviewer mockup's own
    button text promises."""
    protokoll = await eingereicht(besitzer)

    ergebnis = await entscheide(
        session, protokoll_id=protokoll.id, aktion=Aktion.ANNEHMEN, akteur=pruefer
    )

    assert ergebnis.status is Status.LOCKED
    assert ergebnis.locked_at is not None


@pytest.mark.parametrize(
    "aktion", [Aktion.IN_PRUEFUNG_NEHMEN, Aktion.AENDERUNG_ANFORDERN, Aktion.ABLEHNEN]
)
async def test_alles_andere_laesst_den_sperrzeitpunkt_leer(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
    aktion: Aktion,
) -> None:
    protokoll = await eingereicht(besitzer)

    ergebnis = await entscheide(
        session,
        protokoll_id=protokoll.id,
        aktion=aktion,
        akteur=pruefer,
        kommentar=BEGRUENDUNG,
    )

    assert ergebnis.locked_at is None


async def test_die_begruendung_wird_mitgeschrieben(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """The surveyor reads this text, so it is stored as it was written."""
    protokoll = await eingereicht(besitzer)

    await entscheide(
        session,
        protokoll_id=protokoll.id,
        aktion=Aktion.AENDERUNG_ANFORDERN,
        akteur=pruefer,
        kommentar=f"  {BEGRUENDUNG}  ",
    )

    assert (await _ereignisse(session))[0].kommentar == BEGRUENDUNG


async def test_ohne_begruendung_bleibt_der_kommentar_leer(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """Null rather than an empty string, which the database refuses anyway."""
    protokoll = await eingereicht(besitzer)

    await entscheide(
        session, protokoll_id=protokoll.id, aktion=Aktion.ANNEHMEN, akteur=pruefer, kommentar="  "
    )

    assert (await _ereignisse(session))[0].kommentar is None


async def test_eine_abgewiesene_entscheidung_schreibt_gar_nichts(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """The one this file exists for.

    Neither the status nor an event. A status that moved with no event is a
    protocol whose past cannot be reconstructed.
    """
    protokoll = await eingereicht(besitzer)

    with pytest.raises(BegruendungFehlt):
        await entscheide(
            session,
            protokoll_id=protokoll.id,
            aktion=Aktion.ABLEHNEN,
            akteur=pruefer,
            kommentar=None,
        )

    await session.refresh(protokoll)
    assert protokoll.status is Status.SUBMITTED
    assert await _zaehle_ereignisse(session) == 0


async def test_ein_zweites_mal_entscheiden_wird_abgewiesen(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """A locked protocol is final, and a second press of the button must not move
    it on again."""
    protokoll = await eingereicht(besitzer)
    await entscheide(session, protokoll_id=protokoll.id, aktion=Aktion.ANNEHMEN, akteur=pruefer)

    with pytest.raises(UebergangNichtMoeglich):
        await entscheide(
            session, protokoll_id=protokoll.id, aktion=Aktion.ABLEHNEN, akteur=pruefer
        )

    assert await _zaehle_ereignisse(session) == 1


async def test_der_einreicher_entscheidet_nicht_ueber_sein_eigenes(
    session: AsyncSession,
    anlegen: Callable[..., Awaitable[User]],
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """Somebody who reviews and also fishes. Chosen with the user on 2026-09-14."""
    beides = await anlegen(email="lehmann@ffs.de", rollen=(Rolle.REVIEWER, Rolle.SUBMITTER))
    protokoll = await eingereicht(beides)

    with pytest.raises(EigenesProtokoll):
        await entscheide(
            session, protokoll_id=protokoll.id, aktion=Aktion.ANNEHMEN, akteur=beides
        )

    assert await _zaehle_ereignisse(session) == 0


async def test_ein_datensteward_entscheidet_nicht(
    session: AsyncSession,
    besitzer: User,
    anlegen: Callable[..., Awaitable[User]],
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    steward = await anlegen(email="kern@ffs.de", rollen=(Rolle.DATA_STEWARD,))
    protokoll = await eingereicht(besitzer)

    with pytest.raises(RolleFehlt):
        await entscheide(
            session, protokoll_id=protokoll.id, aktion=Aktion.ANNEHMEN, akteur=steward
        )

    assert await _zaehle_ereignisse(session) == 0


async def test_ein_unbekanntes_protokoll_ist_nicht_gefunden(
    session: AsyncSession, pruefer: User
) -> None:
    with pytest.raises(ProtokollNichtGefunden):
        await entscheide(
            session, protokoll_id=uuid.uuid4(), aktion=Aktion.ANNEHMEN, akteur=pruefer
        )


async def test_ein_entwurf_ist_fuer_einen_pruefer_nicht_da(
    session: AsyncSession, besitzer: User, pruefer: User
) -> None:
    """Not a conflict about its state, which would confirm the id is real.

    A draft is somebody's unfinished work and is invisible to everybody else, so
    the answer is the same one a stranger gets for an id that does not exist.
    """
    entwurf = Submission(
        owner_user_id=besitzer.id, status=Status.DRAFT, form_version="20260609", antworten={}
    )
    session.add(entwurf)
    await session.commit()

    with pytest.raises(ProtokollNichtGefunden):
        await entscheide(
            session, protokoll_id=entwurf.id, aktion=Aktion.ANNEHMEN, akteur=pruefer
        )


async def test_die_geschichte_sammelt_sich_an(
    session: AsyncSession,
    besitzer: User,
    pruefer: User,
    eingereicht: Callable[..., Awaitable[Submission]],
) -> None:
    """In Pruefung nehmen and then deciding is two moves, and the Verlauf shows
    both in the order they happened."""
    protokoll = await eingereicht(besitzer)

    await entscheide(
        session, protokoll_id=protokoll.id, aktion=Aktion.IN_PRUEFUNG_NEHMEN, akteur=pruefer
    )
    await entscheide(
        session,
        protokoll_id=protokoll.id,
        aktion=Aktion.AENDERUNG_ANFORDERN,
        akteur=pruefer,
        kommentar=BEGRUENDUNG,
    )

    ereignisse = await _ereignisse(session)
    assert [(e.von_status, e.nach_status) for e in ereignisse] == [
        (Status.SUBMITTED, Status.IN_REVIEW),
        (Status.IN_REVIEW, Status.NEEDS_CHANGES),
    ]


async def test_zwei_entscheidungen_zur_gleichen_zeit_ergeben_eine(
    nebenlaeufige_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """The row lock, which nothing else in this file can show.

    Two reviewers press a button at the same moment. Without the lock both read
    SUBMITTED, both pass the rules and both write, and the second silently
    overwrites the first: a protocol somebody rejected would end up accepted with
    nothing on the screen to say so. A decision carries no version number for the
    browser to be refused on, so this is the only thing standing between them.

    Its own sessions, on their own connections. The rolled-back connection the
    rest of this file uses is one transaction, so nothing written through it is
    visible to a second writer and nothing can contend for a row.
    """
    async with nebenlaeufige_sessions() as aufbau:
        besitzer = await lege_benutzer_an(
            aufbau,
            email="bergmann@ffs.de",
            passwort="Ein sehr langes Passwort 1",
            rollen=(Rolle.SUBMITTER,),
        )
        erste, zweite = [
            await lege_benutzer_an(
                aufbau,
                email=f"pruefer{n}@ffs.de",
                passwort="Ein sehr langes Passwort 1",
                rollen=(Rolle.REVIEWER,),
            )
            for n in (1, 2)
        ]
        gewaesser = Gewaesser(id=uuid.uuid4(), name="Schussen", vorfluter=["Rhein"])
        strecke = Probestrecke(
            id=uuid.uuid4(),
            gewaesser_id=gewaesser.id,
            ortsangabe="unterhalb der Bruecke",
            gewaessertyp=13,
            laenge_m=450,
            untere_grenze_rechtswert=512340,
            untere_grenze_hochwert=5398120,
            obere_grenze_rechtswert=512890,
            obere_grenze_hochwert=5398450,
            regierungspraesidium=4,
        )
        person = Person(id=uuid.uuid4(), name="Anna Weber", email="weber@ffs.de")
        protokoll = Submission(
            owner_user_id=besitzer.id,
            status=Status.SUBMITTED,
            form_version="20260609",
            antworten={},
            probestrecke_id=strecke.id,
            person_id=person.id,
            bearbeiter_name="Anna Weber",
            anlass="wrrl",
            datum=date(2026, 6, 9),
            uhrzeit=time(14, 30),
            submitted_at=datetime.now(UTC),
        )
        aufbau.add_all([gewaesser, strecke, person, protokoll])
        await aufbau.commit()
        protokoll_id = protokoll.id

    # **Written as a held lock rather than as two racing calls.** Two calls under
    # asyncio.gather serialise by themselves often enough that the test passed
    # with the lock taken out, which makes it no test at all. This drives the
    # interleaving instead: the first reviewer holds the row, the second is made
    # to wait for it, and the wait is what is asserted.
    async with nebenlaeufige_sessions() as erste_sitzung:
        erste_akteur = await erste_sitzung.get(User, erste.id)
        assert erste_akteur is not None
        protokoll = await hole_sichtbares_protokoll(
            erste_sitzung, protokoll_id=protokoll_id, benutzer=erste_akteur, sperren=True
        )

        async def zweite_entscheidung() -> str:
            async with nebenlaeufige_sessions() as zweite_sitzung:
                zweite_akteur = await zweite_sitzung.get(User, zweite.id)
                assert zweite_akteur is not None
                try:
                    await entscheide(
                        zweite_sitzung,
                        protokoll_id=protokoll_id,
                        aktion=Aktion.ABLEHNEN,
                        akteur=zweite_akteur,
                        kommentar=BEGRUENDUNG,
                    )
                except UebergangNichtMoeglich:
                    return "abgewiesen"
                return "durch"

        wartende = asyncio.create_task(zweite_entscheidung())
        await asyncio.sleep(0.3)

        # The assertion the lock exists for. Without it the second reviewer has
        # already read SUBMITTED, passed the rules and written by now.
        assert not wartende.done()

        vermerke(
            erste_sitzung, protokoll=protokoll, aktion=Aktion.ANNEHMEN, akteur=erste_akteur
        )
        await erste_sitzung.commit()

        assert await wartende == "abgewiesen"

    async with nebenlaeufige_sessions() as pruefung:
        assert await _zaehle_ereignisse(pruefung) == 1
        gespeichert = await pruefung.get(Submission, protokoll_id)
        assert gespeichert is not None
        assert gespeichert.status is Status.LOCKED
