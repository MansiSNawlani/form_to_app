# Feature: The rules in Python

**From build-plan:** feature 11a
**Status:** built, all ten steps done

## Goal

Give the backend the ability to say, of a whole answers document, everything that is
wrong with it and everything that is still missing. One function in, one list of
violations out, each naming the field it concerns and why.

This is the gate that submitting needs. Until now the backend has deliberately
refused to judge a protocol's contents: `app/protokolle/regeln.py` checks that the
document has the right shape and nothing more, because a draft is half-finished by
definition and a surveyor saves after every few keystrokes. Its own docstring names
feature 11 as the place where demanding a complete, correct document becomes fair.

It also closes the gap the build plan opened on 2026-09-01, when the form screens
were moved ahead of login. Every rule from features 4c through 9b has lived only in
TypeScript since then, so the "written twice" rule in `coding-standards.md` has been
half-met for ten days. After this sub-feature it is met.

Nothing a user can see changes. Feature 11c calls this; 11a only builds it and
proves it.

## Design reference

None. There is no screen in this sub-feature.

## In scope

- A Python mirror of every rule module under `frontend/src/protokoll/regeln/`,
  written to the same contract: a plain function from the answers document to a list
  of violations, holding no database, no HTTP and no German sentences.
- The backend reading the seed option lists, which several rules test values against.
- **A declared list of what a finished protocol must contain.** This exists nowhere
  today, in either half of the app. See "The missing half" below.
- One assembling function, `pruefe_protokoll`, that runs all of it in section order.
- A complete, valid protocol as a test fixture, and a deliberately broken one.

## Out of scope

- **Any endpoint.** Nothing calls `pruefe_protokoll` until 11c. Saving a draft keeps
  checking only the document's shape, exactly as it does now, or half-finished work
  would stop saving.
- **The `FormVersion` table.** `app/formular/felder.py` assigns it to feature 11, on
  the grounds that feature 11 is the first thing needing the stored rules rather than
  only the field names. That premise does not hold the way it was written: these
  rules are Python functions, not rows of JSON, so there is nothing here for the
  table to store. The table's real job is ADR 0004, keeping an old protocol
  renderable after the form changes, and it earns its place when a second form
  version exists. Raised with the user on 2026-09-11 rather than decided quietly.
- Any change to the frontend, including its rule modules and its locale files.
  **Deviated from on 2026-09-11, deliberately and narrowly.** This was inconsistent
  with step 10's own done-when, which requires every key the backend can emit to have
  German text behind it. Four keys are new here and had none, so the choice was to add
  four lines to `de.json` or to ship a check that cannot pass. The four messages were
  written. No other frontend file is touched.
- Attachments. Whether a protocol must carry a Kartenausschnitt before it can be
  submitted is a real question, and it belongs to 11c where the panel that would say
  so is built.

## The missing half

Porting the rules is only part of the job, and the smaller part.

Every existing rule answers "is this answer wrong?" None answers "is this answer
there?" `regel.ts` says why in one line: blank is untouched, and untouched is never
wrong in a draft. That is correct for a draft and useless for a submission.

Requiredness today is a visual asterisk. The `pflicht` prop appears 32 times across
six block components, and only in parts 1, 2 and 5. Parts 3, 4 and 6 mark nothing.
It is enforced nowhere, machine-readable nowhere, and drifts freely.

So `vollstaendigkeit.py` is a new rule, not a port, and it is written as a rule
rather than a data flag because requiredness here is conditional on other answers.
`AnlassBlock.tsx` already does this: the Monitoringstrecken-Nr. is required only for
a WRRL or FFH occasion. Hydrology is required only for flowing water. A static list
of required paths could not express either.

This leaves the frontend's asterisks as a second, hand-maintained truth. That is
accepted for the length of this sub-feature and closed in 11c, where the panel
listing what is still missing reads the backend's answer instead of the asterisks.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The rule contract and its helpers** - create
      `app/protokolle/formregeln/`, mirroring `frontend/src/protokoll/regeln/` module
      for module. Define the `Formverstoss` shape (a path and a message key), and port
      the three helpers in `regel.ts`: `wert_aus` walking a dotted path, `als_zahl`
      reading a German or English decimal, `ist_leer`. Also the four pseudo-paths a
      violation can point at when no single field is wrong: the percentage groups, the
      Einfluss blocks, the equipment pairs, and the catch table as a whole.
      *Done when:* `pytest` covers each helper, including `als_zahl` on `"0,0"`,
      `"0.0"`, `" 12 "`, `""` and `"zwoelf"`, and `wert_aus` three levels deep on
      `probestrecke.gewaesser.vorfluter1`.

- [x] **Step 2 - The option lists reach the backend** - extend `app/formular/` to
      publish `optionslisten.json` from the same seed directory `felder.py` already
      reads, cached the same way. Several rules below compare against coded values:
      the Gewaessertyp numbers, the four no-detection species codes, the WRRL and FFH
      occasions.
      *Done when:* a test reads a known list out of the seed, and a missing seed file
      fails with the same clear message `felder.py` already gives.

- [x] **Step 3 - Part 1 rules** - port `vorfluter.ts`, `koordinaten.ts` and
      `monitoring.ts`. The receiving-water chain with no gaps and ending at Rhein or
      Donau, the Baden-Wuerttemberg coordinate bounds, the monitoring number required
      for a WRRL or FFH occasion.
      *Done when:* `pytest` reproduces every case in the three matching `.test.ts`
      files, and the emitted keys are exactly `vorfluterLuecke`,
      `vorfluterKeinEndpunkt`, `vorfluterNachEndpunkt`, `koordinateKeineGanzeZahl`,
      `koordinateRechtswertAusserhalb`, `koordinateHochwertAusserhalb` and
      `monitoringnummerPflicht`.

- [x] **Step 4 - Part 2 rules** - port `schaetzwert.ts`, each estimate falling inside
      the band chosen for it. Then the hydrology rule, which is new in this direction:
      the frontend blanks the hydrology fields when the water is standing, so the
      backend's job is to refuse a standing-water protocol that still carries
      hydrology answers. That needs a new message key, `hydrologieBeiStillgewaesser`.
      *Done when:* `pytest` covers a value below its band, above it, a value with no
      band chosen, an unreadable value, and a Gewaessertyp of 21, 26 or 29 carrying a
      hydrology answer.

- [x] **Step 5 - Part 3 rules** - port `prozent.ts`: the six blocks, each summing to
      exactly 100, each share a whole number. Keys `prozentKeineGanzeZahl` and
      `prozentsummeNichtHundert`, the latter pointing at the group rather than at any
      one box.
      *Done when:* `pytest` covers all six blocks, a block summing to 99, one summing
      to 101, an untouched block, and a decimal share.

- [x] **Step 6 - Parts 4 and 5 rules** - port `einfluesse.ts`, where the
      contradiction is between two ticks rather than in either, and `ausruestung.ts`,
      where three pairs of numbers must not say nothing between them, and no quantity
      may be negative.
      *Done when:* `pytest` emits `einfluesseBeideBlankett`,
      `einfluesseKeineUndNutzung`, `einfluesseUnbekanntUndNutzung`, `anodenKeine`,
      `befischteLaengeNull`, `befischteBreiteNull` and `zahlNegativ` on the cases their
      `.test.ts` files already cover.

- [x] **Step 7 - Part 6, the counts** - port the first half of `arten.ts`: a row's
      total read out of its ten size classes, the young-of-year count never exceeding
      that total, and no negative or fractional counts anywhere in the table.
      *Done when:* `pytest` emits `anzahlKeineGanzeZahl` and `nullPlusUeberSumme` on
      the cases `arten.test.ts` already covers, and a blank cell counts as nothing
      while a word in a cell refuses to be totalled at all.

- [x] **Step 8 - Part 6, the species** - the second half of `arten.ts`: no species
      named twice, one of the four no-detection codes when nothing was caught, and no
      no-detection code sitting beside a real catch. Split from step 7 because
      `arten.ts` is 332 lines, two and a half times the next largest module, and one
      diff carrying all of it would be too big to read properly.
      *Done when:* `pytest` emits `artDoppelt`, `keinNachweisMitFang`,
      `keinNachweisNebenArt` and `fangOhneNachweisCode` on the cases
      `arten.test.ts` already covers.

- [x] **Step 9 - What a finished protocol must contain** - write
      `vollstaendigkeit.py`. **This step stops for a decision before any code.** The
      32 `pflicht` markers give parts 1, 2 and 5. Parts 3, 4 and 6 mark nothing today,
      so what they require is a call somebody has to make, and it is a product
      question rather than a technical one: must all six percentage blocks be filled
      in, must any Einfluss be ticked, must the catch table have a row. Put the
      proposed list to the user, then build it. Every requirement that depends on
      another answer is written as a condition, not a flag. New keys under
      `protokoll.regeln.fehlt`.
      *Done when:* the required list was agreed rather than assumed, and `pytest`
      shows an empty document naming every missing required field, a complete one
      naming none, a WRRL occasion requiring the monitoring number, a standing water
      not requiring hydrology, and a flowing water requiring it. The list of required
      paths sits in one place and reads top to bottom.

- [x] **Step 10 - One check over the whole document** - `pruefe_protokoll(antworten)`
      running every rule in section order and returning one flat list. Add two
      fixtures: a complete, valid protocol and a deliberately broken one.
      *Done when:* the valid fixture returns zero violations, the broken one returns a
      known set in section order, and a test proves every message key the backend can
      emit already exists under `protokoll.regeln` in
      `frontend/src/i18n/locales/de.json`, so a violation can never reach a user as a
      raw key.

## Files / areas

- `backend/app/protokolle/formregeln/` - new package, one module per frontend rule
  module, plus `regel.py` for the shared helpers and `__init__.py` for the assembler.
  Named `formregeln` rather than `regeln` because `app/protokolle/regeln.py` is taken
  by the document-shape check, and rather than `pruefung` because that word belongs to
  the reviewer's decision in 11d and 11e.
- `backend/app/protokolle/formregeln/*_test.py` - tests beside the code they cover,
  per `coding-standards.md`.
- `frontend/src/protokoll/regeln/schema.ts` gets no twin, and that is correct rather
  than an oversight. It is the Zod check on the document's shape, and the backend
  already has that half in `app/protokolle/regeln.py`. Every other module in the
  folder is ported.
- `backend/app/formular/optionen.py` - new, publishing the seed option lists.
- A fixtures module for the complete and broken protocols.
- Nothing under `frontend/`.

## Data / contracts

**Load-bearing.** 11c returns these to the browser, and 11d stores nothing else.

A violation is a path and a message key:

```
Formverstoss(pfad: str, schluessel: str)
```

- `pfad` is a dotted path into the answers document, or one of the four pseudo-paths
  used where the wrong thing is a combination rather than a field.
- `schluessel` is an i18n key, never a sentence. The backend must not hold German: the
  frontend already carries all 25 of these messages under `protokoll.regeln` in
  `de.json`, and feature 17 translates them. A sentence built in the backend could not
  be translated, and would duplicate one that already exists.

All 25 keys the frontend has must be reachable from the backend, and step 9 proves it
by reading the locale file. Two groups are new and have no German text yet:
`hydrologieBeiStillgewaesser` from step 4, and the `fehlt` family from step 8. Their
wording is written in 11c, where the panel that shows them is built.

`pruefe_protokoll(antworten: Mapping) -> list[Formverstoss]`. An empty list means the
protocol may be submitted. Order is section order, so the panel in 11c can list
problems in the order a person walks the form.

## Testing

`pytest`, from `backend/`. The test gate is on and every step here is logic-bearing,
so every step ships tests in the same diff. There is no UI evidence to fall back on.

The cheapest correctness check available: each ported module's `.test.ts` file is a
written-down list of cases somebody already thought through. Port the cases, not just
the code. Where a Python test and its TypeScript twin disagree, one of the two halves
is wrong, and that is worth stopping for rather than patching past.

No database is needed. These are plain functions over values, like
`app/benutzer/regeln.py`.

## Notes for the AI

- **Mirror the frontend module names exactly.** `vorfluter.ts` becomes `vorfluter.py`.
  The pairing is the point: when a rule changes, both halves are obvious.
- **Read the TypeScript before writing the Python.** Several modules carry reasoning
  in their comments that the code itself does not say, for example why `als_zahl`
  accepts a comma, and why a blank cell and a word are treated differently in
  `arten.ts`.
- **No German sentences in the backend.** Keys only.
- Plain functions over values. No session, no request, no `Submission` object.
- Where a rule comes from the legacy PDF, name the source in a short comment. That is
  the one commenting exception `coding-standards.md` allows, and the Gewaessertyp
  numbers in step 4 are exactly the case it describes.
- The legacy form's own JavaScript is wrong about Gewaessertyp: it tests for 31 and
  32. Read the values from `project-overview.md` and the seed, never from the PDF's
  script. See defect 9 in `docs/ffs-defect-list.md`.
- Do not touch `app/protokolle/regeln.py`. Saving a draft must stay as forgiving as it
  is today.
