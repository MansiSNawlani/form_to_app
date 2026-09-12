"""What a finished protocol has to contain.

The one module in this package with no TypeScript twin, because until now
nothing in either half of the app has asked this question.

Every other rule here answers "is this answer wrong?" None answers "is this
answer there?", and regel.ist_leer says why in one line: blank is untouched, and
untouched is never wrong on its own. That is right for a document somebody is
still filling in over several sittings, and useless the moment they press
Absenden.

**Where the list lives.** Not here. It is read from pflichtfelder.json in the
seed directory, through app/formular/pflicht.py, and the browser reads the same
file to decide which fields carry an asterisk. Until feature 11c it lived twice,
as a tuple here and as 32 props scattered through the form's components, and the
two had already drifted: a field marked required on screen that nothing checked
looks exactly like one that works. On 2026-09-12 the required set was widened to
cover all six parts, and that was the moment to stop keeping two copies of it.

**What stays here** is everything a list cannot say. Requiredness on this form
depends on other answers often enough that a flat set was never going to be the
whole story: the Monitoringstrecken-Nr. is needed only for a monitoring
occasion, the dam's slope only where there is a dam, the ring anodes' diameter
only if ring anodes were used, and a "sonstige ..., welche?" box only when its
own tick is set. Those are rules, and they live beside the other rules.

Part 6 requires one named species. A protocol that names no species and no "kein
Nachweis" code is not a survey result: it reports neither a catch nor the absence
of one. project-overview.md half-states this already, and
artenliste.pruefe_fang_ohne_nachweis_code assumes somebody named something.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from app.formular.pflicht import pflichtfelder
from app.protokolle.formregeln.artenliste import benannte_arten
from app.protokolle.formregeln.einfluesse import (
    KEINE_EINFLUESSE,
    NUTZUNGEN,
    UNBEKANNT_EINFLUESSE,
)
from app.protokolle.formregeln.prozent import PROZENTGRUPPEN, Prozentgruppe
from app.protokolle.formregeln.regel import ARTEN_TABELLE, Formverstoss, ist_leer, wert_aus

# One key for every missing field. The path already says which field it is, and
# the browser puts the message beside it, so a key per field would be 40 ways of
# writing the same sentence.
FEHLT = "protokoll.regeln.fehlt"

# The table needs its own, because "this field is needed" makes no sense printed
# under a grid of 338 cells. What is missing there is an answer, not a value.
FEHLT_ART = "protokoll.regeln.fehltArt"

# A percentage block nobody has touched. Its own key, because "this field is
# needed" is wrong twice over: the fault is the block rather than any one share,
# and what is wanted is a set of numbers totalling 100 rather than a value.
FEHLT_PROZENTGRUPPE = "protokoll.regeln.fehltProzentgruppe"

DAMM_ANTEIL = "ufer.streckenanteil_geschuetteter_damm"
DAMM_NEIGUNG = "ufer.neigung"

# A block of tick boxes where nobody has ticked anything. Its own key, because
# what is wanted is not a value in a field: an unticked box is already an answer,
# so the only thing that can be asked of such a block is that somebody went
# through it. Pointed at the block, since no single box is the missing one.
FEHLT_EINFLUSS = "protokoll.regeln.fehltEinfluss"
FEHLT_BEWIRTSCHAFTUNG = "protokoll.regeln.fehltBewirtschaftung"

#: Pseudo-paths for those two blocks. Not fields; the browser maps them to the
#: block they name, the way it already does for the percentage runs.
EINFLUSS_BLOCK = "block.einfluesse"
BEWIRTSCHAFTUNG_BLOCK = "block.bewirtschaftung"

# The four ways a stretch is fished or fed, as the form prints them.
BEWIRTSCHAFTUNG_TICKS = (
    "bewirschaftung.angelfischerei",
    "bewirschaftung.berufsfischerei",
    "bewirschaftung.teichspeisung",
    "bewirschaftung.teichablauf",
)

# The stocking rows stay optional: whoever surveys a stretch does not always know
# what was put into it. A row somebody has started is a different matter, and this
# is what makes it finish.
RINGANODEN = "ausruestung.ringanoden"
RINGANODEN_DURCHMESSER = "ausruestung.ringanoden_durchmesser"

# Answers that are required only when another answer calls for them.
#
# One table rather than a function each, because the six are the same rule six
# times: something above says this thing exists, so describe it. Written as pairs
# of paths, trigger first.
#
# The trigger reads the same way whatever kind of control it is. A percentage
# share, a rating from 0 to 3 and a tick box all say "yes, there is some of this"
# by holding something that is neither blank nor zero, so one predicate covers a
# dam's share of the bank, a rating of "sonstige Strukturen" and a ticked
# "sonstige Nutzung" alike.
#
# None of these belongs in pflichtfelder.json. A protocol with no dam on the bank
# has no slope to give, and demanding one would refuse a perfectly good survey.
BEDINGTE_FELDER = (
    (DAMM_ANTEIL, DAMM_NEIGUNG),
    ("ufer.sonstiger_bewuchs", "ufer.sonstiger_bewuchs_text"),
    ("ufer.sonstiger_uferverbau", "ufer.sonstiger_uferverbau_text"),
    ("strukturen.sonstige_strukturen", "strukturen.sonstige_strukturen_text"),
    ("einfluesse.sonstige_Nutzung", "einfluesse.sonstige_nutzung_text"),
    (RINGANODEN, RINGANODEN_DURCHMESSER),
)

FEHLT_RICHTUNG = "protokoll.regeln.fehltRichtung"
FEHLT_METHODE = "protokoll.regeln.fehltMethode"


@dataclass(frozen=True)
class BefischterBereich:
    """One of the two rows: whether it was fished, and how."""

    #: The row's own pseudo-path, for a violation that belongs to no single tick.
    id: str
    laenge: str
    richtungen: tuple[str, ...]
    methoden: tuple[str, ...]


BEFISCHTE_BEREICHE = (
    BefischterBereich(
        id="bereich.gesamte_breite",
        laenge="befischte_bereiche.ges_gew_laenge",
        richtungen=(
            "befischte_bereiche.ges_gew_stromauf",
            "befischte_bereiche.ges_gew_stromab",
        ),
        methoden=(
            "befischte_bereiche.ges_gew_watend",
            "befischte_bereiche.ges_gew_vom_boot",
            "befischte_bereiche.ges_gew_vom_ufer",
        ),
    ),
    BefischterBereich(
        id="bereich.entlang_ufer",
        laenge="befischte_bereiche.ufer_laenge",
        richtungen=(
            "befischte_bereiche.ufer_stromauf",
            "befischte_bereiche.ufer_stromab",
        ),
        methoden=(
            "befischte_bereiche.ufer_watend",
            "befischte_bereiche.ufer_vom_boot",
            "befischte_bereiche.ufer_vom_ufer",
        ),
    ),
)

BESATZ_ZEILEN = tuple(
    (
        f"bewirschaftung.besatz_fischart{nr}",
        f"bewirschaftung.besatz{nr}_groessenklassen",
        f"bewirschaftung.besatz{nr}_jahr",
    )
    for nr in (1, 2, 3, 4)
)



def pruefe_vollstaendigkeit(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Every answer a finished protocol needs and does not have.

    In form order, so the panel in 11c can list what is missing in the order
    somebody walks the protocol.
    """
    fehlend = [
        Formverstoss(pfad, FEHLT)
        for pfad in pflichtfelder().pfade
        if ist_leer(wert_aus(antworten, pfad))
    ]

    fehlend += _fehlende_prozentgruppen(antworten)
    fehlend += _fehlende_bedingte_felder(antworten)
    fehlend += _fehlende_hakenbloecke(antworten)
    fehlend += _unfertige_besatzzeilen(antworten)
    fehlend += _unfertige_bereiche(antworten)

    if not benannte_arten(antworten):
        fehlend.append(Formverstoss(ARTEN_TABELLE, FEHLT_ART))

    return fehlend


def _ist_angefasst(gruppe: Prozentgruppe, antworten: Mapping[str, Any]) -> bool:
    """Has anybody put a number in this block at all?

    The same reading prozent.py uses, and deliberately the same: a block is
    touched when any one of its shares holds something. That rule then insists the
    shares total 100, and this one insists the block is touched, so between them
    every block ends up complete and correct. Neither can do it alone, which is
    why prozent.py's own comment sends the question here.
    """
    return any(not ist_leer(wert_aus(antworten, pfad)) for pfad in gruppe.felder)


def _fehlende_prozentgruppen(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The percentage blocks of part 3 that nobody has started.

    Required from 2026-09-12, when the protocol's required set was widened to all
    six parts. Until then part 3 required nothing at all, so a protocol could be
    submitted describing a stretch's surroundings, bank and bed not at all.

    Pointed at the block rather than at a share, because there is no one field to
    blame: a bank that is entirely one thing is answered with a single 100 and
    eight blanks, so no individual share can be called missing.
    """
    return [
        Formverstoss(gruppe.id, FEHLT_PROZENTGRUPPE)
        for gruppe in PROZENTGRUPPEN
        if not _ist_angefasst(gruppe, antworten)
    ]


def _sagt_ja(wert: str) -> bool:
    """Does this answer claim the thing it names is there?

    Blank is no. A number of zero is no: a dam covering 0 % of the bank is no dam,
    and a rating of 0 on the scale means "keine". Anything else is yes, which
    includes the "Ja" a ticked checkbox holds.
    """
    sauber = wert.strip()
    if ist_leer(sauber):
        return False
    return not (sauber.isdigit() and int(sauber) == 0)


def _fehlende_bedingte_felder(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The answers another answer has just made necessary.

    A "sonstige ..., welche?" box is the clearest case. Left alone it is
    correctly empty, but the moment somebody rates "sonstige Strukturen" above 0
    or gives the other bank vegetation a share, the protocol asserts something
    exists and does not say what. That is worse than silence to whoever reads it
    later, because it reads as a complete answer.
    """
    return [
        Formverstoss(feld, FEHLT)
        for ausloeser, feld in BEDINGTE_FELDER
        if _sagt_ja(wert_aus(antworten, ausloeser)) and ist_leer(wert_aus(antworten, feld))
    ]


def _irgendetwas_gesetzt(antworten: Mapping[str, Any], pfade: tuple[str, ...]) -> bool:
    """Has anybody ticked any box in this block?

    A checkbox holds "Ja" when ticked and the empty string when not, which is the
    same reading einfluesse.py uses.
    """
    return any(not ist_leer(wert_aus(antworten, pfad)) for pfad in pfade)


def _fehlende_hakenbloecke(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The two tick blocks of part 4 that nobody has been through.

    **At least one tick, never all of them.** An unticked box is already an
    answer: leaving the Badebetrieb box alone says there is no bathing here.
    Requiring every box would demand that every stretch carries every influence
    at once, which no stretch does.

    Einflüsse can always be answered, because "keine (erkennbar)" and "unbekannt"
    are two of its boxes and exist for exactly this. einfluesse.py then stops
    either of them being ticked beside a real use, so the two rules together mean
    the block says something and says it consistently.
    """
    fehlend: list[Formverstoss] = []

    alle_einfluesse = (KEINE_EINFLUESSE, UNBEKANNT_EINFLUESSE, *NUTZUNGEN)
    if not _irgendetwas_gesetzt(antworten, alle_einfluesse):
        fehlend.append(Formverstoss(EINFLUSS_BLOCK, FEHLT_EINFLUSS))

    if not _irgendetwas_gesetzt(antworten, BEWIRTSCHAFTUNG_TICKS):
        fehlend.append(Formverstoss(BEWIRTSCHAFTUNG_BLOCK, FEHLT_BEWIRTSCHAFTUNG))

    return fehlend


def _unfertige_besatzzeilen(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """A stocking row somebody started and did not finish.

    The rows themselves stay optional, decided with the user on 2026-09-12:
    whoever surveys a stretch does not always know what was stocked into it, and
    demanding it would block a protocol over somebody else's records.

    A row with something in it is different. "Bachforelle, 2024" with no size
    class is a record nobody can use, and the half-written row is more misleading
    than the empty one, because it reads as a complete answer to whoever gets it.
    """
    fehlend: list[Formverstoss] = []

    for zeile in BESATZ_ZEILEN:
        werte = [wert_aus(antworten, pfad) for pfad in zeile]
        if all(ist_leer(wert) for wert in werte):
            continue
        fehlend += [
            Formverstoss(pfad, FEHLT)
            for pfad, wert in zip(zeile, werte, strict=True)
            if ist_leer(wert)
        ]

    return fehlend




def _unfertige_bereiche(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """How each fished stretch was actually fished.

    A row is fished when it carries a length, which ausruestung.py already
    insists at least one of the two rows does. A row that was not fished stays
    empty throughout and is asked for nothing: a survey may well cover the whole
    width and never work along the bank.

    A row that was fished owes a direction and a method, because a catch with no
    record of how it was taken cannot be compared with the next one. Pointed at
    the row rather than at a tick, since no single box is the missing one.
    """
    fehlend: list[Formverstoss] = []

    for bereich in BEFISCHTE_BEREICHE:
        laenge = wert_aus(antworten, bereich.laenge).strip()
        if ist_leer(laenge) or (laenge.isdigit() and int(laenge) == 0):
            continue

        if not _irgendetwas_gesetzt(antworten, bereich.richtungen):
            fehlend.append(Formverstoss(bereich.id, FEHLT_RICHTUNG))
        if not _irgendetwas_gesetzt(antworten, bereich.methoden):
            fehlend.append(Formverstoss(bereich.id, FEHLT_METHODE))

    return fehlend
