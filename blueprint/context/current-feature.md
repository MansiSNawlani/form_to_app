# Feature: 9b - Part 6 rules

**From build-plan:** feature 9b, under feature 9, "Form part 6: the catch table"
**Status:** built, awaiting manual walk-through

## Goal

Make the catch table judge what is in it. 9a built 312 cells, a species picker over 123
entries and two live totals, and not one of them objects to anything: a row can hold
minus four fish, the same species can be named in three rows, a row can claim seven
young-of-year out of a total of two, and a survey that caught nothing can be filed with
no way to tell it from a table nobody has started.

This is the last rule set the protocol needs. After it, all six sections are real and
complete, which is what unblocks features 2, 3 and 11.

## Design reference

No new screen and no new mockup. `prototypes/` carries no catch table, and the printed
PDF decides which fields exist and what the rules are, never how the screen is arranged.

One thing does have to be designed, and it is the reason Step 5 exists. Every other
section shows a field's message under the field, drawn by `FeldRahmen`. A table cell has
no frame: it is roughly sixty pixels wide and named by the column heading above it. 9a
already wired both cell components to point `aria-describedby` at `${pfad}-fehler`, and
**nothing renders an element with that id**, so today a wrong cell would go red and say
nothing to anybody. See `ZahlZelle.tsx:54` and `ArtZelle.tsx:33`.

## What is wrong with a catch table

Four rules, in the order a surveyor would meet them.

| # | Rule | Where the message goes |
|---|---|---|
| A | A count is a whole number, zero or more | the cell |
| B | A row's 0+ count cannot exceed the row's total | the 0+ cell |
| C | The same species cannot be named twice | the second row's species cell |
| D | A survey that caught nothing has to say so | under the table |

### A. A count is a whole number, zero or more

Applies to all eleven numeric cells of a row: the ten size classes and the 0+ column.
Blank stays silent, because untouched is never wrong in a draft.

Anything else reports on that cell: `-4`, `2.5`, `1.200` (which `alsZahl` reads as 1.2,
losing 999 fish), and `abc`. One message for all four cases, because the correction is
the same one, which is the precedent `prozentKeineGanzeZahl` set for part 3's shares.

`ZahlZelle` already sets `min="0"` and `step="1"`, so none of these can be typed. They
survive a paste and a hand-edited draft, and 9a's own comment on that `min` says feature
9b holds the answer to it.

This rule is also what makes rule B safe. `summeAusWerten` deliberately adds a negative
number into a row total rather than hiding it, so that the number on screen and the
message tell the same story; `arten.test.ts` pins that. Rule A is what says the number
was wrong.

The legacy form checks none of this. It has no keystroke handler and no format check
anywhere in part 6, exactly as part 5 had none, so a negative count reaches FiaKa today.
This is a narrowing rather than a port, on the same footing as part 5's sign check: it
needs nothing from FFS, because no survey reports minus four Hechte.

### B. A row's 0+ count cannot exceed the row's total

The printed form heads the column "davon", which is "of which". Young-of-year individuals
are already counted in the ten size classes beside them, so a row claiming seven 0+ out of
a total of two is claiming five fish that are in no size class.

Silent unless the row can be judged. If 0+ is blank, or if 0+ or any of the ten classes
fails rule A, there is nothing trustworthy to compare and the row says nothing more than
rule A already said. This is the same suppression part 3 makes: an unreadable share
reports on that share and the total stays quiet.

The comparison is against the row's ten classes only, never including 0+ itself.
`regeln/arten.ts` already says why, and `summeAusWerten` already computes exactly that
number for the row's total cell, so the rule and the cell on screen are the same
arithmetic.

Note the edge deliberately kept: ten blank classes and `3` in 0+ reports, because a row
total of nothing cannot contain three fish. It appears only once the 0+ cell has been
left, which is the `onTouched` cadence every field message on this form follows.

### C. The same species cannot be named twice

Two rows both naming `HECH` are two answers to one question, and the eventual FiaKa
transfer would carry the species twice with different counts. The message goes on the
**second** and any later row's species cell, not on the first: the row that was named
first is not the one that went wrong, and reddening it would ask the surveyor to fix the
answer they got right.

The four "no detection" codes are ordinary codes here. `OFAF` ("kein Nachweis, Fische")
beside `KNKR` ("kein Nachweis, Krebse") is two different claims and passes; `OFAF` twice
is still one claim made twice and reports.

The legacy form permits duplicates. It has no cross-row check of any kind.

### D. A survey that caught nothing has to say so

This is the rule `project-overview.md` states as "an empty `arten` list requires one of
the four 'no detection' codes", and it is the one that needs the most care, because in a
draft "nothing caught" and "not filled in yet" look almost the same.

The four codes, from `optionslisten.json`:

| Code | Label |
|---|---|
| `OFAN` | kein Nachweis |
| `OFAF` | kein Nachweis, Fische |
| `KNKR` | kein Nachweis, Krebse |
| `KNMU` | kein Nachweis, Muscheln |

Three halves, and each is enforceable in a draft because each is a contradiction rather
than an absence:

- **D1. A no-detection row carries no fish.** `OFAF` in the species cell with `7` in the
  10-15 cm column says both that no fish were found and that seven were. The message goes
  on the species cell, because the counts are the record of what was seen and the code is
  the answer that contradicts them.
- **D2. A table that reads zero has to name a code.** When at least one row names a real
  species, every count cell in the table is blank or `0`, and at least one of them is an
  explicit `0`, the surveyor is saying they caught nothing while naming something they
  caught. The fix is to pick a no-detection code instead. The message goes under the
  table, because no cell is the wrong one.
- **D3. `OFAN` cannot stand beside a named species.** `OFAN` is the unqualified "kein
  Nachweis": nothing at all was found. Any other named species in the table contradicts
  it outright. Reported on the `OFAN` row's species cell.

**What is deliberately not checked, and why.** `OFAF`, `KNKR` and `KNMU` are each
qualified: no fish, no crayfish, no mussels. "No crayfish" standing beside three Hechte is
perfectly coherent, and "no fish" standing beside three Hechte is not. Telling those apart
needs to know which of the 123 species is a fish, a crayfish or a mussel, and
`optionslisten.json` carries only a code and a German label. Guessing the group from the
label's ending is the kind of inference this project refuses. So the qualified codes get
only D1 and C, and the gap becomes a new question in `docs/ffs-questions.md`.

**The cadence, and the one uncertain piece of this feature.** D2 turns on the whole table
reading zero, which a table passes through for one keystroke when a surveyor types `0`
into the first cell before typing a real count into the next. Every field message on this
form waits for a blur, and D2 is not attached to a field, so it does not get that for
free. This is the same problem part 3's group total had, and Step 6 settles it the same
way: the message speaks once any count cell has been left, or when a loaded draft already
reads that way. The documented fallback, if reading touched state across the table proves
unreliable, is to speak as soon as the table reads zero and accept the one-keystroke
flicker. The user sees the same thing in every case but that one.

## Where the messages appear

The gap named under Design reference is closed here, and the shape is the same one part 5
found for its pairs.

- **A wrong cell goes red and keeps its `aria-invalid`.** Themed once in `muiTheme.ts`,
  not per instance, so the tables in features 12 and 16 inherit it.
- **A list under the table carries the text**, one line per problem, each naming its row
  and column: "Art 3, über 10 bis 15 cm: Bitte eine ganze Zahl von 0 oder mehr eintragen."
  Each entry's id is `${pfad}-fehler`, which is exactly what 9a's cells already point at,
  so the dangling reference resolves with no change to `ZahlZelle` or `ArtZelle`.
- **D2's message sits below that list**, as its own paragraph, since it belongs to the
  table rather than to any row.

**The list is not a live region, and that is a decision rather than an oversight.** Part
5's `PaarMeldung` uses `role="status"` because it is one sentence about two boxes. A list
that can hold twenty-six entries and changes on every blur would announce a paragraph at
a time. What a screen reader user gets instead is the message on the cell they are in,
through the `aria-describedby` this step finally makes resolve, which is the right place
to hear it. A read-out of everything wrong at once belongs to feature 11's submit gate.
D2's paragraph does get `role="status"`, because it is one sentence and nobody is standing
on a cell when it changes.

The table's error path needs a name, and no path in the answers document names the table.
It gets its own, namespaced so it cannot collide with an answer, following the four that
already exist:

    Gruppenpfad    summe.umland and five more        teil3/gruppen.ts
    Einflusspfad   einfluesse.widerspruch            teil4/bloecke.ts
    Paarpfad       paar.anoden and two more          teil5/bloecke.ts
    Tabellenpfad   tabelle.arten                     teil6/tabelle.ts   <- new

## In scope

- Rules A, B, C and D as stated above, as plain functions over the answers document in
  `regeln/arten.ts`, tested, holding no React, no Zod and no German.
- The four no-detection codes declared once and pinned against `optionslisten.json` by a
  test, so a renamed code fails the build rather than silently emptying the rule.
- `pruefeArten` registered in `regeln/schema.ts`, so a wrong table makes the document
  formally invalid for feature 11's gate to read.
- The message list under the table, resolving 9a's dangling `aria-describedby`.
- The red invalid cell, themed once in `muiTheme.ts`.
- German strings for all of it in `de.json`.
- One new question in `docs/ffs-questions.md` about the species groups D3 cannot check.

## Out of scope

- **The backend half.** Features 2 and 3 are deferred, so there is no submission endpoint
  and no Pydantic model to mirror into yet. `build-plan.md` accepts that for features 4 to
  9 explicitly. The rules are plain functions over the answers document precisely so the
  backend can take them across unchanged.
- **Required markers and the submit gate.** Whether the catch table must be filled in at
  all, and what refuses a submission, is feature 11. This feature only says when an answer
  is wrong. A table nobody has touched stays silent.
- **A row that names a species and holds no counts.** That is the ordinary state of a row
  half way through being filled in, so objecting to it would object to normal typing. It
  is an incompleteness, and incompleteness is feature 11's.
- **An upper bound on a count.** What counts as too many Rotaugen is a question for FFS,
  and `docs/ffs-questions.md` question 7 already asks it. Guessing a ceiling would put a
  limit in the interface that no rule backs, which is the reason 9a left `max` off the
  cells.
- **Which qualified no-detection code contradicts which species.** Needs a species group
  the seed data does not carry. Becomes a question for FFS instead.
- **A summary of everything wrong with the protocol.** Feature 11's gate.
- **Clearing or blocking anything.** Parts 3, 4 and 5 all settled this and wrote down why:
  the legacy form refuses the keystroke that would break a rule, and refusing it makes an
  ordinary correction impossible. The contradiction is shown; which answer was wrong is
  the surveyor's to decide.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - the codes and the table's error path** - declare `KEIN_NACHWEIS` (the
      four codes), `OHNE_QUALIFIKATION` (`OFAN` alone), `ARTEN_TABELLE` and the
      `Tabellenpfad` type in `teil6/tabelle.ts`, plus a `zaehlfelder(nr)` helper giving a
      row's eleven numeric paths. Widen `Regelverstoss.pfad` in `regeln/regel.ts` with
      `Tabellenpfad`. No behaviour yet.
      *Done when:* `npm run build` and `npm test` pass, section 6 is visibly unchanged, and
      `tabelle.test.ts` proves all four codes exist in `optionslisten.json`'s `arten` list
      with `OFAN` among them, so a renamed code breaks the test rather than the rule.

- [x] **Step 2 - the count rules, with their tests** - rules A and B in `regeln/arten.ts`,
      as plain functions beside the `summeAusWerten` that is already there.
      *Done when:* `npm test` covers, per row: a blank cell is silent; `-4`, `2.5`,
      `1.200` and `abc` each report on their own cell; `0` and `12` are silent; 0+ above
      the row total reports on the 0+ cell; 0+ equal to the total is silent; a row whose
      classes are all blank with 0+ set reports; and a row holding an unreadable class
      reports on that class and stays quiet about 0+.

- [x] **Step 3 - the species rules, with their tests** - rules C, D1 and D3.
      *Done when:* `npm test` covers: two rows naming `HECH` report on the second only;
      three rows naming it report on the second and third; blank species are never
      duplicates of each other; `OFAF` twice reports; `OFAF` beside `KNKR` is silent; a
      no-detection row holding any count above 0 reports on its species cell; a
      no-detection row holding only blanks and zeros is silent; and `OFAN` beside any
      other named species reports on the `OFAN` row.

- [x] **Step 4 - the table rule and the registration** - rule D2, then `pruefeArten` added
      to `REGELN` in `regeln/schema.ts`.
      *Done when:* `npm test` covers: an untouched table is silent; a table with a named
      species and an explicit `0` and nothing else reports at `tabelle.arten`; the same
      table with a no-detection row present is silent; a named species with every cell
      blank is silent, because that is a draft and not a claim; and one non-zero count
      anywhere silences it. Plus a `schema.test.ts` case proving a violation raised at
      `tabelle.arten` round-trips into React Hook Form's error tree with no cell reddened,
      the same guard part 3 has.

- [x] **Step 5 - the messages on screen** - a `Tabellenmeldungen` leaf under the table
      reading `formState.errors.arten` and rendering one entry per problem, each with id
      `${pfad}-fehler` naming its row and column, plus the invalid cell's red border in
      `muiTheme.ts`. Reads the errors the resolver actually raised rather than
      recomputing, so the list and the document cannot disagree and the blur cadence comes
      free.
      *Done when:* pasting `-4` into a cell and leaving it turns that cell red and puts one
      named line under the table; the cell's `aria-describedby` resolves to that line, checked
      in the browser's accessibility inspector; correcting the cell removes the line; a
      keystroke in a cell re-renders the list and no other cell; and the red border comes
      from the theme, not from an `sx` on the cell.

- [x] **Step 6 - the table message and its cadence** - a `TabellenMeldung` paragraph for
      D2 with `role="status"`, and settle here whether it can wait for a blur. If reading
      touched state across the table proves unreliable, take the fallback in "What is wrong
      with a catch table" section D and say so in the step's summary.
      *Done when:* typing `0` into the first cell of a row naming `Hecht` and moving on to
      type `12` in the next shows no message in between; leaving the table with every count
      at `0` does show it; reopening a draft saved in that state shows it on load; and
      picking `OFAN` in a second row clears it.

- [x] **Step 7 - the German strings and the accessibility pass** - every message in
      `de.json`, and the new question appended to `docs/ffs-questions.md`.
      *Done when:* all six messages read correctly in German; every one names what to do
      rather than only what is wrong; the red cell, the list and the paragraph all meet
      contrast in light and dark; the list is reachable by keyboard and is not announced
      wholesale on every blur; and the cell's own message is what a screen reader reads
      when focus lands on it.

## Files / areas

**Changed**

- `frontend/src/protokoll/abschnitte/teil6/tabelle.ts` - the codes, `ARTEN_TABELLE`, `Tabellenpfad`, `zaehlfelder`
- `frontend/src/protokoll/abschnitte/teil6/tabelle.test.ts` - the codes pinned against the seed list
- `frontend/src/protokoll/abschnitte/teil6/ArtenTabelle.tsx` - renders the two message components
- `frontend/src/protokoll/regeln/regel.ts` - `Regelverstoss.pfad` gains `Tabellenpfad`
- `frontend/src/protokoll/regeln/arten.ts` - the four rules, beside `summeAusWerten`
- `frontend/src/protokoll/regeln/arten.test.ts` - their tests
- `frontend/src/protokoll/regeln/schema.ts` - one entry in `REGELN`
- `frontend/src/protokoll/regeln/schema.test.ts` - the `tabelle.arten` round-trip guard
- `frontend/src/protokoll/protokoll.css` - the message list's layout
- `frontend/src/theme/muiTheme.ts` - the invalid cell's border, themed once
- `frontend/src/i18n/locales/de.json` - the six messages and the list's row and column wording
- `docs/ffs-questions.md` - the species group question

**Created**

- `frontend/src/protokoll/abschnitte/teil6/Tabellenmeldungen.tsx`
- `frontend/src/protokoll/abschnitte/teil6/TabellenMeldung.tsx`

**Untouched**

- `frontend/src/protokoll/entwurf/typen.ts`. No new answer is stored. Every one of these
  rules is a verdict on cells that already exist, and a stored verdict would be a second,
  disagreeing answer.
- `database/seed/form_version_20260609/`. No new field and no new option list; the four
  codes are already in `optionslisten.json` and are only being named.
- `ZahlZelle.tsx` and `ArtZelle.tsx`. Their `aria-describedby` is already correct. Step 5
  gives it something to point at rather than changing it.
- The backend. Nothing to validate server-side until features 2 and 3.

## Data / contracts

**Load-bearing, because feature 11's submit gate and the eventual Pydantic half both read
this.** Nothing in `Antworten` changes.

    // teil6/tabelle.ts
    export const ARTEN_TABELLE = 'tabelle.arten' as const
    export type Tabellenpfad = typeof ARTEN_TABELLE

    /** The four codes that record a survey finding nothing. */
    export const KEIN_NACHWEIS: readonly string[] = ['OFAN', 'OFAF', 'KNKR', 'KNMU']

    /** The one that is unqualified, so nothing else may stand beside it. */
    export const OHNE_QUALIFIKATION = 'OFAN'

    /** A row's eleven numeric paths: ten classes then 0plus. */
    export function zaehlfelder(nr: Artnummer): AntwortPfad[]

    // regeln/regel.ts
    interface Regelverstoss {
      pfad: AntwortPfad | Gruppenpfad | Einflusspfad | Paarpfad | Tabellenpfad
      schluessel: ParseKeys
    }

New keys in `de.json`:

| Key | Text |
|---|---|
| `protokoll.regeln.anzahlKeineGanzeZahl` | `Bitte eine ganze Zahl von 0 oder mehr eintragen.` |
| `protokoll.regeln.nullPlusUeberSumme` | `Es können nicht mehr 0+ Tiere gezählt worden sein, als die Zeile insgesamt zählt.` |
| `protokoll.regeln.artDoppelt` | `Diese Art steht bereits in einer früheren Zeile.` |
| `protokoll.regeln.keinNachweisMitFang` | `Diese Zeile meldet keinen Nachweis und zählt trotzdem Tiere.` |
| `protokoll.regeln.keinNachweisNebenArt` | `"Kein Nachweis" schließt jede andere Art in der Tabelle aus.` |
| `protokoll.regeln.fangOhneNachweisCode` | `Wenn nichts gefangen wurde, wählen Sie bitte einen "kein Nachweis"-Eintrag statt einer Art.` |
| `protokoll.abschnitt6.meldung.zelle` | `Art {{nr}}, {{spalte}}: {{text}}` |
| `protokoll.abschnitt6.meldung.legend` | `Hinweise zur Fangtabelle` |

The cell messages carry no numbers. The row's total cell already shows the total, and
keeping the number out means `Regelverstoss` stays a path and a key with no interpolation
values to carry, which is the shape parts 1 to 5 all settled on.

## Testing

`npm test` (vitest, from `frontend/`) is the declared gate. Steps 2, 3 and 4 are the
logic-bearing ones and each ships its tests in the same diff. These are plain functions
over the answers document, which is exactly the "logic where a wrong answer is possible"
that `coding-standards.md` names, and part 6 is the section where a wrong answer is a
wrong scientific record.

`arten.test.ts` grows to cover, at minimum:

- every case listed in the done-when of Steps 2, 3 and 4
- that a violation in one row never names a path in another
- that a rule reporting on a cell suppresses the row rule that depends on it
- that rows 1 and 26 behave identically, so nothing is special-cased at either end

Steps 1, 5, 6 and 7 are UI and integration, so they ride on `npm run build` plus the
walk-through, as `coding-standards.md` directs. Playwright is not installed and is not
being added here.

**Manual walk-through, at the end:** open a draft, go to section 6, and in row 1 pick
Hecht, paste `-4` into a size class and leave the cell. Confirm the cell reds, one named
line appears under the table, and the row's total cell still shows what was typed. Correct
it and confirm both clear. Then put `2` in a class and `7` in 0+ and confirm the 0+ cell
objects. Name Hecht again in row 2 and confirm only row 2 objects. Change row 2 to
"kein Nachweis, Fische" and type a count into it, confirm the species cell objects, then
clear the counts. Set every count in the table to `0` and confirm the message under the
table, then pick "kein Nachweis" in a row and confirm it clears. Reload and confirm the
messages come back on the saved draft. Check all of it in light and dark, and reach one
wrong cell by keyboard alone to confirm the message is spoken.

## Notes for the AI

- **Follow the shape parts 1 to 5 already set.** A rule is a plain function from
  `Antworten` to `Regelverstoss[]`, holding no React, no Zod and no German, so the backend
  can read it straight across when features 2 and 3 land. `regeln/ausruestung.ts` is the
  closest model: it has both a per-field rule and a group rule in one file.
- **Do not change `summeAusWerten`.** It counts a negative number into a row total on
  purpose, so the row's total cell and the message tell the same story, and
  `arten.test.ts` pins that. Rule A is what objects to the sign; the total is not where
  that happens.
- **Never widen a `useWatch` or a `useFormState` past what a leaf needs.** `Gesamtsumme`
  already subscribes to 260 paths and is acceptable because it is a leaf that re-renders
  itself alone. `Tabellenmeldungen` is the same kind of component and the same rule
  applies: it may subscribe widely, and nothing above it may.
- **Memoise every path array handed to `useWatch` or `useFormState`.** A fresh array each
  render resubscribes each render. Every component in `teil6/` already does this and says
  why.
- **Theme the invalid cell once, in `muiTheme.ts`, not per instance.** That is the rule
  9a's cell styling followed and the reason features 12 and 16 will not each rebuild a
  table style. No hard-coded colour: the red comes from the tokens.
- **Compare loosely, store faithfully.** Whatever the user typed stays in the document
  untouched, including a value a rule rejects. Defect 2 is the legacy form rewriting
  answers, and we do not do that.
- **Where a rule comes from the legacy PDF, name the source in a short comment.** That is
  the one commenting exception `coding-standards.md` grants. Note also where a rule is
  ours rather than a port, as `regeln/einfluesse.ts` and `regeln/ausruestung.ts` both do.
- **The species codes are exact.** They come from the picker, so no casing or whitespace
  normalisation is wanted or correct. `KEIN_NACHWEIS` is pinned against the seed list by a
  test precisely so a code renamed upstream fails loudly instead of quietly disabling
  rule D.
- No em dashes, en dashes or ellipsis characters anywhere, including comments and the
  commit message.

## Amended during the build

### The two cell components were not untouched after all

The Files section listed `ZahlZelle.tsx` and `ArtZelle.tsx` as untouched, on the reading that
their `aria-describedby` was already correct and only needed something to point at. That was
half right. The `aria` was correct; the **look** was not wired at all. Both render an
`OutlinedInput` without MUI's `error` prop, so `muiTheme.ts`'s `Mui-error` styling, which
already fills a wrong field and thickens its outline for every other field on the protocol,
never reached a table cell. A wrong cell would have carried `aria-invalid` and looked exactly
like a right one.

Fixed by passing `error` in both, which also means Step 5 added no new theme code: the look
part 6 needed was already defined once in `muiTheme.ts`, which is what that rule is for.
`Suche.tsx` gained an optional `fehlerhaft` prop so `ArtZelle` can ask for it while
`FeldSuche` does not, since `FeldRahmen` already puts the state on the control around it.

### The blur gate counted the wrong cells, and a flash remains

First built so the table's message waited on **any** touched field in a row. That was wrong, and
the code review caught it: a species picker is blurred the moment an option is chosen, so picking
Hecht opened the gate before a single number had been typed, and the message then objected to the
`0` still being typed into the first cell. Exactly the flicker the gate existed to prevent.

The gate now counts only the eleven count cells, which is what the spec's cadence sentence says:
"once any count cell has been left". It moved to `tabelle.ts` as `zaehlzelleBeruehrt` so it is
tested rather than assumed, which is what would have caught this.

**Step 6's done-when is still not literally met, and this is the documented fallback being taken
in part.** Tabbing out of a cell holding `0` marks it touched, so the message appears for the
moment between leaving that cell and typing the next count. Making the done-when true needs a
mechanism nothing else on this form has, holding the message back while focus is anywhere inside
the table, which would also mean a surveyor working in the table never sees the message until they
leave it. Left for the user to decide rather than built unasked.

### The table message recomputes rather than reading its error

Step 6 asked whether the message at `tabelle.arten` could wait for a blur by reading
`formState.errors`. It cannot, for the reason 6b already recorded: React Hook Form refreshes
only the error for the name it is validating, and `tabelle.arten` is not a field, so a message
hanging there goes stale the moment anything is typed.

So `TabellenMeldung` takes part 3's arrangement instead. It calls the same
`fangOhneNachweisCode` that `regeln/schema.ts` calls, on the values it is already watching, and
gates it on touched state exactly as `Gruppensumme` does. One rule, two readers. The
registration in `schema.ts` stays, because it is what makes the document formally invalid for
feature 11's gate to read, and `schema.test.ts` guards the round-trip.

The list of cell messages does read `formState.errors`, and that half of Step 5 stands: those
are real field paths, so React Hook Form refreshes them per field on blur.

### Cross-field rules needed `useNachpruefung`, which the spec did not anticipate

Three of the four rules span more than one cell: the 0+ comparison reads the row's ten classes,
the duplicate rule reads every row's species, and the no-detection contradiction reads a row's
counts. React Hook Form rechecks only the field being edited, so all three would have gone
stale, leaving a message standing after the answer it complained about was corrected.

`useNachpruefung` is the hook parts 1 and 2 already use for exactly this, so part 6 uses it too.
The mapping lives in `tabelle.ts` as the pure `nachzupruefen`, not in the component, so it is
tested rather than assumed: a wrong mapping here is invisible until somebody hits it.

0+ deliberately does not recheck itself. A class changing can settle or raise its message, but
the cell keeps its own blur cadence so it does not object to a number still being typed.

### One message per cell, decided rather than left to the resolver

A cell can break two rules at once: an `OFAN` row named twice beside a real species is both a
duplicate and a contradiction. Only one message can ever be shown, since a field holds a single
error, so `pruefeArten` picks which rather than letting whichever order the resolver happens to
keep decide. The order runs from what a cell holds, through what it contradicts, to that it has
been said before.

### `ZEILENSPALTEN` replaced `ZEILENFELDER` as the declaration

The message list has to name the column a wrong cell is in, in the same words the cell announces
itself with. Rather than a second list of twelve mapping fields to names, `ZEILENSPALTEN` now
carries both and `ZEILENFELDER` is derived from it, so the two cannot drift.

### The cell message key carries no text

`protokoll.abschnitt6.meldung.zelle` was specced as `Art {{nr}}, {{spalte}}: {{text}}`. Built as
`Art {{nr}}, {{spalte}}:` with the message in a sibling element, because the id the cell's
`aria-describedby` points at has to cover the message and not the place: the cell already
announces itself as "Art 3, ueber 10 bis 15 cm", and including that in the description would say
it twice to the one person who cannot see which cell is red.

## Evidence, 2026-09-05

- `npx tsc --noEmit` clean
- `npm run lint` (oxlint) clean
- `npm test` (vitest): 740 passing across 18 files, including 45 in `regeln/arten.test.ts` and
  the two new `schema.test.ts` round-trip guards
- `npm run build` succeeds
- Dev server starts and serves

Still outstanding: the manual walk-through in the Testing section. The on-screen done-whens for
Steps 5, 6 and 7 have not been observed, and Playwright is not installed.

## Changed after the code review

Both review axes ran against the finished build. Five findings were acted on.

### Spec axis

1. **The blur gate counted species cells as well as counts**, so it opened before any number was
   typed. Fixed and tested; see the amendment above.
2. **`artcode` trimmed the stored value**, against the spec's own instruction that "the species
   codes are exact... no casing or whitespace normalisation is wanted or correct", and against the
   comment three lines below it claiming exactly that. The trim is gone and a test pins it.
3. **A comment overstated a suppression.** `keinNachweisMitFang` claimed a broken cell never
   produces two messages. A fraction such as `2,5` is a count above zero, so it trips the cell rule
   and the contradiction rule at once. The behaviour is right, the comment was not; both the
   comment and a test now say what actually happens.

### Standards axis

4. **The message list was hand-built from `div`, `ul` and `li`.** `coding-standards.md` widened the
   MUI rule on 2026-09-05 to cover everything MUI ships, with no carve-out for components that only
   supply styling. Rebuilt on `List`, `ListItem` and `Typography`; the remaining class carries only
   what is particular to this one list, which is what keeps it out of `muiTheme.ts`. The list also
   gained `aria-labelledby` pointing at its own title, so it is named programmatically.
5. **`TabellenMeldung.tsx` and `Tabellenmeldungen.tsx` sat in one directory** differing by one
   capital letter and a suffix, while doing different things. Renamed to `NachweisMeldung.tsx` (the
   one rule it shows) and `Zellmeldungen.tsx` (the cells it lists).

Three findings were deliberately not acted on, and each is the user's call rather than a quiet
decision:

- **`.block-message` on `NachweisMeldung` is a plain paragraph**, not an MUI component. It is the
  same element `teil4/EinfluesseWiderspruch.tsx` and `teil5/PaarMeldung.tsx` render and shares
  their class, so changing this one alone would leave three sibling components inconsistent. Worth
  doing across all three, in one pass, rather than here.
- **`Regelverstoss.pfad` grows a union member per form part.** A single `Pseudopfad` alias would
  stop that, but it touches parts 3, 4 and 5, and `ai-interaction.md` says not to refactor
  unrelated code unasked.
- **Comment volume.** `regeln/arten.ts` adds roughly as many comment lines as code lines, and the
  `## ` headings are the section dividers `coding-standards.md` warns against. The file already had
  that shape before this feature, as do `regel.ts`, `prozent.ts` and `ausruestung.ts`, so matching
  it was the deliberate choice. The standard and the established pattern genuinely disagree here
  and it is worth settling once, for the whole `regeln/` directory.

### Also corrected

Three German strings had drifted from the spec's `de.json` table without being declared. They are
kept as built, and the changes are small and deliberate: `nullPlusUeberSumme` drops "gezaehlt
worden sein" as a redundant clause, `keinNachweisNebenArt` lowercases "kein Nachweis" to match the
option label the picker actually shows, and `fangOhneNachweisCode` puts "statt einer Art" before
the instruction so the sentence ends on what to do.
