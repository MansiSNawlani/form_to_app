# Feature: 7 - Part 4 fields

**From build-plan:** feature 7, "Form part 4: in-water structures, usage influences, fishery
management, stocking history"
**Status:** completed 2026-09-04

## Goal

Build section 4 of the protocol, "Struktur und Bewirtschaftung": what grows and lies in the water,
what people do with the water, and how it is fished and stocked. Forty-three fields, all of them on
the bottom half of page 2 of the printed form.

Section 4 is a placeholder today. After this feature four of the six sections are real, and only
equipment (feature 8) and the catch table (feature 9) remain.

## Why this feature is not split

Items 4, 5 and 6 were each split into fields and then rules. Feature 7 is not, because **section 4
has no rules to split off.**

Checked on 2026-09-04 against both legacy scripts:

| Source | What it says about section 4 |
|---|---|
| `validation.js` | nothing. No `strukturen`, `einfluesse` or `bewirschaftung` field is read at submit |
| `all_js_Formular.js` | nothing. No handler, no calculation, no show-or-hide, no total |

So there is no sum, no conditional visibility, no cross-field check, and nothing that depends on the
Gewaessertyp. Forty-three fields that accept a value and save it. That is one feature's worth of
work and one reviewable diff per block, in six steps.

At 43 fields it is also smaller than 6a, which carried 54 in a single sub-feature.

## Design reference

**No mockup, and none is needed.** Same decision as 6a, made on 2026-09-03 and unchanged: the layout
does not have to match the printed form, so long as it reads well and looks like the rest of the
app. Two references stand in.

1. **`prototypes/protokoll-teil-1.html` and `prototypes/mockup.css`** for everything structural: the
   section card, the `fieldset` and legend, the 12 column grid, the label above the control. Part 4
   must look like parts 1 to 3 built it.
2. **Page 2 of `Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf`**, bottom
   half, for which fields exist and what each is printed as. Section 4 runs from "Natürliche
   Strukturen im Wasser:" down to "Sonstiges:" at the foot of the page.

The printed arrangement, confirmed by widget position on 2026-09-04:

| Block | Printed as |
|---|---|
| Natürliche Strukturen im Wasser | 8 boxes, two rows of four, plus a writing line after the last |
| Nutzungsbedingte Einflüsse | 15 tick boxes, three rows of five, plus a writing line after the last |
| Fischereiliche Bewirtschaftung | 4 tick boxes in one row, then a wide text box, then 4 stocking rows in two printed columns |
| Sonstiges | one wide text box at the foot of the page |

We keep the grouping and the reading order. We do not have to keep the exact columns.

## In scope

- The **Natürliche Strukturen** block: 8 ratings on the printed 0 to 3 scale, plus the free-text box
  recording what the open one was.
- The **Nutzungsbedingte Einflüsse** block: 15 checkboxes, plus the free-text box for the open one.
- The **Fischereiliche Bewirtschaftung** block: 4 checkboxes, the Fischereiausübungsberechtigter
  contact box, and the 4 Besatzmaßnahmen rows of Fischart, Größenklasse(n) and Jahr.
- The **Sonstiges** remarks box at the foot of page 2.
- One new way to enter a 0 to 3 rating, with the four scale steps declared where they are used.
- `Antworten` grows `strukturen`, `einfluesse`, `bewirschaftung`, and one key under `bemerkungen`.
- The three runs and the stocking rows declared once as data in `abschnitte/teil4/bloecke.ts`, in
  the same shape and for the same reasons as `teil3/gruppen.ts`.
- German labels in `frontend/src/i18n/locales/de.json`.
- A path test proving every declared path is a real field in `felder.json`.
- **Defect 10 written up**: the legacy form never exports the fishery management block. See below.

## Out of scope

- **Every rule except one.** The draft carried none at all, since the legacy form has none here.
  One was added by decision on 2026-09-04 and is step 7: the Einflüsse contradiction. Everything
  else still stands, so a protocol may leave every rating blank or name a stocking year of 3021 and
  section 4 says nothing. See "The two rules we are not inventing" below for what was left and why.
- **A new option list extracted from the PDF.** `besatz_fischart` already exists, 77 entries, pulled
  out during the pre-build work. Nothing here needs the extraction script re-run.
- **Growing or shrinking the number of stocking rows.** The printed form has exactly four and the
  legacy paths are `besatz1` to `besatz4`. Four fixed rows, no add-a-row button.
- **`bemerkungen.bemerkung_fische`.** The second remarks box, printed on page 3 above the catch
  table. It belongs to feature 9.
- **`bemerkungen.default`.** A button in the right margin of page 2, not an answer. It gets no key,
  the same call 6a made for the thirteen `check_ok_*` and `check_n_*` indicator fields.
- **Required-field enforcement.** Unchanged from parts 1 to 3: an asterisk marks what feature 11
  will demand at submit, and nothing is blocked here. **Nothing in section 4 gets an asterisk**,
  because `validation.js` requires none of it.
- **The backend half.** No endpoint, no Pydantic model, for the same reason as parts 1 to 3:
  features 2 and 3 are deferred and the build plan accepts that the browser-side half lands first.

### One file that is deliberately not touched

- **`AbschnittNav.tsx`** already links all six sections and shows no completion state, so a section
  becoming real changes nothing about it. Checked on 2026-09-04, and named here so that adding to it
  reads as a mistake rather than as tidying up.

`regeln/schema.ts` was on this list in the draft, on the grounds that part 4 had no rules. Step 7
gave it one, so the file now registers a sixth rule, `pruefeEinfluesse`. That is the only reason it
changed.

## Defect 10: the fishery management block is never exported

Found on 2026-09-04 while reading the field tree for this feature. This is a new defect, not one of
the nine already written up, and it is the most consequential thing this feature turned up.

**The form's own field is spelled `bewirschaftung`. Its export routine asks for `bewirtschaftung`.**

Confirmed three ways:

1. `felder.json` holds 17 fields under `bewirschaftung.` and none under `bewirtschaftung.`.
2. The AcroForm field tree has a top-level node named `bewirschaftung` with 17 children. There is no
   node named `bewirtschaftung`.
3. Both `exportAsXFDF` calls in `all_js_Formular.js`, at lines 1079 and 1105, list
   `"bewirtschaftung"` in `aFields`.

An `aFields` entry names a field, or a parent node whose whole subtree is exported. The name they
ask for does not exist, so the block is silently left out of both export paths: the four
Bewirtschaftung ticks, the Fischereiausübungsberechtigter, and all twelve Besatzmaßnahmen cells.

**Severity: high, and historical data is likely affected.** If FiaKa is fed from these exports, then
no protocol has ever delivered its fishery management data, and every stocking history in FiaKa that
came through this form is missing. Whether FiaKa is in fact fed this way is FFS's to confirm, which
is why the write-up asks rather than asserts.

**What we do about it.** Nothing in the code, deliberately. We keep the legacy path spelling
`bewirschaftung` exactly as the form has it, because `coding-standards.md` makes the legacy path the
name, and a corrected spelling here would break the direct FiaKa mapping that rule exists to
protect. Our application stores and will submit the block correctly regardless, since we do not use
the PDF's export routine. The typo is documented, not fixed.

This sits alongside the standing rule from 4b and 5a: **an obvious typo in a display label is
corrected, an export value or a field path never is.**

## The two rules we are not inventing

Both are real data-quality questions and both are deliberately left alone. Written down here so that
"we did not think of it" is not a later reading.

1. ~~**"keine (erkennbar)" and "unbekannt" are not made exclusive.**~~ **Reversed on 2026-09-04, by
   decision. It is now in scope, as step 7.** The draft deferred it to FFS because making the two
   exclusive means deciding what happens to the other thirteen ticks. That question turned out to
   have an answer the project had already given itself, in `regeln/prozent.ts`: a contradiction is
   marked, never silently corrected. So nothing is cleared and nothing is blocked, and the
   combination is flagged the same way a percentage run that does not total 100 is. See step 7.
2. **A stocking row is not checked for completeness.** A row with a Jahr and no Fischart is
   accepted, and so is a Fischart with no year. The legacy form accepts both. Unchanged: unlike the
   contradiction above, an incomplete row is a half-finished answer rather than a wrong one, and a
   draft is allowed to be half-finished.

Neither is a defect in the sense the defect list uses, since neither corrupts data that was
entered. They are gaps in what the form asks for.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Defect 10 written up** - `docs/ffs-defect-list.md` gains item 10, following the
      shape of items 1 to 9: what the form does, the evidence, the severity, whether historical data
      is affected, and what we intend to do. The opening line "Three of these mean data already in
      FiaKa is wrong" and the closing "Fix all nine in the new application" both need revisiting,
      since the counts change. No code, nothing visible in the app. This comes first because it is
      the reason steps 4 and 5 spell a field `bewirschaftung`, and reviewing that reasoning before
      the code that depends on it is cheaper than after. *Done when:* item 10 reads as a standalone
      report FFS can act on without this repository open; the counts elsewhere in the file match;
      the file still says the list is to be sent to FFS.

- [x] **Step 2 - The 0 to 3 rating, and the Strukturen block** - The scale is declared in
      `abschnitte/teil4/stufen.ts` and `FeldRadio` learns to take it (see "Where the 0 to 3 scale
      lives"). `Antworten` grows the `strukturen` group. `abschnitte/teil4/bloecke.ts` declares the
      eight ratings as `{ pfad, labelKey }`, `StrukturenBlock.tsx` maps over them, and the
      `sonstige_strukturen_text` box is written out beside them. `AbschnittInhalt` routes section 4
      to a real `Abschnitt4` instead of the placeholder. *Done when:* section 4 opens on a real
      form; each of the eight ratings selects one of the four steps and clears again; each step
      shows its number and its meaning, so "2" is never on screen alone; answers survive a reload; a
      path typed wrongly into `bloecke.ts` is a TypeScript error; the block reads correctly in light
      and dark, at desktop width and below 800px; tabbing reaches every rating in reading order.

- [x] **Step 3 - The Nutzungsbedingte Einflüsse block** - `Antworten` grows the `einfluesse` group.
      `bloecke.ts` declares the fifteen checkboxes, `EinfluesseBlock.tsx` maps over them five to a
      row, and the `sonstige_nutzung_text` box is written out after them. *Done when:* all fifteen
      tick and untick and persist across a reload; the text box is labelled for the list it belongs
      to rather than reading as a second stray "Sonstiges"; the three rows are readable at both
      widths; the block is one `fieldset` with a legend, so a screen reader knows which
      "keine (erkennbar)" it has landed on.

- [x] **Step 4 - The Fischereiliche Bewirtschaftung block, and the Sonstiges remarks box** -
      `Antworten` grows the `bewirschaftung` group and one key under `bemerkungen`. `bloecke.ts`
      declares the four use checkboxes; the Fischereiausübungsberechtigter box and the Sonstiges
      remarks box are written out. Both are multi-line: the printed form gives the first a
      three-line box hinted "Verein / Ansprechpartner mit Tel.-Nr. und ggf. E-Mail-Adresse" and the
      second the full width of the page. `FeldText` has no multi-line mode yet, so this step adds
      one rather than dropping to a bare `textarea`. *Done when:* the four checkboxes persist; both
      text boxes accept several lines and survive a reload; the contact box carries the printed
      hint; the two boxes are distinguishable to a screen reader, since "Sonstiges" alone would
      collide with the Strukturen and Einflüsse boxes already on the page; section 1 still renders
      unchanged, proving the multi-line mode did not disturb the single-line callers.

- [x] **Step 5 - The Besatzmaßnahmen rows** - The four stocking rows, declared in `bloecke.ts` as
      four `{ fischart, groessenklassen, jahr }` triples and rendered by mapping. Fischart is a
      `FeldSuche` over the existing `besatz_fischart` list, which has 77 entries and is too long to
      scroll. Größenklasse(n) and Jahr are text. *Done when:* all four rows accept a species, a size
      class and a year, and all twelve values survive a reload; the species search is usable from
      the keyboard alone and stores the export code rather than the label; each row's three controls
      are labelled so that row 3's year is distinguishable from row 1's; the rows are readable at
      both widths.

- [x] **Step 6 - The path test, and the section reviewed whole** - A vitest test beside `bloecke.ts`
      asserts that every declared path is a field name in `felder.json`, and that the runs hold 8,
      15, 4 and 4 x 3 paths, so an entry lost to a bad merge fails loudly rather than quietly going
      missing. Then the whole of section 4 is reviewed in one pass, with the four paths that are in
      no declaration read off against `felder.json` by hand. *Done when:* the test passes, and fails
      when a path is deliberately misspelled and again when an entry is deleted; the full section is
      screenshotted in light and dark at both widths; `npm test`, `npm run lint`, `npx tsc -b`,
      `npm run build` and `pytest` all pass.

- [x] **Step 7 - The Einflüsse contradiction rule** - Added on 2026-09-04, after the other six were
      built. `regeln/einfluesse.ts` holds a plain function saying what is contradictory about the
      Einflüsse answers, `regeln/schema.ts` registers it as the sixth rule, and the block shows its
      message under the fifteen ticks. Two contradictions: one of the two blanket answers ticked
      alongside a named use, and both blanket answers ticked at once. **Nothing is cleared and
      nothing is blocked** - see "How the rule behaves" below. *Done when:* ticking
      "keine (erkennbar)" and then "Wasserkraft" shows a message under the block, and unticking
      either clears it; ticking "keine (erkennbar)" and "unbekannt" together shows a different
      message; the thirteen uses may be ticked in any combination with no message; an untouched
      block is silent; the message is announced to a screen reader without stealing focus; the rule
      is a pure function with a test covering each contradiction and each innocent combination;
      `npm test` is green.

## How the rule behaves

The decision the draft deferred to FFS was what happens to the other thirteen ticks when
"keine (erkennbar)" is chosen. **The answer is nothing.** No box is cleared, no box is disabled, and
no click is refused. The contradiction is shown, and the surveyor decides which answer was the
wrong one.

This is not a fresh judgement. `regeln/prozent.ts` already made it for the percentage runs and wrote
down why: the legacy form refuses a keystroke that would push a run past 100, and refusing it makes
an ordinary correction impossible, because at 100 the first digit of a replacement cannot be typed
until something else has been cleared. Auto-clearing thirteen checkboxes because somebody mis-clicked
one is the same failure in a worse form: it destroys answers that were typed deliberately, in a
protocol that is filled in over several sittings.

**The message goes under the block, not on a box.** It lives at a path outside the answers document,
exactly as a percentage run's total does, for the same two reasons `gruppen.ts` gives: no field in
the document names the combination, and turning fifteen checkboxes red for one contradiction is
noise. It is also genuinely not knowable which box is the wrong one. Only the surveyor knows whether
they meant "keine" or meant "Wasserkraft".

**It speaks immediately, unlike the percentage total.** A run is under 100 all the way up to the
moment it is finished, so its message waits for the field to be left. There is no equivalent
half-finished state here: "keine (erkennbar)" together with a named use is never a step on the way
to a correct answer, so the message appears as soon as the combination exists.

## Where the 0 to 3 scale lives

The eight Strukturen fields are stored by the PDF as **text**, not as a choice field. The scale is
printed above them as a line of prose:

> Semiquantitative Angaben: 0 = keine  1 = wenig  2 = verbreitet  3 = dominierend

So the four steps exist in the printed form but not in its field structure, and that is what decides
where they live in our code.

**They go in the frontend, in `abschnitte/teil4/stufen.ts`, not in the extraction script.** The
script's `RADIO_LABELS` supplements extraction: the PDF supplies the export values and only the
German words beside the buttons are missing, and the script's guard raises if a value has no label
or a label has no value. For the Strukturen there are no export values to pair against, so putting
the scale there would write invented data into a generated file and would make that guard say
nothing about it. `optionslisten.json` stays what it claims to be: what was read out of the PDF.

**`FeldRadio` gains an optional local scale rather than a new component being written.** It already
does everything needed - the frame, the label, the row of buttons, the clear-selection button, the
aria wiring - and differs only in where its options come from. It keeps `liste: ListenName` for its
twelve existing callers, so a wrong list name stays a build error, and gains an alternative
`skala: readonly Option[]` for callers whose options are not in the seed file. Exactly one of the
two is given, enforced by the prop type.

A row of four buttons rather than a dropdown, matching what part 2 established: a small closed
choice where the reader is comparing the options is a row, and a long list is a dropdown. Four short
labels fit a row, and one click beats two.

**Every step shows its number and its meaning**, as "0 - keine" and so on. The number is what gets
stored and what FiaKa receives; the word is what makes the question answerable. This is the same
call `mitWert` makes for the Gewaessertyp.

**A side effect worth naming.** The legacy form stores these eight as free text and checks nothing,
so `7`, `-1` and `weiss nicht` are all accepted and all reach FiaKa. Four buttons make every one of
those impossible without any rule being written. It is not in the defect list, because nothing
proves anyone ever typed a bad rating, but it is a real narrowing and it should be mentioned at
`/complete` rather than discovered later as an unexplained difference from historical records.

## The runs are data

Same shape and same reasoning as `teil3/gruppen.ts`, which this file should be read alongside.
Thirty-nine of the forty-three fields are declared in `abschnitte/teil4/bloecke.ts` and rendered by
mapping:

| Run | Count | Control |
|---|---|---|
| Strukturen ratings | 8 | `FeldRadio` over the local scale |
| Einflüsse | 15 | `FeldHaken` |
| Bewirtschaftung uses | 4 | `FeldHaken` |
| Besatzmaßnahmen | 4 rows x 3 | `FeldSuche` + `FeldText` + `FeldText` |

The reasons, in order of weight: a declared array is the only thing a test can check against
`felder.json`, which is what proves these paths match the legacy form; typing it as `AntwortPfad[]`
makes a path outside the answers document a build error, so the two checks close both directions;
and thirty-nine near-identical JSX elements is the repetition `coding-standards.md` rules out.

**The four that stay written out** differ from one another, so a shared definition would buy nothing
and cost readability: `strukturen.sonstige_strukturen_text`, `einfluesse.sonstige_nutzung_text`,
`bewirschaftung.fischereiausübungsberechtigter` and `bemerkungen.sonstige_bemerkungen`. Step 6
checks these four by hand.

Unlike `teil3/gruppen.ts`, nothing here carries a group id or a total. There is no sum in section 4,
so a run is a legend and a list of fields and nothing more.

## Files / areas

| Path | Why |
|---|---|
| `docs/ffs-defect-list.md` | defect 10, and the counts it changes |
| `frontend/src/protokoll/entwurf/typen.ts` | `Antworten` grows three groups and one key |
| `frontend/src/protokoll/felder/FeldRadio.tsx` | an optional local scale beside the named list |
| `frontend/src/protokoll/felder/FeldText.tsx` | a multi-line mode for the two wide boxes |
| `frontend/src/protokoll/abschnitte/Abschnitt4.tsx` | new section body |
| `frontend/src/protokoll/abschnitte/teil4/stufen.ts` | new, the four scale steps |
| `frontend/src/protokoll/abschnitte/teil4/bloecke.ts` | new, the four runs as data |
| `frontend/src/protokoll/abschnitte/teil4/bloecke.test.ts` | new, the path test |
| `frontend/src/protokoll/abschnitte/teil4/StrukturenBlock.tsx` | new |
| `frontend/src/protokoll/abschnitte/teil4/EinfluesseBlock.tsx` | new |
| `frontend/src/protokoll/abschnitte/teil4/BewirtschaftungBlock.tsx` | new |
| `frontend/src/protokoll/abschnitte/teil4/BesatzZeilen.tsx` | new, the four stocking rows |
| `frontend/src/protokoll/abschnitte/AbschnittInhalt.tsx` | case 4 replaces the placeholder |
| `frontend/src/protokoll/protokoll.css` | only if the existing classes cannot carry a stocking row |
| `frontend/src/i18n/locales/de.json` | every label, legend and hint |

Note that the component file is `BewirtschaftungBlock.tsx`, spelled correctly, while every field
path inside it is `bewirschaftung.*`. Component names are ours; field paths are the legacy form's.
That split is the standing rule, and defect 10 is why it matters here.

## Data / contracts

Every value is a `string | undefined`, exactly as parts 1 to 3, and every key is the legacy PDF
field path. **Load-bearing**: feature 3 sends this same document to the server.

### `strukturen` - 9 fields

Eight ratings on the 0 to 3 scale, then the free text for the open one.

```
strukturen.totholz                     Totholz
strukturen.wurzeln_strukturen          Wurzeln
strukturen.aeste                       ins Wasser hängende Äste
strukturen.schilf                      Schilf / Röhricht
strukturen.submerse_makrophyten        submerse Makrophyten
strukturen.schwimmblattpflanzen        Schwimmblattpflanzen
strukturen.emerse_makrophyten          emerse Makrophyten
strukturen.sonstige_strukturen         the open one, printed with no label
strukturen.sonstige_strukturen_text    free text, what that rating was
```

Order confirmed by widget position on 2026-09-04: `totholz`, `wurzeln_strukturen`, `aeste`, `schilf`
across the first printed row, then `submerse_makrophyten`, `schwimmblattpflanzen`,
`emerse_makrophyten`, `sonstige_strukturen` across the second.

**Two near-misses**, and both are exactly what the path test exists for:

| Looks like | Is actually |
|---|---|
| `strukturen.wurzeln_strukturen` | roots in the water, whereas `ufer.wurzeln` in section 3 is the share of bank with roots reaching in |
| `strukturen.schilf` | reeds in the water, printed "Schilf / Röhricht", whereas `ufer.schilf_rohr` is reeds on the bank, printed "Schilf / Rohr" |

### `einfluesse` - 16 fields

Fifteen checkboxes storing `"Ja"` or `""`, then the free text for the open one. In printed order,
three rows of five:

```
einfluesse.keine_einfluesse            keine (erkennbar)
einfluesse.unbekannt_einfluesse        unbekannt
einfluesse.wasserkraft                 Wasserkraft
einfluesse.stauhaltung                 Stauhaltung
einfluesse.schwallbetrieb              Schwallbetrieb

einfluesse.schifffahrt                 Schifffahrt / Boote
einfluesse.bewaesserung                Bewässerung
einfluesse.entwaesserung               Entwässerung
einfluesse.hochwasserrueckhaltung      Hochwasserrückhaltung
einfluesse.hochwasserablauf            Hochwasserablauf

einfluesse.badebetrieb                 Badebetrieb
einfluesse.viehtraenke                 Viehtränke
einfluesse.holzberieselung             Holzberieselung
einfluesse.trinkwasserversorgung       Trinkwasserversorgung
einfluesse.sonstige_Nutzung            the open one, printed with no label
einfluesse.sonstige_nutzung_text       free text, what that use was
```

**`einfluesse.sonstige_Nutzung` has a capital N and its text twin does not.** It is the only field
path in the entire form with a capital letter, apart from a button. A legacy inconsistency,
preserved exactly, for the same reason the `bewirschaftung` typo is.

### `bewirschaftung` - 17 fields

Note the spelling throughout. See defect 10.

```
bewirschaftung.angelfischerei                     Angelfischerei
bewirschaftung.berufsfischerei                    Berufsfischerei
bewirschaftung.teichspeisung                      Teichspeisung
bewirschaftung.teichablauf                        Teichablauf
bewirschaftung.fischereiausübungsberechtigter     free text, several lines
bewirschaftung.besatz_fischart1                   besatz_fischart code
bewirschaftung.besatz1_groessenklassen            free text
bewirschaftung.besatz1_jahr                       free text
... the same three for rows 2, 3 and 4
```

**`bewirschaftung.fischereiausübungsberechtigter` contains a `ü`.** It is the only non-ASCII field
path in the form. It is legal as a TypeScript key, as a React Hook Form path and as an HTML id, so
it is kept verbatim. Anything that writes it needs the file saved as UTF-8, which this repository
already is.

The four stocking rows are numbered inconsistently by the legacy form, and that is not a mistake to
tidy: the species field is `besatz_fischart1` while its two neighbours are `besatz1_groessenklassen`
and `besatz1_jahr`. The digit moves. Transcribe carefully.

The printed layout puts rows 1 and 2 in a left column and rows 3 and 4 in a right one. We render
four rows top to bottom, because four rows of three read better on a screen than a two-by-two grid
of three-field groups, and because feature 9's catch table will be rows too.

### `bemerkungen` - 1 field of 3

```
bemerkungen.sonstige_bemerkungen       free text, the wide box at the foot of page 2
```

`bemerkungen.bemerkung_fische` is on page 3 and belongs to feature 9. `bemerkungen.default` is a
margin button, not an answer.

**Why this one field is in feature 7 at all.** It is printed at the foot of page 2, immediately under
the Besatzmaßnahmen rows, and no build-plan item names it. Left out, it would be orphaned between
features 7 and 9 and would very likely never land. One text box is cheap; the alternative is a field
that quietly goes missing.

### The 0 to 3 scale

Not an option list from the PDF. Transcribed from the line printed above the block:

| Stored | Meaning |
|---|---|
| `0` | keine |
| `1` | wenig |
| `2` | verbreitet |
| `3` | dominierend |

## Testing

`npm test` (vitest, from `frontend/`) and `pytest` (from `backend/`) are both on, so the gate in
`coding-standards.md` applies.

**In-scope logic needing a test:** step 6's path and count test over `bloecke.ts`, which is the only
genuinely new logic here. It is not asserting behaviour; it is asserting that thirty-nine
hand-transcribed strings match the source of truth, which is the one thing in this feature that can
be wrong without anything looking wrong.

**Everything else rides on browser evidence and the build.** Steps 2 to 5 are field layout, and
`coding-standards.md` says components and integration surfaces are verified that way, not with unit
tests. That is the same call parts 1 to 3 made.

Two changes to shared controls are worth watching in review even though neither gets its own test:
`FeldRadio`'s optional scale must leave its twelve existing callers untouched, and `FeldText`'s
multi-line mode must not change how the single-line callers render. `npx tsc -b` catches the first;
the second is a screenshot of section 1 after step 4, which step 4's done-when asks for.

`pytest` is unaffected by this feature. Step 1 touches only a markdown file and no step re-runs the
extraction script, so the backend suite should stay at its current count. If it does not, something
was changed that this spec did not intend.

**Manual path**, at each step: start the frontend dev server, open a draft, go to section 4, fill in
the new fields, reload, confirm the values came back. Check light and dark, and desktop width and
below 800px. Tab through the block and confirm the order is the reading order and that nothing traps
focus.

## Notes for the AI

- **Every label comes off page 2 of the PDF, not from the field name.** `strukturen.aeste` is
  printed "ins Wasser hängende Äste", `einfluesse.schifffahrt` is "Schifffahrt / Boote",
  `einfluesse.keine_einfluesse` is "keine (erkennbar)". Do not shorten a label to match a key.
- **The three unlabelled boxes need labels we write.** `strukturen.sonstige_strukturen`,
  `einfluesse.sonstige_Nutzung` and their text twins are printed with nothing beside them, exactly
  like section 3's two "sonstige" pairs. Label each for the list it belongs to. By the end of this
  section there are three "Sonstiges" boxes on one page, and a screen reader user must be able to
  tell them apart. This is the same problem 5a solved for the two Schätzwert boxes and 6a for the
  two bank ones.
- **Correct an obvious typo in a display label, never an export value or a field path.** The
  standing rule from 4b and 5a. Defect 10 is what happens when a field path typo goes unnoticed, so
  this feature is the wrong place to start correcting them.
- **No `pflicht` anywhere in section 4.** `validation.js` requires none of these fields. An asterisk
  would promise a gate feature 11 has no grounds to build. This is the same check 6a ran before
  removing the Randstreifen radio's marker.
- **Nothing in this section varies with the Gewaessertyp**, and nothing is conditional on anything
  else. If a condition starts to feel natural while building a block, it is not in the legacy form
  and it is not in this spec.
- **`FeldRadio` and `FeldText` are extended, not copied.** One control, one place where the label
  association and the aria wiring live. `coding-standards.md` and the MUI rule both point that way,
  and 6a set the precedent with `FeldProzent` wrapping `FeldText`.
- **Reach for MUI before a native control**, and where MUI's default composition fights the app,
  theme it in `muiTheme.ts` rather than hand-styling at the call site. The multi-line box in step 4
  is `OutlinedInput` with `multiline`, not a bare `textarea`.
- **No new colour and no `sx` override at a call site.** Tokens in `theme.css`, configured once in
  `muiTheme.ts`.
- **Accessibility is an acceptance criterion, not a later pass.** A label above every control except
  a checkbox, visible focus, contrast in both themes, and each run a `fieldset` with a legend so a
  screen reader knows which group it is in.
- **Untouched is not wrong.** A blank rating means nobody has been in it, and a blank box is never a
  message. `istLeer` in `regeln/regel.ts` is where that convention lives, though section 4 adds no
  rule that needs it.
- **Do not add a rule.** No exclusivity between "keine (erkennbar)" and the rest, no completeness
  check on a stocking row, no year range, no total. Both candidates are written up above as
  questions for FFS. If one comes back as a requirement, it is a `/fix`, not a quiet addition here.

## Amended during the build

Recorded here rather than left as silent divergences from the draft, following the precedent 5a and
6a set.

1. **`FeldRadio` took a wider `liste` instead of a second `skala` prop.** The draft had the control
   grow a second prop, with "exactly one of the two is given" enforced by a union type. That union
   is awkward to write and awkward to narrow. Instead the existing prop's type widened to
   `Optionsquelle = ListenName | readonly Option[]` and `optionen()` resolves it. Same guarantee, one
   word changed in the component, twelve existing call sites untouched, and the question of where
   option vocabulary may come from now sits in `optionen.ts` where the rest of it already lives.

2. **The Sonstiges remarks box got its own block.** The draft folded it into step 4 without saying
   whether it shared the Bewirtschaftung fieldset. It does not: it is a remarks box for the whole
   page, not a fishery-management answer, and putting it inside that fieldset would tell a screen
   reader it belongs to a group it does not. Its own legend also separates it from the two other
   boxes on the page whose label begins "sonstige".

3. **A stocking row is a nested fieldset, and `.form-row` was added for it.** The draft asked only
   that "row 3's year is distinguishable from row 1's" without saying how. Numbering the labels
   ("Jahr 3") would have put four slightly different labels down one column. A legend per row keeps
   the labels short and identical and is the same disambiguation `ProzentGruppe` uses in section 3.
   That needed one CSS class, built from the existing `--muted` and `--step--1` tokens.

4. **`FeldText`'s multi-line mode drops the `type` attribute.** Not in the draft because it is a
   detail: a `textarea` has no `type`, so passing the default `text` through would put invalid markup
   on the page. One ternary.

5. **The path test grew a completeness check, and the four loose paths are in it rather than checked
   by hand.** The draft's step 6 said the four written-out paths would be read against `felder.json`
   manually. Listing them in the test instead costs four lines and makes a stronger check possible:
   the set of paths section 4 renders under `strukturen`, `einfluesse` and `bewirschaftung` must
   *equal* the set the legacy form has. Every other assertion asks whether what we render is real;
   this one asks whether anything real went unrendered, which is the failure a forgotten field
   actually causes. It is what would have caught the remarks box going missing.

6. **A stale comment in `typen.ts` was corrected.** It said "Part 1 exists so far", three features out
   of date, in the block this feature extends.

7. **A seventh step was added after the other six were built.** The Einflüsse contradiction rule,
   by decision on 2026-09-04, reversing the draft's "not inventing this" call. The draft deferred it
   to FFS because it could not say what should happen to the other thirteen ticks; the answer turned
   out to be already written down in `regeln/prozent.ts`, which had settled the same question for
   part 3. Three sections of the spec were corrected rather than left contradicting the code: the
   out-of-scope line, the deliberately-untouched list, and the rules-not-invented list.

## What still needs a human

The browser done-whens, which no automated gate reaches. Section 4 in light and dark, at desktop
width and below 800px, and a tab pass through all four blocks. `/try` has the walkthrough.
