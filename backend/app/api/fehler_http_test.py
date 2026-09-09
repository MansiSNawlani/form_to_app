"""A protocol refusal becomes a response that names fields and never values.

No route can raise these yet, so they are handed to the handler directly. Once
step 6 gives them a route, its tests cover the path through HTTP; this file stays
because it is where the wording itself is checked.
"""

import json
from typing import Any

from fastapi import Request, status

from app.api.fehler_http import (
    HOECHSTENS_GENANNT,
    behandle_protokollfehler,
)
from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    ProtokollFehler,
    Verstoss,
    Verstossgrund,
)

# The handler never looks at the request, so the smallest thing Starlette accepts
# as one is enough.
ANFRAGE = Request({"type": "http", "method": "PUT", "path": "/", "headers": []})


async def antworte(fehler: ProtokollFehler) -> tuple[int, dict[str, Any]]:
    antwort = await behandle_protokollfehler(ANFRAGE, fehler)
    koerper: dict[str, Any] = json.loads(bytes(antwort.body))
    return antwort.status_code, koerper


async def test_nicht_lesbare_antworten_werden_abgelehnt() -> None:
    status_code, koerper = await antworte(AntwortenNichtLesbar())

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANTWORTEN_NICHT_LESBAR"


async def test_ein_zu_grosses_protokoll_nennt_beide_zahlen() -> None:
    """The person has to know how far over it is to know what to shorten."""
    status_code, koerper = await antworte(AntwortenZuGross(250_000, 200_000))

    assert status_code == status.HTTP_413_CONTENT_TOO_LARGE
    assert koerper["code"] == "ANTWORTEN_ZU_GROSS"
    assert "250000" in koerper["nachricht"]
    assert "200000" in koerper["nachricht"]


async def test_ungueltige_antworten_nennen_die_felder() -> None:
    fehler = AntwortenUngueltig(
        (
            Verstoss("erfunden", Verstossgrund.UNBEKANNT),
            Verstoss("bearbeiter.name", Verstossgrund.KEIN_TEXT),
        )
    )

    status_code, koerper = await antworte(fehler)

    assert status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert koerper["code"] == "ANTWORTEN_UNGUELTIG"
    assert "erfunden" in koerper["nachricht"]
    assert "bearbeiter.name" in koerper["nachricht"]


async def test_die_liste_der_felder_bleibt_lesbar() -> None:
    """Four hundred field paths in one sentence helps nobody.

    A few are named and the rest are counted, which is enough to work with and
    still fits in a message somebody will read.
    """
    verstoesse = tuple(
        Verstoss(f"erfunden{n}", Verstossgrund.UNBEKANNT) for n in range(20)
    )

    _, koerper = await antworte(AntwortenUngueltig(verstoesse))

    genannt = sum(1 for n in range(20) if f"erfunden{n}" in koerper["nachricht"])
    assert genannt == HOECHSTENS_GENANNT
    assert f"und {20 - HOECHSTENS_GENANNT} weitere" in koerper["nachricht"]


async def test_eine_ablehnung_traegt_keine_eingaben_zurueck() -> None:
    """Field paths come from our own definition; the values never leave.

    This is the whole reason app/api/fehler_http.py replaces FastAPI's own
    validation response, which quotes the rejected value straight back.
    """
    fehler = AntwortenUngueltig((Verstoss("bearbeiter.name", Verstossgrund.ZU_LANG),))

    _, koerper = await antworte(fehler)

    assert "bearbeiter.name" in koerper["nachricht"]
    # The value that was too long is nowhere in the response, because the
    # exception never carried it in the first place.
    assert not hasattr(fehler.verstoesse[0], "wert")
