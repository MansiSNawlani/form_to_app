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
from enum import StrEnum
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


class Sortierung(StrEnum):
    """The orders the review queue can be asked for.

    Four rather than a free-form column name, so the caller cannot ask to sort by
    something that has no index, no meaning, or no business being exposed.
    """

    #: The default. Longest wait first.
    EINGEREICHT_ALT = "eingereicht_alt"
    #: Most recently handed in first.
    EINGEREICHT_NEU = "eingereicht_neu"
    #: The day of the Befischung, newest first.
    DATUM_NEU = "datum_neu"
    #: The water A to Z, then the Ortsangabe within it.
    GEWAESSER = "gewaesser"


#: What each order sorts by, before the tie-break.
#
# The water is sorted on its lowercased form rather than as stored. Defect 2 in
# docs/ffs-defect-list.md is the legacy form lowercasing water body names, so both
# spellings are genuinely in the data, and an A to Z list that files every
# lowercased name in a block of its own is not an A to Z list. It also makes the
# order the same whatever collation the database was created with.
_ORDNUNGEN: dict[Sortierung, tuple[ColumnElement[Any], ...]] = {
    Sortierung.EINGEREICHT_ALT: (Submission.submitted_at.asc(),),
    Sortierung.EINGEREICHT_NEU: (Submission.submitted_at.desc(),),
    Sortierung.DATUM_NEU: (Submission.datum.desc(),),
    Sortierung.GEWAESSER: (
        func.lower(Gewaesser.name).asc(),
        func.lower(Probestrecke.ortsangabe).asc(),
    ),
}


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


def _eingereichte[Zeile: tuple[Any, ...]](
    anfrage: Select[Zeile], auswahl: Prueffilter
) -> Select[Zeile]:
    """Narrowed to the handed-in protocols this reviewer asked for.

    Named for what it selects rather than for the joins it happens to make. It
    does both jobs, and a caller reading only "joined" would not see that the
    filters had been applied at all.

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

    Deliberately not one of app/protokolle/fehler.py's typed domain errors. Those
    are refusals a person can act on, and each has an HTTP answer waiting for it
    in app/api/fehler_http.py. This is an invariant that cannot fail unless the
    schema has been changed behind the application's back, so 500 is the honest
    answer and there is nothing for the reader to do about it. The message is
    developer English, the way RolleFehlt's is, and never reaches a response body.
    """
    if wert is None:
        raise ValueError(f"{feld} missing on submitted protocol {protokoll_id}")
    return wert


async def liste_pruefliste(
    session: AsyncSession,
    *,
    auswahl: Prueffilter | None = None,
    sortierung: Sortierung = Sortierung.EINGEREICHT_ALT,
    seite: int = 1,
    pro_seite: int = PRO_SEITE_STANDARD,
) -> Prueflistenseite:
    """One page of the protocols waiting to be worked on.

    Ordered by the longest wait first unless asked otherwise. This is a work
    queue, and a queue that puts the newest hand-in at the top grows a tail of
    protocols nobody sees; Meine Protokolle sorts the other way on purpose, because
    it answers "what was I just doing".

    Two statements rather than one with a window function. The count has to see
    exactly the filters the rows do, and two readable statements sharing one
    _eingereichte are easier to keep honest about that than one doing both.
    """
    gewaehlte_seite = begrenze_seite(seite)
    groesse = begrenze_pro_seite(pro_seite)
    gewaehlt = auswahl or Prueffilter()

    gesamt = await session.scalar(
        _eingereichte(select(func.count()).select_from(Submission), gewaehlt)
    )
    # scalar() is typed as possibly None; COUNT(*) never is.
    gesamt = gesamt or 0

    treffer = await session.execute(
        _eingereichte(
            # Labelled, and read back below by name rather than by position.
            # Fourteen columns read as zeile[0] to zeile[13] would mean that
            # inserting one column here silently rewires every field after it,
            # and the queue would print the Ortsangabe under Gewaesser with
            # nothing failing. The three that come off a joined table are
            # labelled for the name the row carries, so the select and the row
            # say the same word.
            select(
                Submission.id,
                Submission.status,
                Submission.form_version,
                Submission.datum,
                Submission.anlass,
                Submission.bearbeiter_name,
                Submission.submitted_at,
                Submission.updated_at,
                User.email.label("eingereicht_von"),
                Gewaesser.name.label("gewaessername"),
                Probestrecke.ortsangabe,
                Probestrecke.laenge_m,
                Probestrecke.monitoringstrecke_nr,
                Probestrecke.regierungspraesidium,
            ),
            gewaehlt,
        )
        # The tie-break is on every order, not only the default. Two rows
        # written in one transaction share a timestamp to the microsecond, and
        # two protocols on the same water share a name, so without it the order
        # is whatever the database felt like and a page boundary could show the
        # same protocol twice.
        .order_by(*_ORDNUNGEN[sortierung], Submission.id.asc())
        .limit(groesse)
        .offset(versatz(gewaehlte_seite, groesse))
    )

    return Prueflistenseite(
        zeilen=[
            Pruefzeile(
                id=zeile.id,
                status=zeile.status,
                form_version=zeile.form_version,
                datum=_pflicht(zeile.datum, "datum", zeile.id),
                anlass=_pflicht(zeile.anlass, "anlass", zeile.id),
                bearbeiter_name=_pflicht(
                    zeile.bearbeiter_name, "bearbeiter_name", zeile.id
                ),
                submitted_at=_pflicht(zeile.submitted_at, "submitted_at", zeile.id),
                updated_at=zeile.updated_at,
                eingereicht_von=zeile.eingereicht_von,
                gewaessername=zeile.gewaessername,
                ortsangabe=zeile.ortsangabe,
                laenge_m=zeile.laenge_m,
                monitoringstrecke_nr=zeile.monitoringstrecke_nr,
                regierungspraesidium=zeile.regierungspraesidium,
            )
            for zeile in treffer
        ],
        gesamt=gesamt,
        seite=gewaehlte_seite,
        pro_seite=groesse,
        seiten=seitenzahl(gesamt, groesse),
    )
