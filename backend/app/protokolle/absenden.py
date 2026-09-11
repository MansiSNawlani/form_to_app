"""Sending a finished protocol to FFS.

The one transition this feature owns: DRAFT to SUBMITTED. Everything after it,
the reviewer taking a protocol into Pruefung, accepting it, rejecting it or
asking for changes, is feature 11d, and nothing here writes locked_at.

This is where the last two sub-features meet. Feature 11a wrote the rules that
say what a finished protocol must contain and what is wrong with it, and 11b
wrote the tables and the matching that decide which Gewaesser, Probestrecke and
Person a protocol belongs to. Neither was called by anything until now.

**Kept out of app/protokolle/dienst.py deliberately.** That module is about a
draft: creating one, reading it, saving it, deleting it, all of which happen many
times a day and none of which judge the contents. This is the single moment a
protocol stops being somebody's private working copy and becomes a survey record
other people act on, and it is the only place in the application that writes the
envelope columns. Mixing it into the draft service would bury that under four
functions of ordinary editing.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.protokolle.dienst import hole_protokoll
from app.protokolle.fehler import ProtokollUnvollstaendig
from app.protokolle.formregeln import pruefe_protokoll
from app.protokolle.regeln import pruefe_aenderbar, pruefe_version
from app.protokolle.zuordnung.dienst import ordne_zu
from app.protokolle.zuordnung.regeln import lies_umschlag


async def sende_ab(
    session: AsyncSession, *, protokoll_id: uuid.UUID, besitzer: User, version: int
) -> Submission:
    """Submit a protocol, or refuse it and leave it exactly as it was.

    The checks are in this order on purpose, and it is the order
    speichere_antworten already uses:

    1. Whose it is. A stranger learns nothing beyond "no such protocol".
    2. Whether it is still a draft. A protocol submitted twice, which is what a
       lost answer on the way back to the browser looks like, must not be
       submitted again.
    3. Whether it has moved on since. Before the rules, because a protocol that
       is not going to be sent either way should not be told which fields are
       missing when the real problem is a second open tab: that sends somebody to
       repair the wrong thing.
    4. What is in the document.

    Why version is required at all. Submitting is the one action in this
    application that cannot be taken back, and the browser posts the version it
    last received. Without it, a tab left open across somebody else's editing
    session could send a document that is no longer the current one, and the
    surveyor would have submitted answers they never saw.

    Nothing is written unless all four pass.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)

    pruefe_aenderbar(protokoll.status)
    pruefe_version(version, protokoll.version)

    verstoesse = pruefe_protokoll(protokoll.antworten)
    if verstoesse:
        raise ProtokollUnvollstaendig(tuple(verstoesse))

    # Reading the envelope after the rules have passed, not before. The rules
    # name every missing answer with a message that belongs beside its field, and
    # this raises UmschlagUnvollstaendig, which has no such message. Reaching it
    # therefore means the two halves disagree about what a finished protocol is,
    # and that is a bug to surface rather than a refusal to show a surveyor.
    umschlag = lies_umschlag(protokoll.antworten)
    zuordnung = await ordne_zu(session, umschlag, besitzer)

    protokoll.probestrecke_id = zuordnung.probestrecke_id
    protokoll.person_id = zuordnung.person_id
    protokoll.bearbeiter_name = umschlag.bearbeiter_name
    protokoll.anlass = umschlag.anlass
    protokoll.datum = umschlag.datum
    protokoll.uhrzeit = umschlag.uhrzeit
    protokoll.submitted_at = datetime.now(UTC)
    protokoll.status = Status.SUBMITTED

    # Raised for the same reason a save raises it: the browser's copy is now
    # behind, and a stale tab's next request has to be refused rather than
    # silently winning.
    protokoll.version += 1

    # One commit, at the end. ordne_zu deliberately commits nothing, so a failure
    # anywhere above this line takes the Gewaesser, the Probestrecke and the
    # Person down with it rather than leaving rows that every later protocol on
    # this stretch would match against.
    await session.commit()
    return protokoll
