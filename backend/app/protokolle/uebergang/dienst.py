"""Moving a protocol from one state to the next, and writing down that it moved.

The database half of this package. regeln.py decides whether a move may be made
without touching a session; this makes it, and records it.

**The status and its event are written together or not at all.** That is the whole
point of the module. A status that moved with no event is a protocol whose past
cannot be reconstructed, and the reviewer who refused it cannot be asked why. So
there is exactly one place that assigns Submission.status outside of the draft
being created, and it is the same place that adds the WorkflowEvent.

Two functions, for the reason app/protokolle/zuordnung/dienst.py has none that
commit: vermerke is half of somebody else's action, and Absenden uses it in the
middle of writing the envelope, so committing there would leave a protocol
SUBMITTED with no Probestrecke behind it. entscheide is a whole action by itself
and commits at the end of it.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.models.workflow_event import WorkflowEvent
from app.protokolle.dienst import beruehre, hole_sichtbares_protokoll
from app.protokolle.uebergang.regeln import Aktion, pruefe_uebergang, ziel


def vermerke(
    session: AsyncSession,
    *,
    protokoll: Submission,
    aktion: Aktion,
    akteur: User,
    kommentar: str | None = None,
) -> WorkflowEvent:
    """Check the move, make it, and add its event. No commit.

    Returns the event rather than the protocol, because the protocol is the
    caller's already and the event is the thing this produced.
    """
    pruefe_uebergang(
        aktion,
        status=protokoll.status,
        rollen=akteur.rollen,
        ist_besitzer=protokoll.owner_user_id == akteur.id,
        kommentar=kommentar,
    )

    von = protokoll.status
    nach = ziel(aktion)

    protokoll.status = nach
    if nach is Status.LOCKED:
        # Accepted and fixed in one action, which is what the reviewer mockup's
        # own button text promises. The gesperrt_hat_zeitpunkt constraint requires
        # the two to arrive together, so this is not a second step somebody could
        # forget.
        protokoll.locked_at = datetime.now(UTC)

    # So a protocol that has just come back rises to the top of its owner's list.
    # beruehre deliberately does not raise version: that number guards the answers
    # document against two open tabs, and a decision changes no answer.
    beruehre(protokoll)

    ereignis = WorkflowEvent(
        submission_id=protokoll.id,
        actor_user_id=akteur.id,
        von_status=von,
        nach_status=nach,
        # Stripped, because the database refuses a comment made of spaces and the
        # rules have already refused a blank one where it was required. What is
        # left is either real text or nothing at all.
        kommentar=(kommentar or "").strip() or None,
    )
    session.add(ereignis)
    return ereignis


async def entscheide(
    session: AsyncSession,
    *,
    protokoll_id: uuid.UUID,
    aktion: Aktion,
    akteur: User,
    kommentar: str | None = None,
) -> Submission:
    """A reviewer's move, from loading the protocol to committing it.

    The row is locked while the decision is made. Two reviewers pressing a button
    at the same moment would otherwise both read SUBMITTED, both pass the rules and
    both write, and the second would overwrite the first with nothing to show it
    had happened. A decision carries no version number for the browser to be
    refused on, so the lock is what serialises them.

    Loaded through the visible-protocol rule rather than by id alone, so a draft
    stays as invisible to a reviewer here as it is on the read route. Without that
    a decision on a draft would come back as a conflict, which tells a stranger the
    id is real.
    """
    protokoll = await hole_sichtbares_protokoll(
        session, protokoll_id=protokoll_id, benutzer=akteur, sperren=True
    )

    vermerke(session, protokoll=protokoll, aktion=aktion, akteur=akteur, kommentar=kommentar)

    await session.commit()
    return protokoll
