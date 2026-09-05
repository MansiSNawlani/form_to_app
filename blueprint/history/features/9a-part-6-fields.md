# Feature: 9a - Part 6 fields

**From build-plan:** feature 9a, under feature 9, "Form part 6: the catch table"
**Status:** completed 2026-09-05

## Goal

Build the catch table, the last of the six sections and the one every other feature exists to
support: which species were caught, how many of each, sorted into ten size classes, and how many of
those were young-of-year. Twenty-six rows of thirteen columns, 339 of the form's 540 fields in one
block, of which 312 are answered and 27 are the totals the form works out for itself, plus the
Ergänzende Anmerkungen box printed above it.

This sub-feature builds the table, the species picker, the live totals and the layout. The rules
that judge what is in it are 9b.

After 9a and 9b all six sections are real and the protocol is complete, which is what unblocks
features 2, 3 and 11.

## Why feature 9 is split, and along which line

Feature 9 is the largest item in the build plan by a wide margin. The split follows the same fields
and rules line features 4, 5 and 6 used.

| Feature | Fields | Rules | Split? |
|---|---|---|---|
| 6a + 6b | 54 | 6 percentage runs | yes |
| 7 | 43 | none | no |
| 8 | 26 | 3, all "at least one of a pair" | no |
| **9a + 9b** | **339** | **4** | **yes** |

339 fields is more than parts 1 to 5 put together. They are one row definition rendered 26 times
rather than 339 hand-written elements, so the code is far smaller than the count suggests, but the
layout is not: a thirteen column numeric grid that has to stay usable with a keyboard, with a
screen reader and on a narrow screen is the hardest interface problem on this project, and it is
the whole of step 6.

## What the legacy form actually does here

Read out of the PDF on 2026-09-04, from the page 3 content stream, the widget rectangles, the field
dictionaries and `Resources/Fiaka_Resources/validation.js`. Five findings change what gets built.

### The columns, left to right

The header text extracts out of order, so the column boundaries were taken from the widget
rectangles instead. `arten.art1.klasse_1` sits at x=210 and `klasse_10` at x=473, ascending, and the
headings fall in the same order:

| Field | Heading | Field | Heading |
|---|---|---|---|
| `klasse_1` | ≤ 5 | `klasse_6` | >25 - 30 |
| `klasse_2` | >5 - 10 | `klasse_7` | >30 - 40 |
| `klasse_3` | >10 - 15 | `klasse_8` | >40 - 50 |
| `klasse_4` | >15 - 20 | `klasse_9` | >50 - 60 |
| `klasse_5` | >20 - 25 | `klasse_10` | > 60 |

All in centimetres, from the block heading "Nachgewiesene Arten und Größenklassen (cm)".

### Σ and Gesamtsumme are calculated, not typed

`arten.artN.summe` carries `AFSimple_Calculate("SUM", ...)` over that row's ten classes and the
read-only flag. `arten.gesamtsumme` does the same over the 26 row sums and is read-only too.

**So they are derived and are not stored.** `project-overview.md`'s `antworten` sketch agrees: it
lists `arten` as `list of { code, klassen[10], null_plus }` with no total in it. Storing a number
the form computes would let a hand-edited draft carry a total that disagrees with its own cells.
This is the one place where a name in `felder.json` deliberately has no key in `Antworten`, and
step 1's test asserts that on purpose rather than leaving it to look like an omission.

### 0+ is a subset of the row, not an extra column

The word printed above the `0plus` column is **"davon"**, which is "of which". So young-of-year
individuals are already counted in the size classes beside them, and the row total must not include
them again.

That is where 9b's young-of-year rule comes from, and it is also why `gesamtsumme` sums only the
`summe` fields. **Nothing in the legacy form checks it.** Confirmed by grepping every `0plus`
reference in `all_js_Formular.js`: all 78 are display toggles and value clears (26 rows x 3), and none is a
comparison. So the young-of-year rule is ours to add, not a rule to port. It belongs to 9b.

### The cells accept negative numbers

Every cell carries `AFNumber_Keystroke(0, 2, 0, 0, "", true)`. Zero decimal places and German
separators, which is right, but `negStyle` 0 means a minus sign is accepted. So a catch of -12
Bachforellen passes the legacy form. Same gap feature 8 closed for part 5's nine quantities, and it
is closed the same way, in 9b.

### The species picker hides its own row

Each `arten.artN.name` carries a validate script that shows the eleven cells beside it when a
species is chosen and hides **and clears** them when it is not. That is where the growable table
comes from, and it is the one piece of legacy behaviour that is a good idea: 312 empty boxes on
screen at once is not a form anybody can fill in.

We keep the growing and drop the clearing. Clearing eleven answered cells because somebody opened
the species dropdown to re-read it is the same destructive reflex `regeln/prozent.ts` refused for
the percentage runs, and step 5 says what happens instead.

## The row model, decided on 2026-09-04

Two shapes were on the table and the middle one was chosen.

**The keys stay exactly the legacy form's.** `arten.art1.klasse_3`, `arten.art7.0plus`, all 312 of
them, generated in `typen.ts` as a mapped type over the row numbers 1 to 26 rather than written out.
`coding-standards.md` makes the legacy path the name, and it is what keeps the eventual FiaKa
transfer a direct match rather than a mapping table somebody maintains. A real `arten[]` array would
have made paths like `arten.0.klassen.2` and pushed a translation step into feature 19.

**The screen shows a list.** Only rows that hold something, plus the blank one at the bottom, up to
26. The saved draft keeps the same shape either way, because every key in `Antworten` is optional
and an untouched row stores nothing at all.

This is the pdf-layout-is-not-the-ui-target rule doing its job: the legacy PDF decides that there
are 26 rows and what each column means, and it decides nothing about how many of them are on screen.

## Design reference

**No mockup, and none is needed.** The same decision made for 6a, 7 and 8 on 2026-09-03. Two
references stand in.

1. **`prototypes/protokoll-teil-1.html` and `prototypes/mockup.css`** for everything structural: the
   section card, the `fieldset` and legend, the label above the control. Section 6 must look like
   sections 1 to 5 built it, and where it cannot (a table has column headings, not labels above
   fields) step 6 says why.
2. **Page 3 of `Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf`**, lower
   half, for which fields exist, what the columns mean and what order they are in.

The printed table is one reference the app does not copy. It is 26 rows of empty boxes on paper
because paper cannot grow.

## In scope

- The `arten` group in `Antworten`: 26 rows of a species code, ten size class counts and a
  young-of-year count, generated as a mapped type.
- The catch table: the species picker over the 123 entry `arten` list, the ten class cells and the
  0+ cell per row.
- The live row total and the live grand total, derived on screen and never stored.
- Rows that grow to 26 and shrink again, with the rows below closing the gap.
- `bemerkungen.bemerkung_fische`, the Ergänzende Anmerkungen box printed above the table, deferred
  here from feature 8.
- Section 6 routing to a real body, replacing the placeholder.
- The layout and accessibility pass: a real `<table>`, a sticky species column, horizontal scrolling
  below the breakpoint, and every cell carrying a name that stands on its own.
- A path test pinning all 312 stored paths against `felder.json`, and asserting that the 27 derived
  fields are excluded deliberately.
- `docs/ffs-questions.md`, the list four earlier specs already refer to and nobody wrote. Step 7,
  and cuttable.

## Out of scope

- **All four of part 6's rules**, which are 9b: the young-of-year count not exceeding its row, the
  four "no detection" codes when nothing was caught, no negative counts, and no species named twice.
  9a shows totals; it does not judge them.
- **Required at submit.** The legacy form marks `arten.art1.name` required in the field dictionary
  (`Ff` bit 2, set on row 1 and on no other row) and then never enforces it. Nothing here blocks
  anything; the submit gate is feature 11, as it is for parts 1 to 5.
- **The backend half.** Written browser side only, as the build plan's 2026-09-01 note says for
  every rule in features 4 to 9. Features 2 and 3 close that gap.
- **Searching by species**, which is feature 12, and needs the server.
- **Any change to the `arten` option list.** 123 entries, no duplicate export value and no duplicate
  label, checked on 2026-09-04. Two oddities are noted below and neither is acted on in the table.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The `arten` shape and the size class declaration** - `Antworten` grows the `arten`
      group as a mapped type over row numbers 1 to 26, each row holding `name`, `klasse_1` to
      `klasse_10` and `0plus`, so all 312 paths are typed without 312 lines. `abschnitte/teil6/
      tabelle.ts` declares the ten size classes once, in printed order, each with its label key and
      its path suffix, plus the row numbers and the 26 row cap. No UI yet. This comes first because
      every later step addresses a field by one of these paths, and a misspelling caught here is
      free while one caught in step 6 is a rebuild.
      *Done when:* `arten.art7.klasse_3` and `arten.art7.0plus` both type-check as `AntwortPfad`
      and `arten.art27.klasse_1` does not; a vitest beside `tabelle.ts` proves every one of the 312
      generated paths is a name in `felder.json`, that there are exactly 312, that they and the 27
      derived names together account for all 339 `arten` fields in the form with nothing left over,
      and that the ten class labels are distinct; the same test asserts that `arten.artN.summe` and `arten.gesamtsumme` are
      in `felder.json` and deliberately absent from `Antworten`, naming the reason, so the gap reads
      as a decision rather than a lost field; the test fails when a suffix is deliberately misspelled
      and again when the row cap is changed to 27; `npm test` and `npx tsc -b` pass.

- [x] **Step 2 - Section 6 opens, with the Ergänzende Anmerkungen box** - `Abschnitt6.tsx`,
      `AbschnittInhalt` routing section 6 to it instead of the placeholder, and
      `teil6/BemerkungFischeBlock.tsx` holding the one field feature 8 deferred here,
      `bemerkungen.bemerkung_fische`. A multi-line `FeldText`, like the two remarks boxes part 4
      already has. Small on purpose: it makes section 6 real and gives the table somewhere to land.
      *Done when:* section 6 opens on a real form with no placeholder; the box accepts several
      paragraphs, grows as it is typed into and survives a reload; it is labelled and reachable by
      keyboard; it reads correctly in light and dark; the last placeholder in the protocol is gone
      and `AbschnittPlatzhalter.tsx` is deleted if nothing else uses it; the `feature` field on
      `ABSCHNITTE` in `abschnitte.ts` goes with it, since the placeholder was its only reader and
      `coding-standards.md` does not allow dead code to sit there waiting for a use.

- [x] **Step 3 - The catch table, one row** - `teil6/ArtenTabelle.tsx` renders a real `<table>`: a
      header row naming the species column, the ten size classes, Σ and davon 0+, and one body row
      built by mapping over `KLASSEN` from step 1. Two thin cell components, because the `Feld*`
      family puts a label above the control and a table cell is named by its column heading instead:
      `teil6/ArtZelle.tsx` wraps the `Autocomplete` over the 123 entry list, and
      `teil6/ZahlZelle.tsx` a number input. Both reuse `feldAria` from `felder/rahmen.ts` so the aria
      wiring is not written twice. No totals yet, no second row.
      **Styling stops at what makes the table legible.** The column widths, the sticky species
      column, the scrolling and the responsive behaviour are all step 6, which is the only reason
      this step stays one diff rather than two: the markup and the CSS are genuinely separable here,
      and splitting the four new files any further would leave a step that renders nothing.
      *Done when:* one row accepts a species and eleven numbers and all twelve survive a reload; the
      species search is usable from the keyboard alone and stores the export code rather than the
      label; every cell has an accessible name that stands on its own, naming both its row and its
      column, so a screen reader user hears "Art 1, über 10 bis 15 cm" rather than a bare number box;
      the header cells are `<th scope="col">`; tabbing runs left to right along the row and into the
      next; the numbers are integers with German separators.

- [x] **Step 4 - The row total and the grand total** - `teil6/Zeilensumme.tsx` and
      `teil6/Gesamtsumme.tsx`, both derived and neither stored, following `teil3/Gruppensumme.tsx`:
      a scoped `useWatch` over only the fields each needs, so a keystroke re-renders the total and
      not the table around it. The parsing is `regeln/arten.ts`, plain functions over the answers
      document, because a count typed as "12" is a string and a German draft may hold "1.200".
      The 0+ cell is **not** in the row total, since the printed form calls that column "davon".
      *Done when:* typing into any class cell updates that row's Σ and the grand total at the foot;
      a keystroke in one row re-renders that row's total, the grand total and nothing else, shown
      with React DevTools' highlight-updates rather than asserted; clearing a cell lowers both;
      typing into the 0+ cell
      changes neither; both totals are read-only text rather than disabled inputs, so a screen reader
      announces them as values and not as broken controls; a cell holding something that is not a
      number leaves the total silent rather than showing NaN; the sum functions are pure with a
      vitest covering an empty row, a full row, German separators and an unparseable cell;
      `npm test` is green.

- [x] **Step 5 - Rows that grow and shrink** - The table shows every row holding an answer plus one
      blank, capped at 26, with an "Art hinzufügen" button and a remove control per row. Removing a
      row clears it and shifts the rows below up, so the numbering never has a hole; that shift is a
      pure function over the answers document in `teil6/zeilen.ts`, not a mutation scattered through
      the component. The visible row count is derived from the draft rather than stored, so a reload
      reopens exactly the rows that hold something. **Choosing a different species does not clear the
      row**, unlike the legacy form, which wipes eleven answered cells when the picker is touched.
      *Done when:* a fresh draft opens with one blank row; a draft saved before this feature, which
      has no `arten` key at all, opens the same way rather than throwing; filling it makes a second
      appear; the count stops at 26 and the add button disables there with a visible reason;
      removing row 2
      of three moves the old row 3 up into row 2, cells and all, and the draft after a reload matches
      what is on screen; removing the only row leaves one blank row rather than none; changing a
      species leaves that row's counts untouched; the shift function has a vitest covering a middle
      row, the last row, the only row and a full table; the add and remove controls are reachable by
      keyboard and named for the row they act on, not "Entfernen" twenty-six times.

- [x] **Step 6 - The layout and accessibility pass** - The hardest part of the feature and its own
      step. Thirteen columns do not fit a phone and will not be made to: the table scrolls sideways
      inside an `overflow-x: auto` container with the species column stuck to the left edge, so the
      row a cell belongs to is always on screen. Column headings are abbreviated in the header and
      given their full text through the cells' own accessible names, which step 3 already built.
      Then the whole section is reviewed in one pass against page 3 of the printed form.
      *Done when:* the table is readable at desktop width and scrolls rather than overflowing the
      page below 800px, with the page body itself never scrolling sideways; the species column stays
      visible while the classes scroll; focus is always visible, including on a cell that is
      partly scrolled out, and tabbing into an off-screen cell scrolls it into view; contrast passes
      in both themes against our own tokens rather than MUI's defaults; the full section is
      screenshotted in light and dark at both widths; `npm test`, `npm run lint`, `npx tsc -b`,
      `npm run build` and `pytest` all pass.

- [x] **Step 7 - The questions for FFS, gathered into a file** - Added by the critique of this
      draft on 2026-09-04, before any code. Four places already say a question is "on the list of
      questions for FFS": `blueprint/history/features/4b-part-1-fields.md` on the missing town field,
      `7-part-4-fields.md` on the Einflüsse that are not exclusive, `8-part-5-fields-and-rules.md`
      and `frontend/src/protokoll/regeln/ausruestung.ts` on row completeness in the fished areas.
      **That list does not exist.** Every question raised while building parts 1 to 5 is sitting in
      an archived spec nobody outside this repository will read, and part 6 is the last form part,
      so this is the last moment they are all still in view. `docs/ffs-questions.md` collects them
      in the shape `docs/ffs-defect-list.md` uses: what we asked, why it came up, what we assumed in
      the meantime, and what changes if the answer differs. The two species list oddities below go
      in as part of the same pass, and the four dangling references are pointed at the new file.
      No code, nothing visible in the app.
      *Done when:* every question the archived specs and the source comments say is on a list is
      actually in the file; each reads as a standalone question FFS can answer without this
      repository open; each names the assumption we are building on meanwhile, so an answer that
      agrees costs nothing; the four references above link to it; the file says plainly that it is
      to be sent to FFS alongside the defect list, which is a separate document because a question
      and a defect ask different things of them.

      **Cut this step if you would rather keep 9a to the table.** It is documentation, it is the
      only step here that touches no part 6 field, and it would sit equally well in its own `/fix`.
      It is proposed inside 9a only because feature 9 is the last form part and the questions stop
      accumulating here.

## Amended during the build

Five things changed after the steps were written. All five came out of running the real table
rather than reading the code, and two of them were bugs the spec would have shipped.

### The counting was wrong in the spec itself

The draft said 338 stored paths in four places. The real figures are **312 stored** (26 rows x 12)
and **27 derived** (26 row sums plus the grand total), which together are the 339 `arten` fields in
`felder.json`. 338 came from counting `summe` as a stored column. Corrected before step 1 was
written, and `tabelle.test.ts` now asserts the split adds up with nothing left over, so the same
slip cannot be made silently again.

### Typing in the catch table took 206ms per keystroke

Measured on 2026-09-04 with all 26 rows filled, which is 312 controls on one screen. The cause was
not part 6 at all: `useAutoSave` called `setState({ status: 'saving' })` on every keystroke, and a
fresh object literal can never be bailed out of, so every keystroke re-rendered `ProtokollFormular`
and with it the whole open section. Through parts 1 to 5 that was too cheap to notice. Part 6 has
26 MUI Autocompletes over a 123 entry list, and it stopped being cheap.

Reusing one `SPEICHERT` object took it to 11.5ms; memoising `ArtZeile` took it to **2.3ms**. This is
a change to shared code that no step asked for, made because section 6 cannot meet its own step 4
done-when without it, and because sticky typing at 338 fields is the exact thing
`coding-standards.md` chose React Hook Form to prevent.

`React.memo` on `ArtZeile` is the first use of it in this codebase. `coding-standards.md` allows it
"only when a measurement showed a problem", and the measurement is above.

### A hand-edited "1.200" silently lost 999 fish

`alsZahl` reads the dot as a decimal point, so a thousands separator came back as `1.2` and the
total printed a confident wrong number. Fixed by requiring whole numbers in `summeAusWerten`, which
is right on its own terms: a count is a number of individuals, and 2.5 Bachforellen is not a smaller
answer than 3, it is not an answer. Part 5's quantities go through the same `alsZahl` and are
deliberately left alone, because a fished length of 1.2 m is a real measurement.

### Two bugs found by driving the table

1. **Removing a row left the species picker below it showing the old value** until a reload. One
   `setValue` over the whole `arten` group updates the registered number inputs but does not notify
   the Controller-driven pickers. Fixed with a write per field, and `entfernenSchreiben` exists so
   that is testable rather than a component detail.
2. **Tabbing to an off-screen cell scrolled it under the sticky columns**, so it had focus and could
   not be seen. Fixed with `scroll-margin-left`. Step 6's done-when asked for this and the first
   check only proved that scrolling happened, not that the cell ended up visible.

### The page scrolled sideways to reach text nobody can see

Step 6's done-when says the page body must never scroll horizontally, and after the fieldset was
taught to shrink it did not. It came back, and the cause was not the table's width.

`.visually-hidden` positions absolutely, and the column headings that use it sit inside a table that
is 1033px wide inside a 600px frame. With no positioned ancestor they resolved against the initial
containing block, which `overflow` cannot clip, so the document grew to 1051px to make room for text
that is deliberately invisible. Bisecting the layout on 2026-09-05 showed `overflow-x: hidden` on
the frame did not contain it and `contain: paint` did, which is what pointed at the containing block
rather than at the width. `position: relative` on `.tabelle-rahmen` fixes it.

Worth stating because the first fix looked like it worked: the check that caught it was driving the
page and asking whether it actually scrolls, not comparing two widths.

### The row count did not grow by itself

Step 5's done-when says "filling it makes a second appear" and the first implementation only grew on
the button. Deciding when to grow means watching the last row, and a watch in the table would
re-render all 312 controls per keystroke, so it is `Zeilenwaechter`, a component that renders
nothing and exists to hold that subscription in a leaf.

### The table was rebuilt on MUI, and the rule that says so was widened

Asked on 2026-09-05, after the table was finished: why is this a bare `<table>` when every control
inside it is MUI? Fair question, and the honest answer was that MUI's `Table` had never been
weighed. The comment at the top of `ArtenTabelle.tsx` argued against a grid of divs, which is a
different argument.

Offered the choice between MUI everywhere and a narrower rule keeping MUI for behaviour-carrying
controls only, the answer was MUI everywhere. So `coding-standards.md` now reads "use MUI wherever
MUI has a component" with no behaviour-versus-structure carve-out, and section 6 was rebuilt on
`Table`, `TableHead`, `TableBody`, `TableFooter`, `TableRow`, `TableCell` and `TableContainer`.
`<caption>` stays native, because MUI genuinely has no component for it.

The look moved with it. The cell borders, spacing, type and the two sunken backgrounds are now
`MuiTable`, `MuiTableCell` and `MuiTableContainer` overrides in `muiTheme.ts`, so the review queue
in feature 12 and the user list in feature 16 inherit them instead of restating them. What stayed in
`protokoll.css` is only what the catch table alone needs: the two sticky columns, the cell widths,
and the `scroll-margin-left` that keeps a focused cell out from under them. Those selectors gained
an `.arten-tabelle` ancestor, because a single class ties with MUI's own themed class and would then
be settled by stylesheet order rather than by intent.

Three things were checked rather than assumed, since the conversion adds 364 styled components to
the screen that already cost the most:

| Measure | Before | After |
|---|---|---|
| Keystroke at 26 rows, 312 controls | 2.3ms | 2.28ms |
| Bundle, raw | 1,057.67 kB | 1,065.26 kB |
| Bundle, gzipped | 322.28 kB | 324.28 kB |

Typing is unchanged because `memo` on `ArtZeile` means a keystroke re-renders one row's total and
the grand total, not the cells; the extra components cost only at mount. `TableCell` inside a
`TableHead` renders `th scope="col"` by itself, and `component="th" scope="row"` gives the row
number and the Gesamtsumme label theirs, so nothing was lost from step 3's accessibility work.
Re-verified after the conversion: the page still never scrolls sideways at either width in either
theme, the species column still holds while the classes scroll, a focused off-screen cell still
lands clear of the sticky columns, removing a row still shifts the rows below up and survives a
reload, and filling the last row still opens the next.

## Data / contracts

Load-bearing, and the last group the document gains. Feature 3 sends this same document to the
server and feature 19 maps it into FiaKa, so these keys are fixed here.

```
arten.art1 .. arten.art26     name, klasse_1 .. klasse_10, 0plus
bemerkungen.bemerkung_fische  free text
```

Every value is a string, for the reason `typen.ts` gives: a number input holds "12" mid-typing and
"" when cleared, and neither is a number.

**Three names deserve a second look.**

| Name | Why it is what it is |
|---|---|
| `0plus` | Starts with a digit, so it is a quoted key. `project-overview.md`'s sketch calls it `null_plus`; the legacy path is `0plus` and `coding-standards.md` makes the legacy path the name, exactly as it did for `messdaten.temperatur` and `ausruestung.leistung`. React Hook Form reads `0plus` as an object key, not an array index, because it is not a number; step 1 proves that with a reload. |
| `name` | Holds the species export code (`BFOR`), not the German label. Same as every other picker on this form. |
| `summe`, `gesamtsumme` | In `felder.json`, deliberately not in `Antworten`. Derived on screen. See above. |

## Testing

**The gate is on.** `npm test` from `frontend/` and `pytest` from `backend/`, both declared in
`AGENTS.md`. Logic-bearing steps ship a passing test in the same diff.

| Step | In-scope logic | Test |
|---|---|---|
| 1 | the generated paths, and the derived-field exclusion | `teil6/tabelle.test.ts` |
| 2 | none, one field | browser and build evidence |
| 3 | none, fields only | browser and build evidence |
| 4 | the row sum and the grand sum | `regeln/arten.test.ts` |
| 5 | the row shift on remove | `teil6/zeilen.test.ts` |
| 6 | none, layout | screenshots and the build |
| 7 | none, documentation only | none |

Components and layout are verified with the dev server, screenshots and the build, exactly as
`coding-standards.md` requires. Playwright is not installed and is not added here.

## Files / areas

**Changed**

- `frontend/src/protokoll/entwurf/typen.ts` - the `arten` group, and `bemerkungen` gains
  `bemerkung_fische`
- `frontend/src/protokoll/abschnitte/AbschnittInhalt.tsx` - section 6 routes to a real body
- `frontend/src/protokoll/abschnitte.ts` - the `feature` field goes with the placeholder that read it
- `blueprint/history/features/4b-part-1-fields.md`, `7-part-4-fields.md`,
  `8-part-5-fields-and-rules.md` and `frontend/src/protokoll/regeln/ausruestung.ts` - step 7 only,
  each pointed at the new questions file instead of at a list that was never written
- `frontend/src/protokoll/protokoll.css` - the table, the sticky columns, the totals
- `frontend/src/protokoll/entwurf/useAutoSave.ts` - the re-render per keystroke. Shared code, and
  the reason is under "Amended during the build"
- `frontend/src/protokoll/regeln/regel.ts` - `alsZahl` moves here from `ausruestung.ts`, so both
  parts parse a number the same way
- `frontend/src/protokoll/regeln/ausruestung.ts` - reads `alsZahl` from `regel.ts`
- `frontend/src/protokoll/felder/FeldSuche.tsx` - the control moves to `Suche.tsx`, the frame stays
- `frontend/src/i18n/locales/de.json` - the section's strings, including the ten class headings and
  their full spoken forms. **Not `en.json`**, which is a ten line stub the shell alone uses; the
  second locale is filled in by feature 17

**Created**

- `frontend/src/protokoll/felder/Suche.tsx` - the search control without the label frame, shared
  with `ArtZelle`, so part 6 is not a twenty line copy of `FeldSuche`

- `frontend/src/protokoll/abschnitte/Abschnitt6.tsx`
- `frontend/src/protokoll/abschnitte/teil6/ArtenTabelle.tsx`
- `frontend/src/protokoll/abschnitte/teil6/ArtZeile.tsx` - added during the build, when the table
  outgrew one file and the row needed memoising
- `frontend/src/protokoll/abschnitte/teil6/ArtZelle.tsx`
- `frontend/src/protokoll/abschnitte/teil6/ZahlZelle.tsx`
- `frontend/src/protokoll/abschnitte/teil6/Zeilensumme.tsx`
- `frontend/src/protokoll/abschnitte/teil6/Gesamtsumme.tsx`
- `frontend/src/protokoll/abschnitte/teil6/Zeilenwaechter.tsx` - added during the build, so the
  table can grow without subscribing to anything
- `frontend/src/protokoll/abschnitte/teil6/BemerkungFischeBlock.tsx`
- `frontend/src/protokoll/abschnitte/teil6/tabelle.ts` and `tabelle.test.ts`
- `frontend/src/protokoll/abschnitte/teil6/zeilen.ts` and `zeilen.test.ts`
- `frontend/src/protokoll/regeln/arten.ts` and `arten.test.ts` - the sum functions only in 9a. 9b
  adds the rules to the same file

- `docs/ffs-questions.md` - step 7 only

**Possibly deleted**

- `frontend/src/protokoll/abschnitte/AbschnittPlatzhalter.tsx` - section 6 was the last placeholder

## Two questions the species list raises

Neither blocks the build and neither is a defect, because nothing here corrupts a record that was
entered. Both go into `docs/ffs-questions.md` in step 7, not into `docs/ffs-defect-list.md`.

1. **The species code `NEUN` is labelled "Zwergstichling".** Every other code in the list is a
   plausible abbreviation of its label, and `NEUN` reads as a Neunauge, not a Stichling. The
   neighbouring `STIC` is "Dreistachliger Stichling" and `ANEU` is "Neunauge, Querder (unbestimmt)".
   It may be an old code that was reused. We cannot check it without FiaKa's own species table, so
   the list is used exactly as extracted and the question is asked.
2. **`MBLA`, "Flussmuschel, Große ", has a trailing space in its label.** Cosmetic, and the export
   value is unaffected. Trimming a label is the sort of correction the legacy-form-typos rule already
   covers, but it is worth confirming the space is not meaningful before it is removed.

## Notes for the AI

- **The domain stays German.** Field paths are the legacy PDF's, exactly, including `0plus` with its
  leading digit and the quoting that needs.
- **Controls come from MUI.** `Autocomplete` and the MUI input, through `feldAria` for the aria
  wiring. The two new cell components exist only because a table cell is named by its column heading
  rather than by a label above it, which is the one thing the `Feld*` family cannot do. Do not
  duplicate anything else those six components already provide.
- **Accessibility is an acceptance criterion, not a later pass.** This is the worst case on the whole
  project: at 26 rows the table holds 312 controls whose only visual distinguishing information is a
  position in a grid. Every one needs a name that stands on its own. A table that is beautiful and
  unreadable to a screen reader fails this feature.
- **Performance is a real constraint here, not a theoretical one.** `coding-standards.md` picked
  React Hook Form because re-rendering 338 fields per keystroke makes typing sticky, and this is the
  section that proves it. Register inputs rather than controlling them, scope every `useWatch` to
  the fields it actually needs, and do not lift cell values into component state.
- **Do not clear a row when its species changes.** The legacy form does; it is destructive and we
  are not copying it.
- **Nothing here writes to the server.** Answers live in browser storage until feature 3, and there
  are no submission endpoints yet.
- **No em dashes** anywhere: code, comments, commit messages, locale strings.
