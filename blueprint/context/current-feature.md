# Feature: Absenden

**From build-plan:** feature 11c
**Status:** built, all eight steps done

## Goal

Let a surveyor send a finished protocol to FFS, and tell them plainly what is still
missing when they cannot.

This is the feature that makes the last two do something. 11a wrote the rules that say
what a finished protocol must contain and what is wrong with it, and nothing calls them.
11b built the Gewaesser, Probestrecke and Person tables and the matching that decides
which rows a protocol belongs to, and nothing calls that either. 11c is the endpoint that
runs both, promotes the envelope columns, moves the status from DRAFT to SUBMITTED, plus
the button and the panel that let a person do it from the screen.

It is also the first time anything in this application produces a protocol that is not a
draft, so it is where the consequences of that land: a submitted protocol can no longer be
edited or deleted, and its page has to say so rather than silently failing a save.

## Design reference

`prototypes/meine-protokolle.html` for the list, which is already built and already prints
the status badge for all seven states.

**There is no mockup for Absenden.** Neither `protokoll-teil-1.html` nor
`meine-protokolle.html` carries a submit button or a problem panel: the protocol mockup's
action row ends with "Weiter: Messdaten und Hydrologie", a disabled "Zurueck", the save
indicator and "Entwurf schliessen". So the button and the panel are designed here, out of
the tokens and components the rest of the form already uses, rather than copied from a
picture. Decided on 2026-09-11 rather than blocking on a new mockup, because both are made
of components the form already has: MUI's `Button`, `Alert` and `List`, and the existing
`BestaetigungsDialog`.

Two placement decisions were taken with the user on 2026-09-11:

- **The button sits at the foot of section 7**, in the empty spot where "Weiter" would be
  if there were an eighth section. Submitting reads as the last thing you do, after the
  attachments, which is the order the paper form ends in too. The header stays as it is.
- **The map excerpt is not required to submit.** See "The attachment question" below.

## In scope

- `POST /api/v1/protokolle/{id}/absenden`: run `pruefe_protokoll`, and on a clean protocol
  read the envelope, match the three rows, write the columns and move the status to
  SUBMITTED.
- The refusal shape: a 422 carrying every violation as a path and a message key, so the
  browser can list them next to the fields they concern.
- The browser side of that call, and the mapping from a violation's path to the section it
  lives in and the label it has on screen.
- The panel listing what is still missing and what is wrong, each entry a link into the
  section and field concerned.
- The Absenden button at the foot of section 7, its confirmation, and its pending state.
- A submitted protocol's page becoming read-only, with a notice saying why.
- Meine Protokolle refreshing after a submission.

## Out of scope

- **Every transition after SUBMITTED.** In Pruefung, accepting, rejecting, requesting
  changes, and the `workflow_events` table are all 11d. Nothing here writes `locked_at`,
  and the only status this feature can produce is SUBMITTED.
- **The reviewer's screen.** `/protokolle/:id/pruefung` is 11e. A submitted protocol's row
  in Meine Protokolle therefore carries the badge and no action link, exactly as it does
  today, because `pruefung-protokoll.html` has no page behind it yet.
- **Taking a submission back.** A surveyor who submits by mistake cannot undo it here. That
  is a transition, so it is 11d's, and the change-request route it will add is the intended
  way back.
- **Filtering or searching the list.** The mockup's search box and three dropdowns belong to
  feature 12's review queue, as `app/api/protokolle.py` already records.
- **The `FormVersion` table.** Left out of 11a with its reasoning; nothing here changes
  that.
- **Any new validation rule.** Every rule this feature enforces already exists in
  `app/protokolle/formregeln/`. If a rule turns out to be missing or wrong, that is a
  finding to raise, not a thing to fix inside this feature.

## The attachment question

11a left this open deliberately: must a protocol carry a Kartenausschnitt, the uploaded map
excerpt, before it can be submitted?

**Decided with the user on 2026-09-11: no.** A protocol with no attachments at all can be
submitted, the panel says nothing about them, and no warning appears.

The reasoning is that the legacy PDF carries its five image slots as buttons a surveyor may
simply not press, so requiring one would refuse a protocol the paper form would have
accepted. A reviewer who wants the map can ask for it through the change-request transition
that 11d builds, which is a person making a judgement rather than a rule guessing at one.

This keeps `pruefe_protokoll` a pure function over the answers document, and means the
submit service never has to count attachment rows. If FFS later says the map is required,
the change is one check in `absenden.py` and one entry in the panel, not a reshape.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The refusal: rules run, nothing is written** - add
      `ProtokollUnvollstaendig` to `app/protokolle/fehler.py`, carrying every
      `Formverstoss` rather than the first. Write `app/protokolle/absenden.py` with
      `sende_ab(session, protokoll_id, besitzer, version)` doing only the guards: load the
      protocol with the owner in the WHERE clause, refuse anything that is not a DRAFT,
      refuse a stale version, run `pruefe_protokoll` and raise on any violation. A clean
      protocol raises nothing and is returned untouched; promoting it is step 2. Split this
      way because the guards and the promotion are two different kinds of code, and one
      diff carrying both would be too long to read properly.
      *Done when:* `pytest` proves, against a real database, that an incomplete draft raises
      `ProtokollUnvollstaendig` carrying the paths in section order and leaves the row
      exactly as it was; that another account's protocol raises `ProtokollNichtGefunden`;
      that a protocol which is not a draft raises `ProtokollNichtMehrEntwurf`; and that a
      stale version raises `ProtokollVeraendert`.

- [x] **Step 2 - The promotion: the envelope and the status** - the rest of `sende_ab`.
      Read the envelope with `lies_umschlag`, match the three rows with `ordne_zu`, write
      `probestrecke_id`, `person_id`, `bearbeiter_name`, `anlass`, `datum`, `uhrzeit` and
      `submitted_at`, set the status to SUBMITTED, raise the version, and commit once.
      *Done when:* `pytest` proves, against a real database, that a complete draft comes
      back SUBMITTED with all seven envelope columns filled and a real Probestrecke row
      behind it; that two protocols submitted on the same stretch share one Probestrecke
      row; that `version` went up by one; and that a failure inside the matching leaves no
      Gewaesser, no Probestrecke, no Person and a protocol still in DRAFT. Also that 11a's
      own complete fixture passes both halves: if `pruefe_protokoll` lets a document
      through and `lies_umschlag` then refuses it, the two disagree about what a finished
      protocol is, and that is a finding to raise rather than a test to loosen.

- [x] **Step 3 - The endpoint** - `POST /api/v1/protokolle/{id}/absenden` in
      `app/api/protokolle.py`, taking `{version}` and answering with the protocol's new
      state. Widen `FehlerAntwort` with an optional `verstoesse` list, and add
      `PROTOKOLL_UNVOLLSTAENDIG` to `app/api/fehler_http.py` as a 422. The German sentence
      names what happened, says why, and says what to do next, which is this project's
      standard since 2026-09-06.
      *Done when:* HTTP tests cover 200 on a complete protocol, 422 carrying the violation
      list on an incomplete one, 401 without a session, 404 for somebody else's protocol,
      and 409 for both a non-draft and a stale version; `ruff check .` and `mypy .` pass.

      **No OpenAPI document was regenerated, because none is checked in.**
      `coding-standards.md` says the generated document belongs in version control
      and no feature has ever added it, so this is standing drift rather than
      anything 11c introduced. Raised rather than fixed here: adding it means
      deciding where it lives and what keeps it current, which is a `/ci` question.

- [x] **Step 4 - The browser's call and its typed error** - `absendeProtokoll` in
      `protokoll/entwurf/api.ts`, the `Verstoss` and `AbsendeAntwort` types in
      `entwurf/typen.ts`, and `PROTOKOLL_UNVOLLSTAENDIG` in `api/fehler.ts`. `ApiFehler`
      gains the violation list, which is the first refusal in this app carrying structured
      detail rather than only a sentence.
      *Done when:* `npm test` proves a 422 body becomes an `ApiFehler` with that code and
      the violations in the order the server sent them; that a 200 returns the new status
      and version; and that a refusal with no `verstoesse` field at all still produces a
      usable error rather than a crash.

- [x] **Step 5 - Where a violation points** - `protokoll/absenden/verortung.ts`, a plain
      function from a violation's path to the section number it lives in and the label key
      it carries on screen. It has to cover every path the rules can emit, not only the
      required ones: a wrong percentage in `umland`, a catch cell at `arten.art7.klasse_3`,
      a hydrology answer on a pond, plus the four pseudo-paths `pruefe_protokoll` uses for a
      percentage group, an Einfluss block, an equipment pair and the catch table as a whole.
      A path it does not recognise is still listed, with its message and no link, rather
      than dropped.
      *Done when:* `npm test` proves that the 31 required paths, at least one path from each
      of the fourteen top-level groups in the answers document, and the four pseudo-paths
      all resolve to a section and to a label key that exists in `de.json`, and that an
      invented path comes back unlocated rather than throwing.

- [x] **Step 6 - The button** - the Absenden button at the foot of section 7, a confirmation
      through the existing `BestaetigungsDialog`, a pending state while the call is in
      flight, and on success a move to Meine Protokolle with the list query invalidated. The
      automatic save is flushed before the call, so a protocol is never submitted from a
      document the server has not got yet. The button is disabled on a protocol that has
      never been saved, because an empty document cannot pass and creating a record just to
      refuse it would leave empty protocols behind; `entwurf/neu.ts` already knows which
      case that is. A refusal shows the server's sentence here; the panel replaces it in
      step 7, which is why this step comes first: a panel with no way to trigger it could
      not be looked at.
      *Done when:* a complete protocol submits and lands on Meine Protokolle showing
      "Eingereicht"; an incomplete one shows the refusal and stays where it is; pressing the
      button twice quickly submits once; a second submit of an already-submitted protocol,
      which is what happens when the first answer is lost on the way back, says it has
      already been sent and offers the list rather than showing a bare conflict; screenshots
      in both themes.

- [x] **Step 7 - The panel** - `protokoll/absenden/AbsendeProbleme.tsx`, replacing the plain
      sentence from step 6. Grouped by section in section order, each entry naming the
      field, printing the German message from `de.json`, and linking to
      `/protokolle/:id/abschnitt/N#<pfad>`, which works because every field's DOM id is
      already its legacy path. New German text under `protokoll.absenden.*`.
      *Done when:* a screenshot in both themes shows the panel over a protocol missing
      several answers; each entry's link opens the right section with the field in view;
      focus moves to the panel when it appears and Tab reaches the first link; the panel
      disappears when a later submit succeeds; and an untouched protocol, which trips every
      required field at once, still lays out across the full width without the list wrapping
      into a second column or pushing the page sideways.

- [x] **Step 8 - A submitted protocol is read-only** - `ProtokollSeite` refuses to open the
      form for anything that is not a DRAFT, showing a notice that says what the status is
      and offering a way back to Meine Protokolle. The automatic save never starts, so
      nothing races a 409 it cannot recover from.
      *Done when:* opening a submitted protocol's section URL shows the notice and no form;
      the browser's network panel shows no save request; `npm test`, `npm run lint` and
      `npm run build` pass, and `pytest`, `ruff check .` and `mypy .` still pass.

## What the branch review changed

Two axes were run against the branch on 2026-09-11. Six findings were real and were
fixed on the branch; two were scope questions, recorded here rather than changed.

**Fixed**

- **A protocol submitted twice showed the wrong message.** Pressing the button twice, or
  losing the first answer on the way back, produced the backend's save-oriented sentence
  telling the surveyor to reload the page. Nothing had gone wrong for them: it was sent.
  `PROTOKOLL_NICHT_MEHR_ENTWURF` is now branched on and answered with the good news and a
  link to Meine Protokolle. This was step 6's own done-when and it had not been met.
- **Every refusal was carrying `"verstoesse": null`.** The contract above says the field is
  left out of anything but a refused submit. `exclude_none` restores the two-field body.
- **A comment said the opposite of its code**, in the panel's fallback name.
- **A raw `<h3>` and a bare router `<Link>`** where MUI has `Typography` and `Link`. The
  standards rule has no carve-out for components that only supply styling.
- **The same rationale was written out four times** across the module docstring, the route,
  the schema and the browser's call. Over-commenting is the tell `coding-standards.md`
  names; the reasoning now lives in one place and the others point at it.
- **One shared empty result object** was handed out by identity from `gruppiere`, with
  mutable arrays inside it. A fresh one each time.
- **The response type was called two things**, `AbsendenAntwort` on the server and
  `AbsendeAntwort` in the browser. One payload, one name.
- **The lookup test checked only the section** for the nineteen non-required paths, not that
  each has a label key that exists.

**Recorded, not changed**

- **Naming a catch cell by its species** goes slightly past step 7's "each entry naming the
  field". Kept: 312 cells share twelve column headings, so "Zeile 7" would send somebody
  counting rows, and the species standing in the row is the only name that means anything.
- **11a's fixture was edited.** `bemerkungen` was a bare string and the form has
  `bemerkungen.sonstige_bemerkungen`; no rule looks at free text, so nothing had caught it
  until this feature saved the fixture through the real endpoint. A fixture is not a rule,
  so this is not the "no new validation rule" line being crossed, but it is a change to 11a's
  work and is named here rather than folded in quietly.

**Left standing, and worth knowing**

`verortung.ts` holds a second copy of the label keys for parts 1, 2 and 6, because those
sections carry their labels inline in the components rather than in a declared list the way
parts 3 to 5 do. A test pins every key to the locale file, so a key that never existed
fails; a key changed in the component and not here would not. Declaring those three sections
the way the others are declared would close it and is a refactor of its own.

## Steps 9 to 14 - what a finished protocol must actually contain

Added on 2026-09-12, after Mansi said that all mandatory fields must be filled before a
protocol can be submitted and that this was not the case as built. It was not: 31 fields
were enforced out of roughly 156, and parts 3 and 4 enforced nothing at all.

The agreed scope is all six parts, and the field-by-field list is in
[pflichtfelder-vorschlag.md](pflichtfelder-vorschlag.md), approved on 2026-09-12. Read it
before starting any step below; it carries the reasoning that these steps only reference.

**Why this is not simply a longer list.** About a third of the form is tick boxes, where an
unticked box is already an answer, and several fields are alternatives rather than
companions. So requiredness has to be expressed as conditions, not as one flat set, and the
steps below are grouped by the kind of rule rather than by how many fields they touch.

- [x] **Step 9 - One list, read by both halves** - the root cause first. Requiredness lives
      today as 32 `pflicht` props scattered through the section components and a separate
      31-path tuple in `vollstaendigkeit.py`, and nothing holds the two together. Put the
      plain required paths in
      `database/seed/form_version_20260609/pflichtfelder.json`, which the backend already
      reads through `FORMULAR_SEED_DIR` and the browser already reaches through its
      `@formular` alias, so neither half needs new plumbing. `FeldRahmen` marks a field
      required when the list says so, and `pflicht` survives only as an override for the
      conditional cases. Update the seed README, which currently says everything in that
      directory is generated: this file is hand-authored, because the PDF carries no
      required flag at all.
      *Done when:* the file starts as exactly today's 31 paths, so nothing changes yet;
      `pytest` still reports the same 31 and its count test still passes; the form still
      shows exactly the asterisks it shows now; and a test in each half proves it is reading
      that file rather than a copy.

- [x] **Step 10 - The plain additions in parts 1, 2 and 5** - data, not logic, now that step
      9 has somewhere to put it. Adds the two boundary landmarks, the estimated Sichttiefe,
      the voltage, the power output, the cathode type and the anode leader's two names. This
      answers all three questions feature 11a left open for FFS.
      *Done when:* `pytest` shows a protocol missing any one of the eight named as missing;
      the eight carry an asterisk on screen without any component being edited, which is
      step 9's promise being kept; the count test moves from 31 to 39 deliberately.

- [ ] **Step 11 - Part 3, where nothing is required today** - the six percentage blocks
      become compulsory rather than "correct if touched", which is a new rule: `prozent.py`
      currently says nothing at all about an untouched block. Plus Randstreifen, the dam's
      share of the stretch, and the share of bank with roots in the water. And the first
      conditional: the dam's slope is required only when the dam share is above 0, because
      there is no slope where there is no dam.
      *Done when:* `pytest` covers an untouched block being reported as missing, a block
      totalling 100 passing, a dam share of 0 not demanding a slope, and a dam share of 30
      demanding one. The panel groups all six under section 3.

- [ ] **Step 12 - Part 4, the ratings and the tick groups** - the eight Strukturen ratings
      each need a value, and 0 means "none" so there is always an answer. Einflüsse and
      Bewirtschaftung need at least one tick each, never all of them: Einflüsse has "keine
      (erkennbar)" and "unbekannt" precisely so the block can be answered when there is
      nothing to report. The Besatz rows stay optional, but a row with anything in it must
      be complete.
      *Done when:* `pytest` covers a rating of 0 counting as answered, an untouched
      Strukturen block reporting eight missing ratings, an Einflüsse block with only
      "unbekannt" ticked passing, an empty Einflüsse block failing, and a Besatz row holding
      a year but no species failing.

- [ ] **Step 13 - Part 5's conditionals** - the ring anodes' diameter is required only when
      ring anodes were used, and each fished-area row that carries a length needs at least
      one direction and at least one method. A row that was not fished stays empty
      throughout.
      *Done when:* `pytest` covers strip anodes alone not demanding a ring diameter, three
      ring anodes demanding one, a fished row with a length and no direction failing, and
      the unused second row staying silent.

- [ ] **Step 14 - "sonstige ..., welche?" and the final agreement** - the four free-text
      boxes that name something become required exactly when their own tick is set, and stay
      optional otherwise. Then the pass that closes the whole complaint: a test proving the
      set the server enforces and the set the screen marks are the same set, conditional
      cases included.
      *Done when:* `pytest` covers a ticked "sonstige Nutzung" with an empty text box
      failing and an unticked one passing; the agreement test fails if a path is added to
      one half only; `npm test`, `npm run lint`, `npm run build`, `pytest`, `ruff check .`
      and `mypy .` all pass.

## Files / areas

**Backend, new**

- `backend/app/protokolle/absenden.py` and `absenden_test.py`

**Backend, changed**

- `backend/app/protokolle/fehler.py` - `ProtokollUnvollstaendig`
- `backend/app/api/protokolle.py` - the route
- `backend/app/api/schemas.py` - `AbsendenAnfrage`, `AbsendenAntwort`, `VerstossAntwort`,
  and the optional `verstoesse` on `FehlerAntwort`
- `backend/app/api/fehler_http.py` - the new code, its status and its German sentence

**Frontend, new**

- `frontend/src/protokoll/absenden/verortung.ts` and `verortung.test.ts`
- `frontend/src/protokoll/absenden/AbsendeProbleme.tsx`
- `frontend/src/protokoll/absenden/AbsendenBlock.tsx`
- `frontend/src/protokoll/absenden/useAbsenden.ts`

**Frontend, changed**

- `frontend/src/protokoll/entwurf/api.ts`, `typen.ts` - the call and its shapes
- `frontend/src/api/fehler.ts` - the code, and the violation list on `ApiFehler`
- `frontend/src/protokoll/abschnitte/Abschnitt7.tsx` or `AbschnittWechsel.tsx` - where the
  button goes, decided at step 7 against whichever keeps the action row in one place
- `frontend/src/protokoll/ProtokollSeite.tsx` - the read-only case
- `frontend/src/i18n/locales/de.json` - the `protokoll.absenden.*` family
- `frontend/src/i18n/locales/en.json` - left as it is. Feature 17 fills it

## Data / contracts

**Load-bearing.** 11d adds transitions on top of this endpoint's shape, 11e reads the same
violation type to show a reviewer what a protocol failed on, and feature 12 sorts and
filters on the columns step 2 writes.

### The request

```
POST /api/v1/protokolle/{id}/absenden
{ "version": 7 }
```

`version` is required, for the same reason a save carries one: a submit from a tab left
open across somebody else's edit would otherwise send a document that is no longer the
current one, and submitting is the one action that cannot be taken back. Same refusal as a
save, `PROTOKOLL_VERAENDERT`, 409.

### The answer, on success

```
{ "id": "...", "status": "SUBMITTED", "version": 8, "submitted_at": "2026-09-11T14:32:00Z" }
```

Not the whole protocol. The browser is leaving the form, so the answers it already holds
are of no further use to it, and the list it navigates to fetches its own rows.

### The answer, on refusal

```
422
{
  "code": "PROTOKOLL_UNVOLLSTAENDIG",
  "nachricht": "...",
  "verstoesse": [
    { "pfad": "probestrecke.gewaesser.name", "schluessel": "protokoll.regeln.fehlt" }
  ]
}
```

This widens `FehlerAntwort`, which until now has been exactly a code and a sentence. The
field is optional and every other refusal leaves it out, so nothing reading the old shape
breaks.

**Why a list of keys and not a list of sentences.** `Formverstoss` is a path and an i18n
key by design, decided in 11a: the backend holds no German, the 29 messages already exist
under `protokoll.regeln` in `de.json`, and feature 17 translates them once. A sentence
built in the backend could not be translated, and would duplicate one the browser already
has.

**Why the whole list and not the first.** A protocol missing one answer is usually missing
several, and a panel that reveals them one submit at a time turns a five minute repair into
an afternoon. Same reasoning `AntwortenUngueltig` already follows.

### What a submitted protocol looks like in the database

Written in one transaction: `status = 'SUBMITTED'`, `submitted_at`, `probestrecke_id`,
`person_id`, `bearbeiter_name`, `anlass`, `datum`, `uhrzeit`, and `version` raised by one.
`locked_at` stays null, which the `gesperrt_hat_zeitpunkt` constraint requires for anything
that is not LOCKED.

The `umschlag_bei_abgabe` check constraint 11b added is the backstop: if this feature ever
writes a status change without the envelope, the database refuses the row rather than
storing half a submission.

## Testing

The gate is `pytest` from `backend/` and `npm test` from `frontend/`. There is still no
`Verify` command, so the full set is `pytest`, `ruff check .` and `mypy .` from `backend/`,
and `npm test`, `npm run lint` and `npm run build` from `frontend/`.

**Backend logic needing tests:** steps 1, 2 and 3, all of it. These are the rules deciding
whether an official survey record may leave a person's hands, so every guard gets a test,
and every test covers the refusal as well as the pass. Steps 1 and 2 need a real database,
which is what the backend test setup already gives.

**The one test that matters most** is that a refused submit writes nothing at all: not the
status, not a Gewaesser row, not a Person row. A half-written submission is worse than a
refused one, because the rows the matching creates are shared with every other protocol on
that stretch.

**Frontend logic needing tests:** steps 4 and 5. `verortung.ts` is a pure lookup with a
wrong answer available to it, so it is tested; the panel and the button are components and
ride on screenshot and build evidence, exactly as `coding-standards.md` says.

**Permission tests.** There must be one proving an account cannot submit another account's
protocol, and it must get the same 404 as for a protocol that does not exist.

## Notes for the AI

- **Ownership goes in the WHERE clause, never a check afterwards.**
  `app/protokolle/dienst.py` explains why at the top of the file, and `absenden.py` follows
  it.
- **Nothing is committed until everything has passed.** The rules run, then the matching,
  then the columns, then one commit. `ordne_zu` deliberately does not commit, so the
  caller's transaction can roll the whole set back.
- **Reaching `UmschlagUnvollstaendig` is a bug, not an unfinished protocol.**
  `pruefe_vollstaendigkeit` has already said the same thing with a message beside each
  field. If the envelope reader refuses a document the rules passed, the two halves
  disagree and that is worth stopping for, not patching past.
- **No German in the backend except in `fehler_http.py`.** A violation is a path and a key.
- **The frontend already has every message.** All 29 keys under `protokoll.regeln` exist in
  `de.json`, including `protokoll.regeln.fehlt` and `fehltArt`. The panel looks them up; it
  does not write new wording for a rule.
- **A field's DOM id is its legacy path**, set in `felder/FeldRahmen.tsx` and the controls
  under it. That is what makes `#probestrecke.gewaesser.name` a working anchor, and why the
  panel needs no new ids.
- **Use MUI wherever MUI has a component**, including `Alert`, `List` and `Button`. The rule
  covers structural components, not only form controls.
- **Flush the automatic save before submitting.** `useAutoSave` debounces, so somebody who
  types into the last field and presses the button immediately would otherwise submit the
  version before that keystroke.
- **Do not touch `app/protokolle/regeln.py`.** Saving a draft stays as forgiving as it is,
  or a half-finished protocol would stop saving.
- **Do not widen the required-field list.** 11a's branch review found it had drifted past
  the form's own 32 asterisks and pinned the count at 31. Adding to it is a deliberate
  decision with the user, not a fix for a failing test.
