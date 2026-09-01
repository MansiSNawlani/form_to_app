# Feature: 4b - Part 1 fields

**From build-plan:** feature 4b, the second of three sub-features of item 4 (Form part 1)
**Status:** built, awaiting review

## Goal

Fill section 1 of the protocol with its real fields: the Anlass block, the Bearbeiter block and the
Probestrecke block, all built from the option lists already extracted from the legacy PDF.

Feature 4a built the frame and wired a single field, `anlass`, to prove that a value chosen in the
form reaches storage and comes back. This feature makes section 1 a form somebody could actually
fill in.

It also settles something larger than part 1. There are roughly 338 fields in this protocol and
this is the first feature that renders a lot of them at once. Whatever pattern the twenty-eight
fields here use, features 5 to 9 will copy. Step 1 therefore builds the small set of field
components the rest of the form is made from, before any block is laid out.

Rules are explicitly not here. The Anlass does not yet make the Monitoringstrecken-Nr. mandatory,
the Vorfluter chain is not checked for ending at the Rhein or the Donau, and coordinates outside
Baden-Wuerttemberg are accepted. That is feature 4c, which follows immediately.

## Design reference

`prototypes/protokoll-teil-1.html` is the target, specifically the three `form-section` fieldsets:
Anlass der Befischung, Bearbeiter, and Probestrecke. Build against the existing tokens in
`frontend/src/styles/theme.css` and `frontend/src/theme/muiTheme.ts`. Do not add colours.

The classes the mockup uses for fields are only partly ported. `protokoll.css` already has `.grid`,
`.col-*`, `.field` and `.form-section`. Step 1 ports the missing ones from `prototypes/mockup.css`:
`.field__req`, `.field__hint`, `.field__error`, `.tabular`, `.unit-row`, `.unit-row__unit` and
`.callout`.

### Deliberate departures from the mockup

Six, each with its reason. The extracted form definition in
`database/seed/form_version_20260609/` wins wherever it and the mockup disagree, because the mockup
was drawn before the PDF was read properly.

| # | The mockup shows | We build | Why |
|---|---|---|---|
| 1 | Anlass options invented for the drawing ("Besatzkontrolle") | The six extracted values | The mockup predates the extraction |
| 2 | Regierungspraesidium as "1 - Stuttgart" | The extracted list, where 1 is Karlsruhe | Recorded as discrepancy 4 in the 4a spec |
| 3 | Three Vorfluter fields | Five | The PDF has `vorfluter1` to `vorfluter5`, and `project-overview.md` says max 5 |
| 4 | A red error under Monitoringstrecken-Nr. | No error state yet | Rules are feature 4c. Build the markup so 4c only adds the message |
| 5 | An Anodenfuehrer field in the Bearbeiter block | Not here | `project-overview.md` puts it in `ausruestung`, which is feature 8 |
| 6 | Coordinates only, under each boundary | A description field above each coordinate pair | `probestrecke.untere` and `probestrecke.obere` are real PDF fields the mockup omits. Confirmed in review on 2026-09-01 |

## In scope

Twenty-eight new fields, plus the one that already exists. Every one is registered under its legacy
PDF path.

### The field components (step 1)

A small set of wrappers over MUI, in `frontend/src/protokoll/felder/`, so that a field is one line
in a block rather than fifteen. This is the load-bearing part of the feature.

### Block 1 - Anlass der Befischung

| Legacy path | Control | Option list |
|---|---|---|
| `anlass` | Select, 6 options | already built in 4a, moved onto the new components |
| `probestrecke.monitoringnummer` | Autocomplete, 722 options | `probestrecke.monitoringnummer` |
| `z.rp` | Select, 4 options | `z.rp` |
| `datum` | date | |
| `messdaten.uhrzeit` | time | |
| `z.quelle` | Select, 13 options | `z.quelle` |
| `z.ps_nummer` | text | |

`z.quelle` and `z.ps_nummer` are included by a decision taken in review on 2026-09-01. They appear
nowhere in the data model in `project-overview.md` and look like FiaKa bookkeeping rather than
survey data, so **this is worth confirming with FFS**: if surveyors are not the ones who fill them
in, they come out again in 4c or later.

`messdaten.uhrzeit` keeps its part 2 path but renders here, which is discrepancy 1 from the 4a
spec: the PDF files the time under part 2, the mockup and the `Submission` model put it in part 1.

### Block 2 - Bearbeiter

`bearbeiter.name`, `bearbeiter.firma`, `bearbeiter.strasse`, `bearbeiter.plz`, `bearbeiter.ort`,
`bearbeiter.telefon`, `bearbeiter.email`. All plain text.

`bearbeiter.ort` **does not exist in the PDF.** The form has a street and a postcode but no town,
while both the mockup and the `Person` model have one. Discrepancy 2 from the 4a spec, which says
4b adds it. Since it is not in the extracted definition, the field carries a comment saying so, and
it is on the list to raise with FFS.

### Block 3 - Probestrecke

| Legacy path | Control |
|---|---|
| `probestrecke.gewaesser.gewaessername` | text |
| `probestrecke.gewaessertyp` | Select, 8 options |
| `probestrecke.laenge` | number, with a metre suffix |
| `probestrecke.ortsangabe` | text, full width |
| `probestrecke.gewaesser.vorfluter1` to `vorfluter5` | text |
| `probestrecke.untere` | text |
| `probestrecke.utm_rw_unten`, `probestrecke.utm_hw_unten` | number |
| `probestrecke.obere` | text |
| `probestrecke.utm_rw_oben`, `probestrecke.utm_hw_oben` | number |

Plus the two explanatory callouts from the mockup, one over the Vorfluter chain and one over the
coordinates. They carry the reasoning a surveyor needs and are not decoration.

### Also in scope

- The page head title, which the 4a code leaves as the literal word "Protokoll". It becomes the
  Gewaessername and the Ortsangabe, as in the mockup, falling back to a placeholder while both are
  empty.
- German strings for everything above in `frontend/src/i18n/locales/de.json`.

## Out of scope

- **Every validation rule.** Feature 4c owns the Monitoringstrecken-Nr. becoming mandatory for
  WRRL and FFH, the Vorfluter chain ending at the Rhein or the Donau, and the Baden-Wuerttemberg
  coordinate bounds. Required fields are marked visually here, but nothing is enforced and nothing
  blocks.
- **Zod schemas.** Zod is installed but stays unused until 4c. Do not add a schema that only
  restates the types.
- **Hydrology suppression.** Choosing See, Teich or abgeschnittenes Altwasser does not yet change
  section 2. Feature 5.
- **Anything on the backend.** No endpoint, table or migration. Feature 3 swaps the draft store's
  storage layer under the same interface.
- **The Anodenfuehrer field.** Feature 8.
- **Sections 2 to 6.** They keep their placeholders.
- **The map picker.** Coordinates are typed. Feature 18.
- **Login and ownership.** Item 2.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The field components and the answers document** - `Antworten` grows every part 1
      path listed above. The missing mockup classes are ported into `protokoll.css`. Three
      components appear under `frontend/src/protokoll/felder/`: `FeldText` (text, number, date,
      time, email and tel, with an optional unit suffix), `FeldAuswahl` (a Select over a named
      option list) and `FeldSuche` (an Autocomplete over a named option list). Each takes a legacy
      path, a label key, a column width, and whether it is required; each renders label above
      control in a `FormControl` with `FormLabel`, per `coding-standards.md`. `Abschnitt1` moves
      its `anlass` field onto `FeldAuswahl`. *Done when:* the Anlass dropdown looks and behaves
      exactly as it did before, choosing a value still survives a reload, `npm run build` and
      `npm test` pass, and no component holds a colour or a literal German string.

- [x] **Step 2 - The Anlass block** - the remaining six fields of block 1, laid out on the mockup's
      grid. The Monitoringstrecken-Nr. uses `FeldSuche`, since 722 options is past what a dropdown
      can serve. *Done when:* all seven fields accept input, every one survives a reload, the
      Monitoringstrecken-Nr. filters as you type and is reachable and selectable by keyboard alone,
      and the block matches the mockup's column widths in light and dark.

- [x] **Step 3 - The Bearbeiter block** - the seven contact fields, on the mockup's grid.
      *Done when:* all seven accept input and survive a reload, each has a real label association,
      and tabbing runs through them in the visual order.

- [x] **Step 4 - The Probestrecke block: the water and the chain** - Gewaessername, Gewaessertyp,
      Laenge with its metre suffix, the full-width Ortsangabe, the Vorfluter callout and the five
      Vorfluter fields. *Done when:* all nine fields survive a reload, the Gewaessertyp dropdown
      shows the eight extracted codes with their labels, and the hint under it says section 2
      disappears for See, Teich and abgeschnittenes Altwasser without that yet being true.

- [x] **Step 5 - The Probestrecke block: the boundaries, and the page head** - the coordinate
      callout, the two boundary description fields and the four coordinate fields, then the page
      head title driven by the answers. A pure `protokollTitel(antworten)` helper returns the
      Gewaessername and the Ortsangabe joined, or just whichever is filled, or a placeholder when
      neither is. *Done when:* the six fields survive a reload, `protokollTitel`'s unit tests pass
      over all four of those cases, typing a Gewaessername changes the heading at the top of the
      page, and the whole of section 1 reads correctly in light and dark at both desktop and narrow
      widths.

## Files / areas

| Path | Why |
|---|---|
| `frontend/src/protokoll/entwurf/typen.ts` | `Antworten` grows the part 1 paths |
| `frontend/src/protokoll/entwurf/titel.ts` | `protokollTitel`, the head title helper |
| `frontend/src/protokoll/entwurf/titel.test.ts` | its tests |
| `frontend/src/protokoll/felder/FeldText.tsx` | text, number, date, time, email, tel |
| `frontend/src/protokoll/felder/FeldAuswahl.tsx` | a Select over a named option list |
| `frontend/src/protokoll/felder/FeldSuche.tsx` | an Autocomplete over a named option list |
| `frontend/src/protokoll/abschnitte/Abschnitt1.tsx` | the three blocks |
| `frontend/src/protokoll/ProtokollKopf.tsx` | the title stops being a constant |
| `frontend/src/protokoll/protokoll.css` | the missing mockup field classes |
| `frontend/src/i18n/locales/de.json` | every new string |

If `Abschnitt1.tsx` grows past a comfortable read, split the three blocks into
`abschnitte/teil1/AnlassBlock.tsx`, `BearbeiterBlock.tsx` and `ProbestreckeBlock.tsx` rather than
letting one file carry twenty-nine fields. Decide that at step 3, when the size is visible.

## Data / contracts

**Load-bearing. Features 5 to 9 add to the same document and feature 3 sends it to the server
unchanged, so these choices are locked here rather than improvised later.**

### Every answer is a string

`Antworten` values are `string | undefined`, including the coordinates and the length. Three
reasons:

1. A draft is half-finished by definition. A number input holds `"54"` mid-typing and `""` when
   cleared, and neither is a number.
2. The legacy PDF stores every field as text, and the export values in `optionslisten.json` are
   strings. Storing what the user typed keeps the FiaKa transfer a direct match.
3. Conversion to an integer is a validation concern, and validation belongs at the boundary:
   feature 4c's Zod schema and, later, Pydantic on the server. Doing it in the field component
   would put a rule in the rendering layer.

`undefined` means never touched, `""` means touched and cleared. Nothing in 4b distinguishes them;
4c may.

### The paths

Nested so each spells out its legacy PDF path exactly, as 4a established:

```
antworten.anlass
antworten.datum
antworten.messdaten.uhrzeit
antworten.z.rp
antworten.z.quelle
antworten.z.ps_nummer
antworten.bearbeiter.{name,firma,strasse,plz,ort,telefon,email}
antworten.probestrecke.gewaesser.gewaessername
antworten.probestrecke.gewaesser.vorfluter1 .. vorfluter5
antworten.probestrecke.{ortsangabe,gewaessertyp,laenge,monitoringnummer}
antworten.probestrecke.{untere,utm_rw_unten,utm_hw_unten}
antworten.probestrecke.{obere,utm_rw_oben,utm_hw_oben}
```

`bearbeiter.ort` is the only path here with no field behind it in the PDF.

### The field component signature

Locked, because roughly 300 more fields use it. Each component takes the legacy path as its `name`,
a translation key, a column span, and an optional required flag. Nothing else. Anything a specific
field needs beyond that (the metre suffix, the numeric input mode) is a named prop, never an
escape hatch that lets a caller pass arbitrary styling.

`FeldAuswahl` and `FeldSuche` take a `ListenName` from `optionen.ts`, so a wrong list name is a
build error rather than an empty dropdown. Neither ever receives an inline array of options.

### Labels

The label shown is the one in the extracted list. Where the numeric code itself carries meaning to
the reader, the code is prefixed: `Gewaessertyp` renders "14 - Fluss", because the hint beneath it
and `CONTEXT.md` both talk in those codes. `probestrecke.monitoringnummer` already carries its
number in the extracted label and needs no prefix.

### Controls

MUI everywhere, per `coding-standards.md` and the decision of 2026-09-01. Dates and times use
MUI's `TextField` with `type="date"` and `type="time"`, **not** `@mui/x-date-pickers`. That package
is a separate dependency needing a date-library adapter, and a native date input is well understood
by keyboard and screen reader users. Revisit only if FFS asks for a calendar.

`probestrecke.gewaessertyp` is a radio group in the PDF but renders as a Select, following the
mockup. Eight options with long labels do not fit the mockup's four-column row as radios.

## Testing

The frontend runner is vitest, added in 4a. `npm test` from `frontend/`.

| What | How |
|---|---|
| `protokollTitel` | Unit test. Both fields, Gewaessername only, Ortsangabe only, neither. This is the one piece of in-scope logic where a wrong answer is possible, so it carries the gate at step 5. |
| The draft store | Untouched. Its existing tests must stay green after `Antworten` grows. |
| Every field persisting | Browser. Fill the block, navigate to section 4, come back, reload. The value is still there. |
| The Autocomplete | Browser and keyboard. Tab to it, type three digits, arrow to a result, press Enter, confirm the stored value is the number and not the label. |
| Label association | Browser. Click each label, confirm focus lands in its control. |
| Both themes | Screenshot section 1 in light and dark at desktop width, and once below 800px where the grid collapses. |
| Build | `npm run build` from `frontend/` at the end of every step. |

The field components themselves get no unit tests. They render; `coding-standards.md` puts
components on browser evidence and the build, not on vitest.

No backend change, so `pytest` is untouched, though it should be green before `/complete`.

## Notes for the AI

- **Every user-visible string comes from `de.json`.** No literal German in a component. That
  includes the callout text and the hints.
- **No colour outside the tokens.** No `sx` colour overrides, no hard-coded hex. Where MUI's
  default composition fights the mockup, change `muiTheme.ts` once rather than patching a call
  site.
- **The app must not read as a Material app.** Flat surfaces, 4px radius, no elevation shadows.
- **Accessibility is an acceptance criterion, not a later pass.** Label above control via
  `FormLabel` inside a `FormControl`, never `InputLabel` and its notch. Every control has a real
  label association. The required marker is `aria-hidden`, with the requirement carried by
  `aria-required`. Focus stays visible against our tokens in both themes.
- **Do not add a dependency.** Not `@mui/x-date-pickers`, not a masking library, not Playwright,
  not a second component library.
- **Do not retype an option list.** Everything comes through `optionen.ts` from the aliased
  `optionslisten.json`. The file is 97 KB and the whole of it is currently imported, which also
  pulls in the 123 species for feature 9. Leave that alone unless the build warns; if it does,
  split the import per list rather than copying values into code.
- If the 722-option Autocomplete feels slow when you try it, cap the rendered results with MUI's
  `filterOptions` limit. Do not reach for virtualization before seeing a problem.
- **Two things to raise with FFS**, both recorded above and neither blocking: `bearbeiter.ort` is
  missing from the form, and `z.quelle` with `z.ps_nummer` may not be the surveyor's to fill in.
