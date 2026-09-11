"""The six percentage runs of part 3, each of which has to come to exactly 100.

The Python half of frontend/src/protokoll/regeln/prozent.ts.

Defect 1 in docs/ffs-defect-list.md is why there is no per-group branch anywhere
below. The legacy form keeps a check_ok_ indicator per group and reads five of
the six at submit, leaving the Substratverteilung out, so a substrate
distribution totalling 43 is sent and accepted today. One code path for all six
is the fix, and the tests hold it to that.

The browser keeps its own copy of the six runs in abschnitte/teil3/gruppen.ts,
where the blocks are rendered from it. Both lists are pinned against felder.json
by their own tests, which is what keeps them from drifting: the fields making up
a run are a fact about the legacy form, not a choice either half gets to make.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.protokolle.formregeln.regel import (
    SUMME_BEWUCHS,
    SUMME_NEIGUNG,
    SUMME_SOHLVERBAU,
    SUMME_SUBSTRAT,
    SUMME_UFERVERBAU,
    SUMME_UMLAND,
    Formverstoss,
    ist_leer,
    wert_aus,
)

KEINE_GANZE_ZAHL = "protokoll.regeln.prozentKeineGanzeZahl"
SUMME_NICHT_HUNDERT = "protokoll.regeln.prozentsummeNichtHundert"

# Whole numbers only, and at most three digits. The legacy form reads these with
# parseInt and the browser control sets min, max and step, so anything else can
# only arrive by paste, by hand-editing, or by an API call that never met the
# form at all.
GANZER_PROZENTWERT = re.compile(r"^\d{1,3}$")


@dataclass(frozen=True)
class Prozentgruppe:
    """One run of shares, and the pseudo-path its total is reported against."""

    id: str
    felder: tuple[str, ...]


UMLAND = Prozentgruppe(
    SUMME_UMLAND,
    (
        "umland.nadelwald",
        "umland.mischwald",
        "umland.laubwald",
        "umland.auwald",
        "umland.wiese",
        "umland.kulturland_acker",
        "umland.feuchtgebiet_moor",
        "umland.siedlungsgebiet",
    ),
)

UFERNEIGUNG = Prozentgruppe(
    SUMME_NEIGUNG,
    (
        "ufer.flachufer",
        "ufer.schraegufer",
        "ufer.abbruch",
        "ufer.unterspuelung",
    ),
)

UFERBEWUCHS = Prozentgruppe(
    SUMME_BEWUCHS,
    (
        "ufer.ohne_bewuchs",
        "ufer.graeser",
        "ufer.schilf_rohr",
        "ufer.krautige_blattpflanzen",
        "ufer.straeucher",
        "ufer.weiden",
        "ufer.erlen",
        "ufer.andere_baeume",
        "ufer.sonstiger_bewuchs",
    ),
)

UFERVERBAUUNG = Prozentgruppe(
    SUMME_UFERVERBAU,
    (
        "ufer.uferverbau_keiner",
        "ufer.mauer_unverfugt",
        "ufer.faschinen",
        "ufer.drahtnetze",
        "ufer.ueberwachsen",
        "ufer.mauer_verfugt",
        "ufer.steinwurf",
        "ufer.sonstiger_uferverbau",
    ),
)

SUBSTRAT = Prozentgruppe(
    SUMME_SUBSTRAT,
    (
        "gewaessersohle.schlamm",
        "gewaessersohle.lehm",
        "gewaessersohle.sonstiges_erdreich",
        "gewaessersohle.sand",
        "gewaessersohle.kies",
        "gewaessersohle.grobkies",
        "gewaessersohle.steine",
        "gewaessersohle.felsen",
    ),
)

SOHLVERBAUUNG = Prozentgruppe(
    SUMME_SOHLVERBAU,
    (
        "gewaessersohle.keine_sohlverbauung",
        "gewaessersohle.rasensteine",
        "gewaessersohle.drahtnetze_sohlverbauung",
        "gewaessersohle.steinschuettung",
        "gewaessersohle.pflasterung",
        "gewaessersohle.betonschale",
    ),
)

PROZENTGRUPPEN = (
    UMLAND,
    UFERNEIGUNG,
    UFERBEWUCHS,
    UFERVERBAUUNG,
    SUBSTRAT,
    SOHLVERBAUUNG,
)


def bewerte_anteile(gruppe: Prozentgruppe, werte: Sequence[str]) -> list[Formverstoss]:
    """The shares of one run, in the run's own order, judged on their own."""
    verstoesse: list[Formverstoss] = []
    summe = 0
    angefasst = False

    for pfad, wert in zip(gruppe.felder, werte, strict=True):
        eingabe = wert.strip()
        # Blank is untouched, and it counts as 0 towards the total. A bank that
        # is entirely one thing is answered with one share of 100 and seven
        # blanks.
        if ist_leer(eingabe):
            continue
        angefasst = True

        if not GANZER_PROZENTWERT.match(eingabe) or int(eingabe) > 100:
            verstoesse.append(Formverstoss(pfad, KEINE_GANZE_ZAHL))
            continue

        summe += int(eingabe)

    # An untouched run is not a wrong run. Whether a run is required at all is
    # vollstaendigkeit.py's question.
    if not angefasst:
        return verstoesse

    # A run holding something that is not a number has no total worth
    # complaining about, and two messages for one mistake is noise.
    if verstoesse:
        return verstoesse

    if summe != 100:
        verstoesse.append(Formverstoss(gruppe.id, SUMME_NICHT_HUNDERT))

    return verstoesse


def bewerte_gruppe(gruppe: Prozentgruppe, antworten: Mapping[str, Any]) -> list[Formverstoss]:
    """The same judgement, reading the run's shares out of the answers document."""
    return bewerte_anteile(gruppe, [wert_aus(antworten, pfad) for pfad in gruppe.felder])


def pruefe_prozentgruppen(antworten: Mapping[str, Any]) -> list[Formverstoss]:
    return [
        verstoss for gruppe in PROZENTGRUPPEN for verstoss in bewerte_gruppe(gruppe, antworten)
    ]
