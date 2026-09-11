"""What a form rule is, and the three things every one of them needs.

The Python half of frontend/src/protokoll/regeln/regel.ts, deliberately module
for module so that a rule which changes has two obvious places to change.

A rule is a plain function from the answers document to what is wrong with it,
holding no database, no HTTP and no German. That keeps it testable without
either half of the running app, and it is the same contract the browser side
already works to, so the two can be read against each other.

The browser checks these rules for instant feedback and this half is the gate.
coding-standards.md calls that writing the validation twice, and it is
deliberate: a rule the browser enforces alone is a rule anybody can skip with a
single HTTP request.
"""

import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

# Where a violation points when no single answer is the wrong one.
#
# Six percentage runs whose total is nobody's field, part 4's Einflüsse, where
# the contradiction is between two ticks rather than in either, part 5's three
# pairs of numbers that between them say nothing, and the catch table as a whole,
# where a survey that recorded nothing without saying so is wrong in no one cell.
# Turning every box in a group red for one problem is noise.
#
# The prefixes keep these clear of real answers, which matters: ufer.neigung is
# a real field, the slope of a built-up dam in degrees, so the percentage run
# about bank slopes could not be named after itself. The exact strings are
# gruppen.ts, teil4/bloecke.ts, teil5/bloecke.ts and teil6/tabelle.ts.
SUMME_UMLAND = "summe.umland"
SUMME_NEIGUNG = "summe.neigung"
SUMME_BEWUCHS = "summe.bewuchs"
SUMME_UFERVERBAU = "summe.uferverbau"
SUMME_SUBSTRAT = "summe.substrat"
SUMME_SOHLVERBAU = "summe.sohlverbau"

EINFLUSS_WIDERSPRUCH = "widerspruch.einfluesse"

ANODEN_PAAR = "paar.anoden"
LAENGE_PAAR = "paar.befischte_laenge"
BREITE_PAAR = "paar.befischte_breite"

ARTEN_TABELLE = "tabelle.arten"


@dataclass(frozen=True, slots=True)
class Formverstoss:
    """One thing wrong with an answers document.

    A key rather than a sentence. The German wording already exists in the
    browser, under protokoll.regeln in frontend/src/i18n/locales/de.json, and
    feature 17 translates it; a sentence built here could not be translated and
    would be a second copy of one that exists. It also keeps German out of the
    backend, which coding-standards.md asks for everywhere but the domain names.
    """

    #: A dotted path into the answers document, or one of the pseudo-paths above.
    pfad: str

    #: The full i18n key, prefix included, so the browser can translate it as it
    #: stands rather than assembling it from parts.
    schluessel: str


def ist_leer(wert: str | None) -> bool:
    """Blank is untouched, and untouched is never wrong on its own.

    A missing answer is the completeness check's business, in
    vollstaendigkeit.py, not any rule here. Every rule in this package asks this
    first and says nothing about an answer nobody has given, which is what lets
    the same rules run over a half-finished draft without shouting at somebody
    still typing.
    """
    return (wert or "").strip() == ""


def wert_aus(antworten: Mapping[str, Any], pfad: str) -> str:
    """One answer out of the document, addressed by its dotted path.

    A walk rather than two fixed lookups, because a path is any depth the
    document has: part 1 already nests three deep at
    probestrecke.gewaesser.vorfluter1.

    Returns "" for anything missing, which ist_leer then reads as untouched.
    That is the same answer a present-but-empty field gives, and nothing on this
    form yet tells the two apart; typen.ts says so on the browser side.

    Anything that is not a string is also "". Every answer is a string on the way
    in, a half-typed number not being a number, so a value of another type came
    from somewhere that went round the form and there is nothing useful to say
    about it here. app/protokolle/regeln.py already refuses to store one.
    """
    aktuell: Any = antworten
    for teil in pfad.split("."):
        if not isinstance(aktuell, Mapping):
            return ""
        aktuell = aktuell.get(teil)
    return aktuell if isinstance(aktuell, str) else ""


def als_zahl(wert: str | None) -> float | None:
    """An answer read as a number, however it was written.

    A count is typed as "0" and a length can be "0", "0,0" or "0.0", since the
    form is German and the input is not. Whitespace survives a paste.

    None for blank and for anything that is not a number at all. The two are not
    told apart here because the callers disagree about what they mean: the
    equipment rules treat both as "no answer", while the catch table counts a
    blank cell as nothing and refuses to total a column holding a word. Each asks
    ist_leer first when it needs the difference.

    Infinity is refused deliberately. Python reads it out of "Infinity" and
    JavaScript's Number does the same, and it would then satisfy every upper
    bound any rule sets. The browser half guards it with Number.isFinite.
    """
    roh = (wert or "").strip().replace(",", ".")
    if roh == "":
        return None
    try:
        zahl = float(roh)
    except ValueError:
        return None
    return zahl if math.isfinite(zahl) else None
