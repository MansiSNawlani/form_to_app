"""The review queue: every protocol that has been handed in.

**This is not the question app/protokolle/dienst.py's _sichtbar answers**, and the
two must not be merged. _sichtbar answers "may this account look at this
protocol", which includes the account's own drafts. This module answers "is this
protocol work waiting for FFS", which excludes every draft, the caller's own
included: a protocol somebody is still writing has not been handed to anybody.
Widening _sichtbar to serve both would widen it for every other caller at the same
time.

**No per-account narrowing happens here.** The queue is the same list for every
member of FFS staff, and what keeps it out of everybody else's hands is the role
requirement on the route in app/api/pruefliste.py. Feature 13 is where an account's
own Regierungspraesidium enters, and when it does it enters as a WHERE clause in
this module, never as a check after the rows have been loaded, for the reason
app/protokolle/dienst.py gives at the top of itself.

The values a row carries come from the envelope columns and the rows they point
at, never from the antworten document. That is the whole payoff of feature 11b:
Meine Protokolle has to read the water out of the JSON because a draft has no
Probestrecke, and nothing in this list is a draft.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.gewaesser import Gewaesser
from app.models.probestrecke import Probestrecke
from app.models.protokoll import Status, Submission
from app.protokolle.pruefliste.parameter import (
    ESCAPE,
    PRO_SEITE_STANDARD,
    begrenze_pro_seite,
    begrenze_seite,
    jahresgrenzen,
    seitenzahl,
    suchbegriffe,
    suchmuster,
    versatz,
)


@dataclass(frozen=True)
class Pruefzeile:
    """One protocol as the review queue shows it, without its answers.

    Flat, the same shape and for the same reason as Protokollzeile in
    app/protokolle/dienst.py: the response model reads its fields by name.

    Deliberately a different row from that one. Meine Protokolle reads five
    display values out of the JSON document and carries no Bearbeiter, no filer
    and no region; this carries all three and reads none of them out of JSON. Two
    lists asking different questions, two rows.
    """

    id: uuid.UUID
    status: Status
    form_version: str

    #: The day of the Befischung, as a real date rather than the string the
    #: answers document holds.
    datum: date
    #: The coded Anlass, e.g. "wrrl". The label is the screen's business.
    anlass: str
    #: Frozen at submit, so a historical row still reads correctly.
    bearbeiter_name: str
    submitted_at: datetime
    updated_at: datetime

    #: The account that filed it, by its login address.
    eingereicht_von: str

    #: Exactly as the surveyor typed it. Nothing normalises a water's name.
    gewaessername: str
    ortsangabe: str
    laenge_m: int
    #: Null for the great majority of stretches, which belong to no programme.
    monitoringstrecke_nr: str | None
    #: 1 to 4. Feature 13 narrows the queue by it.
    regierungspraesidium: int


@dataclass(frozen=True)
class Prueflistenseite:
    """One page of the queue, and enough to draw a pager around it."""

    zeilen: list[Pruefzeile]
    #: Every protocol matching the filters, not just the ones on this page.
    gesamt: int
    seite: int
    pro_seite: int
    #: Never below one, so an empty queue reads "Seite 1 von 1".
    seiten: int


@dataclass(frozen=True)
class Prueffilter:
    """How a reviewer has narrowed the queue.

    One value rather than four arguments, so the row query and the count query
    cannot drift apart: both are handed the same object, and a filter added later
    is added to both at once. A count that saw fewer filters than the rows would
    offer pages that are not there.

    Every field defaults to "not narrowed", so an unfiltered queue is
    Prueffilter() and no caller has to spell out four nothings.
    """

    #: Any of these states. Empty means every state the queue lists, which never
    #: includes DRAFT.
    status: tuple[Status, ...] = ()
    #: The coded Anlass, e.g. "wrrl". One rather than several, because the screen
    #: gives it one dropdown.
    anlass: str | None = None
    #: The year of the Befischung, not of the hand-in.
    jahr: int | None = None
    #: The free text box. Split into words, each of which has to find something.
    suche: str | None = None


def _bedingungen(auswahl: Prueffilter) -> list[ColumnElement[bool]]:
    """The filters as WHERE clauses, in the order a reader would ask them.

    The search is the only one that is not a plain comparison. Each word the
    person typed becomes its own clause, and within a clause the word may sit in
    the water's name, the Ortsangabe or the Monitoringstrecken-Nr. That is what
    makes "Schussen Weissenau" find the row whose water is one and whose place is
    the other; requiring both words in one column would find nothing.

    ILIKE rather than LIKE, because nobody searching for a water types its
    capitals the way the surveyor did. The explicit escape is what stops a typed %
    from matching the whole database, and it has to be passed here as well as
    applied in suchmuster: the masking puts the backslashes in, and this is what
    tells Postgres to read them as masking rather than as backslashes.
    """
    bedingungen: list[ColumnElement[bool]] = []

    if auswahl.status:
        bedingungen.append(Submission.status.in_(auswahl.status))

    if auswahl.anlass is not None:
        bedingungen.append(Submission.anlass == auswahl.anlass)

    if auswahl.jahr is not None:
        von, bis = jahresgrenzen(auswahl.jahr)
        bedingungen.append(Submission.datum.between(von, bis))

    for begriff in suchbegriffe(auswahl.suche):
        muster = suchmuster(begriff)
        bedingungen.append(
            or_(
                Gewaesser.name.ilike(muster, escape=ESCAPE),
                Probestrecke.ortsangabe.ilike(muster, escape=ESCAPE),
                Probestrecke.monitoringstrecke_nr.ilike(muster, escape=ESCAPE),
            )
        )

    return bedingungen


def _verbunden[Zeile: tuple[Any, ...]](
    anfrage: Select[Zeile], auswahl: Prueffilter
) -> Select[Zeile]:
    """The three rows a handed-in protocol always has behind it, plus the filters.

    Inner joins, and that is a statement rather than an oversight. The
    umschlag_bei_abgabe constraint on submissions requires a Probestrecke the
    moment a protocol is not a draft, and owner_user_id is a non-null foreign key.
    An outer join would be pretending a row could arrive without a water, and the
    queue would then quietly print a blank line for a row that cannot exist.

    The joins and the filters are applied in one place so the rows and the count
    cannot end up seeing different ones.
    """
    return (
        anfrage.join(User, User.id == Submission.owner_user_id)
        .join(Probestrecke, Probestrecke.id == Submission.probestrecke_id)
        .join(Gewaesser, Gewaesser.id == Probestrecke.gewaesser_id)
        .where(Submission.status != Status.DRAFT, *_bedingungen(auswahl))
    )


def _pflicht[Wert](wert: Wert | None, feld: str, protokoll_id: uuid.UUID) -> Wert:
    """A column the database has promised is there on a handed-in protocol.

    Four of the envelope columns are nullable so that a draft can exist without
    them, and umschlag_bei_abgabe is what stops that nullability from meaning
    optional. The type checker cannot see a check constraint, so this is where the
    constraint becomes a type.

    It raises rather than substituting a blank, because a null here would mean the
    database had broken its own rule, and a queue quietly printing an empty date
    for it would hide that instead of reporting it.
    """
    if wert is None:
        raise ValueError(f"{feld} fehlt auf dem eingereichten Protokoll {protokoll_id}")
    return wert


async def liste_pruefliste(
    session: AsyncSession,
    *,
    auswahl: Prueffilter | None = None,
    seite: int = 1,
    pro_seite: int = PRO_SEITE_STANDARD,
) -> Prueflistenseite:
    """One page of the protocols waiting to be worked on.

    Ordered by the longest wait first. This is a work queue, and a queue that puts
    the newest hand-in at the top grows a tail of protocols nobody sees; Meine
    Protokolle sorts the other way on purpose, because it answers "what was I just
    doing". Feature 12a's later step makes the order choosable and leaves this one
    the default.

    The id breaks the tie, for the reason liste_protokolle already gives: two rows
    written in one transaction carry the same timestamp to the microsecond, so
    without it the order is whatever the database felt like and a test asserting it
    fails now and then for no reason anybody can reproduce.

    Two statements rather than one with a window function. The count has to see
    exactly the filters the rows do, and two readable statements sharing one
    _verbunden are easier to keep honest about that than one statement doing both.
    """
    gewaehlte_seite = begrenze_seite(seite)
    groesse = begrenze_pro_seite(pro_seite)
    gewaehlt = auswahl or Prueffilter()

    gesamt = await session.scalar(
        _verbunden(select(func.count()).select_from(Submission), gewaehlt)
    )
    # scalar() is typed as possibly None; COUNT(*) never is.
    gesamt = gesamt or 0

    treffer = await session.execute(
        _verbunden(
            select(
                Submission.id,
                Submission.status,
                Submission.form_version,
                Submission.datum,
                Submission.anlass,
                Submission.bearbeiter_name,
                Submission.submitted_at,
                Submission.updated_at,
                User.email,
                Gewaesser.name,
                Probestrecke.ortsangabe,
                Probestrecke.laenge_m,
                Probestrecke.monitoringstrecke_nr,
                Probestrecke.regierungspraesidium,
            ),
            gewaehlt,
        )
        .order_by(Submission.submitted_at.asc(), Submission.id.asc())
        .limit(groesse)
        .offset(versatz(gewaehlte_seite, groesse))
    )

    return Prueflistenseite(
        zeilen=[
            Pruefzeile(
                id=zeile[0],
                status=zeile[1],
                form_version=zeile[2],
                datum=_pflicht(zeile[3], "datum", zeile[0]),
                anlass=_pflicht(zeile[4], "anlass", zeile[0]),
                bearbeiter_name=_pflicht(zeile[5], "bearbeiter_name", zeile[0]),
                submitted_at=_pflicht(zeile[6], "submitted_at", zeile[0]),
                updated_at=zeile[7],
                eingereicht_von=zeile[8],
                gewaessername=zeile[9],
                ortsangabe=zeile[10],
                laenge_m=zeile[11],
                monitoringstrecke_nr=zeile[12],
                regierungspraesidium=zeile[13],
            )
            for zeile in treffer
        ],
        gesamt=gesamt,
        seite=gewaehlte_seite,
        pro_seite=groesse,
        seiten=seitenzahl(gesamt, groesse),
    )
