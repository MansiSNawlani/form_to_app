"""The real form files, for tests.

Every test that reads a PDF in this project reads one of the protocol forms
committed under `Resources/Fiaka_Resources/`, because a hand-built stand-in
would prove only that we can read a PDF we wrote. The paths are resolved once
here rather than in each test file, which otherwise each count the directories
back up to the repository root and get it wrong when a module moves.

Here rather than in a test file for the same reason
`app/protokolle/formregeln/beispiele.py` is: several test modules in different
packages need the same material, and the import path has to be sayable from all
of them.

**Nothing in the running application reads this module**, and nothing may. The
paths below resolve in a source checkout and nowhere else: inside the container
the package sits in site-packages, with no repository around it. That is the same
caveat `app/config.py` carries for `REPO_WURZEL`, which is imported here rather
than worked out a second time, and it is why the Dockerfile hands the seed
directory to the application through an environment variable instead.
"""

from collections.abc import Mapping
from io import BytesIO
from typing import Any

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, NameObject

from app.config import REPO_WURZEL

RESSOURCEN = REPO_WURZEL / "Resources" / "Fiaka_Resources"

#: The form this application replaces, and the one the import reads.
FORMULAR_PDF = RESSOURCEN / "Formular_Protokoll_E-Befischung_V20260609.pdf"

#: A different protocol form: the crayfish one, deferred to feature 21. Real,
#: encrypted, and built by the same people, which makes it a far better "wrong
#: file" than anything we could construct.
KREBS_PDF = RESSOURCEN / "Formular_Protokoll_Krebs_V20230622.pdf"


def formular_bytes() -> bytes:
    """The blank E-Befischung form, as an upload would arrive."""
    return FORMULAR_PDF.read_bytes()


def krebs_bytes() -> bytes:
    """The blank Protokoll Krebs form."""
    return KREBS_PDF.read_bytes()


def _leser() -> PdfReader:
    leser = PdfReader(str(FORMULAR_PDF))
    leser.decrypt("")
    return leser


def gefuellt(werte: Mapping[str, str]) -> bytes:
    """The real form with those answers written into its own boxes.

    The nearest thing to a filled-in protocol that can be built without asking
    somebody for one of theirs. Radio and checkbox values are given the way the
    PDF holds them, with the leading slash: `{"probestrecke.gewaessertyp": "/13"}`.

    Known limit, and it is why this is a helper rather than a committed file: it
    is written by us, so it cannot prove that a protocol *Acrobat* saved reads the
    same way. What makes that survivable is that the values land in `/V` either
    way, which is what the reader looks at, and that the number conversion is
    written to be right whichever form the value is stored in.
    """
    schreiber = PdfWriter(clone_from=_leser())
    for seite in schreiber.pages:
        schreiber.update_page_form_field_values(seite, dict(werte), auto_regenerate=False)
    puffer = BytesIO()
    schreiber.write(puffer)
    return puffer.getvalue()


def ohne_feld(name: str) -> bytes:
    """The real form with one top-level field taken out of it.

    For the cases a filled copy cannot produce, such as a file that does not say
    which form version it is. Only top-level fields can go this way, which is
    enough: `version` is one.
    """
    schreiber = PdfWriter(clone_from=_leser())
    # Reaching for the writer's own catalog, which pypdf offers no public way to
    # edit. Acceptable here and nowhere else: this is test material, and the
    # alternative is committing a second PDF just to be missing one field.
    acroform: Any = schreiber._root_object["/AcroForm"]
    behalten = [ref for ref in acroform["/Fields"] if ref.get_object().get("/T") != name]
    if len(behalten) == len(acroform["/Fields"]):
        raise AssertionError(f"{name} is not a top-level field of this form")
    acroform[NameObject("/Fields")] = ArrayObject(behalten)
    puffer = BytesIO()
    schreiber.write(puffer)
    return puffer.getvalue()


def mit_bild(*namen: str) -> bytes:
    """The real form with a picture sitting in each of those slots.

    The legacy form holds a photograph as a push button's icon, in the widget's
    appearance dictionary under `/MK /I`, which is how a PDF form can carry an
    image at all. The blank form has no `/I` on any of the five slots, so its
    presence means somebody really put a picture there.

    What goes in is a minimal Form XObject rather than a photograph. Feature 23d
    is what reads the pixels out; all 23a does is count the slots that are
    filled, so a real JPEG here would prove nothing extra and would have to be
    committed or generated.
    """
    schreiber = PdfWriter(clone_from=_leser())
    acroform: Any = schreiber._root_object["/AcroForm"]
    gesucht = set(namen)

    for ref in acroform["/Fields"]:
        feld: Any = ref.get_object()
        if str(feld.get("/T")) != "fotos":
            continue
        for kind_ref in feld.get("/Kids", []):
            kind: Any = kind_ref.get_object()
            if f"fotos.{kind.get('/T')}" not in gesucht:
                continue
            symbol = DecodedStreamObject()
            symbol.set_data(b"")
            kind[NameObject("/MK")].update(
                {NameObject("/I"): schreiber._add_object(symbol)}
            )
            gesucht.discard(f"fotos.{kind.get('/T')}")

    if gesucht:
        raise AssertionError(f"not picture slots of this form: {sorted(gesucht)}")

    puffer = BytesIO()
    schreiber.write(puffer)
    return puffer.getvalue()
