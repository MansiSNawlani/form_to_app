"""Finding or creating the three records a submitted protocol points at.

The database half of this package. regeln.py turned the answers into typed values
and comparison keys without touching a session; this takes those and answers the
only question that needs the database: is any of this already on record?

**Read or create, never update.** There is no UPDATE in this module and there is
not meant to be one. A protocol is an official survey record on its way to FiaKa,
so anything an accepted one points at has to be as fixed as the protocol itself,
and that includes the shared rows it merely references rather than only its own
answers. Decided on 2026-09-11, after a first draft that would have refreshed a
Person's contact details and stamped a Monitoringstrecken-Nr. onto a stretch that
had none. Both write to rows other protocols already point at.

The cost is duplicates: a typo makes a second water body, and a stretch that
gains a number gains a second record. That cost is paid deliberately. Feature 18
brings the official water body dataset, which is the first point at which two
records can be merged correctly, and merging is a step a person runs rather than
something that happens quietly at submit.

**Nothing here is a protocol.** Two submissions pointing at one Probestrecke stay
two entirely separate submissions, with their own answers, Bearbeiter, Anlass and
catch. What they share is the statement that they were carried out in the same
place, which is the whole of ADR 0001 and what lets feature 12 ask a stretch for
its history.

No commit. Unlike app/protokolle/dienst.py, which commits because the caller
asked for a draft to exist, this is half of one action: 11c runs the rules, calls
this, writes the envelope onto the submission and commits the lot. Committing
here would leave a Probestrecke behind if the submission that needed it then
failed.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benutzer import User
from app.models.gewaesser import Gewaesser
from app.models.person import Person
from app.models.probestrecke import Probestrecke
from app.protokolle.zuordnung.regeln import (
    Gewaesserangaben,
    Personenangaben,
    Probestreckenangaben,
    Umschlag,
    normalisiert,
)


@dataclass(frozen=True, slots=True)
class Zuordnung:
    """What the protocol turned out to point at.

    gewaesser_id is not a column on submissions; it is reachable through the
    stretch. It is returned because a caller asserting on the matching should not
    have to load a second row to see whether the water was shared.
    """

    gewaesser_id: uuid.UUID
    probestrecke_id: uuid.UUID
    person_id: uuid.UUID


async def ordne_zu(session: AsyncSession, umschlag: Umschlag, konto: User) -> Zuordnung:
    """The three ids this protocol belongs to, creating what is not there yet.

    Order matters: the Gewaesser has to exist before a Probestrecke can point at
    it. Nothing is committed, so a failure anywhere leaves the caller's
    transaction to roll the whole set back.
    """
    gewaesser = await _gewaesser(session, umschlag.gewaesser)
    strecke = await _probestrecke(session, umschlag.probestrecke, gewaesser.id)
    person = await _person(session, umschlag.person, konto)

    return Zuordnung(gewaesser_id=gewaesser.id, probestrecke_id=strecke.id, person_id=person.id)


async def _gewaesser(session: AsyncSession, angaben: Gewaesserangaben) -> Gewaesser:
    """The water this protocol names, matched on its name and its whole chain.

    Compared after normalising and stored as typed, which is the rule defect 2
    exists to enforce.

    **The name is matched in SQL and the chain in Python**, which is a deliberate
    split rather than an unfinished one. lower() does not apply to a text array,
    so normalising the chain in SQL means unnesting it with ordinality and
    rebuilding it in a correlated subquery: a good deal of machinery to filter a
    result set that the name has already reduced to nothing, one row, or the
    handful of Muehlbaeche that share a spelling. The name predicate is the
    selective one; the chain decides between what it returns.

    The order is part of the identity and the comparison keeps it. Muehlbach into
    Neckar into Rhein is not Muehlbach into Rhein into Neckar.

    models/gewaesser.py records why no unique index backs this. The race it would
    close produces a duplicate, and duplicates are a cost this feature already
    accepts.
    """
    gleichnamige = await session.scalars(
        select(Gewaesser)
        .where(func.lower(func.btrim(Gewaesser.name)) == normalisiert(angaben.name))
        .where(func.cardinality(Gewaesser.vorfluter) == len(angaben.vorfluter))
    )
    for kandidat in gleichnamige:
        if [normalisiert(name) for name in kandidat.vorfluter] == list(angaben.schluessel[1:]):
            return kandidat

    neu = Gewaesser(id=uuid.uuid4(), name=angaben.name, vorfluter=list(angaben.vorfluter))
    session.add(neu)
    await session.flush()
    return neu


async def _probestrecke(
    session: AsyncSession, angaben: Probestreckenangaben, gewaesser_id: uuid.UUID
) -> Probestrecke:
    """The stretch, matched on its number where it has one and its ends where not.

    The two keys never cross, which the partial unique indexes on the table
    enforce and this mirrors. A protocol carrying a number never matches a
    stretch without one, even at identical coordinates.
    """
    if angaben.monitoringstrecke_nr is not None:
        bedingung = Probestrecke.monitoringstrecke_nr == angaben.monitoringstrecke_nr
    else:
        bedingung = (
            (Probestrecke.gewaesser_id == gewaesser_id)
            & (Probestrecke.monitoringstrecke_nr.is_(None))
            & (Probestrecke.untere_grenze_rechtswert == angaben.untere_grenze_rechtswert)
            & (Probestrecke.untere_grenze_hochwert == angaben.untere_grenze_hochwert)
            & (Probestrecke.obere_grenze_rechtswert == angaben.obere_grenze_rechtswert)
            & (Probestrecke.obere_grenze_hochwert == angaben.obere_grenze_hochwert)
        )

    treffer = await session.scalars(select(Probestrecke).where(bedingung).limit(1))
    if (gefunden := treffer.first()) is not None:
        # Deliberately returned as it stands. The length and the Ortsangabe this
        # protocol carries may differ, and the stored ones win: neither is part
        # of the key, and both are kept per protocol in its answers anyway.
        return gefunden

    neu = Probestrecke(
        id=uuid.uuid4(),
        gewaesser_id=gewaesser_id,
        monitoringstrecke_nr=angaben.monitoringstrecke_nr,
        ortsangabe=angaben.ortsangabe,
        gewaessertyp=angaben.gewaessertyp,
        laenge_m=angaben.laenge_m,
        untere_grenze_rechtswert=angaben.untere_grenze_rechtswert,
        untere_grenze_hochwert=angaben.untere_grenze_hochwert,
        obere_grenze_rechtswert=angaben.obere_grenze_rechtswert,
        obere_grenze_hochwert=angaben.obere_grenze_hochwert,
        regierungspraesidium=angaben.regierungspraesidium,
    )
    session.add(neu)
    await session.flush()
    return neu


async def _person(session: AsyncSession, angaben: Personenangaben, konto: User) -> Person:
    """The Bearbeiter, matched on the address and never written over.

    The six other fields are not compared and not refreshed. A second protocol
    arriving with a new telephone number reuses this row exactly as it is; the
    details that protocol was filed with live in its own answers document, so
    nothing is lost by leaving the row alone.

    The link to an account is set only when the Bearbeiter is the person filing.
    Often they are not: project-overview.md notes that submitters are frequently
    external consultants filing on somebody else's behalf.
    """
    treffer = await session.scalars(
        select(Person).where(func.lower(func.btrim(Person.email)) == angaben.schluessel).limit(1)
    )
    if (gefunden := treffer.first()) is not None:
        return gefunden

    neu = Person(
        id=uuid.uuid4(),
        name=angaben.name,
        email=angaben.email,
        firma=angaben.firma,
        strasse=angaben.strasse,
        plz=angaben.plz,
        ort=angaben.ort,
        telefon=angaben.telefon,
        user_id=konto.id if normalisiert(konto.email) == angaben.schluessel else None,
    )
    session.add(neu)
    await session.flush()
    return neu
