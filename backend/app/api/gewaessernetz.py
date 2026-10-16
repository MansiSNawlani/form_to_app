"""Searching the official water body network, and snapping a point to it.

Open data, so nothing here is narrowed by role, but it still needs a session
like every other route: the application is not a public mirror of LUBW's
dataset. What the search does lives in app/gewaessernetz/suche.py, and what
snapping does in app/gewaessernetz/einrasten.py.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.abhaengigkeiten import AngemeldeterBenutzer
from app.api.schemas import EinrastenAntwort, FehlerAntwort, GewaessersucheAntwort
from app.db import get_session
from app.gewaessernetz.einrasten import Gewaehlt, einrasten, gewaehlt_aus
from app.gewaessernetz.suche import suche

router = APIRouter(prefix="/api/v1/gewaessernetz", tags=["Gewaessernetz"])

MIN_ZEICHEN = 2
MAX_ZEICHEN = 200

# The stretch has two boundary points, and they are all the search is ever given.
MAX_PUNKTE = 2

# Wider than Baden-Wuerttemberg in EPSG:25832 on purpose: this only keeps a
# request from carrying an absurd number into SQL. Whether a point is in the
# state is the coordinate rule's question, and the browser sends only points
# that passed it.
Koordinate = Annotated[int, Field(ge=0, le=9_999_999)]

ANGEMELDET: dict[int | str, dict[str, Any]] = {
    status.HTTP_401_UNAUTHORIZED: {"model": FehlerAntwort},
    status.HTTP_422_UNPROCESSABLE_CONTENT: {"model": FehlerAntwort},
}


def _abgelehnt(feld: str, grund: str) -> RequestValidationError:
    return RequestValidationError([{"type": "value_error", "loc": ("query", feld), "msg": grund}])


def _punkte(rw: list[Koordinate], hw: list[Koordinate]) -> list[tuple[int, int]]:
    if len(rw) != len(hw):
        raise _abgelehnt("rw", "rw und hw kommen nur paarweise.")
    if len(rw) > MAX_PUNKTE:
        raise _abgelehnt("rw", f"Hoechstens {MAX_PUNKTE} Punkte.")
    return list(zip(rw, hw, strict=True))


@router.get("/suche", response_model=GewaessersucheAntwort, responses=ANGEMELDET)
async def gewaesser_suchen(
    _benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    q: Annotated[
        str,
        Query(
            max_length=MAX_ZEICHEN,
            description="Ein Teil des Gewaessernamens, mindestens zwei Zeichen."
            " Gross- und Kleinschreibung zaehlen nicht, ae findet ä.",
        ),
    ],
    rw: Annotated[list[Koordinate], Query()] = [],  # noqa: B006
    hw: Annotated[list[Koordinate], Query()] = [],  # noqa: B006
) -> GewaessersucheAntwort:
    """Bis zu 20 Gewaesser aus dem neuesten Stand des Gewaessernetzes.

    Mit einem oder zwei Punkten (rw und hw paarweise, EPSG:25832) das naechste
    zuerst, sonst die Namen, die mit der Eingabe beginnen. Ist kein Stand
    geladen, ist stand null und die Liste leer.
    """
    if len(q.strip()) < MIN_ZEICHEN:
        raise _abgelehnt("q", f"Mindestens {MIN_ZEICHEN} Zeichen.")
    ergebnis = await suche(session, q, _punkte(rw, hw))
    return GewaessersucheAntwort.model_validate(ergebnis)


def _wahl_aus_anfrage(
    kennung: str | None, name: str | None, version: str | None
) -> Gewaehlt | None:
    """No pick when none of the three is sent; a refusal when only some are, or
    when the version names no release."""
    if kennung is None and name is None and version is None:
        return None
    gewaehlt = gewaehlt_aus(kennung or "", name or "", version or "")
    if gewaehlt is None:
        raise _abgelehnt(
            "kennung",
            "kennung, name und version kommen nur zusammen, version als 'AWGN JJJJ-MM-TT'.",
        )
    return gewaehlt


@router.get("/einrasten", response_model=EinrastenAntwort, responses=ANGEMELDET)
async def punkt_einrasten(
    _benutzer: AngemeldeterBenutzer,
    session: Annotated[AsyncSession, Depends(get_session)],
    rw: Annotated[Koordinate, Query(description="Rechtswert in Metern, EPSG:25832.")],
    hw: Annotated[Koordinate, Query(description="Hochwert in Metern, EPSG:25832.")],
    kennung: Annotated[str | None, Query(max_length=MAX_ZEICHEN)] = None,
    name: Annotated[str | None, Query(max_length=MAX_ZEICHEN)] = None,
    version: Annotated[str | None, Query(max_length=MAX_ZEICHEN)] = None,
) -> EinrastenAntwort:
    """Die naechste Stelle am Gewaesser fuer einen Grenzpunkt.

    Mit kennung, name und version (alle drei oder keins) am ausgewaehlten
    Gewaesser in dessen Stand, sonst am naechsten Gewaesser des neuesten Stands.
    Ist der Stand nicht geladen, sind stand und treffer null.
    """
    ergebnis = await einrasten(session, (rw, hw), _wahl_aus_anfrage(kennung, name, version))
    return EinrastenAntwort.model_validate(ergebnis)
