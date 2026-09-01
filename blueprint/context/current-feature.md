# Feature: 4c - Part 1 rules

**From build-plan:** feature 4c, the last of three sub-features of item 4 (Form part 1)
**Status:** built, awaiting manual check

## Goal

Make the three rules of part 1 real: the Monitoringstrecken-Nr. becomes mandatory when the Anlass
is WRRL or FFH monitoring, the Vorfluter chain has to end at the Rhein or the Donau, and the four
coordinates have to fall inside Baden-Wuerttemberg.

Feature 4b built all twenty-nine part 1 fields and enforced nothing. The two callouts already
printed on the page promise this behaviour today: the Vorfluter callout says the chain must end at
the Rhein or the Donau, and the coordinate callout says values outside Baden-Wuerttemberg are
rejected. Neither is true yet. This feature makes the page tell the truth.

It also sets the pattern the rest of the form copies. There are five more parts with rules in them,
including the six sum-to-100 blocks in feature 6 and the catch table in feature 9, so how a rule is
written, where its message appears, and how it reaches a screen reader are decided here once.

Two constraints shape everything below:

- **A rule may never block saving.** The draft saves whatever is typed, valid or not. A protocol is
  filled in over several sittings, and half-finished answers are the normal state.
- **A rule may never shout at an untouched field.** Part 1 marks fields required, but "required to
  submit" is feature 11's gate. 4c only complains about answers that are actually wrong or
  inconsistent, never about a field nobody has reached yet.

## Design reference

`prototypes/protokoll-teil-1.html`, specifically the Monitoringstrecken-Nr. field, which is the one
field the mockup draws in its error state:

```html
<div class="field col-4 field--error">
  <label for="mon-nr">Monitoringstrecken-Nr. <span class="field__req" aria-hidden="true">*</span></label>
  <input id="mon-nr" aria-describedby="mon-nr-fehler" aria-invalid="true">
  <span class="field__error" id="mon-nr-fehler">
    Beim Anlass "WRRL-Monitoring" ist die Monitoringstrecken-Nr. erforderlich.
  </span>
</div>
```

That is the exact target: a red border with a soft red fill on the control, and a short bold red
message underneath naming the reason. The `.field__error` and `.field--error` rules in
`prototypes/mockup.css` are not ported yet and step 2 ports them. Colours come from the existing
`--danger` and `--danger-soft` tokens in `frontend/src/styles/theme.css`, which are already defined
in both themes. Do not add a colour.

## The three rules

### Rule 1 - Monitoringstrecken-Nr. required for WRRL and FFH

When `anlass` is `wrrl` or `ffh`, `probestrecke.monitoringnummer` must be filled in. Those are the
two extracted export values, and `project-overview.md` states the rule as "values containing wrrl
or ffh make monitoringstrecke_nr required". Match on the exact values rather than a substring: the
list has six entries and none of the other four contain either word, so a substring test would only
be looser for no gain.

The visible required marker on the field follows the Anlass too. Feature 4b deliberately left the
field unmarked and wrote the reason into the code: an unconditional marker would contradict the
hint beneath it, which reads "Nur bei Fischmonitoring gemaess WRRL oder FFH."

### Rule 2 - the Vorfluter chain ends at the Rhein or the Donau

The five `probestrecke.gewaesser.vorfluter1..5` fields are one chain read downstream from the
Probestrecke. Three things make it wrong:

| Wrong | Example | Message sits on |
|---|---|---|
| A gap in the chain | vorfluter1 and vorfluter3 filled, vorfluter2 empty | the empty field |
| The chain does not reach the Rhein or the Donau | Argen, Schussen, and nothing more | the last filled field |
| Something continues past the terminator | Argen, Schussen, Rhein, Bodensee | the first field after the terminator |

Comparison against "Rhein" and "Donau" ignores case and surrounding spaces, and accepts a name that
merely contains the word, so "Alte Donau", "Hochrhein" and "Oberrhein" all terminate a chain. What
is stored is exactly what the user typed. This matters: defect 2 in `docs/ffs-defect-list.md` says
the legacy form lowercases every water body name, which is one of the three defects that corrupted
data already in FiaKa. Compare loosely, store faithfully.

An empty chain is not an error. Only a chain somebody has started is checked, which is what keeps
the rule out of the way of a half-finished draft. Defect 8 is the reason the rule exists at all:
the legacy form checks the chain while the user types and then only checks the first box at submit,
so a cleared chain passes today.

### Rule 3 - coordinates inside Baden-Wuerttemberg

All four of `utm_rw_unten`, `utm_hw_unten`, `utm_rw_oben`, `utm_hw_oben` are EPSG:25832
(ETRS89 / UTM zone 32N) metres, and each must be a whole number inside these bounds:

| Value | Minimum | Maximum |
|---|---|---|
| Rechtswert (easting) | 380000 | 620000 |
| Hochwert (northing) | 5255000 | 5525000 |

**Where those numbers come from, and their one weakness.** No project document fixes them, so they
are derived here: Baden-Wuerttemberg spans roughly 7.5 to 10.5 degrees east and 47.5 to 49.8
degrees north, which in zone 32N is about 388000 to 613000 east and 5266000 to 5516000 north,
rounded outward to round numbers. It is a rectangle, not the state border, so a point just over the
line in Bavaria, Hesse, Switzerland or Alsace still passes. That is deliberate. The check exists to
catch the mistakes that actually happen: a swapped Rechtswert and Hochwert, a digit dropped, a
Gauss-Krueger value from an older map, or degrees typed instead of metres. Every one of those lands
far outside the box. Real border testing needs the official water body dataset and belongs to
feature 18. **Worth confirming the bounds with FFS**, since tightening them later is a one-line
change.

Each of the four fields carries its own message naming its own allowed range, rather than one
message for the group. A surveyor who typed the Hochwert into the Rechtswert box needs to be told
which box is wrong.

## In scope

- The three rules above, as pure functions with unit tests.
- One Zod schema over the whole answers document, calling those functions, wired into the existing
  React Hook Form as a resolver.
- An error state on the shared field frame: the red border and fill, the message, `aria-invalid`,
  and the message joined to the control through `aria-describedby` alongside any existing hint.
- The required marker on the Monitoringstrecken-Nr. following the Anlass.
- German messages in `frontend/src/i18n/locales/de.json`.

## Out of scope

- **A submit gate.** Nothing is blocked, nothing is prevented, and saving continues regardless of
  validity. Refusing to submit an invalid protocol is feature 11.
- **Required-field enforcement in general.** The asterisks on Gewaessername, Datum, the coordinates
  and the rest stay decoration until feature 11. Only the conditional Monitoringstrecken-Nr. rule
  is enforced here, because it is a rule about a relationship between two answers rather than a
  presence check.
- **The backend half.** Features 2 and 3 were deferred until after the form parts, so there is no
  endpoint to validate against. These rules exist only in the browser for now, which leaves the
  "written twice" rule in `coding-standards.md` half met exactly as the build plan says it will be
  until feature 3. Writing the rules as pure functions is what keeps the eventual Pydantic version
  a translation rather than an archaeology exercise.
- **An error summary or a per-section error count in the step bar.** Feature 11 needs that view to
  tell somebody why they cannot submit. Adding it now would be a submit gate without the submit.
- **Any other field's validation.** No e-mail format, no postcode shape, no length range on
  `probestrecke.laenge`, no check that the two boundary coordinates are as far apart as the stated
  length. The last one is tempting and is a real check, but it needs a decision about tolerance and
  belongs with the map work in feature 18.
- **Hydrology suppression** for standing water types. Feature 5.
- **Zod schemas for parts 2 to 6.** The schema module is built so those parts extend it, but only
  part 1 is described here.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The three rules as pure functions** - `frontend/src/protokoll/regeln/` gains
      `monitoring.ts`, `vorfluter.ts` and `koordinaten.ts`, each exporting a function that takes
      values and returns what is wrong, with no React, no Zod and no translation in any of them.
      `coding-standards.md` puts domain rules in plain functions for exactly this reason, and it is
      what makes the eventual Pydantic version a direct translation. Nothing in the UI changes yet.
      *Done when:* `npm test` passes with a test file beside each rule covering, at minimum: the
      four Anlass values that do not require a number and the two that do, each with the number
      present and absent; a chain that is empty, one with a gap, one that never reaches a
      terminator, one ending at "Alte Donau" and one at "Oberrhein", one with an entry after the
      terminator, and one padded with spaces and odd casing; and a coordinate that is empty, not a
      number, a decimal, below the minimum, above the maximum, and exactly on each bound.

- [x] **Step 2 - The error surface, and rule 1 on screen** - `FeldRahmen` learns to show an error:
      the message under the control, `aria-invalid` on the control, and the error id added to
      `aria-describedby` beside any hint id, so a screen reader reads both. `.field--error` and
      `.field__error` are ported from `prototypes/mockup.css` into `protokoll.css` using the
      `--danger` tokens. `regeln/schema.ts` holds the Zod schema over `Antworten` and is wired into
      `useForm` as a resolver, with rule 1 as its only rule so far. The Monitoringstrecken-Nr.
      marker follows the Anlass. *Done when:* choosing "Fischmonitoring gemaess WRRL" with the
      number empty shows the mockup's error under the field and marks the field required, filling
      the number clears it, switching back to "allgemeine Bestandserhebung" clears both the error
      and the marker, the message is reachable by a screen reader and not only visible, and a
      protocol left in that invalid state still saves and still comes back after a reload.

- [x] **Step 3 - The Vorfluter chain on screen** - rule 2 joins the schema, with each of its three
      failures landing on the field named in the table above. *Done when:* typing one Vorfluter and
      leaving the rest empty shows the "chain must reach the Rhein or the Donau" message on that
      field, typing "Donau" in the second box clears it, leaving a gap in the middle shows a message
      on the gap, and adding a sixth link after "Rhein" shows a message on it. No message appears
      while all five boxes are empty.

- [x] **Step 4 - The coordinate bounds on screen** - rule 3 joins the schema, with a message per
      field naming that field's allowed range. *Done when:* a Hochwert typed into the Rechtswert box
      is flagged on the Rechtswert, a decimal is flagged, an empty box is not flagged, a value on
      either bound is accepted, and all four fields behave the same way. Then the whole of section 1
      is checked in light and dark, at desktop width and below 800px, with every error state showing
      at once, and `npm run build` passes.

## Files / areas

| Path | Why |
|---|---|
| `frontend/src/protokoll/regeln/monitoring.ts` | rule 1, pure |
| `frontend/src/protokoll/regeln/vorfluter.ts` | rule 2, pure |
| `frontend/src/protokoll/regeln/koordinaten.ts` | rule 3, pure, and the bounds constants |
| `frontend/src/protokoll/regeln/*.test.ts` | one test file per rule |
| `frontend/src/protokoll/regeln/schema.ts` | the Zod schema over `Antworten`, calling the rules |
| `frontend/src/protokoll/ProtokollFormular.tsx` | the resolver and the validation mode |
| `frontend/src/protokoll/felder/FeldRahmen.tsx` | the error message and its id |
| `frontend/src/protokoll/felder/rahmen.ts` | `aria-describedby` gains the error id, plus `aria-invalid` |
| `frontend/src/protokoll/felder/Feld{Text,Auswahl,Suche,Datum}.tsx` | each passes its error through |
| `frontend/src/protokoll/abschnitte/teil1/AnlassBlock.tsx` | the marker follows the Anlass |
| `frontend/src/protokoll/protokoll.css` | `.field--error` and `.field__error` |
| `frontend/src/i18n/locales/de.json` | the messages |

## Data / contracts

**Nothing about the stored document changes.** `Antworten` keeps every field a
`string | undefined`, and the draft store, its interface and its tests are untouched. An invalid
answer is stored exactly as typed. This is deliberate and load-bearing for feature 3: the server
will receive whatever the surveyor last wrote, and the server decides what is acceptable.

### How a rule is written

Locked here, because parts 2 to 6 add roughly forty more rules to the same schema.

A rule is a plain function of values. It returns a translation key, or a list of field-and-key
pairs where the rule spans several fields, and never a formatted German sentence. Two reasons: a
message built inside a rule cannot be translated for feature 17, and a rule that returns data
rather than prose can be read straight across into Pydantic when the backend catches up.

The Zod schema is the only place that knows about both the rules and the field paths. It calls the
pure functions and attaches each returned key to a path. No rule logic lives in the schema itself,
and no schema lives in a component.

### The error message contract

The message a field shows is a translation key resolved in `FeldRahmen`, from `protokoll.regeln.*`
in `de.json`. A field component never receives a formatted string, and no German text appears in a
rule, a schema or a component.

### Validation timing

`useForm` gains `mode: 'onTouched'`, so a field is first checked when the user leaves it and then on
every change after that. An untouched field never shows an error, which is what keeps a fresh draft
quiet.

Two known sharp edges to expect while building step 2, both with a known fix:

1. A rule spanning two fields does not re-run on the other field's change by itself. When the Anlass
   changes, the Monitoringstrecken-Nr. has to be revalidated deliberately, with React Hook Form's
   `trigger`. The same applies to the Vorfluter chain in step 3, where every box shares one rule.
2. Validation must not re-render the whole form. Read errors through the per-field subscription
   (`useFormState` with a `name`) inside `FeldRahmen`, not by pulling `formState.errors` into
   `ProtokollFormular` and passing it down. At 338 fields the difference is the whole reason
   `coding-standards.md` chose React Hook Form.

### One new dependency, already added

`@hookform/resolvers` 5.9.1, the official adapter from the React Hook Form project, joins Zod to
the form. Approved and installed on 2026-09-01, before step 1. It sits alongside Zod 4 without
complaint, and the build and the existing tests stayed green.

The alternative, considered and rejected, was a hand-written resolver: about thirty lines that run
the schema and map each Zod issue's path onto React Hook Form's dotted field name. Not hard, but
thirty lines of adapter nobody else maintains.

This is the only new dependency in 4c.

## Testing

The frontend runner is vitest. `npm test` from `frontend/`.

| What | How |
|---|---|
| The three rules | Unit tests, step 1, listed in full in that step. This is all of the in-scope logic where a wrong answer is possible, so the gate lands there. |
| The schema | Covered through the rules. Do not write a test that only restates the field paths. |
| The draft store | Untouched. Its existing tests must stay green. |
| `protokollTitel` | Untouched. Same. |
| Error display | Browser. Each rule triggered on screen, per the done-whens in steps 2 to 4. |
| Screen reader wiring | Browser. Focus a field in error and confirm the message is read with the label, and that the hint under the Monitoringstrecken-Nr. is still read too. |
| Saving while invalid | Browser. Leave a field in error, reload, confirm the bad value came back and the error is shown again. |
| Both themes | Screenshot section 1 with every error showing, in light and dark, at desktop width and below 800px. |
| Build | `npm run build` from `frontend/` at the end of every step. |

No backend change, so `pytest` is untouched, though it should be green before `/complete`.

## Notes for the AI

- **Never block saving.** `useAutoSave` writes `form.getValues()` on every change and knows nothing
  about validity. Keep it that way. If a change here makes an invalid draft fail to save, the change
  is wrong.
- **Every message comes from `de.json`.** No German string in a rule, a schema or a component.
- **No colour outside the tokens.** The error state uses `--danger` and `--danger-soft`, which exist
  in both themes already. No hex, no `sx` colour override. If MUI's own error styling fights the
  mockup, change `muiTheme.ts` once rather than patching a call site.
- **Accessibility is an acceptance criterion, not a later pass.** `aria-invalid` on the control, the
  message reachable through `aria-describedby` without displacing the hint, and the message readable
  in both themes. The red border alone is not a signal, which is why the message is always text as
  well.
- **Store what was typed.** Never trim, lowercase or otherwise normalise a Vorfluter name on its way
  into the document. Normalise only inside the comparison. Defect 2 in `docs/ffs-defect-list.md` is
  what happens when a form edits what somebody typed.
- **Do not add a dependency beyond `@hookform/resolvers`**, which is already installed. Not a
  validation library beside Zod, not Playwright, not a second component library.
- **Two things to raise with FFS**, neither blocking:
  1. The coordinate bounds are derived here, not given. Confirm the rectangle is acceptable, or
     supply the real extent.
  2. A chain terminating at a name merely containing "Rhein" or "Donau" accepts "Alte Donau" and
     "Oberrhein" on purpose, and would also accept an unrelated tributary named something like
     "Donaubach". Confirm that a loose match is better than a fixed list of accepted names.
- The three questions raised by 4b are still open and unchanged: `bearbeiter.ort` is missing from
  the legacy form, `z.quelle` and `z.ps_nummer` may not be the surveyor's to fill in, and the time
  picker rounds to five minute steps.
