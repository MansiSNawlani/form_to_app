"""Every refusal this API can send has wording in both locale files, since 17e.

The browser writes a refusal in the language the person chose, from
fehler.server.<CODE> in frontend/src/i18n/locales/, and only falls back to the
German nachricht for a code it has no wording for. That fallback is meant for a
browser older than the API, not for a code somebody forgot. This file is how a
feature adding a refusal is told to write its wording.

Three things are held here, each through a refusal rendered by the real handler:

- the code has a key in de.json and in en.json
- every {{placeholder}} in either text is a value the refusal carries in werte,
  since the browser falls back to German rather than print a raw placeholder
- the German text, filled in, is the backend's own sentence word for word, so
  the two German copies cannot drift apart. ANTWORTEN_UNGUELTIG is the one
  exception, and the reason is in _BEWUSST_ANDERS below.

The locale files belong to the frontend. When it is not checked out beside the
backend, as in a container image, these skip and say what is missing.
"""

import json
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from fastapi import Request

from app.anlagen.fehler import (
    AnlageInhaltKeinBild,
    AnlagenartVoll,
    AnlageNichtGefunden,
    AnlageTypUnzulaessig,
    AnlageZuGross,
)
from app.api.fehler_http import (
    ANFRAGE_UNGUELTIG,
    ANLAGE_UEBERSETZUNG,
    ART_SATZ,
    EINLESE_UEBERSETZUNG,
    PROTOKOLL_UEBERSETZUNG,
    UEBERSETZUNG,
    UNBEKANNT,
    behandle_anlagenfehler,
    behandle_benutzerfehler,
    behandle_einlesefehler,
    behandle_protokollfehler,
)
from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
    LetzterSuperAdmin,
    NichtAngemeldet,
    RegierungspraesidiumAusserhalbBereich,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RolleFehlt,
    RollenLeer,
    SelbstEntzugUnzulaessig,
)
from app.demo.fehler import DemoAus, DemoNichtEingerichtet, DemoRolleUnzulaessig
from app.formular.fehler import PdfGesperrt, PdfNichtLesbar, PdfOhneFormular
from app.protokolle.einlesen.fehler import (
    DateiZuGross,
    FormularversionFehlt,
    KeinBefischungsformular,
)
from app.protokolle.fehler import (
    AntwortenNichtLesbar,
    AntwortenUngueltig,
    AntwortenZuGross,
    BegruendungFehlt,
    EigenesProtokoll,
    ProtokollNichtGefunden,
    ProtokollNichtLoeschbar,
    ProtokollNichtMehrEntwurf,
    ProtokollUnvollstaendig,
    ProtokollVeraendert,
    UebergangNichtMoeglich,
    Verstoss,
    Verstossgrund,
)
from app.security.passwoerter import PasswortZuKurz, PasswortZuLang

LOCALES = Path(__file__).resolve().parents[3] / "frontend" / "src" / "i18n" / "locales"

pytestmark = pytest.mark.skipif(
    not (LOCALES / "de.json").is_file(),
    reason=f"Die Sprachdateien des Frontends fehlen: {LOCALES} ist nicht ausgecheckt.",
)

# The same reading of a {{placeholder}} as platzhalter in frontend/src/api/fehler.ts.
PLATZHALTER = re.compile(r"\{\{\s*([^}\s,]+)[^}]*\}\}")

ANFRAGE = Request({"type": "http", "method": "GET", "path": "/", "headers": []})

# Lists the paths without the reason per group, which the German sentence gives.
# It asks the person to report a fault in the application, so the reasons are for
# whoever reads the report, and they are in nachricht and in the log.
_BEWUSST_ANDERS = {"ANTWORTEN_UNGUELTIG"}


def _mit_namen[T: Exception](fehler: T, dateiname: str = "Protokoll.pdf") -> T:
    """The import service fills the file name in afterwards; so does this."""
    fehler.dateiname = dateiname  # type: ignore[attr-defined]
    return fehler


# One real refusal per code. A code in the tables with no case here fails
# test_jeder_code_ist_hier_vertreten, so this list cannot quietly fall behind.
FAELLE: list[tuple[Exception, Any]] = [
    (AnmeldungFehlgeschlagen(), behandle_benutzerfehler),
    (NichtAngemeldet(), behandle_benutzerfehler),
    (RolleFehlt(("REVIEWER",)), behandle_benutzerfehler),
    (KontoDeaktiviert(), behandle_benutzerfehler),
    (KontoNichtInteraktiv(), behandle_benutzerfehler),
    (EmailUngueltig("anna", "kein @"), behandle_benutzerfehler),
    (EmailBereitsVergeben("anna@ffs.de"), behandle_benutzerfehler),
    (RollenLeer(), behandle_benutzerfehler),
    (RegierungspraesidiumFehlt(), behandle_benutzerfehler),
    (RegierungspraesidiumUnzulaessig(2), behandle_benutzerfehler),
    (RegierungspraesidiumAusserhalbBereich(7), behandle_benutzerfehler),
    (PasswortZuKurz(), behandle_benutzerfehler),
    (PasswortZuLang(), behandle_benutzerfehler),
    (BenutzerNichtGefunden("anna@ffs.de"), behandle_benutzerfehler),
    (LetzterSuperAdmin(), behandle_benutzerfehler),
    (SelbstEntzugUnzulaessig(), behandle_benutzerfehler),
    (DemoAus(), behandle_benutzerfehler),
    (DemoRolleUnzulaessig(), behandle_benutzerfehler),
    (DemoNichtEingerichtet(), behandle_benutzerfehler),
    (ProtokollNichtGefunden(uuid.uuid4()), behandle_protokollfehler),
    (ProtokollVeraendert(3, 4), behandle_protokollfehler),
    (ProtokollNichtMehrEntwurf("SUBMITTED"), behandle_protokollfehler),
    (AntwortenNichtLesbar(), behandle_protokollfehler),
    (AntwortenZuGross(250_000, 200_000), behandle_protokollfehler),
    (
        AntwortenUngueltig((Verstoss("erfunden", Verstossgrund.UNBEKANNT),)),
        behandle_protokollfehler,
    ),
    (ProtokollUnvollstaendig(()), behandle_protokollfehler),
    (ProtokollNichtLoeschbar("SUBMITTED"), behandle_protokollfehler),
    (UebergangNichtMoeglich("annehmen", "DRAFT"), behandle_protokollfehler),
    (BegruendungFehlt("ablehnen"), behandle_protokollfehler),
    (EigenesProtokoll("annehmen"), behandle_protokollfehler),
    (AnlageNichtGefunden(), behandle_anlagenfehler),
    (AnlageTypUnzulaessig("foto.heic", "image/heic"), behandle_anlagenfehler),
    (AnlageInhaltKeinBild("foto.jpg"), behandle_anlagenfehler),
    (AnlageZuGross("foto.jpg", 11 * 1024 * 1024, 10 * 1024 * 1024), behandle_anlagenfehler),
    (AnlageZuGross("foto.jpg", 600 * 1024, 512 * 1024), behandle_anlagenfehler),
    (AnlagenartVoll("foto.jpg", "FOTO", 20, 20), behandle_anlagenfehler),
    (AnlagenartVoll("karte.png", "KARTENAUSSCHNITT", 1, 1), behandle_anlagenfehler),
    (_mit_namen(PdfNichtLesbar()), behandle_einlesefehler),
    (_mit_namen(PdfGesperrt()), behandle_einlesefehler),
    (_mit_namen(PdfOhneFormular()), behandle_einlesefehler),
    (_mit_namen(KeinBefischungsformular(540)), behandle_einlesefehler),
    (_mit_namen(FormularversionFehlt()), behandle_einlesefehler),
    (DateiZuGross("Protokoll.pdf", 20 * 1024 * 1024), behandle_einlesefehler),
]


def _server_texte(datei: str) -> dict[str, str]:
    texte: dict[str, str] = json.loads((LOCALES / datei).read_text(encoding="utf-8"))["fehler"][
        "server"
    ]
    return texte


def _platzhalter(text: str) -> set[str]:
    return set(PLATZHALTER.findall(text))


def _ausgefuellt(text: str, werte: dict[str, Any]) -> str:
    """The German text as the browser renders it.

    A float is a megabyte count, which i18next's number format prints the way
    _megabyte in fehler_http.py does: no ",0" on a round number, a comma otherwise.
    """

    def wert(treffer: re.Match[str]) -> str:
        roh = werte[treffer.group(1)]
        return f"{roh:g}".replace(".", ",") if isinstance(roh, float) else str(roh)

    return PLATZHALTER.sub(wert, text)


async def _koerper(fehler: Exception, handler: Any) -> dict[str, Any]:
    antwort = await handler(ANFRAGE, fehler)
    koerper: dict[str, Any] = json.loads(bytes(antwort.body))
    return koerper


def _schluessel(koerper: dict[str, Any]) -> str:
    """The key the browser looks up: ANLAGENART_VOLL picks its sentence by art."""
    art = koerper.get("werte", {}).get("art")
    return f"{koerper['code']}_{art}" if art else str(koerper["code"])


def test_jeder_code_ist_hier_vertreten() -> None:
    in_tabellen: set[type[Exception]] = {
        *UEBERSETZUNG,
        *PROTOKOLL_UEBERSETZUNG,
        *ANLAGE_UEBERSETZUNG,
        *EINLESE_UEBERSETZUNG,
    }

    assert in_tabellen - {type(fehler) for fehler, _ in FAELLE} == set()
    assert {fehler.art for fehler, _ in FAELLE if isinstance(fehler, AnlagenartVoll)} == set(
        ART_SATZ
    )


@pytest.mark.parametrize("datei", ["de.json", "en.json"])
@pytest.mark.parametrize(("fehler", "handler"), FAELLE, ids=lambda f: type(f).__name__)
async def test_jede_absage_hat_einen_wortlaut(fehler: Exception, handler: Any, datei: str) -> None:
    koerper = await _koerper(fehler, handler)
    texte = _server_texte(datei)
    schluessel = _schluessel(koerper)

    assert schluessel in texte, f"fehler.server.{schluessel} fehlt in {datei}"
    assert _platzhalter(texte[schluessel]) <= set(koerper.get("werte", {})), schluessel


@pytest.mark.parametrize("datei", ["de.json", "en.json"])
@pytest.mark.parametrize("allgemein", [UNBEKANNT, ANFRAGE_UNGUELTIG], ids=lambda f: f[0])
def test_die_allgemeinen_absagen_haben_einen_wortlaut(
    allgemein: tuple[str, int, str], datei: str
) -> None:
    """Neither carries values, so neither text may ask for one."""
    texte = _server_texte(datei)

    assert allgemein[0] in texte
    assert _platzhalter(texte[allgemein[0]]) == set()


@pytest.mark.parametrize(("fehler", "handler"), FAELLE, ids=lambda f: type(f).__name__)
async def test_der_deutsche_wortlaut_ist_der_des_backends(fehler: Exception, handler: Any) -> None:
    koerper = await _koerper(fehler, handler)
    if koerper["code"] in _BEWUSST_ANDERS:
        pytest.skip("bewusst anders formuliert, siehe _BEWUSST_ANDERS")

    text = _server_texte("de.json")[_schluessel(koerper)]

    assert _ausgefuellt(text, koerper.get("werte", {})) == koerper["nachricht"]


@pytest.mark.parametrize("allgemein", [UNBEKANNT, ANFRAGE_UNGUELTIG], ids=lambda f: f[0])
def test_die_allgemeinen_deutsch_wie_im_backend(allgemein: tuple[str, int, str]) -> None:
    assert _server_texte("de.json")[allgemein[0]] == allgemein[2]
