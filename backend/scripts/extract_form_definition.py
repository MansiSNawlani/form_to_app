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

# The radio group carries only export values, so the German labels come from the
# printed form. Values 28 and 29 are the two Altwasser options: the form's own
# JavaScript tests for 31 and 32, which the field can never hold, so both
# handlers are dead. See docs/ffs-defect-list.md item 9.
GEWAESSERTYP_LABELS: dict[str, str] = {
    "11": "Graben",
    "12": "Kanal",
    "13": "Bach",
    "14": "Fluss",
    "21": "See",
    "26": "Teich",
    "28": "angebundenes Altwasser",
    "29": "abgeschnittenes Altwasser",
}


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
    """Read a radio or checkbox group's export values, in on-form order."""
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
        felder.append(eintrag)

    if "probestrecke.gewaessertyp" in {f["name"] for f in felder}:
        typ = next(f for f in felder if f["name"] == "probestrecke.gewaessertyp")
        optionslisten["gewaessertyp"] = [
            {"wert": wert, "label": GEWAESSERTYP_LABELS[wert]} for wert in typ["werte"]
        ]
        typ["optionsliste"] = "gewaessertyp"

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
