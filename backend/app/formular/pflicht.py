"""Which answers a finished protocol must carry.

The third file in the seed directory, and the only hand-authored one. The other
two are read out of the legacy PDF by scripts/extract_form_definition.py; this
one cannot be, because the PDF's field definition carries no required flag at
all. It knows a field's name, its type and its option list, and nothing about
whether anybody has to fill it in. So requiredness is a decision this project
took, and the reasoning behind every entry is in
blueprint/context/pflichtfelder-vorschlag.md.

**Why it is a file rather than a list in Python.** Until feature 11c this list
lived twice: as a tuple in formregeln/vollstaendigkeit.py and as 32 `pflicht`
props scattered through the form's section components, with nothing holding the
two together. They had already drifted, and the drift was invisible, because a
field carrying an asterisk on screen that nothing actually checked looks exactly
like one that works. The browser reads this same file through its @formular
alias, so the asterisk and the gate are now the same fact.

**Only the plain requirements are here.** A list cannot say "the dam's slope is
required when there is a dam", and it cannot say "at least one of these ticks".
Those live as rules in app/protokolle/formregeln/, which is where every other
conditional already is.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.formular.felder import FormularDefinitionFehlt, formular

PFLICHT_DATEI = "pflichtfelder.json"


@dataclass(frozen=True)
class Pflichtfelder:
    """One form version's required answers."""

    version: str
    #: In the file's own order, which is form order, so the panel in the browser
    #: lists what is missing in the order somebody walks the protocol.
    pfade: tuple[str, ...]


def lade_pflichtfelder(verzeichnis: Path) -> Pflichtfelder:
    """Read one version's required list out of its seed directory.

    Takes the directory rather than the configured one, so the failure cases are
    testable without a broken checkout. Same shape and the same error as its two
    companions: all three describe one form version, and somebody holding a
    half-written seed directory needs the path rather than the distinction.

    Every path is checked against the field list. A required field the form does
    not have could never be filled in, so it would refuse every protocol ever
    submitted, and a typo in a hand-authored file is exactly how that would
    happen.
    """
    pfad = verzeichnis / PFLICHT_DATEI

    try:
        roh = json.loads(pfad.read_text(encoding="utf-8"))
    except OSError as fehler:
        raise FormularDefinitionFehlt(pfad, "it could not be opened") from fehler
    except json.JSONDecodeError as fehler:
        raise FormularDefinitionFehlt(pfad, "it is not readable JSON") from fehler

    if not isinstance(roh, dict):
        raise FormularDefinitionFehlt(pfad, "its top level is not an object")

    version = roh.get("version")
    pfade = roh.get("pflichtfelder")
    if not isinstance(version, str) or not isinstance(pfade, list):
        raise FormularDefinitionFehlt(pfad, "it has no version or no required list")

    if not all(isinstance(eintrag, str) for eintrag in pfade):
        raise FormularDefinitionFehlt(pfad, "one of its entries is not a path")

    if len(set(pfade)) != len(pfade):
        raise FormularDefinitionFehlt(pfad, "it names the same path twice")

    return Pflichtfelder(version=version, pfade=tuple(pfade))


@lru_cache
def pflichtfelder() -> Pflichtfelder:
    """The required list this deployment enforces, read once per process.

    Cached like its two companions, and for the same reason: the file cannot
    change while the service runs, and every submission consults it.

    The paths are checked against the field list here rather than in lade_
    above, so that loading a directory in a test does not drag the configured
    form definition in with it.
    """
    geladen = lade_pflichtfelder(get_settings().formular_seed_dir)

    unbekannt = sorted(set(geladen.pfade) - formular().pfade)
    if unbekannt:
        raise FormularDefinitionFehlt(
            get_settings().formular_seed_dir / PFLICHT_DATEI,
            f"it requires fields this form does not have: {', '.join(unbekannt)}",
        )

    return geladen
