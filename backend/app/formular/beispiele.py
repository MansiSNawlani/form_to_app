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

Nothing in the running application reads these. A deployment has the form
definition in `database/seed/`, which is where `felder.py` looks.
"""

from pathlib import Path

RESSOURCEN = Path(__file__).resolve().parents[3] / "Resources" / "Fiaka_Resources"

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
