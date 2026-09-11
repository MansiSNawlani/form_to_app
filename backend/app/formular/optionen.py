"""Which values the form's pickers offer, per list.

The companion to felder.py, which publishes the field names. This publishes what
may go in them, out of the same seed directory and by the same generator, and for
the same reason: the lists exist nowhere but inside the legacy PDF, and the
longest of them holds 722 monitoring stretch numbers. Read rather than retyped.

Added in feature 11a, because the rules are the first thing on this side that
compares an answer against a coded value: whether the Gewässertyp is a standing
water, whether the Anlass is one of the two monitoring occasions, whether a
species code is one the form knows.

Only the values, not the labels. This half of the app never shows a label to
anybody; it answers with an i18n key and the browser does the rest.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.formular.felder import FormularDefinitionFehlt, formular

OPTIONEN_DATEI = "optionslisten.json"


@dataclass(frozen=True)
class Optionslisten:
    """One form version's pickers."""

    version: str
    listen: dict[str, frozenset[str]]

    def werte(self, name: str) -> frozenset[str]:
        """What that list offers, or nothing at all if there is no such list.

        Empty rather than a KeyError. A rule naming a list that does not exist is
        our own bug, and the place it should surface is the test suite, not
        halfway through checking somebody's protocol.
        """
        return self.listen.get(name, frozenset())


def lade_optionen(verzeichnis: Path) -> Optionslisten:
    """Read one version's option lists out of its seed directory.

    Takes the directory rather than reading the configured one, so the failure
    cases are testable without a broken checkout. Same shape as felder.lade, and
    it raises the same error: both files describe one form version, and somebody
    holding a half-written seed directory needs the path, not the distinction.
    """
    pfad = verzeichnis / OPTIONEN_DATEI

    try:
        roh = json.loads(pfad.read_text(encoding="utf-8"))
    except OSError as fehler:
        raise FormularDefinitionFehlt(pfad, "it could not be opened") from fehler
    except json.JSONDecodeError as fehler:
        raise FormularDefinitionFehlt(pfad, "it is not readable JSON") from fehler

    if not isinstance(roh, dict):
        raise FormularDefinitionFehlt(pfad, "its top level is not an object")

    version = roh.get("version")
    listen = roh.get("listen")
    if not isinstance(version, str) or not isinstance(listen, dict):
        raise FormularDefinitionFehlt(pfad, "it has no version or no lists")

    return Optionslisten(version=version, listen=_werte_je_liste(pfad, listen))


def _werte_je_liste(pfad: Path, listen: dict[str, object]) -> dict[str, frozenset[str]]:
    geladen: dict[str, frozenset[str]] = {}

    for name, eintraege in listen.items():
        if not isinstance(eintraege, list):
            raise FormularDefinitionFehlt(pfad, f"its list {name} is not a list")

        werte = [
            eintrag["wert"]
            for eintrag in eintraege
            if isinstance(eintrag, dict) and isinstance(eintrag.get("wert"), str)
        ]
        if len(werte) != len(eintraege):
            raise FormularDefinitionFehlt(pfad, f"its list {name} has an entry with no value")

        # A repeated value collapses rather than raising, which the frozenset
        # does by itself.
        #
        # The E-Gerät list really does offer the same value twice, under the
        # labels "keine Angabe" and "unbekannt"; it is the only list in the form
        # that does, and it is item 12 in docs/ffs-defect-list.md. The frontend
        # collapses it too, in protokoll/optionen.ts, for the display side of the
        # same reason. Refusing it here would mean a backend that will not start
        # on the seed the browser is perfectly happy with, and it would buy
        # nothing: this half only ever asks whether a value is allowed, and a
        # duplicate does not change that answer.
        geladen[name] = frozenset(werte)

    return geladen


@lru_cache
def optionen() -> Optionslisten:
    """The option lists this deployment serves, read once per process.

    Cached like the field list, and for the same reason: the files cannot change
    while the service runs, and a rule consults these on every submission.

    The two files are checked against each other here rather than in lade_optionen,
    which sees only one of them. A seed directory holding a field list from one
    form version and pickers from another is a half-finished deploy, and the way
    it would otherwise surface is a valid protocol being refused for a reason
    nobody can trace back to the files.
    """
    geladen = lade_optionen(get_settings().formular_seed_dir)

    if geladen.version != formular().version:
        raise FormularDefinitionFehlt(
            get_settings().formular_seed_dir / OPTIONEN_DATEI,
            f"it is form version {geladen.version} beside a field list"
            f" for version {formular().version}",
        )

    return geladen
