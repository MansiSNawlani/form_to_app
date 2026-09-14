"""Sending a finished protocol to FFS.

The owner's transition: DRAFT to SUBMITTED, and since feature 11d NEEDS_CHANGES
to SUBMITTED as well, which is a surveyor sending back a protocol a reviewer
asked them to correct. The reviewer's own moves are in
app/protokolle/uebergang/, and nothing here writes locked_at.

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
from app.models.protokoll import Submission
from app.protokolle.dienst import hole_protokoll
from app.protokolle.fehler import ProtokollNichtMehrEntwurf, ProtokollUnvollstaendig
from app.protokolle.formregeln import pruefe_protokoll
from app.protokolle.regeln import pruefe_version
from app.protokolle.uebergang.dienst import vermerke
from app.protokolle.uebergang.regeln import UEBERGAENGE, Aktion
from app.protokolle.zuordnung.dienst import ordne_zu
from app.protokolle.zuordnung.regeln import lies_umschlag


async def sende_ab(
    session: AsyncSession, *, protokoll_id: uuid.UUID, besitzer: User, version: int
) -> Submission:
    """Submit a protocol, or refuse it and leave it exactly as it was.

    The checks are in this order on purpose, and it is the order
    speichere_antworten already uses:

    1. Whose it is. A stranger learns nothing beyond "no such protocol".
    2. Whether it is in a state it can be sent from. A protocol submitted twice,
       which is what a lost answer on the way back to the browser looks like,
       must not be submitted again.
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

    _pruefe_absendbar(protokoll)
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

    # **Set once, and not moved by a corrected protocol coming back in.** This is
    # when the protocol was first handed in, which is what a deadline is measured
    # against; the second hand-in is in the Verlauf, where it belongs. The model
    # has said so in its own comment since feature 11b, and this is where that
    # became true.
    if protokoll.submitted_at is None:
        protokoll.submitted_at = datetime.now(UTC)

    # The status change and its event, together.
    vermerke(session, protokoll=protokoll, aktion=Aktion.ABSENDEN, akteur=besitzer)

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


def _pruefe_absendbar(protokoll: Submission) -> None:
    """Refuse a protocol that cannot be sent from the state it is in.

    vermerke checks this too, and raises the general "that move is not possible"
    that a reviewer gets. This one comes first so the surveyor gets the message
    written for them instead: pressing Absenden twice, or losing the first answer
    on the way back, is not an error on their part, and 11c's branch review found
    that being told to reload the page reads as though their work was lost.

    The states are read out of the same transition table rather than compared
    against DRAFT here, so this cannot drift from the rule it is standing in
    front of.
    """
    if protokoll.status not in UEBERGAENGE[Aktion.ABSENDEN].von:
        raise ProtokollNichtMehrEntwurf(protokoll.status.value)
