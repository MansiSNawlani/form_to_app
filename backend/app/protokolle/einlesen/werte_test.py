"""One value, from the form's German writing into the one we store.

The most dangerous code in the import, so the cases are spelled out one per row
rather than generated. 373 of the form's 383 numeric fields group their
thousands with a dot, so "1.234" fish has to come back as 1234 and not as 1.2,
and a temperature written "12,5" has to come back as 12.5 rather than being
refused as not a number.

Every format below is one that really occurs in this form, taken from
felder.json after the extraction script recorded them.
"""

import pytest

from app.formular.felder import Feldformat, Formatart
from app.protokolle.einlesen.werte import umwandle

DATUM = Feldformat(art=Formatart.DATUM, muster="dd.mm.yyyy")
ZEIT = Feldformat(art=Formatart.ZEIT)

#: arten.art1.klasse_1 and 369 others: whole numbers, dot groups the thousands.
ZAEHLUNG = Feldformat(art=Formatart.ZAHL, stellen=0, trennung=2)
#: messdaten.temperatur: one decimal, comma marks it, dot groups.
TEMPERATUR = Feldformat(art=Formatart.ZAHL, stellen=1, trennung=2)
#: hydrologie.breite_schaetzwert: one decimal, comma marks it, no grouping.
SCHAETZWERT = Feldformat(art=Formatart.ZAHL, stellen=1, trennung=3)
#: probestrecke.utm_rw_unten: whole, no grouping. A coordinate is not grouped.
KOORDINATE = Feldformat(art=Formatart.ZAHL, stellen=0, trennung=3)
#: bewirschaftung.besatz1_jahr: whole, no grouping, dot would mark decimals.
JAHR = Feldformat(art=Formatart.ZAHL, stellen=0, trennung=1)
#: ufer.erlen: the one field in the form where a comma groups the thousands.
ERLEN = Feldformat(art=Formatart.ZAHL, stellen=0, trennung=0)


@pytest.mark.parametrize(
    ("wert", "format_", "erwartet"),
    [
        # The date, both ways round. The form writes the first.
        ("04.05.2026", DATUM, "2026-05-04"),
        ("2026-05-04", DATUM, "2026-05-04"),
        # A time needs nothing: HH:MM is both how the form writes it and how
        # FeldDatum.tsx stores it.
        ("14:30", ZEIT, "14:30"),
        # The 999 fish. This is the whole reason this module exists.
        ("1.234", ZAEHLUNG, "1234"),
        ("1.234.567", ZAEHLUNG, "1234567"),
        ("12", ZAEHLUNG, "12"),
        # A dot with anything but three digits behind it is not a group, so it
        # stays a decimal point and part 6's own rule refuses it as not a whole
        # number of fish. Stripping it here would turn 12.5 into 125.
        ("12.5", ZAEHLUNG, "12.5"),
        ("12,5", ZAEHLUNG, "12.5"),
        # Negative and zero are somebody else's judgement, not this module's.
        ("-3", ZAEHLUNG, "-3"),
        ("0", ZAEHLUNG, "0"),
        # The temperature, in either writing. Both must arrive as 12.5, because
        # it does not matter whether Acrobat stored what it displayed or what it
        # parsed, and we do not know which.
        ("12,5", TEMPERATUR, "12.5"),
        ("12.5", TEMPERATUR, "12.5"),
        ("1.234", TEMPERATUR, "1234"),
        # No grouping in this style, so a dot can only ever be a decimal point.
        ("12,5", SCHAETZWERT, "12.5"),
        ("1.234", SCHAETZWERT, "1.234"),
        # A coordinate keeps all six digits and gains no separators.
        ("532187", KOORDINATE, "532187"),
        ("5321.87", KOORDINATE, "5321.87"),
        # A year is never grouped, whatever the rest of the form does.
        ("2026", JAHR, "2026"),
        # The form's one comma-grouping field.
        ("1,234", ERLEN, "1234"),
        ("12.5", ERLEN, "12.5"),
        # Whitespace the form left behind.
        (" 1.234 ", ZAEHLUNG, "1234"),
    ],
)
def test_umgewandelte_werte(wert: str, format_: Feldformat, erwartet: str) -> None:
    ergebnis = umwandle(wert, format_)

    assert ergebnis.text == erwartet
    assert ergebnis.brauchbar


@pytest.mark.parametrize(
    ("wert", "format_"),
    [
        # Not a date at all.
        ("irgendwann", DATUM),
        # Written the right way round and not a real day. February has 28 days
        # in 2026, so this is somebody's typo rather than a format we misread.
        ("31.02.2026", DATUM),
        ("2026-02-31", DATUM),
        ("04.05.26", DATUM),
        # Not a number at all.
        ("zwoelf", ZAEHLUNG),
        ("12 Stueck", ZAEHLUNG),
    ],
)
def test_werte_die_nicht_uebernommen_werden_koennen(wert: str, format_: Feldformat) -> None:
    """Kept exactly as the file wrote them, and named.

    Rewriting one into something plausible is the one thing a reader must never
    do, and dropping it would hide a real problem behind an empty field. The form
    rules name it again beside its own field afterwards.
    """
    ergebnis = umwandle(wert, format_)

    assert ergebnis.text == wert
    assert not ergebnis.brauchbar


def test_ein_feld_ohne_format_bleibt_wie_es_ist() -> None:
    """155 of the 540: a name, an address, a remark."""
    ergebnis = umwandle("Schwarzer Regen", None)

    assert ergebnis.text == "Schwarzer Regen"
    assert ergebnis.brauchbar


def test_leer_bleibt_leer() -> None:
    """The reader leaves blanks out before it gets here; this is belt and braces."""
    assert umwandle("", ZAEHLUNG).text == ""
    assert umwandle("", ZAEHLUNG).brauchbar
    assert umwandle("   ", DATUM).text == "   "
