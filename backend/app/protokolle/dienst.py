"""Creating, finding and listing protocols.

The layer where the model, the rules and the database meet. The routes in
app/api/protokolle.py parse, authorise and delegate here, so everything below can
be tested against a transaction rather than through HTTP.

**Ownership is part of the query, never a check after it.** Every function takes
the account asking and puts its id in the WHERE clause. Loading a row first and
comparing owners afterwards would work exactly as well today and would be one
forgotten line away from a leak in the next feature that copies the loading and
not the check. Filtering in the query means a function that forgets it returns
nothing at all, which fails loudly rather than quietly showing somebody else's
survey.

Feature 13 widens this: a Regierungspräsidium account sees its region, and a
reviewer sees everything. That widening belongs here, in one place, rather than
in the routes.

The session is an argument rather than something this module reaches for, the
same shape app/benutzer/dienst.py uses, and these functions commit for the same
reason: the caller asks for a draft to be created and afterwards there is one.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.formular.felder import formular
from app.models.benutzer import User
from app.models.protokoll import Status, Submission
from app.protokolle.fehler import ProtokollNichtGefunden
from app.protokolle.regeln import pruefe_aenderbar, pruefe_antworten, pruefe_version


@dataclass(frozen=True)
class Protokollzeile:
    """One protocol as a list shows it, without its answers.

    Twenty protocols each carrying 338 answers is a large response for drawing
    twenty table rows, so the list sends this instead. The five display values
    are read out of the answers document in the query rather than by loading each
    document and picking through it here, which is what keeps the document off
    the wire entirely.

    They are read, not stored. Feature 12's review queue reads across every
    account rather than one person's handful, and that is where these become real
    indexed columns worth filtering and sorting on.

    The five follow prototypes/meine-protokolle.html, which heads each row with
    the water and the stretch, then prints the survey date and the occasion.
    """

    id: uuid.UUID
    status: Status
    form_version: str
    version: int
    created_at: datetime
    updated_at: datetime

    #: The water. None until somebody has typed one.
    gewaessername: str | None
    #: Where on it. Printed beside the water as the row's second line.
    ortsangabe: str | None
    #: Metres, as text like every other answer.
    laenge: str | None
    #: The day of the survey, not the day the draft was touched.
    datum: str | None
    #: The coded Anlass, e.g. wrrl_monitoring.
    anlass: str | None


def _antwort_feld(*pfad: str) -> ColumnElement[str | None]:
    """One answer, read out of the JSONB document by its legacy path.

    Blank comes back as nothing. A field somebody typed into and then cleared
    reads to a person exactly like one they never touched, so the API has one
    representation for "nothing to show" instead of leaving every caller to
    remember that "" and null mean the same thing here.
    """
    return func.nullif(func.trim(Submission.antworten[pfad].astext), "")


async def lege_entwurf_an(session: AsyncSession, *, besitzer: User) -> Submission:
    """A new, empty draft for this account.

    Empty rather than prefilled. The account holder is not always the person who
    carried out the survey, which is why CONTEXT.md keeps Person apart from User,
    so copying the signed-in address into the Bearbeiter block would be wrong
    more often than it was right.

    The form version comes from the loaded definition rather than a constant
    here, so there is one place that knows which version this is. ADR 0004 never
    migrates a submission to a later one.
    """
    entwurf = Submission(
        owner_user_id=besitzer.id,
        status=Status.DRAFT,
        form_version=formular().version,
        antworten={},
    )
    session.add(entwurf)
    await session.commit()
    return entwurf


async def hole_protokoll(
    session: AsyncSession, *, protokoll_id: uuid.UUID, besitzer: User
) -> Submission:
    """One protocol belonging to this account, or a refusal.

    The same refusal whether the id is unknown or belongs to somebody else. See
    ProtokollNichtGefunden for why the two must stay indistinguishable.
    """
    treffer = await session.scalar(
        select(Submission).where(
            Submission.id == protokoll_id,
            Submission.owner_user_id == besitzer.id,
        )
    )
    if treffer is None:
        raise ProtokollNichtGefunden(protokoll_id)
    return treffer


async def speichere_antworten(
    session: AsyncSession,
    *,
    protokoll_id: uuid.UUID,
    besitzer: User,
    antworten: Any,
    version: int,
) -> Submission:
    """Replace a draft's answers, if it is still the draft this save started from.

    The whole document, not a patch. The form holds every answer in one React
    Hook Form state and hands it over whole, so working out a difference here
    would mean reconstructing on the server something the client already knows.

    The checks are in this order on purpose:

    1. Whose it is. A stranger learns nothing beyond "no such protocol".
    2. Whether it may still be changed at all.
    3. Whether it has moved on since. Before the document, because the save is
       not going to be stored either way, and telling somebody a field is wrong
       when the real problem is a second open tab sends them to fix the wrong
       thing.
    4. What is in the document.

    Nothing is written until all four pass, so a refused save leaves the stored
    protocol exactly as it was.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)

    pruefe_aenderbar(protokoll.status)
    pruefe_version(version, protokoll.version)
    pruefe_antworten(antworten)

    # Assigned rather than mutated in place. SQLAlchemy notices an attribute
    # being set; it does not watch the inside of a plain dict, so editing the
    # stored document in place would leave a save that quietly wrote nothing.
    protokoll.antworten = antworten
    # Raised on every save, including one whose answers happen to be identical.
    # The client asked to save, so the version it holds has to move on, or its
    # next save would arrive claiming a version that is already behind.
    protokoll.version += 1
    await session.commit()
    return protokoll


async def loesche_protokoll(
    session: AsyncSession, *, protokoll_id: uuid.UUID, besitzer: User
) -> None:
    """Remove a draft belonging to this account.

    Only a draft. Once a protocol has been submitted it is a record somebody else
    is working with, and withdrawing it is a workflow step for feature 11 rather
    than a delete.

    Nothing cleans up attachments, because there are none on the server yet.
    Feature 3d gives them one, and it has to delete them here as well or the
    files stay behind with nothing pointing at them.
    """
    protokoll = await hole_protokoll(session, protokoll_id=protokoll_id, besitzer=besitzer)
    pruefe_aenderbar(protokoll.status)

    await session.delete(protokoll)
    await session.commit()


async def liste_protokolle(session: AsyncSession, *, besitzer: User) -> list[Protokollzeile]:
    """This account's own protocols, most recently worked on first.

    Not paginated. This is one person's own protocols, a handful rather than
    thousands, and the filter on the owner is what bounds it. Feature 12's queue
    reads across every account and is where paging becomes real.

    The id breaks a tie on updated_at. Two drafts created in the same transaction
    carry the same timestamp to the microsecond, so without it their order is
    whatever the database felt like and a test asserting the order would fail
    now and then for no reason anybody could reproduce.
    """
    zeilen = await session.execute(
        select(
            Submission.id,
            Submission.status,
            Submission.form_version,
            Submission.version,
            Submission.created_at,
            Submission.updated_at,
            _antwort_feld("probestrecke", "gewaesser", "gewaessername"),
            _antwort_feld("probestrecke", "ortsangabe"),
            _antwort_feld("probestrecke", "laenge"),
            _antwort_feld("datum"),
            _antwort_feld("anlass"),
        )
        .where(Submission.owner_user_id == besitzer.id)
        .order_by(Submission.updated_at.desc(), Submission.id.desc())
    )

    return [
        Protokollzeile(
            id=zeile[0],
            status=zeile[1],
            form_version=zeile[2],
            version=zeile[3],
            created_at=zeile[4],
            updated_at=zeile[5],
            gewaessername=zeile[6],
            ortsangabe=zeile[7],
            laenge=zeile[8],
            datum=zeile[9],
            anlass=zeile[10],
        )
        for zeile in zeilen
    ]
