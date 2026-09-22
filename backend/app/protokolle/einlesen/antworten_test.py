"""The values of a filled-in form, as an answers document.

Against a copy of the real form with values written into its real boxes, which
is as close to a filled protocol as anything can get without asking somebody for
one of theirs. The known limit of that is written down in
`app/formular/beispiele.py`.
"""

from typing import Any

import pytest
from pypdf.generic import DictionaryObject, NameObject, TextStringObject

from app.formular.beispiele import FEHLT, formular_bytes, gefuellt, vorhanden
from app.formular.felder import FormularDefinition, formular
from app.formular.pdf import oeffne
from app.protokolle.einlesen.antworten import lies_antworten, wert_aus
from app.protokolle.einlesen.beispiele import AUSGEFUELLT, VORBELEGT
from app.protokolle.regeln import MAX_ZEICHEN_PRO_ANTWORT, pruefe_antworten

# The forms are not in the repository, so a checkout without them skips this
# module rather than failing it.
pytestmark = pytest.mark.skipif(not vorhanden(), reason=FEHLT)


def test_die_leere_form_ergibt_genau_ihre_vorbelegung() -> None:
    """Seventeen answers, and not one the reader made up.

    Pinned as a whole document rather than field by field, so a form version
    that ships different defaults fails here and somebody looks at it.
    """
    lesung = lies_antworten(oeffne(formular_bytes()))

    assert lesung.antworten == VORBELEGT
    assert lesung.unbekannt == ()
    assert lesung.unbrauchbar == ()


def test_ein_ausgefuelltes_protokoll_wird_ganz_gelesen() -> None:
    """The whole document at once, so nothing can be quietly missing from it."""
    lesung = lies_antworten(oeffne(gefuellt(AUSGEFUELLT)))

    assert lesung.antworten == {
        **VORBELEGT,
        "datum": "2026-05-04",
        "messdaten": {"uhrzeit": "14:30", "temperatur": "12.5"},
        "bearbeiter": {"name": "Käthe Müller"},
        "probestrecke": {
            "laenge": "0",
            "gewaessertyp": "13",
            "gewaesser": {"gewaessername": "Schwarzer Regen", "vorfluter1": "Donau"},
        },
        "einfluesse": {"wasserkraft": "Ja"},
        "arten": {"art1": {"name": "BFOR", "klasse_3": "1234"}},
        "bemerkungen": {"sonstige_bemerkungen": "Zeile eins\nZeile zwei"},
    }
    assert lesung.unbrauchbar == ()


def test_die_gefaehrlichen_stellen_einzeln() -> None:
    """The four conversions that would be wrong in a way nobody would notice."""
    antworten = lies_antworten(oeffne(gefuellt(AUSGEFUELLT))).antworten

    # 1234 fish, not 1.2 of one.
    assert antworten["arten"]["art1"]["klasse_3"] == "1234"
    # The date the right way round.
    assert antworten["datum"] == "2026-05-04"
    # The radio's export value without the PDF's slash on the front.
    assert antworten["probestrecke"]["gewaessertyp"] == "13"
    # The umlauts the form's own encoding mangles.
    assert antworten["bearbeiter"]["name"] == "Käthe Müller"


def test_ein_nicht_angekreuztes_kaestchen_fehlt_ganz() -> None:
    """Rather than being stored as empty.

    entwurf/typen.ts draws the line: absent means never touched and "" means
    touched and cleared. A surveyor never touched a box they did not tick.
    """
    antworten = lies_antworten(oeffne(gefuellt(AUSGEFUELLT))).antworten

    assert antworten["einfluesse"] == {"wasserkraft": "Ja"}
    assert "badebetrieb" not in antworten["einfluesse"]


def test_ein_leeres_auswahlfeld_fehlt_ganz() -> None:
    """The form parks a single space in an unchosen dropdown.

    32 of them, the 26 species pickers among them, and a space is not a species.
    The extraction script already skips that placeholder where it reads the
    option lists; this is the same decision on the way back in.
    """
    antworten = lies_antworten(oeffne(formular_bytes())).antworten

    assert "arten" not in antworten
    assert "z" not in antworten
    assert "monitoringnummer" not in antworten["probestrecke"]


def test_ein_unerwarteter_radiowert_bleibt_stehen() -> None:
    """Kept, not dropped, even though no option list offers it.

    Judging a value against its option list is the form rules' job, and they name
    the field when they refuse it. A reader that quietly threw it away would turn
    a protocol somebody has to look at into one that reads as merely incomplete.
    The value 31 is a real possibility here: the legacy form's own JavaScript
    believes the two Altwasser types export 31 and 32 (defect 9).
    """
    antworten = lies_antworten(oeffne(gefuellt({"probestrecke.gewaessertyp": "/31"}))).antworten

    assert antworten["probestrecke"]["gewaessertyp"] == "31"


def test_ein_unlesbares_datum_bleibt_stehen_und_wird_benannt() -> None:
    lesung = lies_antworten(oeffne(gefuellt({"datum": "31.02.2026"})))

    assert lesung.antworten["datum"] == "31.02.2026"
    assert lesung.unbrauchbar == ("datum",)


def test_ein_zu_langer_wert_wird_weggelassen_und_benannt() -> None:
    """The one case where the value cannot be carried at all.

    app/protokolle/regeln.py caps one answer at 4000 characters, so a longer one
    would make the whole save fail with a message about the document rather than
    about the field. Left out and named instead.
    """
    zu_lang = "x" * (MAX_ZEICHEN_PRO_ANTWORT + 1)

    lesung = lies_antworten(oeffne(gefuellt({"bemerkungen.sonstige_bemerkungen": zu_lang})))

    assert "bemerkungen" not in lesung.antworten
    assert lesung.unbrauchbar == ("bemerkungen.sonstige_bemerkungen",)


def test_das_ergebnis_haelt_die_formpruefung_aus() -> None:
    """Because 23b saves it through the ordinary save path.

    A document this reader produced that the shape check refuses could never be
    stored at all, so the two have to agree.
    """
    lesung = lies_antworten(oeffne(gefuellt(AUSGEFUELLT)))

    # It returns quietly or raises, so passing is the absence of an exception.
    pruefe_antworten(lesung.antworten)


def test_ein_feld_das_die_anwendung_nicht_kennt_wird_benannt() -> None:
    """A question the next form version adds, which has to be visible.

    It cannot happen while the file and the seed are the same version, since both
    field lists come from the same extraction. So the seed is narrowed here
    instead, which is exactly the shape of a form that has gained a field.
    """
    schmaler = FormularDefinition(
        version=formular().version,
        pfade=formular().pfade - {"anlass"},
        formate=formular().formate,
    )

    lesung = lies_antworten(oeffne(formular_bytes()), definition=schmaler)

    assert lesung.unbekannt == ("anlass",)
    assert "anlass" not in lesung.antworten


@pytest.mark.parametrize(
    ("wert", "erwartet"),
    [
        (None, None),
        (NameObject("/Off"), None),
        (NameObject("/Ja"), "Ja"),
        (NameObject("/13"), "13"),
        (TextStringObject("Schwarzer Regen"), "Schwarzer Regen"),
        (TextStringObject("  "), None),
    ],
)
def test_wert_aus_einem_feld(wert: Any, erwartet: str | None) -> None:
    """The one place the PDF's own way of holding a value is unwrapped."""
    feld = DictionaryObject()
    if wert is not None:
        feld[NameObject("/V")] = wert

    assert wert_aus(feld) == erwartet
