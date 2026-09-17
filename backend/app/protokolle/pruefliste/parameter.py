"""What a search box and a page number mean, as values.

No SQLAlchemy and no database in here. The review queue's query is built from
these answers, and every one of them has a wrong answer available to it: a search
that matches everything, a page of nothing, a pager that says "Seite 1 von 0".
Keeping them as plain functions is what lets each be held to its promise without
a database, which is the arrangement coding-standards.md asks for.
"""

from datetime import date

#: What LIKE reads as "one character" and "any number of characters".
_PLATZHALTER = ("%", "_")

#: The character that takes a wildcard's meaning away, passed to ILIKE as its
#: ESCAPE. Doubled inside a search term for the reason maskiere_platzhalter
#: gives.
ESCAPE = "\\"

#: How many rows a request asks for when it does not say.
PRO_SEITE_STANDARD = 25

#: One row. A page of nothing would be a pager with no last page.
PRO_SEITE_MIN = 1

#: The most one request may ask for. The queue is read by a person a screenful at
#: a time, and the cap is what stops one request asking for every protocol FFS
#: has ever taken.
PRO_SEITE_MAX = 100

#: The years date() can express. Not a statement about how old a Befischung may
#: be: it is only what keeps jahresgrenzen from raising on a year nobody meant.
JAHR_MIN = date.min.year
JAHR_MAX = date.max.year


def maskiere_platzhalter(text: str) -> str:
    """One search term with LIKE's wildcards taken out of it.

    Without this, typing 50% into the search box matches every protocol in the
    database, because % means "anything". The surveyor sees a search box that
    ignores what they type.

    The escape character goes first, and the order is the whole point: masking %
    before \\ would escape the backslash this function had just added and turn
    \\% back into a wildcard.
    """
    maskiert = text.replace(ESCAPE, ESCAPE * 2)
    for zeichen in _PLATZHALTER:
        maskiert = maskiert.replace(zeichen, ESCAPE + zeichen)
    return maskiert


def suchbegriffe(suche: str | None) -> tuple[str, ...]:
    """A search box split into the words that each have to find something.

    Every term is required, and each may match any of the searched columns. That
    is what makes "Schussen Weissenau" find the row whose water is Schussen and
    whose Ortsangabe is Weissenau. Matching the typed string as one value would
    find nothing, since no single column holds both words, and the box would look
    broken to the one person most likely to try it.

    Whitespace only is the same as no search at all, so a box somebody tabbed
    through does not narrow the list to nothing.
    """
    if suche is None:
        return ()
    return tuple(suche.split())


def suchmuster(begriff: str) -> str:
    """One term as ILIKE is asked for it: anywhere inside the value.

    The surrounding % are the wildcards we mean. Anything the person typed is
    masked first, so theirs are not.
    """
    return f"%{maskiere_platzhalter(begriff)}%"


def begrenze_seite(seite: int) -> int:
    """A page number that exists. Pages are 1-based and there is none before."""
    return max(seite, 1)


def begrenze_pro_seite(pro_seite: int) -> int:
    """A page size between one row and the cap."""
    return min(max(pro_seite, PRO_SEITE_MIN), PRO_SEITE_MAX)


def versatz(seite: int, pro_seite: int) -> int:
    """How many rows to skip to reach this page."""
    return (begrenze_seite(seite) - 1) * begrenze_pro_seite(pro_seite)


def seitenzahl(gesamt: int, pro_seite: int) -> int:
    """How many pages a total makes, never fewer than one.

    An empty queue has one empty page, so the pager reads "Seite 1 von 1". Zero
    pages would be a count no page number could satisfy, and the screen would
    have to special-case it.
    """
    if pro_seite < PRO_SEITE_MIN:
        return 1
    return max(-(-gesamt // pro_seite), 1)


def jahresgrenzen(jahr: int) -> tuple[date, date]:
    """A year as the first and the last day of it.

    Two dates rather than an extract(year) on the column, because a comparison
    against a plain date column can use an index and a function over that column
    cannot. There is no index on datum today, and this is the shape that does not
    have to change on the day there is one.
    """
    return date(jahr, 1, 1), date(jahr, 12, 31)
