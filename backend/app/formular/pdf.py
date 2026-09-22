"""Reading the legacy Acrobat form: opening it, decoding it, walking its fields.

The mechanics that both halves of the PDF work need. `scripts/extract_form_definition.py`
has read this form since before the build started, to pull the option lists and
the field list out of it; feature 23 reads a filled-in copy of the same form to
import it, and 23e writes one back out. Those are three callers for one set of
mechanics, so they live here and nowhere else.

`decode` and `walk` were moved here from that script in feature 23a. They are
unchanged, and the script now imports them, because two copies of the walk would
be two answers to what a field is called, and every answer path in this
application is whatever the walk says it is.
"""

from collections.abc import Iterator
from io import BytesIO
from typing import Any

from pypdf import PasswordType, PdfReader
from pypdf._codecs import _pdfdoc_encoding
from pypdf.errors import DependencyError, PyPdfError
from pypdf.generic import ByteStringObject, DictionaryObject, TextStringObject

from app.formular.fehler import PdfGesperrt, PdfNichtLesbar, PdfOhneFormular


def oeffne(daten: bytes) -> PdfReader:
    """Open a form PDF held in memory, or refuse it with a reason.

    From bytes rather than a path: the import's copy arrives as an upload and
    never touches a disk, and the tests' copies are built in memory too.

    The empty password is tried on anything encrypted, because the form FFS
    distributes is encrypted and opens with it. That is not a lock being picked:
    the file carries no user password, and Acrobat opens it the same way for
    everybody who has ever filled one in.
    """
    try:
        leser = PdfReader(BytesIO(daten))
    except (PyPdfError, ValueError, OSError) as fehler:
        raise PdfNichtLesbar(str(fehler)) from fehler

    if leser.is_encrypted:
        try:
            ergebnis = leser.decrypt("")
        # Encryption this build of pypdf cannot handle is a file we cannot read,
        # not a file somebody has the password to, so it is not PdfGesperrt.
        except (PyPdfError, DependencyError, NotImplementedError, ValueError) as fehler:
            raise PdfNichtLesbar(str(fehler)) from fehler
        if ergebnis == PasswordType.NOT_DECRYPTED:
            raise PdfGesperrt("the file needs a password")

    try:
        katalog: Any = leser.trailer["/Root"].get_object()
        acroform: Any = katalog["/AcroForm"].get_object()
    except (KeyError, AttributeError, TypeError, PyPdfError) as fehler:
        raise PdfOhneFormular(str(fehler)) from fehler

    # An AcroForm with no field array is a scan somebody ran through a tool that
    # left the dictionary behind. Nothing to read either way.
    if "/Fields" not in acroform:
        raise PdfOhneFormular("the form carries no fields")

    return leser


def felder(leser: PdfReader) -> Iterator[tuple[str, DictionaryObject]]:
    """Every terminal field of an opened form, as (legacy path, field).

    The pairing with `oeffne` above: that one proves there is a form, this one
    reads it, and no caller has to know that the fields hang off the catalog's
    AcroForm dictionary.
    """
    katalog: Any = leser.trailer["/Root"].get_object()
    acroform: Any = katalog["/AcroForm"].get_object()
    yield from walk(acroform["/Fields"])


def decode(value: Any) -> str:
    """Decode a PDF text string.

    pypdf mis-decodes the PDFDocEncoded strings in this form, turning every
    umlaut into a replacement character, so the original bytes are decoded here
    instead.
    """
    if isinstance(value, ByteStringObject):
        raw = bytes(value)
    elif isinstance(value, TextStringObject):
        raw = value.get_original_bytes()
    else:
        return str(value)
    if raw.startswith(b"\xfe\xff"):
        return raw[2:].decode("utf-16-be")
    return "".join(_pdfdoc_encoding[byte] for byte in raw)


def walk(fields: Any, prefix: str = "") -> Iterator[tuple[str, DictionaryObject]]:
    """Yield every terminal field as (full legacy path, field dictionary).

    Names are assembled from the /T parts down the tree, which is what produces
    the dotted paths the legacy form uses, such as
    probestrecke.gewaesser.vorfluter1.
    """
    for ref in fields:
        field = ref.get_object()
        title = field.get("/T")
        name = f"{prefix}{decode(title)}" if title is not None else prefix.rstrip(".")
        kids = field.get("/Kids")
        # A radio group's kids are widget annotations, not fields: they have no
        # /T of their own. Only descend when the kids are real child fields.
        if kids and any(kid.get_object().get("/T") is not None for kid in kids):
            yield from walk(kids, f"{name}.")
        else:
            yield name, field
