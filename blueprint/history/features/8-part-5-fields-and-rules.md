# Feature: 8 - Part 5 fields and rules

**From build-plan:** feature 8, "Form part 5: equipment and fished areas"
**Status:** completed 2026-09-04

## Goal

Build section 5 of the protocol, "Eingesetzte Ausrüstung und befischte Bereiche": which
electrofishing device was used and how it was rigged, who led the anode, and which stretch of water
was actually fished, how wide, in which direction and by what method.

Twenty-six fields, all of them on the top half of page 3 of the printed form, plus the three
cross-field checks the legacy form makes there. Section 5 is a placeholder today. After this
feature five of the six sections are real and only the catch table, feature 9, remains.

## Why this feature is not split

Items 4, 5 and 6 were each split into a fields sub-feature and a rules sub-feature. Feature 7 was
not split, because part 4 has no rules. Feature 8 is not split either, for the opposite reason to
feature 7: it has rules, but only three, and they are the same shape as each other.

| Feature | Fields | Rules | Split? |
|---|---|---|---|
| 6a + 6b | 54 | 6 percentage runs | yes |
| 7 | 43 | none | no |
| **8** | **26** | **3, all "at least one of a pair"** | **no** |

Twenty-six fields is the smallest field count of any form part so far, and the three rules are one
function each over a pair of numbers. That is one feature's worth of work, built in six steps plus
a seventh added during the build.

## Design reference

**No mockup, and none is needed.** Same decision as 6a and 7, made on 2026-09-03 and unchanged. The
layout does not have to match the printed form so long as it reads well and looks like the rest of
the app. Two references stand in.

1. **`prototypes/protokoll-teil-1.html` and `prototypes/mockup.css`** for everything structural: the
   section card, the `fieldset` and legend, the 12 column grid, the label above the control.
   Part 5 must look like parts 1 to 4 built it.
2. **Page 3 of `Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf`**, top
   half, for which fields exist, what they are called and how they group.

## What was found while reading the form

Three things turned up that the build plan's one line did not anticipate. Two of them are new
defects and the third changes where a rule lives.

### The Bauweise question has no printed label at all

`ausruestung.bauweise` is a two button radio group on page 3, exporting `alte` and `neue`. There is
**no text printed beside either button**, no tooltip on the field, and no caption on either widget.
Checked on 2026-09-04 four ways: the page content stream has no text drawn between y=715 and y=736,
where the two buttons sit; the field has no `/TU`; neither widget has an `/MK /CA`; and the strings
"Bauweise", "alte" and "neue" appear nowhere in any of the four pages' text.

The only place the question is named at all is the error message in `validation.js`:

> Geben Sie bitte die Bauweise des E-Gerätes an!

And `validation()` **refuses to send the form** until one of the two is chosen. So every surveyor
who has ever filed this protocol had to pick between two unlabelled buttons in order to submit.

This becomes **defect 11**, written up in step 1.

**Working assumption for the build, to be confirmed with FFS:** the two options are labelled
"alte Bauweise" and "neue Bauweise", which is the literal reading of the error message and claims
nothing the form does not already say. If FFS comes back with the real distinction, changing it is
two strings.

### The E-Gerät dropdown offers the same answer twice

`ausruestung.egeraet` has 34 entries, and two of them export the identical value `keine Angabe`,
labelled "keine Angabe" and "unbekannt". It is the only list in the whole form with a duplicate
export value, confirmed by checking all 22 extracted lists.

No data is corrupted, since both choices store the same string, but a dropdown that offers the same
answer under two names is a usability bug, and in an MUI `Autocomplete` matching on the stored value
it means picking "unbekannt" and reopening the draft shows "keine Angabe".

This becomes **defect 12**, written up in step 1.

### The three legacy checks are pair checks, not field checks

`validation.js` makes five checks over part 5. Two are ordinary required fields and three are not:

| Legacy check | What it means | Where it lands here |
|---|---|---|
| `egeraet.value.length < 2` | E-Gerät must be given | `pflicht` asterisk, gate is feature 11 |
| `bauweise == "Off"` | Bauweise must be chosen | `pflicht` asterisk, gate is feature 11 |
| `ringanoden + streifenanoden < 1` | at least one anode of either kind | **a rule**, step 5 |
| `ges_gew_laenge + ufer_laenge == 0` | at least one fished length | **a rule**, step 5 |
| `ges_gew_breite + ufer_breite == 0` | at least one fished width | **a rule**, step 5 |

The last three cannot be an asterisk on one field, because neither field of the pair is required on
its own. How they behave without making a fresh draft shout is set out under "How the three rules
behave" below.

## In scope

- The `ausruestung` block, ten fields: E-Gerät, Spannung, Ausgangsleistung, Bauweise, Ringanoden and
  their diameter, Kathodentyp, Streifenanoden, and the two accompanying net checkboxes.
- The `anodenfuehrer` block, two fields: Vorname and Nachname.
- The `befischte_bereiche` block, fourteen fields: two rows of length, effective width, two
  direction checkboxes and three method checkboxes.
- The three "at least one of a pair" rules, as plain functions with tests.
- A sign check over part 5's nine quantities, added during the build. See step 7.
- The Bauweise option labels added to the extraction script's `RADIO_LABELS` and the seed list
  regenerated.
- Duplicate export values collapsed once, in `optionen.ts`, so no control ever offers the same
  answer twice.
- Defects 11 and 12 added to `docs/ffs-defect-list.md`, with the counts elsewhere in that file
  brought back into line.

## Out of scope

- **The Ergänzende Anmerkungen box** at the foot of the equipment area, path
  `bemerkungen.bemerkung_fische`. It is printed directly above the catch table and reads as its
  introduction, and `typen.ts` already assigns it to feature 9. It stays there.
- **The catch table itself**, feature 9, which is the rest of page 3.
- **Required at submit.** The two `pflicht` asterisks are drawn now, but nothing blocks anything.
  The submit gate is feature 11, exactly as it is for parts 1 to 4.
- **The backend half of the three rules.** Written browser side only, as the build plan's
  2026-09-01 note says for every rule in features 4 to 9. Features 2 and 3 close that gap.
- **Row completeness in the fished areas.** See the note at the end of "How the three rules behave".

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Defects 11 and 12 written up** - `docs/ffs-defect-list.md` gains two items in the
      shape of items 1 to 10: what the form does, the evidence, the severity, whether historical
      data is affected, and what we intend to do. Item 11 is the unlabelled Bauweise question, which
      the form nonetheless refuses to submit without. Item 12 is the duplicated `keine Angabe` in
      the E-Gerät list. The opening paragraph and the closing "What we intend to do" section both
      carry counts that no longer match, so both need revisiting. No code, nothing visible in the
      app. This comes first because item 11 is the reason step 2 invents two German words, and
      reviewing that reasoning before the code that depends on it is cheaper than after.
      *Done when:* both items read as standalone reports FFS can act on without this repository
      open; every count in the file matches the number of live items; the file still says the list
      is to be sent to FFS.

- [x] **Step 2 - The Bauweise labels, and the duplicate option** - `RADIO_LABELS` in
      `backend/scripts/extract_form_definition.py` gains `ausruestung.bauweise`, with a comment
      saying plainly that unlike every other entry these two labels are **not** transcribed from the
      print, because nothing is printed, and naming defect 11 as the reason. `optionslisten.json` is
      regenerated by running the script rather than hand-edited. `optionen.ts` registers
      `ausruestung.bauweise` in `ListenName` and collapses duplicate `wert` entries in `optionen()`,
      keeping the first label, with a comment naming defect 12. *Done when:* the regenerated file
      holds a 2 entry `ausruestung.bauweise` list and is otherwise identical to what it was, proving
      the run changed only what it was meant to; `optionen('ausruestung.egeraet')` returns 33 entries
      with no repeated `wert`; a vitest beside `optionen.ts` covers both the deduplication and a list
      with no duplicates passing through untouched; `pytest` and `ruff check .` pass in `backend/`.

- [x] **Step 3 - Section 5 opens, with the Ausrüstung and Anodenführer blocks** - `Antworten` grows
      the `ausruestung` and `anodenfuehrer` groups. `abschnitte/teil5/bloecke.ts` declares what can
      be declared as data; `AusruestungBlock.tsx` renders the ten equipment fields and the two
      Anodenführer names. `AbschnittInhalt` routes section 5 to a real `Abschnitt5` instead of the
      placeholder. Controls follow what parts 1 to 4 established: `FeldSuche` for the 34 entry
      E-Gerät list, `FeldAuswahl` for the 9 entry Kathodentyp, `FeldRadio` for the two Bauweise
      buttons, `FeldHaken` for the two nets, `FeldText` for the rest with their printed units (V,
      kW, cm) and counts. *Done when:* section 5 opens on a real form; every one of the twelve fields
      accepts a value and survives a reload; the E-Gerät search is usable from the keyboard alone and
      stores the export code rather than the label; the Bauweise buttons select and clear; the E-Gerät
      and Bauweise fields carry the required asterisk and nothing is blocked by it; the units read as
      part of the field rather than as stray text; the block reads correctly in light and dark, at
      desktop width and below 800px; tabbing reaches every control in reading order.

- [x] **Step 4 - The Befischte Bereiche block** - `Antworten` grows the `befischte_bereiche` group.
      `bloecke.ts` declares the two rows as `{ laenge, breite, stromauf, stromab, vom_boot, watend,
      vom_ufer }` and `BefischteBereicheBlock.tsx` renders them by mapping, so the fourteen fields
      are one definition rather than fourteen near-identical elements. The printed form lays these
      out as a table with "Strecke", "effektiv befischte Breite", "Richtung" and "Methode" as column
      headings over two labelled rows, "Über die gesamte Gewässerbreite" and "entlang der Ufer".
      *Done when:* both rows accept a length, a width and any combination of the five checkboxes, and
      all fourteen values survive a reload; every control is labelled so that the second row's
      "watend" is distinguishable from the first row's to a screen reader, not only by column
      position; the grouping is a `fieldset` per row or an equivalent that says out loud which row a
      control belongs to; the layout is readable at desktop width and stacks rather than scrolling
      sideways below 800px; both `m` units are attached to their fields.

- [x] **Step 5 - The three pair rules** - `regeln/ausruestung.ts` holds the three checks as plain
      functions over the answers document, `regeln/schema.ts` registers them, and each block shows
      its message under the pair it concerns. The paths they report against are group paths declared
      in `teil5/bloecke.ts`, alongside `Gruppenpfad` and `Einflusspfad` in `regel.ts`, because no
      single field is the wrong one. Behaviour is set out under "How the three rules behave" below,
      and the short version is that a blank pair is silent and an explicit zero pair is not.
      *Done when:* entering 0 ring anodes and 0 strip anodes shows a message under the anode pair,
      and changing either to 1 clears it; the same for the two lengths and for the two widths; a
      completely untouched section 5 shows no message anywhere; filling one of a pair with a real
      number shows no message, while filling one with a zero and leaving the other blank does show
      one, because that is a claim of nothing rather than an unfinished pair; each rule is a pure
      function with a test covering the zero pair, each single answer, the blank pair and a valid
      pair; the messages are announced to a screen reader without stealing focus; `npm test` is
      green.

      **Corrected on 2026-09-04, during the build.** This done-when first read "filling only one of
      a pair shows no message", which contradicted both the legacy form and the rule as built. The
      legacy check is a sum, so a zero beside a blank trips it: `"0" + ""` coerces to `0`, and
      `0 < 1`. Leaving that silent would mean a surveyor who types 0 ring anodes and never returns
      to the strip anodes is never told the pair says nothing. The wording, not the rule, was the
      mistake.

- [x] **Step 6 - The path test, and the section reviewed whole** - A vitest beside
      `teil5/bloecke.ts` asserts that every declared path is a field name in `felder.json`, and that
      the block holds 10, 2 and 2 x 7 paths, so an entry lost to a bad merge fails loudly rather than
      quietly going missing. It follows `teil4/bloecke.test.ts` exactly, including listing by hand
      any path that is written out in a component rather than declared, so the check covers all
      twenty-six. Then the whole of section 5 is reviewed in one pass against page 3 of the printed
      form. *Done when:* the test passes, and fails when a path is deliberately misspelled and again
      when an entry is deleted; the full section is screenshotted in light and dark at both widths;
      `npm test`, `npm run lint`, `npx tsc -b`, `npm run build` and `pytest` all pass.

- [x] **Step 7 - No negative quantities** - Added on 2026-09-04, after the other six were built,
      when a review of what section 5 validates found the answer was nothing per field. Part 5's
      nine quantities are a voltage, a power output, two anode counts, a diameter, and two lengths
      and two widths. None can be negative, and the legacy form permits all of them: it has no
      keystroke handler, no format check and no range check anywhere in part 5, so a fished length
      of -50 reaches FiaKa today. `teil5/bloecke.ts` declares the nine as `ZAHLENFELDER`,
      `regeln/ausruestung.ts` gains a sign check beside the pair checks, and each field gets
      `min: 0` as a spinner affordance. `FeldText`'s `bereich` prop makes `max` and `step` optional
      so a field can have a floor without an invented ceiling. **A floor only.** What counts as too
      high a voltage is a question for FFS, and guessing it would put a limit in the interface that
      no rule backs. *Done when:* typing -1 into any of the nine shows a message on that field and
      clearing it or making it 0 removes it; 0 and positive values are accepted, including a German
      decimal comma; a blank field says nothing; a value that is not a number is left to the field's
      own type; a negative anode count is reported alongside the anode pair message rather than
      instead of it; `ZAHLENFELDER` is checked against `felder.json` so a misspelling there cannot
      silently drop a field out of the rule; `npm test`, `npm run lint`, `npx tsc -b`,
      `npm run build` and `pytest` all pass.

## How the three rules behave

All three legacy checks are of the form "at least one of these two numbers must be given". Copied
literally they would fire on a brand new draft, where both numbers are blank, and
`ProtokollFormular.tsx` is explicit that this form does not do that:

> The asterisks mark what is needed to submit, which is feature 11's gate; the rules only speak up
> about an answer that is wrong.

So each check is split along that line, and neither half is dropped.

**The blank pair is a submit requirement, not a rule.** Both numbers empty means nobody has answered
yet, which is the normal state of a protocol filled in over several sittings. Feature 11 refuses the
submission. Nothing is said now.

**The zero pair is a rule, and it fires immediately.** Zero ring anodes and zero strip anodes is not
a step on the way to a correct answer; it is a claim that the survey was carried out with no anode,
which cannot be true of an electrofishing survey. Likewise a fished length of zero by zero. That is
an answer that is wrong, which is precisely what a rule is for.

**Nothing is cleared and nothing is blocked.** Settled for the percentage runs in `regeln/prozent.ts`
and again for the Einflüsse in `regeln/einfluesse.ts`, for reasons that apply here unchanged: the
legacy form refuses the keystroke, and refusing it makes an ordinary correction impossible.

**The message goes under the pair, not on a field.** The same call `gruppen.ts` and `bloecke.ts`
already make: no field in the document names the combination, and turning both boxes red for one
problem is noise, when only the surveyor knows which of the two numbers was the wrong one.

### One looseness inherited on purpose

The legacy check pairs the two **lengths** with each other and the two **widths** with each other,
never a row with itself. So a length entered against "Über die gesamte Gewässerbreite" and a width
entered against "entlang der Ufer" passes, leaving two half-filled rows and neither area actually
described.

We mirror that rather than inventing a row completeness rule, on the same grounds `typen.ts` gives
for the Besatzmaßnahmen rows: "Nothing checks a row for completeness. A year with no species, or a
species with no year, is accepted, as it is in the legacy form." Whether a fished area needs both
numbers is a question about how FFS reads these records, and it is theirs to answer. It is not a
defect, because nothing here corrupts a record that was entered, so it is question 5 in
[../../../docs/ffs-questions.md](../../../docs/ffs-questions.md) rather than an item in
`ffs-defect-list.md`.

## Two names that do not match project-overview.md

Both are cases of the legacy path winning, which `coding-standards.md` requires. Neither is a slip.

| project-overview.md sketch | Legacy path, and what we use | Precedent |
|---|---|---|
| `ausruestung.ausgangsleistung` | `ausruestung.leistung` | same as `messdaten.temperatur` vs `wassertemperatur` |
| `anodenfuehrer` nested inside `ausruestung` | `anodenfuehrer` is its own top-level group | the sketch says "Exact keys follow the legacy field paths" |

The overview's `antworten` sketch is labelled a sketch and says so itself, so neither of these needs
the overview regenerating.

## Files / areas

**Changed**

- `docs/ffs-defect-list.md` - items 11 and 12, and the counts in the opening and closing sections
- `backend/scripts/extract_form_definition.py` - `RADIO_LABELS` gains `ausruestung.bauweise`
- `database/seed/form_version_20260609/optionslisten.json` - regenerated, not edited
- `database/seed/form_version_20260609/felder.json` - regenerated alongside it. One line, linking
  `ausruestung.bauweise` to its new option list. The script writes both files on every run
- `database/seed/form_version_20260609/README.md` - the list table gains `ausruestung.bauweise`
- `frontend/src/protokoll/optionen.ts` - the new list name, and the duplicate collapse
- `frontend/src/protokoll/entwurf/typen.ts` - the `ausruestung`, `anodenfuehrer` and
  `befischte_bereiche` groups
- `frontend/src/protokoll/abschnitte/AbschnittInhalt.tsx` - section 5 routes to a real body
- `frontend/src/protokoll/regeln/schema.ts` - three rules registered
- `frontend/src/protokoll/regeln/regel.ts` - `pfad` widens to the new group paths, and `wertAus`
  moves here from `prozent.ts` so both rules share one walk
- `frontend/src/protokoll/regeln/prozent.ts` - reads `wertAus` from `regel.ts`
- `frontend/src/protokoll/felder/FeldText.tsx` - `bereich` accepts a floor without a ceiling
- `frontend/src/i18n/locales/de.json` - the section's strings. **Not `en.json`**, which is a ten line
  stub the shell alone uses; the second locale is filled in by feature 17

**Created**

- `frontend/src/protokoll/abschnitte/Abschnitt5.tsx`
- `frontend/src/protokoll/abschnitte/teil5/AusruestungBlock.tsx`
- `frontend/src/protokoll/abschnitte/teil5/BefischteBereicheBlock.tsx`
- `frontend/src/protokoll/abschnitte/teil5/PaarMeldung.tsx` - added during the build. All three
  rules are the same check over a different pair, so one message component used three times beats
  three near-identical ones. It takes only which pair it is; the fields and the message both come
  from the rule
- `frontend/src/protokoll/abschnitte/teil5/bloecke.ts` and `bloecke.test.ts`
- `frontend/src/protokoll/regeln/ausruestung.ts` and `ausruestung.test.ts`
- `frontend/src/protokoll/optionen.test.ts`

## Data / contracts

Load-bearing. Feature 3 sends this same document to the server and feature 9 adds the last group to
it, so these keys are fixed here. Every value is a string, for the reason `typen.ts` gives: a number
input holds "54" mid-typing and "" when cleared, and neither is a number.

```
ausruestung          egeraet, spannung, leistung, bauweise, ringanoden,
                     ringanoden_durchmesser, kathode, streifenanoden,
                     kiemennetz, stoppnetz
anodenfuehrer        vorname, nachname
befischte_bereiche   ges_gew_laenge, ges_gew_breite, ges_gew_stromauf,
                     ges_gew_stromab, ges_gew_vom_boot, ges_gew_watend,
                     ges_gew_vom_ufer,
                     ufer_laenge, ufer_breite, ufer_stromauf, ufer_stromab,
                     ufer_vom_boot, ufer_watend, ufer_vom_ufer
```

Every path above is verified against `felder.json` in step 6. A checkbox holds `"Ja"` when ticked
and `""` when not, as everywhere else on this form.

## Testing

**The gate is on.** `npm test` from `frontend/` and `pytest` from `backend/`, both declared in
`AGENTS.md`. Logic-bearing steps ship a passing test in the same diff.

| Step | In-scope logic | Test |
|---|---|---|
| 1 | none, documentation only | none |
| 2 | duplicate collapse in `optionen()` | `optionen.test.ts`, plus `pytest` for the script |
| 3 | none, fields only | browser and build evidence |
| 4 | none, fields only | browser and build evidence |
| 5 | the three pair rules | `regeln/ausruestung.test.ts` |
| 6 | the path transcription | `teil5/bloecke.test.ts` |

Components and layout are verified with the dev server, screenshots and the build, exactly as
`coding-standards.md` requires. Playwright is not installed and is not added here.

## Notes for the AI

- **The domain stays German.** Field paths are the legacy PDF's, exactly. `leistung` not
  `ausgangsleistung`, `anodenfuehrer` at the top level not inside `ausruestung`.
- **Controls come from MUI.** `Select`, `TextField`, `Checkbox`, `RadioGroup` and `Autocomplete`
  before any native control, through the existing `Feld*` wrappers, which already carry the label
  association, the hint, the error and the aria wiring. Do not write a new field component unless
  part 5 genuinely needs a control none of the six provides.
- **Accessibility is an acceptance criterion, not a later pass.** The fished areas table is the risk
  here: a grid of ten checkboxes whose only distinguishing information is a column heading is
  unusable with a screen reader. Each control needs a name that stands on its own.
- **Do not hand-edit `optionslisten.json`.** Change `RADIO_LABELS` and re-run
  `backend/scripts/extract_form_definition.py`. The file's README says so and the script's guard
  depends on it.
- **Nothing here writes to the server.** Answers live in browser storage until feature 3, and there
  are no submission endpoints yet.
- **No em dashes** anywhere: code, comments, commit messages, locale strings.
