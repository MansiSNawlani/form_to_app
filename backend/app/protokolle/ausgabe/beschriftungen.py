"""What each answer is called, in German, for the document to print.

A PDF has to say "mittlere Breite", not hydrologie.breite. Those words exist in
one place, the frontend: de.json holds the wording and the block components
decide which wording belongs to which answer path.

So they are generated out of the components by frontend/scripts/beschriftungen.ts
into database/seed/, beside felder.json and optionslisten.json, and this module
reads them. Same arrangement, same reason: a label belongs to a form version,
and one source means the document and the screen cannot drift apart.

Not retyped here, deliberately. nurlesen/ProtokollNurLesen.tsx refused to make a
second copy of the labels for the read-only view, on the grounds that "the copy
would drift from the form the first time a label changed", and a copy that lived
in another language in another directory would drift faster.

**The catch table is not in here.** Its 312 fields are arten.artN.klasse_M, and
they have no individual labels on screen either: the table names its columns
once, across the top. The document prints it the same way, so it needs the
column headings rather than 312 labels. beschriftungen_test.py holds that line.
"""

import json
from functools import lru_cache
from pathlib import Path

from app.config import get_settings
from app.formular.felder import FormularDefinitionFehlt

BESCHRIFTUNGEN_DATEI = "beschriftungen.json"

ERZEUGER = "frontend/scripts/beschriftungen.ts"


def lade(verzeichnis: Path) -> dict[str, str]:
    """Read one version's labels out of its seed directory.

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

    beschriftungen = roh.get("beschriftungen")
    anzahl = roh.get("anzahl")
    if not isinstance(beschriftungen, dict):
        raise FormularDefinitionFehlt(pfad, "it holds no labels", ERZEUGER)

    if any(not isinstance(wort, str) or not wort for wort in beschriftungen.values()):
        raise FormularDefinitionFehlt(pfad, "a label is empty or is not text", ERZEUGER)

    if len(beschriftungen) != anzahl:
        raise FormularDefinitionFehlt(
            pfad,
            f"it claims {anzahl} labels and holds {len(beschriftungen)}",
            ERZEUGER,
        )

    return {pfad_: wort for pfad_, wort in beschriftungen.items()}


@lru_cache
def beschriftungen() -> dict[str, str]:
    """The labels this deployment serves, read once per process.

    Cached like the field definition next to it: the file cannot change while
    the process runs, and a document build should not re-read it per field.
    """
    return lade(get_settings().formular_seed_dir)
