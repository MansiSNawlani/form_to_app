"""One uploaded file, turned into a draft this account owns.

Where 23a's reader meets the database. The reader is plain functions over bytes;
this is what makes their result into a protocol somebody can open, and what runs
the form rules over it so the person is told what is still wrong with it.

No HTTP. `app/api/protokolle.py` is what turns the refusals below into responses
and this into a 201, exactly as every other route there delegates.

**Nothing here judges whether the protocol is good enough.** `pruefe_protokoll`
already says what is wrong with an answers document, and this calls it and passes
the answer on. An import is never refused for its contents, only for not being a
readable protocol at all: an imported protocol lands as a draft with its problems
listed, never as a submission.
"""

import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.anlagen.fehler import sicherer_name
from app.formular.fehler import PdfFehler
from app.models.benutzer import User
from app.models.protokoll import Submission
from app.protokolle.dienst import neuer_entwurf, uebernimm_antworten
from app.protokolle.einlesen.antworten import Einleseergebnis
from app.protokolle.einlesen.fehler import EinleseFehler
from app.protokolle.einlesen.protokoll import lies_protokoll
from app.protokolle.formregeln import pruefe_protokoll
from app.protokolle.formregeln.regel import Formverstoss

LOG = logging.getLogger(__name__)

# A real protocol with its map runs 1 to 2 MB, so this is a safety valve rather
# than a judgement about anybody's file: what it bounds is how much memory one
# request may hold while it is read. What bounds the request body itself is the
# reverse proxy, which is where a refusal before anything is spooled belongs.
MAX_PDF_BYTES = 25 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class Einlesebericht(Einleseergebnis):
    """What an import produced, beyond the protocol itself.

    23a's Einleseergebnis with one thing added. Written as an extension rather
    than as a second dataclass because three of its four fields would otherwise
    be the reader's own, declared and commented twice; the review of 23a caught
    exactly that duplication once already. `version` here is the version the
    **file** declared, which is deliberately not the version the protocol
    carries.
    """

    #: Everything the rules say is wrong or missing, exactly as Absenden reports
    #: it: a path and an i18n key the browser already knows how to translate.
    #: Empty is a real answer and means the protocol is ready to submit.
    verstoesse: tuple[Formverstoss, ...] = ()


async def importiere(
    session: AsyncSession, *, daten: bytes, dateiname: str, besitzer: User
) -> tuple[Submission, Einlesebericht]:
    """One uploaded file, as a new draft belonging to this account, and its report.

    In this order, and the order is what makes the promise below true:

    1. Read the file. Everything that can refuse the upload refuses it here,
       before a row exists.
    2. Create the draft and put the answers in, in **one** transaction.
    3. Run the form rules over what was stored, and report what they say.

    **Nothing is written when the file cannot be read**, and that is a stronger
    promise than it looks. `lege_entwurf_an` and `speichere_antworten` each commit
    on their own, so creating a draft and then filling it would leave an empty
    protocol behind whenever the second half failed. This calls the halves of
    those two that neither look anything up nor commit, so a failure anywhere
    leaves the session's transaction to be rolled back with nothing in it.

    **The draft is written even when the rules have plenty to say.** A protocol
    with problems is exactly what an import produces, and the report is how the
    person is told about them.

    **The protocol is stamped with this deployment's form version, never the
    file's.** Every import is a new survey, held to today's rules, rather than a
    historical record being preserved: `neuer_entwurf` already does that, and the
    version the file declared travels in the report instead.

    The filename is carried for one purpose: a refusal opens with the file it is
    about. The reader takes bytes and has never known what the upload was called,
    so this is where the name is put onto whatever it raised, once, rather than
    threaded through four modules that have no other use for it. A filename is
    the person's own and may be echoed back; nothing else from the file ever is.
    """
    try:
        lesung = lies_protokoll(daten)
    except (PdfFehler, EinleseFehler) as fehler:
        fehler.dateiname = sicherer_name(dateiname)
        raise

    entwurf = neuer_entwurf(besitzer)
    session.add(entwurf)
    # Flushed rather than committed, so the row has its id and its version 1 for
    # the save path below to check against without the transaction ending here.
    await session.flush()

    uebernimm_antworten(entwurf, antworten=lesung.antworten, version=entwurf.version)
    await session.commit()

    _melde_unbekannte(entwurf.id, lesung.unbekannt)

    return entwurf, Einlesebericht(
        version=lesung.version,
        antworten=lesung.antworten,
        unbekannt=lesung.unbekannt,
        unbrauchbar=lesung.unbrauchbar,
        bilder=lesung.bilder,
        verstoesse=tuple(pruefe_protokoll(entwurf.antworten)),
    )


def _melde_unbekannte(protokoll_id: UUID, unbekannt: tuple[str, ...]) -> None:
    """Fields the file held that this application has no home for.

    **Logged and not shown.** A field we cannot place means our form definition
    and the file disagree, which is our problem rather than something the person
    uploading can act on: there is no answer they could give to "this form has a
    field we have never heard of". This project's rule is that a message somebody
    sees has to tell them what to do, so this one goes where the people who can
    do something about it will find it.

    It matters enough to be a warning rather than a note. One of these is a
    curiosity; the same name turning up on every import is FFS having changed the
    form, which is feature 11's stored definitions arriving whether anybody
    planned them or not.

    The names only, never the values. They are our own field paths, so printing
    them cannot repeat anything a surveyor typed, which is the line
    `app/protokolle/fehler.py` draws for every message in this application.
    """
    if unbekannt:
        LOG.warning(
            "Import %s: the file carries %d field(s) this form version has no home for: %s",
            protokoll_id,
            len(unbekannt),
            ", ".join(unbekannt),
        )
