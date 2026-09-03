# Feature: 6b - Part 3 rules

**From build-plan:** feature 6b, under feature 6 (Form part 3)
**Status:** built, awaiting review

## Goal

Make section 3 add up. 6a put forty-three percentage boxes on screen; none of them
knows about any other. This feature gives each of the six runs a running total the
user can see while typing, and the rule that the run has to come to exactly 100.

It also closes two entries in `docs/ffs-defect-list.md`:

- **[Defect 1](../../docs/ffs-defect-list.md)**, the high-severity one. The legacy form
  checks five of the six runs at submit and silently skips `Substratverteilung`. A
  protocol whose substrate shares total 43 is sent and accepted. Here all six are
  checked the same way, which is what the defect list already promises FFS under
  "What we intend to do".
- **[Defect 4](../../docs/ffs-defect-list.md)**. In the legacy form `gewaessersohle.lehm`
  calls `app.alert0(...)`, which does not exist, so instead of a warning the script
  throws and the reader may show nothing at all. Gone by construction: there is one
  code path for all forty-three shares.

## Design reference

No new screen and no new mockup. This adds one line of text to each of the six runs
that 6a already built, inside the `fieldset` that is already there.

`prototypes/` carries no percentage block, and the printed PDF decides which fields
exist and what the rules are, never how the screen is arranged. The legacy form's own
device is a red star that turns into a green tick beside each run. A number is more use
than a tick, because "Summe: 83 %" tells the user how far off they are and a tick does
not.

## The six runs

The blocks are already declared as data in
[bloecke.ts](../../frontend/src/protokoll/abschnitte/teil3/bloecke.ts). This is what
each one is and what the legacy form calls its indicator field.

| Run | Constant | Legacy indicator | Shares | Checked at submit today? |
|---|---|---|---|---|
| Nutzung des Umlands | `UMLAND` | `check_ok_umland` | 8 | yes |
| Neigung | `UFERNEIGUNG` | `check_ok_neigung` | 4 | yes |
| Uferbewuchs | `UFERBEWUCHS` | `check_ok_bewuchs` | 9 | yes |
| Uferverbauung | `UFERVERBAUUNG` | `check_ok_uferverbau` | 8 | yes |
| Substratverteilung | `SUBSTRAT` | `check_ok_substrat` | 8 | **no, defect 1** |
| Sohlverbauung | `SOHLVERBAUUNG` | `check_ok_sohlverbau` | 6 | yes |

Forty-three shares in total. Every field not in this table (the Randstreifen radio, the
Damm pair, Wurzeln, Buhnenbereich, the Besonderheiten checkboxes and the two free-text
boxes) is not part of any run and is never added up.

## The rule, exactly

For each run, in this order:

1. **Every share blank, so silent.** Untouched is never wrong in a draft, the same
   convention `istLeer` already carries in `regeln/regel.ts`. This is also why the
   asterisk stays off: whether a run is required at all is feature 11's gate.
2. **A share that is not a whole number 0 to 100, so a message on that share.** The
   legacy form reads these with `parseInt`, and 6a already set `min`, `max` and `step`
   on the input, so this only ever catches a pasted or hand-edited value. Per field,
   because the wrong thing genuinely is that one box.
3. **Otherwise the shares must total exactly 100, so one message on the run.** Blank
   counts as 0 for the sum.

**Over 100 is a message, not a rejection.** The legacy form sets `event.rc = false` on
every keystroke that would push a run past 100, so the character never lands. That
makes ordinary editing painful: with the run already at 100 you cannot type the first
digit of a corrected value without first clearing another box. We let the value in and
say the run is over. This is a deliberate divergence, and it is the reason defect 4
cannot recur here.

## Where the message goes

One wrong sum is one problem, so it gets one message, placed beside the run's total
rather than on any single share. Painting nine boxes red for one idea is the noise the
Vorfluter rule already refuses to make.

`Regelverstoss.pfad` is currently an `AntwortPfad`, and no path in the answers document
names a run. Three of the six runs live under `ufer` and two under `gewaessersohle`, so
a group path does not identify one either. The run therefore gets its own error path,
namespaced so it cannot collide with an answer:

    summe.umland   summe.neigung   summe.bewuchs
    summe.uferverbau   summe.substrat   summe.sohlverbau

The suffixes are the legacy indicator names, so the mapping back to the PDF stays
readable. `summe` is not a group in `Antworten`, which matters: `ufer.neigung` is a real
field, the geschütteter Damm's slope in degrees, and using the run's own name as its
error path would have quietly reddened it.

**This is the one uncertain piece of the feature, so Step 3 exists to settle it.**
React Hook Form stores errors in a tree of its own and does not require a path to exist
in the values, so an issue raised at `summe.umland` should round-trip through
`zodResolver` into `formState.errors`. It is typed against `FieldPath<Antworten>`
though, so `trigger` and `getFieldState` need one narrow, commented cast. If it does not
round-trip, the documented fallback is that `Blocksumme` renders the message from the
same pure rule it already calls for the total, and the schema keeps only the per-share
violations from point 2. The user sees the same thing either way. What is lost is the
document being formally invalid for a wrong sum, which only feature 11's submit gate
reads, and which gets its authoritative Pydantic half then anyway.

## In scope

- Each of the six runs carries an id and its legend in `bloecke.ts`, so the rule and the
  view name the same thing.
- `regeln/prozent.ts`: the pure rule, tested, covering all six runs including the
  substrate run the legacy form skips.
- A running total under each run, live as the user types.
- The sum message, and the per-share message for a value that is not a whole 0 to 100.
- Editing any share rechecks its own run and nothing else.
- German strings for all of it, in `de.json`.

## Out of scope

- **The backend half.** Features 2 and 3 are deferred, so there is no submission
  endpoint and no Pydantic model to mirror this into yet. `build-plan.md` accepts that
  for features 4 to 9 explicitly. The rule is written as a plain function over the
  answers document precisely so the backend can take it across unchanged.
- **Required markers and the submit gate.** Feature 11 decides what blocks a submission.
  This feature only says when an answer is wrong.
- **The rest of section 3.** Randstreifen, the Damm pair, Wurzeln, Buhnenbereich, the
  Besonderheiten checkboxes and the free-text boxes have no rules and gain none here.
- **Sections 4 to 6.** Parts 4, 5 and 6 are features 7, 8 and 9.
- **Touching `docs/ffs-defect-list.md`.** It already promises this fix under "What we
  intend to do"; delivering it needs no edit.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - the runs gain an identity** - turn each block in `bloecke.ts` from a bare
      array into `{ id, legendKey, felder }`, and let `ProzentBlock` take the whole block
      instead of a legend and a list. Update `bloecke.test.ts` for the new shape and add a
      case asserting the six ids are distinct. Pure refactor, no behaviour.
      *Done when:* `npm run build` and `npm test` pass, and section 3 renders exactly as
      before with no visible change.

- [x] **Step 2 - the rule, with its tests** - `regeln/prozent.ts`, exporting the pure
      `bewerteBlock` (the total, plus what is wrong with one run) and
      `pruefeProzentbloecke` as a `Regel`. No React, no Zod, no German, matching
      `regeln/regel.ts`.
      *Done when:* `npm test` covers, per run: all blank is silent; exactly 100 is silent;
      83 and 120 both report; a blank share counts as 0; `50.5`, `-1`, `101` and `abc`
      each report on their own share and suppress the sum message; and a test proves the
      substrate run is treated identically to the other five, which is defect 1.

- [x] **Step 3 - the run's error channel** - widen `Regelverstoss.pfad` to accept a run id
      as well as an `AntwortPfad`, register `pruefeProzentbloecke` in `regeln/schema.ts`,
      and add `useBlockFehler` beside `useFeldFehler`. Settle the round-trip question here
      before anything is drawn.
      *Done when:* a draft saved with Umland totalling 83 shows an error at `summe.umland`
      after reopening, no field in the run carries one, and the per-share message from
      Step 2 still lands on its own field. If it does not round-trip, take the fallback in
      "Where the message goes" and say so in the step's summary.

- [x] **Step 4 - the running total on screen** - a `Blocksumme` inside `ProzentBlock`,
      reading its own run's values with a scoped `useWatch` and showing `Summe: 83 %`,
      with the message from Step 3 beneath it when there is one.
      *Done when:* typing in Uferbewuchs updates only that run's total, the other five are
      unchanged on screen, and a keystroke does not re-render the section around it.

- [x] **Step 5 - rechecking as you type** - wire `useNachpruefung` so editing any share
      rechecks its own run. Without this the message goes stale, exactly as it would have
      for the Vorfluter chain.
      *Done when:* with Umland at 83 and its message showing, typing 17 into the last
      empty share clears the message without visiting any other field; and changing a
      share in Umland leaves the Substrat message alone.

- [x] **Step 6 - the German strings and the accessibility pass** - the total, the two
      messages, and associating both with the run's `fieldset` so a screen reader
      reaching the run hears what it has to add up to.
      *Done when:* all six runs read correctly in German; the total and its message meet
      contrast in light and dark; the message is reachable from the run's fieldset via
      `aria-describedby`; and the total does not announce on every keystroke.

## Files / areas

**Changed**

- `frontend/src/protokoll/abschnitte/teil3/bloecke.ts` - blocks gain `id` and `legendKey`
- `frontend/src/protokoll/abschnitte/teil3/bloecke.test.ts` - new shape, distinct ids
- `frontend/src/protokoll/abschnitte/teil3/ProzentBlock.tsx` - takes a block, renders the total
- `frontend/src/protokoll/abschnitte/teil3/UmlandBlock.tsx`, `UferBlock.tsx`, `GewaessersohleBlock.tsx` - pass the block through
- `frontend/src/protokoll/abschnitte/Abschnitt3.tsx` - the `useNachpruefung` wiring
- `frontend/src/protokoll/regeln/regel.ts` - `Regelverstoss.pfad` widened
- `frontend/src/protokoll/regeln/schema.ts` - one entry in `REGELN`
- `frontend/src/protokoll/felder/fehler.ts` - `useBlockFehler`
- `frontend/src/protokoll/protokoll.css` - the total's own row
- `frontend/src/i18n/locales/de.json` - the total and the two messages

**Created**

- `frontend/src/protokoll/regeln/prozent.ts`
- `frontend/src/protokoll/regeln/prozent.test.ts`
- `frontend/src/protokoll/abschnitte/teil3/Blocksumme.tsx`

**Untouched**

- The answers document. No new answer is stored: a total is derived, and the legacy
  `check_ok_*` indicators are presentation state, not answers.
- `database/seed/form_version_20260609/`. No new field and no new option list.
- The backend. Nothing to validate server-side until features 2 and 3.

## Data / contracts

**Load-bearing, because features 7, 8 and 9 will copy it.** Part 4 has seven ratings,
part 5 has two rows of fished areas and part 6 has row totals over ten size classes, so
whatever shape a derived group total takes here is the shape three more features reach
for.

    // bloecke.ts
    interface Prozentblock {
      id: Blockpfad          // 'summe.umland' and the five others
      legendKey: ParseKeys
      felder: readonly Prozentfeld[]
    }

    // regel.ts
    interface Regelverstoss {
      pfad: AntwortPfad | Blockpfad
      schluessel: ParseKeys
    }

    // prozent.ts
    interface Blockbewertung {
      summe: number                    // blank counts as 0
      verstoesse: readonly Regelverstoss[]
    }

`Antworten` does not change. `Blockpfad` is a union of the six literals, declared in
`bloecke.ts` next to the runs it names.

New keys in `de.json`:

| Key | Text |
|---|---|
| `protokoll.abschnitt3.summe` | `Summe: {{summe}} %` |
| `protokoll.regeln.prozentsummeNichtHundert` | `Die Anteile müssen zusammen genau 100 % ergeben.` |
| `protokoll.regeln.prozentKeineGanzeZahl` | `Bitte einen ganzen Prozentwert von 0 bis 100 eintragen.` |

The sum message does not name the number. The running total is on the line above it and
already says so, and keeping the number out means `Regelverstoss` stays a path and a
key, with no interpolation values to carry.

## Testing

`npm test` (vitest, from `frontend/`) is the declared gate, and Step 2 is the
logic-bearing step, so its test ships in the same diff. The rule is a plain function over
the answers document, which is exactly the "logic where a wrong answer is possible" that
`coding-standards.md` names.

`prozent.test.ts` covers, at minimum:

- all six runs, so defect 1 cannot come back as "we only tested Umland"
- blank run, exact 100, under, over
- a blank share counted as 0
- `50.5`, `-1`, `101`, `abc` and `50,5` on a share
- a run with one share filled to 100 and the rest blank, which is valid
- that a violation in one run never names a path in another

Steps 1, 3, 4, 5 and 6 are UI and integration, so they ride on `npm run build` plus a
walk-through, as `coding-standards.md` directs. Playwright is not installed and is not
being added here.

**Manual walk-through, at the end:** open a draft, go to section 3, and for each of the
six runs put in shares that total 83, confirm the total reads 83 and the message appears
after leaving the field, then correct the last share to reach 100 and confirm both clear.
Do the substrate run last and deliberately, because that is the one the legacy form never
checked. Then reload the page and confirm the message comes back on the saved draft.
Check the total and the message in light and dark.

## Notes for the AI

- **Follow the shape parts 1 and 2 already set.** A rule is a plain function from
  `Antworten` to `Regelverstoss[]`, holding no React, no Zod and no German, so the
  backend can read it straight across when features 2 and 3 land. `schaetzwert.ts` is
  the closest model.
- **Never widen a `useWatch` past its own run.** `Blocksumme` re-renders on every
  keystroke by design. If it watches the whole document, all forty-three fields and the
  page around them re-render with it, which is the sticky typing `coding-standards.md`
  picked React Hook Form to avoid.
- **`useNachpruefung`'s arguments must be stable across renders**, so declare them
  outside the component. Its own comment says so; an inline array resubscribes on every
  render.
- **Watch the two `neigung`s.** `ufer.neigung` is the geschütteter Damm's slope in
  degrees and is not one of the four shares in the Neigung run. The run's error path is
  `summe.neigung`.
- **Compare loosely, store faithfully.** Whatever the user typed stays in the document
  untouched, including a value the rule rejects. Defect 2 is the legacy form rewriting
  answers, and we do not do that.
- **Where a rule comes from the legacy PDF, name the source in a short comment.** That is
  the one commenting exception `coding-standards.md` grants, and defect 1 is worth the
  line.
- No em dashes, en dashes or ellipsis characters anywhere, including comments and the
  commit message.

## Amended during the build

### The block error path works, and the view does not read it

Step 3's open question is settled: an issue raised at `summe.umland` does round-trip
through `zodResolver` into React Hook Form's error tree, with no field in the run
reddened. `regeln/schema.test.ts` is the proof and stays as the guard, because a
resolver that ever started filtering issues against the document would make six
messages vanish in silence.

The view still does not read it, and `useBlockFehler` was never written. React Hook
Form only refreshes the error for the name it is validating, so a message hanging at
`summe.umland` goes stale the moment the user types in a share, and un-staling it means
`trigger` on a path that is not a field. `Blocksumme` already holds the run's values,
because it has to show the total, so it calls the same `bewerteAnteile` the schema calls
and is live by construction. One arithmetic, two readers, no plumbing between them.

The schema registration stays. It is what makes the document formally invalid for a
wrong total, which is what feature 11's submit gate will read.

### Step 5 was not needed

`useNachpruefung` is for a rule that spans fields and would otherwise go stale. Nothing
in part 3 goes stale: the block total recomputes from its own `useWatch` on every
keystroke, and the per-share message depends only on that share's own value, which
React Hook Form already revalidates on its own. The step was dropped rather than built
empty.

### The sum message waits for a blur, rather than not appearing at all

First built so the message only appeared once a group went **over** 100, on the
reasoning that under 100 is what every group looks like on the way to being filled in.
The spec review caught that this quietly dropped a promised behaviour: Step 3's
done-when and the walk-through both describe a reopened draft totalling 83 showing its
message, and it would not have.

Built instead on the `onTouched` cadence every other field on the protocol already
follows. The message appears once any share in the group has been left, and clears the
moment the total is right.

A reopened draft needs its own trigger. `ProtokollFormular` revalidates a loaded draft
on mount, but `trigger()` sets errors and leaves every field untouched, so touched
state alone would have shown a protocol put down at 83 as clean. `Gruppensumme` also
judges the draft's loaded values, and a group that arrived already wrong speaks up
straight away.

### `bewerteBlock` split in two

`bewerteAnteile(block, werte)` judges a run from its shares; `bewerteBlock(block,
antworten)` reads those shares out of the document and delegates. The split exists so
`Blocksumme` can pass the values it already has from `useWatch` instead of rebuilding an
answers document just to have it taken apart again.
