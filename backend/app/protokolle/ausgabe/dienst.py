"""Gathering one protocol into the document builder, and naming the file.

The layer where the model, the store and the builder meet. The route parses,
authorises and delegates here; everything below can be tested against a
transaction and a temporary directory rather than through HTTP.

**Ownership is never asked about here directly.** The protocol is reached
through hole_sichtbares_protokoll, the same rule the reviewer's screen uses, so
a stranger learns exactly what they learn everywhere else: nothing. The wider
rule rather than hole_protokoll, because reading a protocol is what this is, and
app/protokolle/dienst.py explains why the two are separate functions.
"""

import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.dienst import liste_anlagen
from app.anlagen.speicher import Anlagenspeicher
from app.models.benutzer import User
from app.protokolle.ausgabe.beschriftungen import gliederung
from app.protokolle.ausgabe.dokument import Bild, Protokollkopf, baue, verkleinere
from app.protokolle.dienst import hole_sichtbares_protokoll

#: Where the title block's facts sit in the answers document.
GEWAESSER = "probestrecke.gewaesser.gewaessername"
ORTSANGABE = "probestrecke.ortsangabe"
DATUM = "datum"
UHRZEIT = "messdaten.uhrzeit"
BEARBEITER = "bearbeiter.name"


@dataclass(frozen=True, slots=True)
class Ausgabe:
    """The finished download: what it is called and what is in it."""

    dateiname: str
    daten: bytes


async def baue_ausgabe(
    session: AsyncSession,
    *,
    protokoll_id: uuid.UUID,
    benutzer: User,
    speicher: Anlagenspeicher,
) -> Ausgabe:
    """One protocol as a PDF, pictures and all.

    The pictures are read and shrunk one at a time rather than all at once. An
    attachment may be 10 MB and a protocol may carry 21 of them, so holding them
    whole would mean 200 MB of memory to answer one download.

    A picture whose row has outlived its file is a line in the document rather
    than a failed download. app/anlagen/speicher.py explains how that happens:
    the row and the file are not one transaction, and the order they are written
    in makes the harmless failure the only one possible.
    """
    protokoll = await hole_sichtbares_protokoll(
        session, protokoll_id=protokoll_id, benutzer=benutzer
    )
    anlagen = await liste_anlagen(session, protokoll_id=protokoll_id, benutzer=benutzer)

    bilder: list[Bild] = []
    hinweise: list[str] = []
    for anlage in anlagen:
        daten = await speicher.lies(anlage.storage_key)
        if daten is None:
            hinweise.append(f"{anlage.dateiname}: die Datei ist nicht mehr im Speicher.")
            continue
        bilder.append(Bild(art=anlage.art, dateiname=anlage.dateiname, daten=verkleinere(daten)))

    antworten: dict[str, Any] = dict(protokoll.antworten or {})
    kopf = Protokollkopf(
        gewaesser=_text(antworten, GEWAESSER),
        ortsangabe=_text(antworten, ORTSANGABE),
        datum=_datum(_text(antworten, DATUM)),
        uhrzeit=_uhrzeit(_text(antworten, UHRZEIT)),
        status=gliederung().statuswort(protokoll.status.value),
        bearbeiter=_text(antworten, BEARBEITER),
        form_version=protokoll.form_version,
        anlagen=len(anlagen),
        hinweise=tuple(hinweise),
    )

    return Ausgabe(dateiname=dateiname(kopf), daten=baue(kopf, antworten, bilder))


def dateiname(kopf: Protokollkopf) -> str:
    """What the file is called once it reaches somebody's Downloads folder.

    Built from the water and the date, because that is how a surveyor refers to
    a survey, and a folder full of protokoll.pdf, protokoll(1).pdf is no use to
    anybody.

    Reduced to plain ASCII. The Content-Disposition header can carry an umlaut
    safely, but the name also has to survive being saved on whatever filesystem
    is at the other end, and a Windows share is not somewhere to find out.
    """
    teile = [teil for teil in ("Protokoll", _sicher(kopf.gewaesser)) if teil]
    if kopf.datum:
        teile.append(kopf.datum.isoformat())
    return f"{'_'.join(teile)}.pdf"


def _sicher(wert: str) -> str:
    ohne_umlaute = (
        wert.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("Ä", "Ae")
        .replace("Ö", "Oe")
        .replace("Ü", "Ue")
        .replace("ß", "ss")
    )
    zerlegt = unicodedata.normalize("NFKD", ohne_umlaute).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", zerlegt).strip("-")[:60]


def _text(antworten: dict[str, Any], pfad: str) -> str:
    hier: Any = antworten
    for teil in pfad.split("."):
        if not isinstance(hier, dict):
            return ""
        hier = hier.get(teil)
    return str(hier).strip() if hier is not None else ""


def _datum(wert: str) -> date | None:
    """The stored date, which the form writes dd.mm.yyyy and the app may store
    as an ISO date. Neither is guaranteed on a draft somebody is halfway through."""
    for muster in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(wert, muster).date()
        except ValueError:
            continue
    return None


def _uhrzeit(wert: str) -> time | None:
    try:
        return datetime.strptime(wert, "%H:%M").time()
    except ValueError:
        return None
