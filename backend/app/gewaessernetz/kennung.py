"""Whether a protocol's official identifier still belongs to its water.

Picking a water from the search (feature 18c) writes three answers together: the
name as LUBW spells it, the identifier and the release. The browser clears the
identifier as soon as the name is typed over, but the browser is a convenience;
this is the gate, run at submit.

**The one rule that needs the database**, which is why it is here and not in
app/protokolle/formregeln/, where every rule is a plain function of the answers.
Whether an identifier exists can only be asked of the loaded network.

A release replaced by a newer one still counts. Releases are kept side by side
precisely so an identifier can be looked up in the one it came from.
"""

import re
from collections.abc import Mapping
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gewaessernetz import Gewaessernetz
from app.protokolle.formregeln.regel import Formverstoss, ist_leer, wert_aus
from app.protokolle.zuordnung.regeln import (
    AMTLICHE_ID,
    GEWAESSERNAME,
    GIS_DATASET_VERSION,
    normalisiert,
)

KENNUNG_PASST_NICHT = "protokoll.regeln.gewaesserKennungPasstNicht"

# The dataset's name in front of the release, so that if FFS answers question 16
# with another dataset the stored value says which one an identifier came from.
DATENSATZ = "AWGN"
_VERSION = re.compile(rf"^{DATENSATZ} (\d{{4}}-\d{{2}}-\d{{2}})$")


def datensatzversion(stand: date) -> str:
    """What gis_dataset_version holds for a release: "AWGN 2025-05-01"."""
    return f"{DATENSATZ} {stand.isoformat()}"


def stand_aus_version(version: str) -> date | None:
    """The release a gis_dataset_version names, or None if it names none."""
    treffer = _VERSION.match(version)
    if treffer is None:
        return None
    try:
        return date.fromisoformat(treffer.group(1))
    except ValueError:
        return None


async def pruefe_gewaesserkennung(
    session: AsyncSession, antworten: Mapping[str, Any]
) -> list[Formverstoss]:
    """Nothing, or one message on the Gewaesser name.

    On the name rather than the identifier because the name is what the surveyor
    sees and can change: the message tells them to pick the water again or type
    it freely. A missing name is the completeness check's to report.
    """
    name = wert_aus(antworten, GEWAESSERNAME)
    kennung = wert_aus(antworten, AMTLICHE_ID)
    version = wert_aus(antworten, GIS_DATASET_VERSION)

    if ist_leer(name) or (ist_leer(kennung) and ist_leer(version)):
        return []

    stand = stand_aus_version(version)
    if ist_leer(kennung) or stand is None:
        return [_passt_nicht()]

    amtlicher_name = await session.scalar(
        select(Gewaessernetz.name)
        .where(Gewaessernetz.stand == stand)
        .where(Gewaessernetz.kennung == kennung)
        .limit(1)
    )
    if amtlicher_name is None or normalisiert(amtlicher_name) != normalisiert(name):
        return [_passt_nicht()]
    return []


def _passt_nicht() -> Formverstoss:
    return Formverstoss(pfad=GEWAESSERNAME, schluessel=KENNUNG_PASST_NICHT)
