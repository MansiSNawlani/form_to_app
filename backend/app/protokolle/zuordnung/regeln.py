"""Reading a finished protocol into the values its envelope needs.

The answers document holds everything as text, because every control on the form
writes a string and a half-typed number is not a number. The columns added in
feature 11b hold dates, times and integers. This module is the crossing between
the two, and it is a plain function from a document to typed values: no session,
no HTTP, nothing German, in keeping with coding-standards.md.

**Compare loosely, store faithfully.** Every name here is carried through exactly
as it was typed, and compared after normalising. Defect 2 in
docs/ffs-defect-list.md is the legacy form lowercasing water body names, one of
the three defects that put wrong data into FiaKa, and the fix is not to lowercase
at the other end of the pipe but to stop lowercasing what is stored at all.
formregeln/vorfluter.py already works this way.

**Refused, never guessed at.** A value that is not the type the column needs
raises rather than being interpreted. "09.06.2026" could be the 9th of June or
the 6th of September, and choosing on somebody's behalf puts silently wrong data
into a state database. The form's pickers cannot produce any of these, so a
document holding one reached us round the form.

This runs after formregeln/vollstaendigkeit.py has passed, which 11c arranges, so
a missing required answer here is a bug rather than an unfinished protocol. It
still refuses loudly: the rows this feeds are shared between protocols, and half
of one is worse than none.
"""

import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, time
from typing import Any

from app.models.probestrecke import GEWAESSERTYPEN, REGIERUNGSPRAESIDIEN
from app.protokolle.fehler import UmschlagUnvollstaendig
from app.protokolle.formregeln.regel import ist_leer, wert_aus
from app.protokolle.formregeln.vorfluter import VORFLUTER_PFADE

# The pickers' own formats, which FeldDatum.tsx writes into the document.
DATUM = re.compile(r"^\d{4}-\d{2}-\d{2}$")
UHRZEIT = re.compile(r"^\d{2}:\d{2}$")

# Digits and nothing else. Not als_zahl from regel.py, which reads "450,5" and
# "4.5e2" because a catch count and a conductivity reading are numbers in a
# looser sense. These four are metres and a count of metres, and a decimal point
# in one means the value came from somewhere that was not the form.
GANZE_ZAHL = re.compile(r"^\d+$")

ANLASS = "anlass"
DATUM_PFAD = "datum"
UHRZEIT_PFAD = "messdaten.uhrzeit"
RP_PFAD = "z.rp"

BEARBEITER_NAME = "bearbeiter.name"
BEARBEITER_EMAIL = "bearbeiter.email"
#: The five that carry no asterisk on the form and so may be absent here.
BEARBEITER_OPTIONAL = ("firma", "strasse", "plz", "ort", "telefon")

GEWAESSERNAME = "probestrecke.gewaesser.gewaessername"
ORTSANGABE = "probestrecke.ortsangabe"
GEWAESSERTYP = "probestrecke.gewaessertyp"
LAENGE = "probestrecke.laenge"
MONITORINGNUMMER = "probestrecke.monitoringnummer"

# In the order the columns are named, so a swapped pair would be visible here
# rather than only in the data months later.
KOORDINATEN_PFADE = (
    "probestrecke.utm_rw_unten",
    "probestrecke.utm_hw_unten",
    "probestrecke.utm_rw_oben",
    "probestrecke.utm_hw_oben",
)


def normalisiert(wert: str) -> str:
    """A name reduced to what two spellings of it have in common.

    For comparison only. Nothing written to the database goes through here.

    **Exactly lower(btrim(x)), and deliberately no more.** The same normalisation
    has to hold in three places: this function, the WHERE clause in dienst.py,
    and the unique index on personen.email. Postgres is the one that cannot be
    changed freely, because an index expression must be immutable, so Python
    matches SQL rather than the other way round.

    That rules out casefold, which would fold the German sharp s and make
    "Weißach" and "Weissach" one water. lower() leaves it alone, so they are two.
    Treating them as one here while the index treated them as two would be worse
    than either answer on its own: the lookup and the constraint would disagree
    about what a duplicate is. A sharp s spelled two ways is the same class of
    duplicate as a typo, which this feature already accepts and feature 18
    merges.
    """
    return wert.strip().lower()


@dataclass(frozen=True, slots=True)
class Gewaesserangaben:
    """The water, as this protocol describes it."""

    name: str
    vorfluter: tuple[str, ...]

    @property
    def schluessel(self) -> tuple[str, ...]:
        """What decides whether this is a water already on record.

        The name together with the whole chain. The name alone is not an
        identity: Baden-Wuerttemberg has many a Muehlbach, and the authoritative
        identifier that would settle it, Gewaesser.amtliche_id, stays empty until
        feature 18. The chain is what places the water in the drainage network,
        so a Muehlbach flowing to the Neckar and one flowing to the Iller are two
        waters.
        """
        return (normalisiert(self.name), *(normalisiert(name) for name in self.vorfluter))


@dataclass(frozen=True, slots=True)
class Probestreckenangaben:
    """The stretch, as this protocol describes it."""

    monitoringstrecke_nr: str | None
    ortsangabe: str
    gewaessertyp: int
    laenge_m: int
    untere_grenze_rechtswert: int
    untere_grenze_hochwert: int
    obere_grenze_rechtswert: int
    obere_grenze_hochwert: int
    regierungspraesidium: int

    @property
    def koordinaten(self) -> tuple[int, int, int, int]:
        return (
            self.untere_grenze_rechtswert,
            self.untere_grenze_hochwert,
            self.obere_grenze_rechtswert,
            self.obere_grenze_hochwert,
        )

    @property
    def schluessel(self) -> tuple[object, ...]:
        """What decides whether this is a stretch already on record.

        The Monitoringstrecken-Nr. when the protocol carries one, because it is
        officially assigned and stable. Otherwise both boundaries: two ends on
        one water are the stretch.

        **The two never cross**, which is why the discriminator is in the tuple.
        A protocol carrying a number does not attach to an identically placed
        stretch that has none. Decided on 2026-09-11: stamping the number onto
        the existing row would write to something already-accepted protocols
        point at, and nothing in this feature ever does that.

        Not the water. The caller pairs this with the Gewaesser it resolved,
        which is what the unique index on the table does too.
        """
        if self.monitoringstrecke_nr is not None:
            return ("nr", normalisiert(self.monitoringstrecke_nr))
        return ("koordinaten", *self.koordinaten)


@dataclass(frozen=True, slots=True)
class Personenangaben:
    """The Bearbeiter, as this protocol describes them."""

    name: str
    email: str
    firma: str | None
    strasse: str | None
    plz: str | None
    ort: str | None
    telefon: str | None

    @property
    def schluessel(self) -> str:
        """The address, which is the identity. See models/person.py on why the
        other six are not part of it and are never written over."""
        return normalisiert(self.email)


@dataclass(frozen=True, slots=True)
class Umschlag:
    """Everything a submission leaving DRAFT needs, read out of its answers.

    The three nested groups become rows; the four scalars become columns on the
    submission itself. Nothing here writes anything: app/protokolle/zuordnung/
    dienst.py turns this into ids, and 11c puts them on the submission.
    """

    anlass: str
    datum: date
    uhrzeit: time
    bearbeiter_name: str
    gewaesser: Gewaesserangaben
    probestrecke: Probestreckenangaben
    person: Personenangaben


class _Leser:
    """One pass over the document, collecting what is wrong as it goes.

    A class rather than a chain of functions because every read can fail the same
    way and the failures are reported together. A client whose document is
    missing one value is usually missing several, and reporting them one submit
    at a time turns a five minute fix into an afternoon; AntwortenUngueltig
    already works this way for the same reason.
    """

    def __init__(self, antworten: Mapping[str, Any]) -> None:
        self._antworten = antworten
        self._fehlend: list[str] = []

    def text(self, pfad: str) -> str:
        wert = wert_aus(self._antworten, pfad)
        if ist_leer(wert):
            self._fehlend.append(pfad)
            return ""
        return wert

    def optional(self, pfad: str) -> str | None:
        wert = wert_aus(self._antworten, pfad)
        return None if ist_leer(wert) else wert

    def ganze_zahl(self, pfad: str, *, erlaubt: tuple[int, ...] | None = None) -> int:
        """A whole number, optionally one of a known set.

        erlaubt carries the Gewaessertyp codes and the four Regierungspraesidien.
        Both are check constraints on the table as well; refusing here is what
        turns a database error nobody can act on into a named path.
        """
        roh = self.text(pfad)
        if not roh:
            return 0
        if not GANZE_ZAHL.match(roh.strip()):
            return self._abgelehnt(pfad)

        wert = int(roh.strip())
        if erlaubt is not None and wert not in erlaubt:
            return self._abgelehnt(pfad)
        return wert

    def laenge(self, pfad: str) -> int:
        """Metres. A stretch of no length was not fished."""
        wert = self.ganze_zahl(pfad)
        return self._abgelehnt(pfad) if wert == 0 and pfad not in self._fehlend else wert

    def datum(self, pfad: str) -> date:
        roh = self.text(pfad).strip()
        if not roh:
            return date.min
        if not DATUM.match(roh):
            return self._abgelehnt(pfad, date.min)
        try:
            return date.fromisoformat(roh)
        except ValueError:
            # The pattern passes 2026-13-45; only the calendar knows better.
            return self._abgelehnt(pfad, date.min)

    def uhrzeit(self, pfad: str) -> time:
        roh = self.text(pfad).strip()
        if not roh:
            return time.min
        if not UHRZEIT.match(roh):
            return self._abgelehnt(pfad, time.min)
        try:
            return time.fromisoformat(roh)
        except ValueError:
            return self._abgelehnt(pfad, time.min)

    def _abgelehnt[T](self, pfad: str, ersatz: T = 0) -> T:  # type: ignore[assignment]
        """Record the path and hand back a placeholder.

        The placeholder is never used: fertig() raises before anything built from
        it is returned. It exists so one bad value does not stop the pass and hide
        the other four.
        """
        self._fehlend.append(pfad)
        return ersatz

    def fehlt(self, pfad: str) -> None:
        """Record a path the caller decided was missing.

        For the Vorfluter chain, whose emptiness is a fact about the whole chain
        rather than about any one read.
        """
        self._fehlend.append(pfad)

    def fertig(self) -> None:
        if self._fehlend:
            raise UmschlagUnvollstaendig(tuple(self._fehlend))


def lies_umschlag(antworten: Mapping[str, Any]) -> Umschlag:
    """The envelope this protocol carries, or a named list of what stopped it."""
    leser = _Leser(antworten)

    gewaesser = Gewaesserangaben(
        name=leser.text(GEWAESSERNAME),
        vorfluter=_kette(antworten, leser),
    )
    probestrecke = Probestreckenangaben(
        monitoringstrecke_nr=leser.optional(MONITORINGNUMMER),
        ortsangabe=leser.text(ORTSANGABE),
        gewaessertyp=leser.ganze_zahl(GEWAESSERTYP, erlaubt=GEWAESSERTYPEN),
        laenge_m=leser.laenge(LAENGE),
        untere_grenze_rechtswert=leser.ganze_zahl(KOORDINATEN_PFADE[0]),
        untere_grenze_hochwert=leser.ganze_zahl(KOORDINATEN_PFADE[1]),
        obere_grenze_rechtswert=leser.ganze_zahl(KOORDINATEN_PFADE[2]),
        obere_grenze_hochwert=leser.ganze_zahl(KOORDINATEN_PFADE[3]),
        regierungspraesidium=leser.ganze_zahl(RP_PFAD, erlaubt=REGIERUNGSPRAESIDIEN),
    )
    person = Personenangaben(
        name=leser.text(BEARBEITER_NAME),
        email=leser.text(BEARBEITER_EMAIL),
        **{feld: leser.optional(f"bearbeiter.{feld}") for feld in BEARBEITER_OPTIONAL},
    )
    umschlag = Umschlag(
        anlass=leser.text(ANLASS),
        datum=leser.datum(DATUM_PFAD),
        uhrzeit=leser.uhrzeit(UHRZEIT_PFAD),
        bearbeiter_name=person.name,
        gewaesser=gewaesser,
        probestrecke=probestrecke,
        person=person,
    )

    leser.fertig()
    return umschlag


def _kette(antworten: Mapping[str, Any], leser: _Leser) -> tuple[str, ...]:
    """The Vorfluter chain, as typed, without its trailing empty boxes.

    Five boxes with two filled in is a chain of two. Not sorted and not
    deduplicated: the order is the chain, and a name repeated in it is
    formregeln/vorfluter.py's business rather than this module's.

    Trailing blanks are dropped. A blank left anywhere before the end is a gap,
    and the box it sits in is named rather than quietly closed up: a chain
    shortened here would be written to the database as a different chain from the
    one somebody typed, which is a different water. vorfluter.py reports the same
    gap with a message beside the field, and 11c runs it first; this is the gate
    under it.
    """
    kette = [wert_aus(antworten, pfad) for pfad in VORFLUTER_PFADE]
    while kette and ist_leer(kette[-1]):
        kette.pop()

    if not kette:
        leser.fehlt(VORFLUTER_PFADE[0])
        return ()

    for pfad, name in zip(VORFLUTER_PFADE, kette, strict=False):
        if ist_leer(name):
            leser.fehlt(pfad)

    return tuple(kette)
