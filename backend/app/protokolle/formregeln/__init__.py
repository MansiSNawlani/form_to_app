"""The form rules: what is missing from an answers document, and what is wrong.

Every rule from features 4c to 9b, mirroring frontend/src/protokoll/regeln/
module for module, plus vollstaendigkeit.py, which has no twin because nothing
in either half of the app has asked what a finished protocol needs until now.

See regel.py for the contract they all share. Nothing here holds a database, an
HTTP request or a German sentence: a violation is a path and an i18n key, and
the browser does the wording.

Feature 11c is what calls pruefe_protokoll. Saving a draft deliberately does not:
app/protokolle/regeln.py stays as forgiving as it is, or a half-finished protocol
would stop saving.
"""

from collections.abc import Mapping
from typing import Any

from app.protokolle.formregeln.artenliste import pruefe_arten
from app.protokolle.formregeln.ausruestung import pruefe_ausruestung
from app.protokolle.formregeln.einfluesse import pruefe_einfluesse
from app.protokolle.formregeln.hydrologie import pruefe_hydrologie
from app.protokolle.formregeln.koordinaten import pruefe_koordinaten
from app.protokolle.formregeln.monitoring import pruefe_monitoringnummer
from app.protokolle.formregeln.prozent import pruefe_prozentgruppen
from app.protokolle.formregeln.regel import Formverstoss, erste_je_pfad
from app.protokolle.formregeln.schaetzwert import pruefe_schaetzwerte
from app.protokolle.formregeln.vollstaendigkeit import pruefe_vollstaendigkeit
from app.protokolle.formregeln.vorfluter import pruefe_vorfluterkette

__all__ = ["Formverstoss", "pruefe_protokoll"]


def pruefe_protokoll(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """Everything wrong with a protocol somebody is trying to submit.

    An empty list means it may be submitted.

    The order

    What is missing first, then what is wrong, and within that, part 1 through
    part 6. Somebody repairing a protocol fills the gaps before they argue with
    the rules, and the panel in 11c shows this list as it comes.

    The two groups cannot overlap. Every rule below stays quiet about a blank
    answer, which is what lets the same rules run over a half-finished draft, so
    a field that is missing is never also wrong.

    Why the whole list is deduplicated by path

    One field really can break two rules at once. A pond carrying a width
    estimate trips hydrologie.py, because the section does not apply to standing
    water at all, and schaetzwert.py, because that estimate sits under a band
    marked as not applying. Both are true and only one is worth saying.

    Order decides which survives, and hydrologie.py comes first deliberately:
    "this section does not apply to a pond" is the reason the other complaint
    exists. Part 6 does the same thing inside itself for the same reason.
    """
    return erste_je_pfad(
        [
            *pruefe_vollstaendigkeit(antworten),
            *pruefe_monitoringnummer(antworten),
            *pruefe_vorfluterkette(antworten),
            *pruefe_koordinaten(antworten),
            *pruefe_hydrologie(antworten),
            *pruefe_schaetzwerte(antworten),
            *pruefe_prozentgruppen(antworten),
            *pruefe_einfluesse(antworten),
            *pruefe_ausruestung(antworten),
            *pruefe_arten(antworten),
        ]
    )
