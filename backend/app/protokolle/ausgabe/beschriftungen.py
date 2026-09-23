"""What each answer is called, in German, and under which heading it prints.

A PDF has to say "mittlere Breite", not hydrologie.breite, and it has to say it
under "Hydrologie" rather than in one long list. Both facts live in one place,
the frontend: de.json holds the wording, the block components decide which
wording belongs to which answer path, and the order of the screens is the order
of the document.

So both are generated out of the components by frontend/scripts/beschriftungen.ts
into database/seed/, beside felder.json and optionslisten.json, and this module
reads them. Same arrangement, same reason: they belong to a form version, and
one source means the document and the screen cannot drift apart.

Not retyped here, deliberately. nurlesen/ProtokollNurLesen.tsx refused to make a
second copy of the labels for the read-only view, on the grounds that "the copy
would drift from the form the first time a label changed", and a copy that lived
in another language in another directory would drift faster.

**The catch table is not labelled field by field.** Its 312 fields are
arten.artN.klasse_M, and they have no individual labels on screen either: the
table names its columns once, across the top. The outline marks that block
`fangtabelle` and the document lays it out as a table.
"""

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.formular.felder import FormularDefinitionFehlt

BESCHRIFTUNGEN_DATEI = "beschriftungen.json"

ERZEUGER = "frontend/scripts/beschriftungen.ts"


@dataclass(frozen=True, slots=True)
class Block:
    """One heading and the fields printed under it."""

    titel: str
    #: The catch table prints as a table of its own rather than label and value.
    fangtabelle: bool
    pfade: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Abschnitt:
    """One of the protocol's sections, as the screens divide it up."""

    titel: str
    bloecke: tuple[Block, ...]


@dataclass(frozen=True, slots=True)
class Gruppe:
    """One run of shares that has to total 100, so the document can print it."""

    titel: str
    pfade: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Gliederung:
    """Everything the document needs to know about naming and ordering."""

    version: str
    abschnitte: tuple[Abschnitt, ...]
    gruppen: tuple[Gruppe, ...]
    beschriftungen: dict[str, str]
    #: What each status is called in German, so a printout does not say DRAFT.
    status: dict[str, str] = field(default_factory=dict)

    def wort(self, pfad: str) -> str:
        """The label for one field.

        Falls back to the path rather than raising. A document missing one word
        is worth handing over; a download that refuses because a label is
        missing is not, and the backend test already fails the build for it.
        """
        return self.beschriftungen.get(pfad, pfad)

    def statuswort(self, status: str) -> str:
        """What a status is called in German, or the raw name if nothing says."""
        return self.status.get(status, status)


def lade(verzeichnis: Path) -> Gliederung:
    """Read one version's labels and outline out of its seed directory.

    Takes the directory rather than the configured one, so a broken file can be
    tested without breaking the checkout, exactly as app/formular/felder.py does.

    The count in the file is checked against the mapping beside it. Both are
    written by the same generator, so a disagreement means the file was hand
    edited or truncated, and a silently short label list would show up as a
    protocol printing field paths at somebody instead of words.
    """
    pfad = verzeichnis / BESCHRIFTUNGEN_DATEI

    try:
        roh = json.loads(pfad.read_text(encoding="utf-8"))
    except OSError as fehler:
        raise FormularDefinitionFehlt(pfad, "it could not be opened", ERZEUGER) from fehler
    except json.JSONDecodeError as fehler:
        raise FormularDefinitionFehlt(pfad, "it is not readable JSON", ERZEUGER) from fehler

    if not isinstance(roh, dict):
        raise FormularDefinitionFehlt(pfad, "its top level is not an object", ERZEUGER)

    version = roh.get("version")
    beschriftungen = roh.get("beschriftungen")
    anzahl = roh.get("anzahl")
    if not isinstance(version, str) or not isinstance(beschriftungen, dict):
        raise FormularDefinitionFehlt(pfad, "it has no version or no labels", ERZEUGER)

    if any(not isinstance(wort, str) or not wort for wort in beschriftungen.values()):
        raise FormularDefinitionFehlt(pfad, "a label is empty or is not text", ERZEUGER)

    if len(beschriftungen) != anzahl:
        raise FormularDefinitionFehlt(
            pfad, f"it claims {anzahl} labels and holds {len(beschriftungen)}", ERZEUGER
        )

    return Gliederung(
        version=version,
        abschnitte=_abschnitte(pfad, roh.get("abschnitte")),
        gruppen=_gruppen(roh.get("gruppen")),
        beschriftungen=dict(beschriftungen),
        status={
            str(schluessel): str(wort) for schluessel, wort in (roh.get("status") or {}).items()
        },
    )


def _abschnitte(pfad: Path, roh: object) -> tuple[Abschnitt, ...]:
    """The outline, refused rather than guessed at when it is not the right shape."""
    if not isinstance(roh, list) or not roh:
        raise FormularDefinitionFehlt(pfad, "it carries no outline", ERZEUGER)

    abschnitte = []
    for eintrag in roh:
        if not isinstance(eintrag, dict) or not isinstance(eintrag.get("bloecke"), list):
            raise FormularDefinitionFehlt(pfad, "a section carries no blocks", ERZEUGER)
        bloecke = []
        for block in eintrag["bloecke"]:
            if not isinstance(block, dict) or not isinstance(block.get("pfade"), list):
                raise FormularDefinitionFehlt(pfad, "a block carries no field list", ERZEUGER)
            bloecke.append(
                Block(
                    titel=str(block.get("titel", "")),
                    fangtabelle=bool(block.get("fangtabelle")),
                    pfade=tuple(str(p) for p in block["pfade"]),
                )
            )
        abschnitte.append(Abschnitt(titel=str(eintrag.get("titel", "")), bloecke=tuple(bloecke)))

    return tuple(abschnitte)


def _gruppen(roh: object) -> tuple[Gruppe, ...]:
    """The percentage runs. Absent is not an error: a form version with no run
    that has to total 100 is perfectly possible, and the document simply prints
    no totals for it."""
    if not isinstance(roh, list):
        return ()
    return tuple(
        Gruppe(
            titel=str(eintrag.get("titel", "")),
            pfade=tuple(str(p) for p in eintrag.get("pfade", [])),
        )
        for eintrag in roh
        if isinstance(eintrag, dict)
    )


@lru_cache
def gliederung() -> Gliederung:
    """The labels and outline this deployment serves, read once per process.

    Cached like the field definition next to it: the file cannot change while
    the process runs, and a document build should not re-read it per field.
    """
    return lade(get_settings().formular_seed_dir)
