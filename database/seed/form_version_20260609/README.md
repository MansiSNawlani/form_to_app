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

Lists repeated across numbered fields are stored once. The 26 species pickers
(`arten.art1.name` to `arten.art26.name`) share `arten`, and the four stocking rows share
`besatz_fischart`.

**`felder.json`** - all 540 terminal fields with their legacy dotted paths and PDF types (`Tx`
text, `Ch` dropdown, `Btn` radio or checkbox). Radio groups carry their export values. This is
the reference for naming fields as each form part is built.

## Two things to know

**The German is correct here, whatever your terminal shows.** The PDF stores these strings in
PDFDocEncoding and pypdf decodes them wrongly, so the script decodes the original bytes itself.
The files are UTF-8. A Windows console with a non-UTF-8 codepage will still render the umlauts as
question marks when printing them.

**`gewaessertyp` labels are not in the PDF.** A radio group stores only export values, so the
eight German labels are held in the script and paired with the values on extraction. The values
themselves come from the PDF. They are `28` and `29` for the two Altwasser types, not `31` and
`32` as the form's own JavaScript assumes; see [defect 9](../../../docs/ffs-defect-list.md).

## Where this ends up

The `FormVersion` entity holds one of these per version in its `definition` column, locked by
[ADR 0004](../../../docs/adr/0004-freeze-form-versions.md). Until that table exists these are
plain reference files.
