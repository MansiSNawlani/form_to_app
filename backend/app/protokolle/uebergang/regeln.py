"""Which move a protocol may make, and who may make it.

One declared table and one function that reads it. No database, no HTTP and no
German, the same contract app/protokolle/formregeln/ works to, so the whole state
machine can be exercised as a table rather than through a running application.

**The roles live here rather than on the routes.** A route still declares what it
requires, but the tuple it declares comes from this table, so there is one answer
to "who may accept a protocol" instead of one per route that somebody has to keep
in step.

**What the states mean**, beyond what models/protokoll.py already says:

- SUBMITTED and IN_REVIEW are both decidable. Requiring In Pruefung nehmen before
  a decision would add a click that protects nothing, because nothing here
  reserves a protocol to one reviewer. IN_REVIEW is a courtesy to colleagues, and
  feature 12's queue is where it starts to carry weight.
- NEEDS_CHANGES is the one way back. It is the only state besides DRAFT that its
  owner may edit, and the only state besides DRAFT that Absenden works from.
- REJECTED and LOCKED are final. The mockup says so of both in its own words, and
  test_aus_einem_endzustand_fuehrt_nichts_heraus holds the table to it.
- ACCEPTED is never written. The build plan fixed that on 2026-09-11: Annehmen
  goes straight to LOCKED, and ACCEPTED becomes a real step only when feature 19
  needs something between the reviewer's yes and the transfer to FiaKa.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from app.benutzer.fehler import RolleFehlt
from app.models.benutzer import Rolle
from app.models.protokoll import Status
from app.protokolle.fehler import (
    BegruendungFehlt,
    EigenesProtokoll,
    UebergangNichtMoeglich,
)


class Aktion(StrEnum):
    """Everything that moves a protocol from one state to another.

    Named for what the person does rather than for the state it produces. A
    client that spoke in target states could ask for any of them, and the first
    one it would ask for is LOCKED.
    """

    #: The surveyor hands the protocol in, for the first time or after a
    #: correction. app/protokolle/absenden.py is the only caller.
    ABSENDEN = "ABSENDEN"
    IN_PRUEFUNG_NEHMEN = "IN_PRUEFUNG_NEHMEN"
    ANNEHMEN = "ANNEHMEN"
    AENDERUNG_ANFORDERN = "AENDERUNG_ANFORDERN"
    ABLEHNEN = "ABLEHNEN"


#: The three the reviewer mockup offers as one radio group and one button.
#: The API takes exactly these on its decision route.
ENTSCHEIDUNGEN = (Aktion.ANNEHMEN, Aktion.AENDERUNG_ANFORDERN, Aktion.ABLEHNEN)

#: Who may take a protocol into Pruefung and decide on it. Chosen with the user on
#: 2026-09-14: a Data Steward corrects and quality-checks submitted data, and the
#: yes or no is the Reviewer's.
PRUEFERROLLEN = (Rolle.REVIEWER, Rolle.SUPER_ADMIN)

#: Where every protocol begins. Not the target of any transition, which is why the
#: completeness test names it separately.
START = Status.DRAFT

#: Final. Nothing leaves these, and no transition may name one as a source.
ENDZUSTAENDE = frozenset({Status.REJECTED, Status.LOCKED})

#: In the enum, written by nothing. See the note at the top of this file.
UNGENUTZT = frozenset({Status.ACCEPTED})


@dataclass(frozen=True, slots=True)
class Uebergang:
    """One move, and everything that has to be true for it to happen."""

    #: The states it may be made from.
    von: frozenset[Status]

    #: The state it produces.
    nach: Status

    #: Who may make it. None means the protocol's owner, whatever roles they hold,
    #: which is not the same as "anybody": the loader behind such an action puts
    #: the owner in the WHERE clause.
    rollen: frozenset[Rolle] | None

    #: Whether the person has to say why. True only where somebody else is being
    #: asked to act on the answer.
    begruendung_noetig: bool


UEBERGAENGE: dict[Aktion, Uebergang] = {
    Aktion.ABSENDEN: Uebergang(
        von=frozenset({Status.DRAFT, Status.NEEDS_CHANGES}),
        nach=Status.SUBMITTED,
        rollen=None,
        begruendung_noetig=False,
    ),
    Aktion.IN_PRUEFUNG_NEHMEN: Uebergang(
        von=frozenset({Status.SUBMITTED}),
        nach=Status.IN_REVIEW,
        rollen=frozenset(PRUEFERROLLEN),
        begruendung_noetig=False,
    ),
    Aktion.ANNEHMEN: Uebergang(
        von=frozenset({Status.SUBMITTED, Status.IN_REVIEW}),
        nach=Status.LOCKED,
        rollen=frozenset(PRUEFERROLLEN),
        # Nothing is being asked of anybody, so there is nothing to explain. A
        # reviewer may still write something, and it is kept.
        begruendung_noetig=False,
    ),
    Aktion.AENDERUNG_ANFORDERN: Uebergang(
        von=frozenset({Status.SUBMITTED, Status.IN_REVIEW}),
        nach=Status.NEEDS_CHANGES,
        rollen=frozenset(PRUEFERROLLEN),
        begruendung_noetig=True,
    ),
    Aktion.ABLEHNEN: Uebergang(
        von=frozenset({Status.SUBMITTED, Status.IN_REVIEW}),
        nach=Status.REJECTED,
        rollen=frozenset(PRUEFERROLLEN),
        begruendung_noetig=True,
    ),
}


def ziel(aktion: Aktion) -> Status:
    """Where this action leaves the protocol."""
    return UEBERGAENGE[aktion].nach


def pruefe_uebergang(
    aktion: Aktion,
    *,
    status: Status,
    rollen: Sequence[Rolle],
    ist_besitzer: bool,
    kommentar: str | None,
) -> None:
    """Refuse a move that may not be made, or return quietly.

    The checks are in this order on purpose, and it is the order the rest of this
    application already uses: who you are, then what you are allowed to do to this
    particular protocol, then whether the protocol is in a state for it, then what
    you sent.

    Whether somebody may see the protocol at all is decided before this, in
    app/protokolle/dienst.py, and stays there: ownership and visibility belong in
    the WHERE clause rather than in a check afterwards.
    """
    uebergang = UEBERGAENGE[aktion]

    _pruefe_wer(aktion, uebergang, rollen=rollen, ist_besitzer=ist_besitzer)

    if status not in uebergang.von:
        raise UebergangNichtMoeglich(aktion.value, status.value)

    if uebergang.begruendung_noetig and not (kommentar or "").strip():
        raise BegruendungFehlt(aktion.value)


def _pruefe_wer(
    aktion: Aktion,
    uebergang: Uebergang,
    *,
    rollen: Sequence[Rolle],
    ist_besitzer: bool,
) -> None:
    """Whether this account may make this kind of move at all.

    RolleFehlt rather than an error of this module's own, so a refusal for want of
    a role reads the same here as it does everywhere else in the application and
    the browser has one code to handle rather than two.
    """
    if uebergang.rollen is None:
        # An owner's action. Unreachable through the routes, where the loader
        # filters on the owner, and checked anyway so that a later feature loading
        # a protocol another way cannot quietly become a second way in.
        if not ist_besitzer:
            raise RolleFehlt((aktion.value,))
        return

    if not any(rolle in uebergang.rollen for rolle in rollen):
        raise RolleFehlt(tuple(rolle.value for rolle in sorted(uebergang.rollen)))

    # **Nobody decides on their own protocol.** Chosen with the user on
    # 2026-09-14. Checked after the role, so somebody with no business here at all
    # is told that rather than being told whose protocol it is.
    if ist_besitzer:
        raise EigenesProtokoll(aktion.value)
