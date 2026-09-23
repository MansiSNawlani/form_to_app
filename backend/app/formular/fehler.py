"""Why a form file could not be opened, as types rather than strings.

The same arrangement as `app/protokolle/fehler.py` and `app/benutzer/fehler.py`:
these carry the facts and no wording, so `app/api/fehler_http.py` can turn them
into HTTP responses and feature 17 can translate them without touching the
reader.

Three separate refusals rather than one "bad file", because what the person
holding the file should do next is different in each case, and a message that
cannot say which one it is leaves them with nothing to try. That is the
project's standing rule for a user-facing error: name the thing, say what is
wrong in plain words, and say what to do instead.
"""


class PdfFehler(Exception):
    """Base for everything here, so a caller can catch the family.

    The filename is empty on the way out of this module and stays that way: a
    reader that takes bytes has never been told what the file was called. It is
    the import service that fills it in, once, for all of these at the point
    where the name is known, so that a refusal can open with the file it is
    about the way the attachment refusals already do.
    """

    dateiname: str = ""


class PdfNichtLesbar(PdfFehler):
    """Not a PDF at all, or one damaged past reading.

    An upload of the wrong file, or one truncated in transit. There is nothing
    to do but choose a different file, which is what the person is told.
    """


class PdfGesperrt(PdfFehler):
    """A PDF locked with a password we were not given.

    Kept apart from "not readable" deliberately. The file is fine and the person
    almost certainly knows the password, so the useful thing to say is "open it
    in Acrobat, save it without the password, and try again". Telling them the
    file is broken sends them looking for a file that is not broken.

    The Protokoll E-Befischung itself is encrypted, which is not this: it opens
    with an empty password, so anybody can read it and this never fires for it.
    """


class PdfOhneFormular(PdfFehler):
    """A PDF with no form fields in it.

    Almost always a scan or a print-to-PDF of the protocol rather than the
    Acrobat form. The answers were never in the file as data, so there is
    nothing to read out of it however long we look, and the person needs to be
    told that rather than shown an import with 540 empty fields.
    """
