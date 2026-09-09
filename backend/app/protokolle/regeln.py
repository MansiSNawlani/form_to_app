"""What an answers document may contain.

ADR 0003 stores the roughly 338 answers as one JSON document and requires it to
be schema-validated on write, because a loosely typed column is not an excuse for
unvalidated data.

For a draft that means its shape, not its rules. A draft is incomplete by
definition: a surveyor fills one in over several sittings and saves after every
few keystrokes, so nothing here may require a field, refuse an empty document, or
add up a percentage block. The form's own rules (sum-to-100, hydrology suppressed
for standing waters, the catch table rules, the Vorfluter chain, the coordinate
bounds) are the gate on submitting, which is feature 11, where demanding a
complete document is a fair thing to do.

What is left is worth checking anyway, and this is why:

- **A path the form does not have** is our own bug rather than a person's
  mistake, and this is where it surfaces instead of sitting in the database until
  somebody wonders why a field never appears.
- **A value that is not text** would come back out of the database and be handed
  to a form control that expects a string. Every answer is a string on the way in
  as well; frontend/src/protokoll/entwurf/typen.ts explains why, and the short
  version is that a half-typed number is not a number.
- **A value or a document past its size** is the one case here that is not a bug
  in our client, and the caps are far enough out that no real protocol meets
  them.

Plain functions over values, holding no database and no HTTP, exactly like
app/benutzer/regeln.py.
"""

from collections.abc import Mapping
from functools import lru_cache
from typing import Any

from app.formular.felder import formular
from app.models.protokoll import Status
from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    ProtokollNichtMehrEntwurf,
    ProtokollVeraendert,
    Verstoss,
    Verstossgrund,
)

# One answer's limit. The longest thing the form asks for is a free text box, the
# Fischereiausübungsberechtigter with its address and telephone number, or the
# remarks at the foot of page 2. Four thousand characters is several times any of
# them and still refuses a pasted document.
MAX_ZEICHEN_PRO_ANTWORT = 4_000

# The whole document's limit, counted across the answers rather than over the
# serialised JSON, so the number means something a person could be told: this is
# how much writing the protocol holds. A filled-in protocol is roughly twenty
# thousand characters, so this is ten times a real one.
MAX_ZEICHEN_GESAMT = 200_000


@lru_cache
def _tiefe() -> int:
    """How many levels deep the deepest real field path goes.

    Worked out from the definition rather than written down, so it cannot drift
    from it. Today it is three: probestrecke.gewaesser.gewaessername and
    arten.art1.klasse_1 are the deepest the form goes.

    The walk stops descending here. Without a limit a document nested ten
    thousand deep would be walked ten thousand deep, and there is nothing down
    there that could ever be a field.
    """
    return max(pfad.count(".") for pfad in formular().pfade) + 1


def _pruefe_blatt(pfad: str, wert: Any, bekannt: frozenset[str]) -> Verstoss | None:
    """What is wrong with one answer, or nothing.

    In this order deliberately. Telling somebody a value is too long, when the
    real answer is that the field does not exist, sends them to fix the wrong
    thing.
    """
    if pfad not in bekannt:
        return Verstoss(pfad, Verstossgrund.UNBEKANNT)
    if not isinstance(wert, str):
        return Verstoss(pfad, Verstossgrund.KEIN_TEXT)
    if len(wert) > MAX_ZEICHEN_PRO_ANTWORT:
        return Verstoss(pfad, Verstossgrund.ZU_LANG)
    return None


def finde_verstoesse(dokument: Mapping[str, Any]) -> tuple[Verstoss, ...]:
    """Every answer in the document that could not be stored, and why.

    Returns rather than raises, so the rule can be asked a question without
    exception handling, and so a test reads as a list of expected findings. The
    raising wrapper below is what the service calls.

    Walked with an explicit stack rather than by recursion. The document is
    untrusted input, and a recursive walk over untrusted nesting is a stack
    overflow waiting for somebody to find it.

    A group with nothing in it, such as {"bearbeiter": {}}, is not a violation.
    React Hook Form hands back untouched groups that way, and refusing them would
    fail an ordinary save for holding nothing.
    """
    bekannt = formular().pfade
    hoechste_tiefe = _tiefe()

    verstoesse: list[Verstoss] = []
    stapel: list[tuple[tuple[str, ...], Mapping[str, Any]]] = [((), dokument)]

    while stapel:
        eltern, knoten = stapel.pop()
        for schluessel, wert in knoten.items():
            teile = (*eltern, schluessel)
            pfad = ".".join(teile)

            # A key with a dot would flatten to the same path as a nested one, so
            # {"bearbeiter.name": "a"} and {"bearbeiter": {"name": "b"}} could
            # both be in one document with nothing deciding which wins. Refusing
            # the flat spelling means a stored path has exactly one shape.
            if "." in schluessel:
                verstoesse.append(Verstoss(pfad, Verstossgrund.PUNKT_IM_SCHLUESSEL))
                continue

            # Descend only where there could still be a field further down. A
            # path that is already a field is a leaf whatever was put at it, so
            # an object at bearbeiter.name is reported as "bearbeiter.name is not
            # text" rather than as an unknown bearbeiter.name.tief, which would
            # point at the wrong place.
            if isinstance(wert, dict) and pfad not in bekannt and len(teile) < hoechste_tiefe:
                stapel.append((teile, wert))
                continue

            verstoss = _pruefe_blatt(pfad, wert, bekannt)
            if verstoss is not None:
                verstoesse.append(verstoss)

    return tuple(verstoesse)


def zaehle_zeichen(dokument: Mapping[str, Any]) -> int:
    """How much writing the document holds, across every answer in it.

    Only strings are counted, because only strings are storable; a document
    carrying anything else is refused by finde_verstoesse anyway, and this must
    not raise on its way to reporting that.
    """
    gesamt = 0
    stapel: list[Mapping[str, Any]] = [dokument]
    tiefe = 0
    hoechste_tiefe = _tiefe()

    # Walked level by level rather than node by node, so the same depth limit
    # applies here as in the walk above and neither can run away on its own.
    while stapel and tiefe < hoechste_tiefe:
        naechste: list[Mapping[str, Any]] = []
        for knoten in stapel:
            for wert in knoten.values():
                if isinstance(wert, str):
                    gesamt += len(wert)
                elif isinstance(wert, dict):
                    naechste.append(wert)
        stapel = naechste
        tiefe += 1

    return gesamt


def pruefe_aenderbar(status: Status) -> None:
    """Refuse a protocol its owner may no longer change.

    One function rather than a comparison at each call site, because feature 11
    widens this: NEEDS_CHANGES will almost certainly join DRAFT once a reviewer
    can ask for a correction. Widening it there means editing this, not hunting
    for every place that compared against DRAFT.
    """
    if status is not Status.DRAFT:
        raise ProtokollNichtMehrEntwurf(status.value)


def pruefe_version(erwartet: int, tatsaechlich: int) -> None:
    """Refuse a save that was working from an older copy than the stored one.

    Checked before the document itself, and deliberately. The save is not going
    to be stored either way, and telling somebody a field is wrong when the real
    problem is that they have the protocol open twice sends them to fix the wrong
    thing.
    """
    if erwartet != tatsaechlich:
        raise ProtokollVeraendert(erwartet, tatsaechlich)


def pruefe_antworten(dokument: Any) -> None:
    """Refuse a document that cannot be stored, or return quietly.

    The order matters. Size is checked first, because a runaway document would
    otherwise produce a violation list as long as itself, and "your protocol is
    too big" is the useful thing to say about it either way.
    """
    if not isinstance(dokument, dict):
        raise AntwortenNichtLesbar

    zeichen = zaehle_zeichen(dokument)
    if zeichen > MAX_ZEICHEN_GESAMT:
        raise AntwortenZuGross(zeichen, MAX_ZEICHEN_GESAMT)

    verstoesse = finde_verstoesse(dokument)
    if verstoesse:
        raise AntwortenUngueltig(verstoesse)
