"""The state machine, exercised as a table rather than as a story.

Every cell of UEBERGAENGE has a wrong answer available to it, and the wrong
answers are all quiet: a decision allowed from a state it should not be allowed
from moves an official record on with nobody noticing, and a role check that never
matches locks out the only people who can do the job.

No database and no HTTP here, because the rules need neither.
"""

import pytest

from app.benutzer.fehler import RolleFehlt
from app.models.benutzer import Rolle
from app.models.protokoll import Status
from app.protokolle.fehler import (
    BegruendungFehlt,
    EigenesProtokoll,
    UebergangNichtMoeglich,
)
from app.protokolle.uebergang.regeln import (
    ENDZUSTAENDE,
    ENTSCHEIDUNGEN,
    PRUEFERROLLEN,
    START,
    UEBERGAENGE,
    UNGENUTZT,
    Aktion,
    pruefe_uebergang,
)

BEGRUENDUNG = "Bitte die Leitfaehigkeit nachtragen, das Feld ist leer geblieben."

#: The least a reviewer has to supply for each decision to be allowed at all.
NOETIGER_KOMMENTAR = {
    Aktion.IN_PRUEFUNG_NEHMEN: None,
    Aktion.ANNEHMEN: None,
    Aktion.AENDERUNG_ANFORDERN: BEGRUENDUNG,
    Aktion.ABLEHNEN: BEGRUENDUNG,
}


class _Vorgabe:
    """Stands for whatever comment this decision needs.

    A marker object rather than a default of "", because the empty string is one
    of the values these tests have to be able to send.
    """


VORGABE = _Vorgabe()


def als_pruefer(aktion: Aktion, status: Status, kommentar: str | None | _Vorgabe = VORGABE) -> None:
    """The common case: a reviewer, somebody else's protocol, a usable comment."""
    pruefe_uebergang(
        aktion,
        status=status,
        rollen=(Rolle.REVIEWER,),
        ist_besitzer=False,
        kommentar=NOETIGER_KOMMENTAR[aktion] if isinstance(kommentar, _Vorgabe) else kommentar,
    )


@pytest.mark.parametrize("aktion", ENTSCHEIDUNGEN)
@pytest.mark.parametrize("status", [Status.SUBMITTED, Status.IN_REVIEW])
def test_jede_entscheidung_ist_aus_beiden_zustaenden_moeglich(
    aktion: Aktion, status: Status
) -> None:
    """A decision may be taken straight from SUBMITTED.

    Requiring In Pruefung nehmen first would add a click that protects nothing:
    nothing here reserves a protocol to one reviewer, so IN_REVIEW is a courtesy
    to colleagues rather than a lock.
    """
    als_pruefer(aktion, status)


@pytest.mark.parametrize("aktion", ENTSCHEIDUNGEN)
@pytest.mark.parametrize(
    "status", [Status.DRAFT, Status.NEEDS_CHANGES, Status.REJECTED, Status.LOCKED]
)
def test_keine_entscheidung_ist_aus_den_uebrigen_zustaenden_moeglich(
    aktion: Aktion, status: Status
) -> None:
    """A draft was never handed in, one sent back is being corrected, and the last
    two are final."""
    with pytest.raises(UebergangNichtMoeglich):
        als_pruefer(aktion, status)


@pytest.mark.parametrize("aktion", [Aktion.AENDERUNG_ANFORDERN, Aktion.ABLEHNEN])
@pytest.mark.parametrize("kommentar", [None, "", "   ", "\n\t "])
def test_eine_abweisung_ohne_begruendung_wird_zurueckgewiesen(
    aktion: Aktion, kommentar: str | None
) -> None:
    """The surveyor is being told to do something. Without a reason there is
    nothing for them to act on, which is why the mockup marks the field
    required."""
    with pytest.raises(BegruendungFehlt):
        als_pruefer(aktion, Status.SUBMITTED, kommentar=kommentar)


def test_annehmen_braucht_keine_begruendung() -> None:
    """Nothing is being asked of anybody, so there is nothing to explain."""
    als_pruefer(Aktion.ANNEHMEN, Status.SUBMITTED, kommentar=None)


def test_annehmen_darf_eine_begruendung_tragen() -> None:
    """Optional, not forbidden. A reviewer may want to record why they accepted."""
    als_pruefer(Aktion.ANNEHMEN, Status.SUBMITTED, kommentar="Alles plausibel.")


@pytest.mark.parametrize("aktion", ENTSCHEIDUNGEN)
def test_niemand_entscheidet_ueber_sein_eigenes_protokoll(aktion: Aktion) -> None:
    """Chosen with the user on 2026-09-14. Somebody who holds the Reviewer role
    and also files protocols may not wave their own through."""
    with pytest.raises(EigenesProtokoll):
        pruefe_uebergang(
            aktion,
            status=Status.SUBMITTED,
            rollen=(Rolle.REVIEWER, Rolle.SUBMITTER),
            ist_besitzer=True,
            kommentar=NOETIGER_KOMMENTAR[aktion],
        )


def test_auch_ein_super_admin_entscheidet_nicht_ueber_sein_eigenes() -> None:
    """The rule is about the protocol, not about how senior the account is."""
    with pytest.raises(EigenesProtokoll):
        pruefe_uebergang(
            Aktion.ANNEHMEN,
            status=Status.SUBMITTED,
            rollen=(Rolle.SUPER_ADMIN,),
            ist_besitzer=True,
            kommentar=None,
        )


@pytest.mark.parametrize("aktion", ENTSCHEIDUNGEN)
@pytest.mark.parametrize(
    "rollen",
    [(Rolle.SUBMITTER,), (Rolle.DATA_STEWARD,), (Rolle.REGIERUNGSPRAESIDIUM,), ()],
)
def test_wer_nicht_pruefen_darf_entscheidet_nicht(
    aktion: Aktion, rollen: tuple[Rolle, ...]
) -> None:
    """A Data Steward corrects and quality-checks; the yes or no is the Reviewer's.
    That is what project-overview.md gives each of them to do."""
    with pytest.raises(RolleFehlt):
        pruefe_uebergang(
            aktion,
            status=Status.SUBMITTED,
            rollen=rollen,
            ist_besitzer=False,
            kommentar=NOETIGER_KOMMENTAR[aktion],
        )


@pytest.mark.parametrize("aktion", ENTSCHEIDUNGEN)
def test_ein_super_admin_darf_entscheiden(aktion: Aktion) -> None:
    pruefe_uebergang(
        aktion,
        status=Status.SUBMITTED,
        rollen=(Rolle.SUPER_ADMIN,),
        ist_besitzer=False,
        kommentar=NOETIGER_KOMMENTAR[aktion],
    )


def test_in_pruefung_nehmen_geht_nur_aus_eingereicht() -> None:
    als_pruefer(Aktion.IN_PRUEFUNG_NEHMEN, Status.SUBMITTED)

    for status in [Status.DRAFT, Status.IN_REVIEW, Status.NEEDS_CHANGES, Status.LOCKED]:
        with pytest.raises(UebergangNichtMoeglich):
            als_pruefer(Aktion.IN_PRUEFUNG_NEHMEN, status)


@pytest.mark.parametrize("status", [Status.DRAFT, Status.NEEDS_CHANGES])
def test_der_besitzer_darf_aus_beiden_zustaenden_absenden(status: Status) -> None:
    """A first hand-in and a corrected one are the same action on one protocol."""
    pruefe_uebergang(
        Aktion.ABSENDEN,
        status=status,
        rollen=(Rolle.SUBMITTER,),
        ist_besitzer=True,
        kommentar=None,
    )


@pytest.mark.parametrize(
    "status", [Status.SUBMITTED, Status.IN_REVIEW, Status.REJECTED, Status.LOCKED]
)
def test_absenden_ist_aus_den_uebrigen_zustaenden_nicht_moeglich(status: Status) -> None:
    with pytest.raises(UebergangNichtMoeglich):
        pruefe_uebergang(
            Aktion.ABSENDEN,
            status=status,
            rollen=(Rolle.SUBMITTER,),
            ist_besitzer=True,
            kommentar=None,
        )


def test_absenden_ist_nicht_die_sache_eines_pruefers() -> None:
    """A reviewer cannot hand in somebody else's protocol for them.

    Nothing can reach this, because the loader behind Absenden filters on the
    owner. It is checked here so that a later feature loading a protocol another
    way cannot quietly become a second way in.
    """
    with pytest.raises(RolleFehlt):
        pruefe_uebergang(
            Aktion.ABSENDEN,
            status=Status.DRAFT,
            rollen=(Rolle.REVIEWER,),
            ist_besitzer=False,
            kommentar=None,
        )


def test_die_pruefer_rollen_kommen_aus_der_tabelle() -> None:
    """One answer to who may decide, read by the routes rather than typed there a
    second time."""
    for aktion in ENTSCHEIDUNGEN:
        assert UEBERGAENGE[aktion].rollen == frozenset(PRUEFERROLLEN)


def test_jeder_status_ist_in_der_tabelle_erklaert() -> None:
    """The test that fails when somebody adds an eighth state.

    A status the table says nothing about is either one a protocol can reach and
    never leave, or one nothing can reach at all, and neither shows up as a
    failure anywhere else.
    """
    erreichbar = {uebergang.nach for uebergang in UEBERGAENGE.values()}

    assert erreichbar | ENDZUSTAENDE | UNGENUTZT | {START} == set(Status)


def test_aus_einem_endzustand_fuehrt_nichts_heraus() -> None:
    """REJECTED and LOCKED are final, which is what the reviewer mockup promises
    of both."""
    for uebergang in UEBERGAENGE.values():
        assert not (uebergang.von & ENDZUSTAENDE)
