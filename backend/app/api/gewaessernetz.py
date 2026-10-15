"""Searching the official water body network.

Open data, so nothing here is narrowed by role, but it still needs a session
like every other route: the application is not a public mirror of LUBW's
dataset. What the search does lives in app/gewaessernetz/suche.py.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.abhaengigkeiten import AngemeldeterBenutzer
from app.api.schemas import FehlerAntwort, GewaessersucheAntwort
from app.db import get_session
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
