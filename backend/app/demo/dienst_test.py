import uuid
from collections.abc import AsyncIterator, Awaitable, Callable

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.speicher import DateiSpeicher, anlagen_schluessel
from app.benutzer.dienst import finde_nach_email, melde_an
from app.benutzer.fehler import AnmeldungFehlgeschlagen
from app.demo.dienst import setze_demo_zurueck
from app.demo.fehler import DemoAus
from app.demo.regeln import DEMO_KONTEN
from app.models.benutzer import Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.models.workflow_event import WorkflowEvent
from app.protokolle.absenden import sende_ab
from app.protokolle.dienst import lege_entwurf_an, speichere_antworten
from app.protokolle.formregeln.beispiele import VOLLSTAENDIG

Anlegen = Callable[..., Awaitable[User]]


async def _zuruecksetzen(session: AsyncSession, speicher: DateiSpeicher) -> None:
    await setze_demo_zurueck(session, speicher, demo_modus=True)


async def _anzahl(session: AsyncSession, modell: type[object]) -> int:
    return (await session.execute(select(func.count()).select_from(modell))).scalar_one()


async def _demoprotokolle(session: AsyncSession) -> list[Submission]:
    einreicher = await finde_nach_email(session, DEMO_KONTEN[Rolle.SUBMITTER])
    assert einreicher is not None
    return list(
        (
            await session.execute(
                select(Submission).where(Submission.owner_user_id == einreicher.id)
            )
        ).scalars()
    )


async def test_ohne_demo_modus_wird_nichts_angefasst(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    with pytest.raises(DemoAus):
        await setze_demo_zurueck(session, speicher, demo_modus=False)

    assert await _anzahl(session, User) == 0
    assert await _anzahl(session, Submission) == 0


async def test_legt_die_beiden_konten_an(session: AsyncSession, speicher: DateiSpeicher) -> None:
    await _zuruecksetzen(session, speicher)

    for rolle, adresse in DEMO_KONTEN.items():
        konto = await finde_nach_email(session, adresse)
        assert konto is not None
        assert konto.rollen == [rolle]
        assert konto.ist_aktiv


async def test_demokonten_oeffnen_sich_nicht_ueber_das_anmeldeformular(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    """Their password is a random value nobody is told, so the only way in is
    the demo route, and that one closes with the switch."""
    await _zuruecksetzen(session, speicher)

    for adresse in DEMO_KONTEN.values():
        for geraten in ("demo", "passwort", adresse):
            with pytest.raises(AnmeldungFehlgeschlagen):
                await melde_an(session, email=adresse, passwort=geraten)


async def test_vier_beispiele_in_vier_zustaenden(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    await _zuruecksetzen(session, speicher)

    zustaende = sorted(p.status for p in await _demoprotokolle(session))
    assert zustaende == sorted(
        [Status.DRAFT, Status.SUBMITTED, Status.NEEDS_CHANGES, Status.LOCKED]
    )


async def test_das_zurueckgeschickte_beispiel_traegt_die_begruendung(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    await _zuruecksetzen(session, speicher)

    kommentare = (
        await session.execute(
            select(WorkflowEvent.kommentar).where(
                WorkflowEvent.nach_status == Status.NEEDS_CHANGES
            )
        )
    ).scalars()
    assert [k for k in kommentare if k and "Länge der Probestrecke" in k]


async def test_zweimal_ausgefuehrt_bleiben_es_vier(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    await _zuruecksetzen(session, speicher)
    nach_dem_ersten = [
        await _anzahl(session, modell) for modell in (Probestrecke, Gewaesser, Person, User)
    ]

    await _zuruecksetzen(session, speicher)

    assert len(await _demoprotokolle(session)) == 4
    assert [
        await _anzahl(session, modell) for modell in (Probestrecke, Gewaesser, Person, User)
    ] == nach_dem_ersten


async def test_entfernt_was_besucher_angelegt_haben(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    await _zuruecksetzen(session, speicher)
    einreicher = await finde_nach_email(session, DEMO_KONTEN[Rolle.SUBMITTER])
    assert einreicher is not None
    besucher = await lege_entwurf_an(session, besitzer=einreicher)

    await _zuruecksetzen(session, speicher)

    assert besucher.id not in {p.id for p in await _demoprotokolle(session)}


async def test_entfernt_auch_was_der_demopruefer_angelegt_hat(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    """Any signed-in account may start a protocol, the reviewer included, so a
    visitor at the reviewer's door can leave one behind as well."""
    await _zuruecksetzen(session, speicher)
    pruefer = await finde_nach_email(session, DEMO_KONTEN[Rolle.REVIEWER])
    assert pruefer is not None
    besucher = await lege_entwurf_an(session, besitzer=pruefer)

    await _zuruecksetzen(session, speicher)

    noch_da = await session.scalar(select(func.count()).where(Submission.id == besucher.id))
    assert noch_da == 0


async def test_entfernt_auch_die_dateien_der_anlagen(
    session: AsyncSession, speicher: DateiSpeicher
) -> None:
    await _zuruecksetzen(session, speicher)
    protokoll = (await _demoprotokolle(session))[0]

    async def _bloecke() -> AsyncIterator[bytes]:
        yield b"ein Foto"

    schluessel = anlagen_schluessel(protokoll.id, uuid.uuid4())
    await speicher.schreibe(schluessel, _bloecke())

    await _zuruecksetzen(session, speicher)

    assert not await speicher.existiert(schluessel)


async def test_ein_echtes_protokoll_bleibt_unberuehrt(
    session: AsyncSession, speicher: DateiSpeicher, anlegen: Anlegen
) -> None:
    """The whole point of deleting by owner. Even run against the wrong
    database, the reset cannot reach a protocol somebody really filed, nor the
    stretch and person it points at."""
    echt = await anlegen(email="anna@ffs.de")
    entwurf = await lege_entwurf_an(session, besitzer=echt)
    gespeichert = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=echt,
        antworten=dict(VOLLSTAENDIG),
        version=entwurf.version,
    )
    abgesendet = await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=echt, version=gespeichert.version
    )
    probestrecke_id, person_id = abgesendet.probestrecke_id, abgesendet.person_id

    await _zuruecksetzen(session, speicher)
    await _zuruecksetzen(session, speicher)

    geblieben = await session.get(Submission, entwurf.id)
    assert geblieben is not None
    assert geblieben.status == Status.SUBMITTED
    assert await session.get(Probestrecke, probestrecke_id) is not None
    assert await session.get(Person, person_id) is not None
