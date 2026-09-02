"""Extract the field and option definitions from a Protokoll E-Befischung PDF.

The legacy form is an encrypted Acrobat AcroForm. Its dropdown contents (species,
Anlass values, monitoring stretch numbers, cathode types) exist nowhere else, so
they are read straight out of the PDF rather than retyped. Re-run this when FFS
issues a new form version.

    python scripts/extract_form_definition.py \
        ../Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf \
        ../database/seed/form_version_20260609

Writes optionslisten.json (the named option lists) and felder.json (every field
with its type), both keyed by the legacy field paths.
"""

from __future__ import annotations

import json
import re
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from pypdf._codecs import _pdfdoc_encoding
from pypdf.generic import ByteStringObject, DictionaryObject, TextStringObject

# Repeated pickers share one vocabulary. Collapsing them keeps the seed readable
# and stops 26 identical species lists from landing in the file.
SHARED_LISTS: dict[str, str] = {
    r"^arten\.art\d+\.name$": "arten",
    r"^bewirschaftung\.besatz_fischart\d+$": "besatz_fischart",
}

# A radio group stores only its export values. The German words printed beside
# the buttons live in the page's drawing instructions, so they are transcribed
# here and paired with the values the PDF reports, and a value with no label or a
# label with no value stops the extraction.
#
# Each map is written in the order the buttons are printed, left to right and
# then down, which is not the order the PDF lists them in: hydrologie.stroemung
# runs 5 to 1 across the page, and hydrologie.linienfuehrung prints 1, 2, 4, 3.
# Pairing was done by widget position rather than by list order for that reason.
#
# A label of None means the form exports the value but prints nothing beside it.
# Every hydrologie group has one: a further button parked in the right margin,
# outside the printed table, exporting 0. It is not an answer. The Gewaessertyp
# handlers set the whole hydrology section to 0 when the water is standing, so 0
# means "hydrology does not apply to this water". It is never offered.
#
# Units are printed once at the end of a row rather than on each button, so they
# are not part of a label here. They belong to the field, and the interface adds
# them: metres for breite and tiefe, m/s for fliessgeschwindigkeit, percent for
# stillwasserbereich.
RADIO_LABELS: dict[str, dict[str, str | None]] = {
    # Values 28 and 29 are the two Altwasser options: the form's own JavaScript
    # tests for 31 and 32, which the field can never hold, so both handlers are
    # dead. See docs/ffs-defect-list.md item 9.
    "probestrecke.gewaessertyp": {
        "14": "Fluss",
        "12": "Kanal",
        "13": "Bach",
        "11": "Graben",
        "26": "Teich",
        "29": "abgeschnittenes Altwasser",
        "28": "angebundenes Altwasser",
        "21": "See",
    },
    # The form prints "vor der Untersuchnung" on the middle button. Confirmed on
    # 2026-09-02 as a typo in the source, so it is corrected here. Do not
    # "restore" it to match the PDF: the label is display text. An export value
    # would be a different matter and is never touched.
    "messdaten.regenfaelle": {
        "1": "keine",
        "2": "vor der Untersuchung",
        "3": "während der Untersuchung",
    },
    "messdaten.truebung": {"1": "keine", "2": "schwach", "3": "deutlich"},
    "messdaten.schaumbildung": {"1": "keine", "2": "schwach", "3": "deutlich"},
    "hydrologie.breite": {
        "1": "< 1",
        "2": "< 2",
        "3": "< 5",
        "4": "< 15",
        "5": "< 50",
        "6": "< 100",
        "7": "≥ 100",
        "0": None,
    },
    "hydrologie.tiefe": {
        "1": "< 0,1",
        "2": "< 0,3",
        "3": "< 0,5",
        "4": "< 1",
        "5": "< 2",
        "6": "< 4",
        "7": "≥ 4",
        "0": None,
    },
    "hydrologie.tiefenvarianz": {
        "1": "gleichmäßig tief",
        "2": "gleichmäßig flach",
        "3": "stark wechselnd",
        "0": None,
    },
    "hydrologie.linienfuehrung": {
        "1": "geradlinig",
        "2": "mit Biegungen",
        "4": "gewunden",
        "3": "mäandrierend",
        "0": None,
    },
    "hydrologie.stroemung": {
        "5": "reißend",
        "4": "turbulent fließend",
        "3": "fließend mit vereinzelten Turbulenzen",
        "2": "gleichmäßig fließend",
        "1": "träge fließend",
        "0": None,
    },
    "hydrologie.fliessgeschwindigkeit": {
        "1": "< 0,1",
        "2": "0,1 - 0,25",
        "3": "0,25 - 0,5",
        "4": "0,5 - 0,75",
        "5": "0,75 - 1",
        "6": "> 1",
        "0": None,
    },
    "hydrologie.wasserfuehrung": {
        "1": "gering",
        "2": "normal",
        "3": "stark",
        "4": "trocken gefallen",
        "0": None,
    },
    "hydrologie.stillwasserbereich": {
        "1": "< 10",
        "2": "10 - 25",
        "3": "25 - 50",
        "4": "50 - 75",
        "5": "> 75",
        "0": None,
    },
    # No value 2, and the printed order is 1, 4, 5, 3. Both are as the form has
    # them; see the questions in docs/ffs-defect-list.md.
    "hydrologie.gesamtprofil": {
        "1": "naturnah",
        "4": "leicht beeinträchtigt",
        "5": "deutlich beeinträchtigt",
        "3": "naturfern",
        "0": None,
    },
}

# gewaessertyp keeps the short list name it was first published under, since the
# frontend and the seed README already refer to it that way.
RADIO_LIST_NAMES: dict[str, str] = {"probestrecke.gewaessertyp": "gewaessertyp"}


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


def options(field: DictionaryObject) -> list[dict[str, str]] | None:
    """Read a dropdown's options as export value plus display label."""
    opt = field.get("/Opt")
    if opt is None:
        return None
    result: list[dict[str, str]] = []
    for entry in opt:
        entry = entry.get_object()
        if isinstance(entry, str) or not hasattr(entry, "__getitem__"):
            wert = label = decode(entry)
        else:
            wert, label = decode(entry[0].get_object()), decode(entry[1].get_object())
        if not wert.strip() and not label.strip():
            continue  # the blank first row Acrobat uses as a placeholder
        result.append({"wert": wert, "label": label})
    return result


def export_values(field: DictionaryObject) -> list[str]:
    """Read a radio or checkbox group's export values, in the PDF's own order.

    That is the order of the /Kids array, which is not the order the buttons are
    printed in. hydrologie.fliessgeschwindigkeit lists 1, 2, 3, 5, 6, 4 for
    buttons that read left to right as 1 to 6. RADIO_LABELS carries the printed
    order, so the option lists follow that and this stays a faithful record of
    the file.
    """
    values: list[str] = []
    for kid in field.get("/Kids", []):
        states = kid.get_object().get("/AP", {}).get("/N", {})
        for state in states:
            if state != "/Off" and str(state)[1:] not in values:
                values.append(str(state)[1:])
    if not values:
        states = field.get("/AP", {}).get("/N", {})
        values = [str(s)[1:] for s in states if s != "/Off"]
    return values


def shared_list_name(field_name: str) -> str | None:
    for pattern, list_name in SHARED_LISTS.items():
        if re.match(pattern, field_name):
            return list_name
    return None


def radio_options(field_name: str, exports: list[str]) -> list[dict[str, str]]:
    """Pair a radio group's export values with the labels printed beside them.

    The pairing is the one thing in this script that cannot be checked by
    reading the output: a label attached to the wrong export value puts the
    right German word on the wrong stored answer and nothing downstream notices.
    So a value the transcription does not cover, or a transcribed value the form
    does not export, stops the extraction rather than producing a plausible file.
    """
    labels = RADIO_LABELS[field_name]
    unlabelled = [wert for wert in exports if wert not in labels]
    not_exported = [wert for wert in labels if wert not in exports]
    if unlabelled or not_exported:
        raise ValueError(
            f"{field_name}: the form exports {exports} but RADIO_LABELS describes "
            f"{list(labels)}. Not labelled: {unlabelled}. Not exported: {not_exported}."
        )
    return [{"wert": wert, "label": label} for wert, label in labels.items() if label is not None]


def extract(pdf_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    reader = PdfReader(str(pdf_path))
    catalog: Any = reader.trailer["/Root"].get_object()
    acroform: Any = catalog["/AcroForm"].get_object()

    optionslisten: dict[str, list[dict[str, str]]] = {}
    felder: list[dict[str, Any]] = []

    for name, field in walk(acroform["/Fields"]):
        ftype = str(field.get("/FT", ""))
        eintrag: dict[str, Any] = {"name": name, "typ": ftype.lstrip("/") or None}

        if ftype == "/Ch":
            auswahl = options(field) or []
            list_name = shared_list_name(name) or name
            if list_name in optionslisten and optionslisten[list_name] != auswahl:
                raise ValueError(f"{name} disagrees with the shared list {list_name}")
            optionslisten[list_name] = auswahl
            eintrag["optionsliste"] = list_name
        elif ftype == "/Btn":
            exports = export_values(field)
            if exports:
                eintrag["werte"] = exports
            if name in RADIO_LABELS:
                list_name = RADIO_LIST_NAMES.get(name, name)
                optionslisten[list_name] = radio_options(name, exports)
                eintrag["optionsliste"] = list_name
        felder.append(eintrag)

    described = set(RADIO_LABELS)
    found = {f["name"] for f in felder}
    if described - found:
        raise ValueError(f"RADIO_LABELS describes fields this form has not: {described - found}")

    version = pdf_path.stem.rsplit("_V", 1)[-1]
    meta = {"version": version, "quelle": pdf_path.name}
    return (
        {**meta, "listen": dict(sorted(optionslisten.items()))},
        {**meta, "anzahl": len(felder), "felder": felder},
    )


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    pdf_path, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    optionslisten, felder = extract(pdf_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, payload in (("optionslisten.json", optionslisten), ("felder.json", felder)):
        target = out_dir / filename
        text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        target.write_text(text, encoding="utf-8")
        print(f"wrote {target}")
    for list_name, entries in optionslisten["listen"].items():
        print(f"  {list_name:32} {len(entries)} options")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
