"""Signing in as a demo account, and putting the demo back to its start."""

import copy
import secrets
import uuid
from dataclasses import dataclass

from sqlalchemy import delete, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.speicher import Anlagenspeicher
from app.benutzer.dienst import finde_nach_email, lege_benutzer_an
from app.demo.beispiele import BEISPIELE, Beispiel
from app.demo.fehler import DemoAus, DemoNichtEingerichtet
from app.demo.regeln import DEMO_KONTEN, demo_adresse
from app.models.benutzer import Rolle, User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.protokolle.absenden import sende_ab
from app.protokolle.dienst import lege_entwurf_an, speichere_antworten
from app.protokolle.uebergang.dienst import fuehre_uebergang_aus
from app.protokolle.uebergang.regeln import Aktion

# What the reviewer does to an example after it has been handed in, to leave it
# in the state it shows. SUBMITTED needs nothing further.
_PRUEFERSCHRITT: dict[Status, Aktion] = {
    Status.NEEDS_CHANGES: Aktion.AENDERUNG_ANFORDERN,
    Status.LOCKED: Aktion.ANNEHMEN,
}


@dataclass(frozen=True, slots=True)
class Zuruecksetzung:
    """What a reset did, for the command to report."""

    entfernt: int
    angelegt: int


async def melde_demo_an(session: AsyncSession, *, rolle: Rolle, demo_modus: bool) -> User:
    """The demo account for this role, if the demo is on and set up."""
    benutzer = await finde_nach_email(session, demo_adresse(rolle, demo_modus=demo_modus))
    if benutzer is None or not benutzer.ist_aktiv:
        raise DemoNichtEingerichtet
    return benutzer


async def setze_demo_zurueck(
    session: AsyncSession, speicher: Anlagenspeicher, *, demo_modus: bool
) -> Zuruecksetzung:
    """Remove what visitors did, and put the four examples back.

    The switch is a second guard. The first is that only protocols owned by the
    two demo accounts are ever deleted, so even on the wrong database nothing anybody
    really filed can be reached.
    """
    if not demo_modus:
        raise DemoAus

    konten = await _richte_konten_ein(session)
    entfernt = await _entferne_demodaten(session, speicher, list(konten.values()))
    for beispiel in BEISPIELE:
        await _lege_beispiel_an(
            session,
            beispiel,
            einreicher=konten[Rolle.SUBMITTER],
            pruefer=konten[Rolle.REVIEWER],
        )
    return Zuruecksetzung(entfernt=entfernt, angelegt=len(BEISPIELE))


async def _richte_konten_ein(session: AsyncSession) -> dict[Rolle, User]:
    """Both demo accounts, created if missing and otherwise left as they are.

    A locked one stays locked: locking it is how somebody closes one door of the
    demo on purpose, and a reset should not quietly reopen it.
    """
    konten: dict[Rolle, User] = {}
    for rolle, adresse in DEMO_KONTEN.items():
        konto = await finde_nach_email(session, adresse)
        if konto is None:
            # A password nobody is told, so the ordinary sign-in form can never
            # open this account. The demo route is the only door.
            konto = await lege_benutzer_an(
                session, email=adresse, passwort=secrets.token_urlsafe(32), rollen=[rolle]
            )
        konten[rolle] = konto
    return konten


async def _entferne_demodaten(
    session: AsyncSession, speicher: Anlagenspeicher, demokonten: list[User]
) -> int:
    """Delete every protocol the demo accounts own, whatever its state, and what
    only those protocols used.

    Both accounts, not only the submitter: any signed-in account may start a
    protocol or import a PDF, the reviewer included.

    Every state, unlike loesche_protokoll, which removes drafts only: that rule
    protects a record FFS has seen, and nothing in a demo is one.

    The Probestrecken, Gewaesser and Personen go only if these protocols were
    the last to point at them, and only the ones these protocols pointed at, so
    a stretch a real protocol shares survives.
    """
    protokolle = (
        await session.execute(
            select(Submission.id, Submission.probestrecke_id, Submission.person_id).where(
                Submission.owner_user_id.in_([konto.id for konto in demokonten])
            )
        )
    ).all()
    if not protokolle:
        return 0

    protokoll_ids = [zeile.id for zeile in protokolle]
    strecken = {zeile.probestrecke_id for zeile in protokolle} - {None}
    personen = {zeile.person_id for zeile in protokolle} - {None}
    gewaesser = set(
        (
            await session.execute(
                select(Probestrecke.gewaesser_id).where(Probestrecke.id.in_(strecken))
            )
        ).scalars()
    )

    # Attachments and the Verlauf go with each protocol by ON DELETE CASCADE.
    await session.execute(delete(Submission).where(Submission.id.in_(protokoll_ids)))
    await _entferne_verwaiste(session, strecken=strecken, gewaesser=gewaesser, personen=personen)
    await session.commit()

    # Files after the commit, as loesche_protokoll does: a cascade knows nothing
    # about the volume.
    for protokoll_id in protokoll_ids:
        await speicher.loesche_protokoll(protokoll_id)
    return len(protokoll_ids)


async def _entferne_verwaiste(
    session: AsyncSession,
    *,
    strecken: set[uuid.UUID],
    gewaesser: set[uuid.UUID],
    personen: set[uuid.UUID],
) -> None:
    """Of the rows the deleted protocols pointed at, those nothing points at now.

    Probestrecken before Gewaesser, because a Gewaesser is only free once its
    last Probestrecke has gone.
    """
    await session.execute(
        delete(Probestrecke).where(
            Probestrecke.id.in_(strecken),
            ~exists().where(Submission.probestrecke_id == Probestrecke.id),
        )
    )
    await session.execute(
        delete(Gewaesser).where(
            Gewaesser.id.in_(gewaesser),
            ~exists().where(Probestrecke.gewaesser_id == Gewaesser.id),
        )
    )
    await session.execute(
        delete(Person).where(
            Person.id.in_(personen),
            ~exists().where(Submission.person_id == Person.id),
        )
    )


async def _lege_beispiel_an(
    session: AsyncSession,
    beispiel: Beispiel,
    *,
    einreicher: User,
    pruefer: User,
) -> uuid.UUID:
    """One example, through the same services a person in the browser uses, so
    it has passed exactly the checks a typed protocol passes."""
    entwurf = await lege_entwurf_an(session, besitzer=einreicher)
    gespeichert = await speichere_antworten(
        session,
        protokoll_id=entwurf.id,
        besitzer=einreicher,
        antworten=copy.deepcopy(beispiel.antworten),
        version=entwurf.version,
    )
    if beispiel.status == Status.DRAFT:
        return entwurf.id

    await sende_ab(
        session, protokoll_id=entwurf.id, besitzer=einreicher, version=gespeichert.version
    )
    aktion = _PRUEFERSCHRITT.get(beispiel.status)
    if aktion is not None:
        await fuehre_uebergang_aus(
            session, protokoll_id=entwurf.id, aktion=aktion,
            akteur=pruefer,
            kommentar=beispiel.kommentar,
        )
    return entwurf.id
