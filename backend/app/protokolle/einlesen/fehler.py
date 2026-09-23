"""Why a file is not a protocol this application can import.

Facts, no wording, like `app/protokolle/fehler.py` and for the same reason:
`app/api/fehler_http.py` turns these into HTTP responses and feature 17
translates them, so a message written here could be translated nowhere.

Why a file could not be *opened at all* is `app/formular/fehler.py`. These are
the refusals for a file that opened fine and is not the thing we were handed it
as.

What these carry is a fact about the file itself, never an answer anybody typed.
The note at the top of `app/protokolle/fehler.py` explains why that line matters:
a message built out of a person's own data repeats it back into logs and
screens, and none of these can.
"""

from app.anlagen.fehler import sicherer_name


class EinleseFehler(Exception):
    """Base for everything here, so a caller can catch the family.

    Carries the name of the file it is about, for the reason `PdfFehler` gives:
    the refusal a person reads opens with the file they picked. Empty until the
    import service fills it in, because nothing that raises one of these below
    knows it.
    """

    dateiname: str = ""


class FormularversionFehlt(EinleseFehler):
    """The file does not say which form version it is.

    Its version field is gone, empty, or holds something that is not a version.

    Still a refusal even though the version is no longer what the import is held
    to. Every copy FFS has ever distributed stamps its own version into that
    field and marks it read-only, so a file without one has been through
    something other than Acrobat, and what the reader would be taking answers out
    of is no longer a document anybody can vouch for.
    """


class KeinBefischungsformular(EinleseFehler):
    """A PDF form, and not the Protokoll E-Befischung.

    Overwhelmingly the Protokoll Krebs, which FFS distributes alongside this one
    and which is feature 21.

    **Not "the wrong version".** Until 2026-09-22 this refusal was exactly that,
    and it turned away real protocols whose only fault was being filled in on a
    copy of the form somebody downloaded in 2023. What is refused now is a file
    whose fields are not this form's fields at all, which no copy of the
    Protokoll E-Befischung has ever been.

    Carries how many of our fields the file lacks, in its message and so in the
    log, because that is the difference between "somebody uploaded the crayfish
    form" and "FFS have changed a field name and our import is about to refuse
    everything". It is a count rather than the names: the names are ours and
    printing all 540 of them helps nobody read a log.
    """

    def __init__(self, fehlend: int) -> None:
        super().__init__(f"the file is missing {fehlend} of this form's fields")


class DateiZuGross(EinleseFehler):
    """The upload is past the size an imported protocol may be.

    Not a judgement about anybody's file. A real protocol with its map runs 1 to
    2 MB, so the cap is a safety valve: it is what stops a request holding an
    arbitrary amount of memory while it is read.

    Carries the cap rather than how much arrived. The read stops the moment the
    cap is passed, so what was counted is not what the file holds, and naming it
    would be a number we made up.

    What bounds the request body itself is the reverse proxy in front of the
    service, not this. By the time a handler runs the multipart body has already
    been parsed; this bounds what is read out of it and held.
    """

    def __init__(self, dateiname: str, hoechstens: int) -> None:
        super().__init__(f"the upload exceeds {hoechstens} bytes")
        self.dateiname = sicherer_name(dateiname)
        self.hoechstens = hoechstens
