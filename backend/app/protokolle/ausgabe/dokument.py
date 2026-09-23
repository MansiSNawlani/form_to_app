"""A filed protocol as a PDF somebody can keep, print, and pass on.

Feature 23e. A document of our own, not a copy of the official Acrobat form:
build-plan.md item 23 carries that decision and why it was reversed. So nothing
here opens the legacy file, and a deployment does not need a copy of it.

Plain functions over plain values. The whole builder takes a header, an answers
document and a list of pictures, and returns bytes, so it is tested without a
database, an HTTP request or a disk, exactly as coding-standards.md asks of
domain logic.

**What it prints is what is there.** No rule runs during a download. A draft with
half its answers missing produces a half-empty document, which is right: the
person asked for a copy of what they have, not for a judgement on it. A field
nobody answered is left out rather than printed empty, the way the read-only view
leaves it out, because a page of blank labels hides the answers among them.

ReportLab rather than an HTML engine. pyproject.toml explains the choice: this is
a pure Python wheel and behaves the same on the Windows machine the tests run on
as it does in the container.
"""

import io
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, time
from decimal import Decimal, InvalidOperation
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.formular.felder import formular
from app.formular.optionen import optionen
from app.models.anlage import Anlagenart
from app.protokolle.ausgabe.beschriftungen import Block, Gliederung, Gruppe, gliederung

#: The page, and how much of it is margin. Generous rather than tight: this is
#: read on paper as often as on screen, and often in a folder.
SEITE = A4
RAND = 18 * mm

#: The accent from frontend/src/styles/theme.css, so the document and the
#: application look like the same thing. Nothing else here is coloured: the
#: printed protocol is an official record and reads as one.
AKZENT = colors.HexColor("#1f6feb")
LINIE = colors.HexColor("#d0d7de")
GEDAEMPFT = colors.HexColor("#57606a")

#: How wide the label column is. The longest label in the form runs to about
#: sixty characters, and a narrower column would wrap most of them twice.
LABELBREITE = 62 * mm

#: The ten size class columns of the catch table, part 6.
KLASSEN = tuple(f"klasse_{nummer}" for nummer in range(1, 11))

#: What an unticked box holds, and what the import writes for one.
JA = "Ja"

#: How many pixels wide a picture is worth keeping. An attachment may be 10 MB
#: and a protocol may carry 21 of them, so embedding them untouched would mean
#: holding 200 MB to build one download and handing over a file nobody can
#: email. This is roughly 150 dpi across the printable width, which is more than
#: a photograph of a river bank needs to be recognisable on paper.
BILDBREITE = 1240


@dataclass(frozen=True, slots=True)
class Bild:
    """One attachment, already read out of the store."""

    art: Anlagenart
    dateiname: str
    daten: bytes


@dataclass(frozen=True, slots=True)
class Protokollkopf:
    """What the title block says, gathered by the caller from the envelope.

    Deliberately not the Submission model. Keeping the builder to plain values
    is what lets it be tested without a database, and it is the envelope columns
    that differ between a draft and a filed protocol, not the answers.
    """

    gewaesser: str
    ortsangabe: str = ""
    datum: date | None = None
    uhrzeit: time | None = None
    status: str = ""
    bearbeiter: str = ""
    form_version: str = ""
    #: How many pictures the protocol has, counted before any were read. Printed
    #: even when none could be loaded, so a missing photograph is visible.
    anlagen: int = 0
    #: What the pictures could not say for themselves, one line each.
    hinweise: tuple[str, ...] = ()


@dataclass
class _Stile:
    """The handful of paragraph styles the document uses."""

    titel: ParagraphStyle
    untertitel: ParagraphStyle
    abschnitt: ParagraphStyle
    block: ParagraphStyle
    text: ParagraphStyle
    klein: ParagraphStyle
    zelle: ParagraphStyle
    kopfzelle: ParagraphStyle = field(init=False)

    def __post_init__(self) -> None:
        self.kopfzelle = ParagraphStyle(
            "kopfzelle", parent=self.zelle, fontName="Helvetica-Bold", fontSize=7
        )


def _stile() -> _Stile:
    grund = getSampleStyleSheet()["BodyText"]
    text = ParagraphStyle(
        "text", parent=grund, fontName="Helvetica", fontSize=9, leading=12, alignment=TA_LEFT
    )
    return _Stile(
        titel=ParagraphStyle(
            "titel", parent=text, fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=2
        ),
        untertitel=ParagraphStyle(
            "untertitel", parent=text, fontSize=10, textColor=GEDAEMPFT, spaceAfter=8
        ),
        abschnitt=ParagraphStyle(
            "abschnitt",
            parent=text,
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            spaceBefore=10,
            spaceAfter=4,
            textColor=AKZENT,
        ),
        block=ParagraphStyle(
            "block",
            parent=text,
            fontName="Helvetica-Bold",
            fontSize=10,
            spaceBefore=6,
            spaceAfter=2,
        ),
        text=text,
        klein=ParagraphStyle("klein", parent=text, fontSize=8, textColor=GEDAEMPFT),
        zelle=ParagraphStyle("zelle", parent=text, fontSize=8, leading=10),
    )


def baue(
    kopf: Protokollkopf,
    antworten: dict[str, Any],
    bilder: Sequence[Bild] = (),
    plan: Gliederung | None = None,
) -> bytes:
    """One protocol as a PDF, start to finish.

    `plan` is injectable so a test can print against a small outline of its own
    rather than against all 174 fields of the real form.
    """
    plan = plan or gliederung()
    stile = _stile()
    puffer = io.BytesIO()

    dokument = SimpleDocTemplate(
        puffer,
        pagesize=SEITE,
        leftMargin=RAND,
        rightMargin=RAND,
        topMargin=RAND,
        bottomMargin=RAND,
        title=_dateititel(kopf),
        author="Fischereiforschungsstelle Baden-Wuerttemberg",
        subject="Protokoll E-Befischung",
    )

    inhalt: list[Any] = [*_kopfblock(kopf, stile)]
    for abschnitt in plan.abschnitte:
        teile = list(_abschnitt(abschnitt, antworten, plan, stile))
        if teile:
            inhalt.extend(teile)
    inhalt.extend(_anlagenblock(kopf, bilder, stile))

    dokument.build(inhalt, onLaterPages=_fusszeile(kopf), onFirstPage=_fusszeile(kopf))
    return puffer.getvalue()


def _dateititel(kopf: Protokollkopf) -> str:
    teile = ["Protokoll E-Befischung", kopf.gewaesser]
    if kopf.datum:
        teile.append(kopf.datum.strftime("%d.%m.%Y"))
    return " - ".join(teil for teil in teile if teil)


def _kopfblock(kopf: Protokollkopf, stile: _Stile) -> Iterable[Any]:
    yield Paragraph("Protokoll E-Befischung", stile.titel)

    unter = [kopf.gewaesser or "Ohne Gewaessernamen"]
    if kopf.ortsangabe:
        unter.append(kopf.ortsangabe)
    yield Paragraph(" - ".join(unter), stile.untertitel)

    zeilen = [
        ("Datum", _datum(kopf.datum)),
        ("Uhrzeit", kopf.uhrzeit.strftime("%H:%M") if kopf.uhrzeit else ""),
        ("Status", kopf.status),
        ("Bearbeiter", kopf.bearbeiter),
        ("Formularversion", kopf.form_version),
    ]
    yield _wertetabelle([(wie, was) for wie, was in zeilen if was], stile)
    yield Spacer(1, 4)


def _fusszeile(kopf: Protokollkopf):  # type: ignore[no-untyped-def]
    """The page number and what the document is, on every page.

    Worth the room: a protocol runs to several pages and they get separated. The
    status is here as well as in the header because a printed draft that reads
    like a filed one is the one way this document could mislead somebody.
    """
    beschreibung = " - ".join(
        teil for teil in ("Protokoll E-Befischung", kopf.gewaesser, kopf.status) if teil
    )

    def zeichne(leinwand: Any, dokument: Any) -> None:
        leinwand.saveState()
        leinwand.setFont("Helvetica", 7)
        leinwand.setFillColor(GEDAEMPFT)
        leinwand.drawString(RAND, RAND * 0.6, beschreibung)
        leinwand.drawRightString(SEITE[0] - RAND, RAND * 0.6, f"Seite {dokument.page}")
        leinwand.restoreState()

    return zeichne


def _abschnitt(
    abschnitt: Any, antworten: dict[str, Any], plan: Gliederung, stile: _Stile
) -> Iterable[Any]:
    """One section, or nothing at all when none of its fields was answered."""
    bloecke: list[Any] = []
    for block in abschnitt.bloecke:
        bloecke.extend(_block(block, antworten, plan, stile))

    if not bloecke:
        return []

    return [Paragraph(abschnitt.titel, stile.abschnitt), *bloecke]


def _block(block: Block, antworten: dict[str, Any], plan: Gliederung, stile: _Stile) -> list[Any]:
    if block.fangtabelle:
        return _fangtabelle(block.titel, antworten, stile)

    """The fields of one block, with each run of shares closed by its own total.

    The total follows the last share of its run rather than waiting for the end
    of the block. Section 3's Ufer block holds three runs, and printing their
    three totals in a stack underneath all of them leaves a reader counting rows
    upwards to work out which belongs to which.
    """
    # Which group, if any, each path closes. Built once rather than searched per
    # row, and only for groups this block actually holds.
    schliesst: dict[str, Gruppe] = {}
    im_block = set(block.pfade)
    for kandidat in plan.gruppen:
        if kandidat.pfade and set(kandidat.pfade) <= im_block:
            schliesst[kandidat.pfade[-1]] = kandidat

    teile: list[Any] = []
    zeilen: list[tuple[str, str]] = []

    def leere() -> None:
        if zeilen:
            teile.append(_wertetabelle(list(zeilen), stile))
            zeilen.clear()

    for pfad in block.pfade:
        wert = _wert(pfad, antworten, plan)
        if wert:
            zeilen.append((plan.wort(pfad), wert))

        gruppe = schliesst.get(pfad)
        if gruppe is None:
            continue
        summe = _summe(gruppe, antworten)
        if summe is not None:
            leere()
            teile.append(Paragraph(f"{gruppe.titel} - Summe: {_dezimal(summe)} %", stile.klein))

    leere()
    if not teile:
        return []

    return [Paragraph(block.titel, stile.block), *teile]


def _summe(gruppe: Gruppe, antworten: dict[str, Any]) -> Decimal | None:
    """What one run of shares adds up to, or nothing when none was given.

    Added up rather than checked. The rule is enforced when a protocol is
    submitted; here the number is simply shown, so a reader can see for
    themselves, and so a draft that does not add up says so on paper too.
    """
    gegeben = [teil for pfad in gruppe.pfade if (teil := _zahl(antworten, pfad)) is not None]
    return sum(gegeben, Decimal(0)) if gegeben else None


def _fangtabelle(titel: str, antworten: dict[str, Any], stile: _Stile) -> list[Any]:
    """Part 6, as a table: species down the side, the ten size classes across.

    The same shape as the screen, and for the same reason: 312 label-and-value
    rows would be unreadable, and the columns mean nothing apart from each other.

    A row total is worked out here rather than stored. The legacy form calculates
    it and marks it read-only, so storing it would let a hand-edited draft carry a
    total that disagrees with its own cells; entwurf/typen.ts makes the same call.

    0+ is printed as its own column and never added into the total: it counts
    young of the year that are already inside the ten classes, so adding it would
    count those fish twice. That is the rule feature 9b enforces.
    """
    arten = antworten.get("arten")
    zeilen = list(_artzeilen(arten)) if isinstance(arten, dict) else []

    if not zeilen:
        return [
            Paragraph(titel, stile.block),
            Paragraph("Keine Arten eingetragen.", stile.text),
        ]

    kopf = [
        Paragraph("Art", stile.kopfzelle),
        *(Paragraph(f"K{nummer}", stile.kopfzelle) for nummer in range(1, 11)),
        Paragraph("0+", stile.kopfzelle),
        Paragraph("Summe", stile.kopfzelle),
    ]

    daten = [kopf]
    gesamt = 0
    for name, klassen, nullplus in zeilen:
        summe = sum(wert or 0 for wert in klassen)
        gesamt += summe
        daten.append(
            [
                Paragraph(name, stile.zelle),
                *(Paragraph(_ganz(wert), stile.zelle) for wert in klassen),
                Paragraph(_ganz(nullplus), stile.zelle),
                Paragraph(str(summe), stile.kopfzelle),
            ]
        )

    breiten = [34 * mm, *([10.5 * mm] * 10), 10.5 * mm, 14 * mm]
    tabelle = Table(daten, colWidths=breiten, repeatRows=1, hAlign="LEFT")
    tabelle.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, LINIE),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f3f5f7")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    return [
        Paragraph(titel, stile.block),
        tabelle,
        Paragraph(f"Gesamtsumme: {gesamt}", stile.klein),
    ]


def _artzeilen(arten: dict[str, Any]) -> Iterable[tuple[str, list[int | None], int | None]]:
    """The catch rows that hold anything, in the form's own row order.

    art1 to art26, sorted by number rather than by name, so art2 does not print
    after art19. A row with no species and no counts is a row nobody filled in.
    """
    for nummer in range(1, 27):
        zeile = arten.get(f"art{nummer}")
        if not isinstance(zeile, dict):
            continue
        name = str(zeile.get("name") or "").strip()
        klassen = [_ganzzahl(zeile.get(klasse)) for klasse in KLASSEN]
        nullplus = _ganzzahl(zeile.get("0plus"))
        if not name and not any(wert is not None for wert in (*klassen, nullplus)):
            continue
        yield name or "ohne Artangabe", klassen, nullplus


def _anlagenblock(kopf: Protokollkopf, bilder: Sequence[Bild], stile: _Stile) -> list[Any]:
    """The map excerpt and the photographs, each on the page at full width.

    The count comes first and comes from the protocol rather than from the list
    below it, so a picture that could not be read is visible as a gap rather
    than silently absent. A downloaded protocol that quietly dropped a
    photograph would be worse than one that says it could not print it.
    """
    if kopf.anlagen == 0 and not bilder and not kopf.hinweise:
        return []

    teile: list[Any] = [PageBreak(), Paragraph("Karte und Fotos", stile.abschnitt)]
    teile.append(
        Paragraph(
            f"{kopf.anlagen} Anlage(n) am Protokoll, {len(bilder)} davon hier abgedruckt.",
            stile.klein,
        )
    )
    for hinweis in kopf.hinweise:
        teile.append(Paragraph(hinweis, stile.klein))

    for bild in bilder:
        gezeichnet = _bild(bild, stile)
        if gezeichnet is not None:
            teile.append(gezeichnet)

    return teile


def verkleinere(daten: bytes) -> bytes:
    """One picture, reduced to something worth putting in a document.

    Returns the original bytes when anything goes wrong, because a picture that
    cannot be resized may still be one ReportLab can place, and the caller
    already copes with one it cannot.
    """
    from PIL import Image as PilImage

    try:
        with PilImage.open(io.BytesIO(daten)) as bild:
            bild.load()
            if bild.width <= BILDBREITE:
                return daten
            hoehe = round(bild.height * BILDBREITE / bild.width)
            verkleinert = bild.convert("RGB").resize((BILDBREITE, hoehe))
            puffer = io.BytesIO()
            verkleinert.save(puffer, format="JPEG", quality=80, optimize=True)
            return puffer.getvalue()
    except Exception:  # noqa: BLE001 - any unreadable picture, for any reason
        return daten


def _bild(bild: Bild, stile: _Stile) -> Any:
    """One picture, scaled to the text width and captioned.

    A picture ReportLab cannot decode is skipped with its name rather than
    taking the whole download down with it. The person still gets their
    protocol, and the caption says which file did not come.
    """
    beschriftung = (
        "Kartenausschnitt" if bild.art is Anlagenart.KARTENAUSSCHNITT else "Foto"
    ) + f": {bild.dateiname}"

    breite = SEITE[0] - 2 * RAND
    hoehe = SEITE[1] * 0.42

    try:
        leser = ImageReader(io.BytesIO(bild.daten))
        echte_breite, echte_hoehe = leser.getSize()
    except Exception:  # noqa: BLE001 - any unreadable picture, for any reason
        return Paragraph(f"{beschriftung} (nicht darstellbar)", stile.klein)

    if echte_breite <= 0 or echte_hoehe <= 0:
        return Paragraph(f"{beschriftung} (nicht darstellbar)", stile.klein)

    faktor = min(breite / echte_breite, hoehe / echte_hoehe, 1.0)
    return KeepTogether(
        [
            Spacer(1, 6),
            Paragraph(beschriftung, stile.klein),
            Image(io.BytesIO(bild.daten), echte_breite * faktor, echte_hoehe * faktor),
        ]
    )


def _wertetabelle(zeilen: Sequence[tuple[str, str]], stile: _Stile) -> Table:
    daten = [[Paragraph(wie, stile.zelle), Paragraph(was, stile.zelle)] for wie, was in zeilen]
    tabelle = Table(
        daten,
        colWidths=[LABELBREITE, SEITE[0] - 2 * RAND - LABELBREITE],
        hAlign="LEFT",
    )
    tabelle.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINIE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return tabelle


def _wert(pfad: str, antworten: dict[str, Any], plan: Gliederung) -> str:
    """One answer, as the document prints it, or empty when there is none.

    Three translations happen here and nowhere else:

    - a coded option becomes what it is called, so "wrrl" prints as
      "Fischmonitoring gemaess WRRL";
    - a ticked box becomes "Ja", because "Ja" on its own beside a label reads as
      an answer and the stored value is not always that word;
    - everything else prints exactly as stored. Numbers keep the application's
      own writing, 12.5 and never 12,5, which is the writing every other part of
      this application uses.
    """
    roh = _hole(antworten, pfad)
    if roh is None:
        return ""

    wert = str(roh).strip()
    if not wert:
        return ""

    liste = formular().optionslisten.get(pfad)
    if liste:
        return optionen().etikett(liste, wert)

    return JA if wert == JA else wert


def _hole(antworten: dict[str, Any], pfad: str) -> Any:
    """One value out of the nested answers document, by its dotted path."""
    hier: Any = antworten
    for teil in pfad.split("."):
        if not isinstance(hier, dict):
            return None
        hier = hier.get(teil)
    return hier if hier is not None else None


def _zahl(antworten: dict[str, Any], pfad: str) -> Decimal | None:
    roh = _hole(antworten, pfad)
    if roh is None or str(roh).strip() == "":
        return None
    try:
        return Decimal(str(roh).strip())
    except InvalidOperation:
        return None


def _ganzzahl(roh: Any) -> int | None:
    if roh is None or str(roh).strip() == "":
        return None
    try:
        return int(Decimal(str(roh).strip()))
    except (InvalidOperation, ValueError):
        return None


def _ganz(wert: int | None) -> str:
    return "" if wert is None else str(wert)


def _dezimal(wert: Decimal) -> str:
    """A total without a trailing .0, since the shares are whole numbers."""
    gerundet = wert.normalize()
    return f"{gerundet:f}"


def _datum(wert: date | None) -> str:
    return wert.strftime("%d.%m.%Y") if wert else ""
