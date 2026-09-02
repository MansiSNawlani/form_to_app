# Form definition, version 20260609

Extracted from `Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf` by
`backend/scripts/extract_form_definition.py`. Generated files: re-run the script rather than
editing them.

These are the dropdown contents the build plan lists as a pre-build task. They exist nowhere but
inside the PDF, so they are read out of it rather than retyped.

## Files

**`optionslisten.json`** - the option lists, each entry an export value (`wert`) and the German
label the form displays (`label`). The export value is what gets stored, because that is what
FiaKa receives today.

| List | Entries | Needed by |
|---|---|---|
| `anlass` | 6 | Feature 4 |
| `probestrecke.monitoringnummer` | 722 | Feature 4 |
| `gewaessertyp` | 8 | Features 4 and 5 |
| `z.rp` | 4 | Feature 4 |
| `z.quelle` | 13 | Feature 4 |
| `arten` | 123 | Feature 9 |
| `besatz_fischart` | 77 | Feature 7 |
| `ausruestung.egeraet` | 34 | Feature 8 |
| `ausruestung.kathode` | 9 | Feature 8 |
| `messdaten.regenfaelle` | 3 | Feature 5 |
| `messdaten.truebung` | 3 | Feature 5 |
| `messdaten.schaumbildung` | 3 | Feature 5 |
| `hydrologie.breite` | 7 | Feature 5 |
| `hydrologie.tiefe` | 7 | Feature 5 |
| `hydrologie.tiefenvarianz` | 3 | Feature 5 |
| `hydrologie.linienfuehrung` | 4 | Feature 5 |
| `hydrologie.stroemung` | 5 | Feature 5 |
| `hydrologie.fliessgeschwindigkeit` | 6 | Feature 5 |
| `hydrologie.wasserfuehrung` | 4 | Feature 5 |
| `hydrologie.stillwasserbereich` | 5 | Feature 5 |
| `hydrologie.gesamtprofil` | 4 | Feature 5 |

Lists repeated across numbered fields are stored once. The 26 species pickers
(`arten.art1.name` to `arten.art26.name`) share `arten`, and the four stocking rows share
`besatz_fischart`.

**`felder.json`** - all 540 terminal fields with their legacy dotted paths and PDF types (`Tx`
text, `Ch` dropdown, `Btn` radio or checkbox). Radio groups carry their export values. This is
the reference for naming fields as each form part is built.

## Three things to know

**The German is correct here, whatever your terminal shows.** The PDF stores these strings in
PDFDocEncoding and pypdf decodes them wrongly, so the script decodes the original bytes itself.
The files are UTF-8. A Windows console with a non-UTF-8 codepage will still render the umlauts as
question marks when printing them.

**No radio group's labels are in the PDF's fields.** A radio group stores only export values, so
the German words printed beside the buttons are transcribed in `RADIO_LABELS` in the script and
paired with the values on extraction, which raises if the two disagree. The values themselves
always come from the PDF. For `gewaessertyp` they are `28` and `29` for the two Altwasser types,
not `31` and `32` as the form's own JavaScript assumes; see
[defect 9](../../../docs/ffs-defect-list.md).

**Radio lists are in printed order, `felder.json` is in the PDF's order.** The two differ.
`hydrologie.fliessgeschwindigkeit` lists its values as 1, 2, 3, 5, 6, 4 for buttons that read left
to right as 1 to 6, and `hydrologie.stroemung` reads 5 down to 1 across the page. The option lists
follow what a surveyor sees; `felder.json` stays a faithful record of the file.

Each hydrology group also exports a `0` that is **not** in its option list. It has no label
printed beside it and is not an answer: the legacy form writes it to every hydrology group when
the Gewässertyp is a standing water, so it means "hydrology does not apply here". Feature 5b
writes it. This is what [defect 7](../../../docs/ffs-defect-list.md) misread, and that item is
now withdrawn.

## Where this ends up

The `FormVersion` entity holds one of these per version in its `definition` column, locked by
[ADR 0004](../../../docs/adr/0004-freeze-form-versions.md). Until that table exists these are
plain reference files.
