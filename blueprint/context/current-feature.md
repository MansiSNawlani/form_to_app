# Feature: Der Statusautomat

**From build-plan:** feature 11d
**Status:** specced, not started

## Goal

Give a submitted protocol somewhere to go, and write down every move it makes.

Feature 11c got a protocol as far as SUBMITTED and stopped there. Nothing in the
application can take one into Pruefung, accept it, reject it, or send it back to the
surveyor with a note saying what to fix. This feature builds those moves: which state a
protocol may go to from where, who is allowed to make each move, the Begruendung that a
rejection and a change request cannot happen without, and the locking that acceptance
performs.

It also builds the `workflow_events` table, which is the protocol's history. Every move
writes one row: who made it, from which state to which, what they wrote, and when. That
table is what the Verlauf panel in the reviewer mockup prints, and it is the only record
anybody will ever have of why a protocol was refused.

Two decisions taken with the user on 2026-09-14 shape it:

- **A Reviewer or a Super Admin decides.** A Data Steward may read a submitted protocol
  but may not accept, reject, or ask for changes. That follows the one-line job
  descriptions in `project-overview.md`: the Data Steward corrects and quality-checks,
  the Reviewer decides.
- **Nobody decides on their own protocol.** Somebody who holds the Reviewer role and also
  files protocols is refused a decision on one they filed themselves, whatever roles they
  hold. See "The lone reviewer" below for the risk this carries and what FFS has to be
  told about it.

## Design reference

`prototypes/pruefung-protokoll.html` is the reviewer's screen, and it is **feature 11e's
to build**. It is linked here because it is what fixes this feature's contracts: the
decision panel names exactly three decisions, states in its own words what each one does,
and says that a Begruendung is required for two of them. The Verlauf panel fixes what a
history entry carries: what happened, who did it, when, and the comment underneath.

What this feature builds on screen is only the surveyor's half, and there is no mockup for
it. `protokoll-teil-1.html` shows the form a surveyor fills in and says nothing about a
protocol that has come back with a correction requested. So the notice carrying the
reviewer's message is designed here out of the components the form already uses, the same
way 11c designed the Absenden panel, and it is built to look like the existing
`NichtMehrEntwurf` notice it sits beside.

## In scope

**The rules**

- The transition table: every move a protocol may make, the states it may be made from,
  the roles that may make it, and whether a Begruendung is required.
- Deciding is refused on a protocol you filed yourself.
- A protocol in NEEDS_CHANGES becomes editable by its owner again, and re-submittable.
  Its attachments become changeable again with it.
- A protocol that has ever been submitted can no longer be deleted, including one in
  NEEDS_CHANGES.
- Annehmen writes LOCKED and `locked_at` in one action.
- REJECTED and LOCKED are terminal. Nothing moves out of them.

**The record**

- The `workflow_events` table and its migration: which protocol, who acted, from which
  status to which, the comment, and when.
- Every transition writes exactly one row, in the same transaction as the status change.
- 11c's Absenden writes one too, so the history starts where the protocol left its owner.

**The endpoints**

- `POST /protokolle/{id}/pruefung` - take a submitted protocol into Pruefung.
- `POST /protokolle/{id}/entscheidung` - the three decisions and the Begruendung.
- `GET /protokolle/{id}/verlauf` - the history of one protocol.
- A Reviewer, Data Steward or Super Admin may read a submitted protocol that is not
  theirs. **A draft stays private to its owner**, which is what CONTEXT.md says a draft is.

**The surveyor's screen**

- A protocol in NEEDS_CHANGES opens in the form again instead of showing the "already
  sent" notice.
- The reviewer's message is shown at the top of it, so the surveyor can read what to fix
  while fixing it.
- The Absenden button sends it again.
- Meine Protokolle offers a NEEDS_CHANGES row the same "weiter bearbeiten" link a draft
  gets, since it is a protocol with something left to do.

**The vocabulary**

- `CONTEXT.md` gains the workflow words this feature settles: In Pruefung, Verlauf,
  Begruendung, and what a change request is.

## Out of scope

- **The reviewer's screen.** `/protokolle/:id/pruefung` is 11e. Until it exists a reviewer
  drives these endpoints through the API, which is exactly what the tests do.
- **The review queue.** Finding the protocols waiting to be decided is feature 12. This
  feature has no list endpoint for a reviewer at all: you act on a protocol whose id you
  already have.
- **A Data Steward correcting submitted data.** `project-overview.md` gives them that job
  and no build-plan item builds it. Nothing here lets any account edit a protocol it does
  not own, and this is worth raising as a gap in the plan rather than solving quietly.
- **Withdrawing a submission.** A surveyor who submits by mistake still cannot take it
  back. 11c already recorded that the intended way back is the reviewer's change request,
  and that is now built. Adding a withdrawal is a new transition and a new decision with
  FFS.
- **The ACCEPTED status.** It stays in the enum unwritten. The build plan fixed this on
  2026-09-11: Annehmen goes straight to LOCKED, and ACCEPTED becomes a real step only when
  feature 19 needs something between the reviewer's yes and the transfer to FiaKa.
- **Notifications.** Nobody is emailed when a protocol comes back or is accepted. That is
  feature 14, worker and all.
- **The audit trail.** `workflow_events` records status changes only. Who changed which
  answer is `AuditEvent`, feature 15, a different table for a different question.
- **Any new validation rule.** The rules that decide whether a protocol may be submitted
  are 11a's and 11c's. A re-submission runs exactly the same ones.
- **Regional access.** A Regierungspraesidium account gets nothing here. Feature 13 widens
  the visibility rule this feature touches, and the widening goes in the same one place.

## The lone reviewer

The decision above means a protocol filed by the only person holding the Reviewer role
cannot be accepted by anybody. There is no override, and building one would mean building
a second way to decide that bypasses the rule the first way exists to enforce.

This is fine while FFS has more than one reviewer and is a dead end if they have one. FFS
has to be told before this goes live, so step 10 adds it to `docs/ffs-questions.md` as a
statement of consequence rather than a question: this is what the application now does,
and if a single reviewer is the real situation, say so and the rule changes. The way out,
if they need one, is a Super Admin being allowed to decide on a Reviewer's protocol, which
is one line in the transition table.

## What a re-submission does and does not move

A protocol sent back with NEEDS_CHANGES and then sent in again is the same submission, not
a new one. So:

- `submitted_at` **does not move.** It is when the protocol was first handed in, which is
  what any deadline is measured against, and the model already says so in its own comment.
- The envelope **is read again** and the matching runs again. The surveyor may have
  corrected the water name or a coordinate, which is often exactly what the reviewer asked
  for, so the Probestrecke this protocol points at has to be worked out from what it says
  now and not from what it said in July.
- `version` moves as it always does, because the answers changed.
- The history keeps both hand-ins. Two `SUBMITTED` rows in `workflow_events` with a
  `NEEDS_CHANGES` row between them is the correct and readable account of what happened.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The table** - `app/models/workflow_event.py` and its Alembic migration.
      Columns as `project-overview.md` fixes them: `id`, `submission_id`, `actor_user_id`,
      `von_status`, `nach_status`, `kommentar`, `created_at`. `von_status` is nullable,
      because the first event 11c's Absenden writes has a real DRAFT before it but a later
      import or backfill may not; `nach_status` never is. Two check constraints in the
      style the other tables already use: both statuses out of the `Status` enum, and a
      comment that is either absent or has something in it, so an empty string cannot
      stand in for a Begruendung. `ON DELETE CASCADE` on `submission_id`, so deleting a
      draft takes its history with it; no cascade on `actor_user_id`, for the same reason
      `submissions.owner_user_id` has none.
      *Done when:* `alembic upgrade head` then `alembic check` reports the models and the
      database agree; `alembic downgrade -1` drops it cleanly; `pytest` proves against a
      real database that a row with an unknown status is refused, that a row with an empty
      comment is refused, and that deleting a protocol deletes its events.

- [x] **Step 2 - The state machine, as a plain function** - `app/protokolle/uebergang/regeln.py`.
      An `Entscheidung` enum with the mockup's three decisions, and one declared table of
      transitions: from which states, to which state, which roles, Begruendung required or
      not. `pruefe_uebergang(...)` reads that table and raises `UebergangNichtMoeglich`,
      `BegruendungFehlt` or `EigenesProtokoll`. No database, no HTTP, no German, exactly
      like `app/protokolle/formregeln/`. The roles live in the table rather than on the
      route, so there is one place that answers "who may do this".
      *Done when:* `pytest` covers every cell of the table, in both directions: each
      decision allowed from SUBMITTED and from IN_REVIEW, refused from DRAFT, from
      NEEDS_CHANGES, from REJECTED and from LOCKED; Aenderung anfordern and Ablehnen
      refused with no comment and with a blank one; Annehmen allowed without one; a
      Reviewer refused on their own protocol; a Data Steward refused outright; a Super
      Admin allowed. Also a test that walks the enum and fails if a status is ever added
      without the table saying what may happen to it.

- [x] **Step 3 - Writing a transition** - `app/protokolle/uebergang/dienst.py`. One
      function that checks the rules, moves the status, writes the `workflow_events` row
      and commits once, so no status can move without its history entry. Locking is here:
      Annehmen sets LOCKED and `locked_at` together, which is what the
      `gesperrt_hat_zeitpunkt` constraint requires. `beruehre` is called so a protocol
      that has just come back rises to the top of its owner's list. **`version` is not
      raised**, for the reason `beruehre` explains: that number guards the answers
      document against two open tabs, and a decision changes no answer.
      The protocol is loaded `with_for_update()`, so two reviewers pressing a button at the
      same moment queue instead of both reading the same old status and both writing. A
      decision request carries no `version`, so this row lock is the only thing that can
      catch that.
      *Done when:* `pytest` proves, against a real database, that each decision writes the
      right status and exactly one event; that Annehmen writes `locked_at` and the others
      leave it null; that a refused transition writes neither a status nor an event; that a
      second decision on an already locked protocol is refused; and that two decisions
      arriving at once on two connections end with one winner, one refusal and exactly one
      event.

- [x] **Step 4 - Absenden joins the history** - `app/protokolle/absenden.py` writes its own
      `workflow_events` row through step 3's writer, and accepts NEEDS_CHANGES as well as
      DRAFT. `submitted_at` is set only when it is still null, so a re-submission keeps the
      original hand-in. `pruefe_aenderbar` widens to DRAFT and NEEDS_CHANGES, which is the
      widening `app/protokolle/regeln.py` has had a note asking for since feature 3, and a
      new `pruefe_loeschbar` keeps deleting to drafts alone, so a protocol that has been
      seen by FFS cannot be deleted by its owner. Attachments follow `pruefe_aenderbar`
      already, so they become changeable again with the form.
      *Done when:* `pytest` proves a first submit writes a DRAFT to SUBMITTED event; a
      protocol in NEEDS_CHANGES can be saved, can have a photo added, cannot be deleted,
      and can be submitted again; the second submit leaves `submitted_at` where it was,
      writes a second event and re-runs the matching; and a protocol in SUBMITTED still
      refuses all four.

- [x] **Step 5 - Who may see a protocol that is not theirs** - `app/protokolle/dienst.py`
      gains the visibility rule it has carried a note about since feature 3: the owner sees
      their own whatever state it is in, and a Reviewer, Data Steward or Super Admin sees
      anything that is not a DRAFT. A draft stays private to its owner, which is what
      CONTEXT.md says a draft is. This is a **separate loader** from `hole_protokoll`:
      editing, saving and deleting keep the owner-only one, so widening who may look at a
      protocol cannot accidentally widen who may write to it. The `GET /protokolle/{id}`
      route uses the new one.
      *Done when:* `pytest` proves a Reviewer may read a submitted protocol belonging to
      somebody else, may not read that person's draft, and gets the same 404 for both a
      draft and an id that does not exist; a plain Submitter still gets 404 for anything
      not theirs; the owner still reads their own draft; and the save, delete and
      attachment routes still refuse a Reviewer on somebody else's protocol.

- [x] **Step 6 - The endpoints** - three routes in `app/api/protokolle.py`:
      `POST /{id}/pruefung`, `POST /{id}/entscheidung` taking `{entscheidung, kommentar}`,
      and `GET /{id}/verlauf`. The role requirement on the first two comes from step 2's
      table rather than being typed again at the route. New refusal codes in
      `app/api/fehler_http.py` with German sentences that name the thing, say why, and say
      what to do next, which is this project's standard since 2026-09-06. The Begruendung
      is capped at 4000 characters in the schema, the same cap one answer already has in
      `app/protokolle/regeln.py`, so a pasted document is refused by Pydantic rather than
      stored.
      *Done when:* HTTP tests cover 200 for each decision; 409 for a decision from the
      wrong state; 422 for a missing Begruendung and for one past the cap; 403 for a Data
      Steward and for a Submitter; 403 for a Reviewer deciding on their own; 401 with no
      session; 404 for an unknown id; and the Verlauf coming back newest first for the
      owner and for a reviewer, and 404 for a stranger. `ruff check .` and `mypy .` pass.

- [x] **Step 7 - The browser's side of the three calls** - the types and the calls in
      `protokoll/pruefung/`, the new error codes in `api/fehler.ts`, and a `verlauf` query.
      Pure plumbing, tested the way 11c tested `absendeProtokoll`.
      *Done when:* `npm test` proves each refusal body becomes an `ApiFehler` carrying its
      code, that a decision returns the protocol's new status, and that a Verlauf with no
      entries is an empty list rather than a crash.

- [x] **Step 8 - A protocol that came back** - `ProtokollSeite` opens the form for
      NEEDS_CHANGES instead of showing `NichtMehrEntwurf`, and a new notice above the form
      prints what the reviewer wrote, with who wrote it and when. It prints the most recent
      change request in the Verlauf, not the whole history: a protocol sent back twice
      carries two, and the older one has already been dealt with. The Absenden button at
      the foot of section 7 needs no change: it already submits whatever the form is
      holding, and the backend now accepts it from this state.
      *Done when:* a protocol put into NEEDS_CHANGES through the API opens in the form with
      the reviewer's sentence at the top; an answer can be corrected and saved; pressing
      Absenden sends it and lands on Meine Protokolle showing "Eingereicht"; the notice
      does not appear on an ordinary draft; screenshots in both themes; the notice reads
      correctly at the narrow width the form already supports.

- [x] **Step 9 - Meine Protokolle** - a NEEDS_CHANGES row gets the same link into the form
      that a draft gets, since it is the other kind of protocol with something left to do.
      The badge and its colour already exist for all seven states, so this is the link and
      nothing else. The count line is left alone: "davon 2 Entwuerfe" counts drafts, a
      protocol that has been submitted and come back is not one, and widening that number
      to mean "still to do" would need a word for the two together that nobody has.
      *Done when:* a NEEDS_CHANGES row shows the link, a SUBMITTED row still does not, and
      a REJECTED row still does not; the count line prints the same number it printed
      before; screenshots in both themes.

- [x] **Step 10 - The words, and what FFS has to be told** - `CONTEXT.md` gains the
      workflow vocabulary this feature settles: In Pruefung, Verlauf, Begruendung, and what
      a change request is, each with the word to avoid. `docs/ffs-questions.md` gains the
      lone-reviewer consequence from the section above. German strings for everything
      steps 8 and 9 added go under `protokoll.*` in `de.json`; `en.json` is left for
      feature 17.
      *Done when:* `npm test`, `npm run lint`, `npm run build` pass from `frontend/`, and
      `pytest`, `ruff check .` and `mypy .` pass from `backend/`; no German string added in
      steps 8 and 9 is left hard-coded in a component.

## What the branch review changed

Two axes were run against the branch on 2026-09-14. Neither found a hard standards
violation. Five judgement calls and three gaps were real and were fixed on the branch; six
deviations from the spec above were deliberate and are recorded rather than undone.

**Fixed**

- **The writer was called `entscheide`**, and it is the entry point for In Pruefung nehmen
  as well, which `regeln.py` says in its own words is not a decision. Now
  `fuehre_uebergang_aus`. The browser had it right from the start, with `nimmInPruefung`
  separate from `entscheide`.
- **The same rationale was copied into three and four places**, across both halves of the
  app. This is the finding 11c's own review made, reintroduced. One canonical statement
  now, with the others pointing at it.
- **A timestamp format written twice.** `AbsendeProbleme.tsx` already had one. Both now use
  `zeitpunktAnzeige` beside the other display helpers.
- **A gap where a date belongs.** An unparseable timestamp printed "Angefordert von X am
  Uhr", which reads as a fault in the application rather than a missing detail. The whole
  sentence is dropped instead.
- **`BEGRUENDUNG_NOETIG` was exported and unused**, written for 11e. Deleted, with a note
  saying why the browser should not hold a second copy of a rule the server owns.
- **Three permission tests the spec asked for were missing**: an attachment upload by a
  reviewer on somebody else's protocol, a role refusal on the Pruefung route as well as on
  the decision route, and a Super Admin over HTTP rather than only in the unit tests.

**Deliberate, and recorded rather than undone**

- **The enum is `Aktion` with five members**, not `Entscheidung` with three. All five moves
  have to be in one table for the completeness test to mean anything, and `ENTSCHEIDUNGEN`
  names the three the reviewer screen offers. The wire contract is unchanged: the decision
  route takes exactly the three.
- **`pruefe_uebergang` raises a fourth error**, `RolleFehlt`, rather than one of its own for
  a missing role. One code for "your account may not do this" across the whole application
  beats a second that means the same thing.
- **A third check constraint**, `uebergang_bewegt_sich`. A move from a state to itself would
  print in the Verlauf as a line saying nothing happened, and only a bug can write one.
- **A fourth error type**, `ProtokollNichtLoeschbar`. Found by running the real thing: the
  delete refusal was reusing the save message and telling somebody their protocol could no
  longer be changed while they were typing into it.
- **Step 9 did slightly more than the link.** The delete button is hidden on a returned
  protocol, since deleting one is refused, and the link says "Ueberarbeiten" rather than
  "Weiter", because that row is not a draft to carry on with.
- **No screenshots.** Playwright is not installed and `coding-standards.md` says not to add
  it mid-feature, so steps 8 and 9 rest on the build, the tests and a full round trip driven
  against the running stack. The visual check in both themes is still owed and is the first
  thing `/check` or a manual pass should cover.

## Files / areas

**Backend, new**

- `backend/app/models/workflow_event.py` and `workflow_event_test.py`
- `database/migrations/versions/<stamp>_workflow_events.py`
- `backend/app/protokolle/uebergang/__init__.py`, `regeln.py`, `regeln_test.py`,
  `dienst.py`, `dienst_test.py`
- `backend/app/api/uebergang_test.py`

**Backend, changed**

- `backend/app/models/__init__.py` - the new model registered
- `backend/app/protokolle/fehler.py` - `UebergangNichtMoeglich`, `BegruendungFehlt`,
  `EigenesProtokoll`
- `backend/app/protokolle/regeln.py` - `pruefe_aenderbar` widened, `pruefe_loeschbar` added
- `backend/app/protokolle/dienst.py` - the visibility rule and the second loader
- `backend/app/protokolle/absenden.py` - the event, NEEDS_CHANGES, `submitted_at` kept
- `backend/app/api/protokolle.py` - three routes
- `backend/app/api/schemas.py` - `EntscheidungAnfrage`, `UebergangAntwort`, `VerlaufEintrag`
- `backend/app/api/fehler_http.py` - the new codes and their sentences

**Frontend, new**

- `frontend/src/protokoll/pruefung/typen.ts` - the decision and Verlauf shapes
- `frontend/src/protokoll/pruefung/api.ts` and `api.test.ts`
- `frontend/src/protokoll/pruefung/AenderungAngefordert.tsx` - the notice above the form

**Frontend, changed**

- `frontend/src/api/fehler.ts` - the new codes
- `frontend/src/protokoll/ProtokollSeite.tsx` - NEEDS_CHANGES opens the form
- `frontend/src/protokoll/liste/ProtokollZeile.tsx` - the link on a NEEDS_CHANGES row
- `frontend/src/i18n/locales/de.json`

**Docs**

- `CONTEXT.md`, `docs/ffs-questions.md`

## Data / contracts

**Load-bearing.** 11e draws the decision panel and the Verlauf out of exactly these
shapes, and feature 12's queue filters on the statuses this feature is the only writer of.

### The table

```
workflow_events
  id               uuid, primary key
  submission_id    uuid -> submissions.id, ON DELETE CASCADE, indexed
  actor_user_id    uuid -> users.id, no cascade
  von_status       text, nullable, checked against the Status enum
  nach_status      text, checked against the Status enum
  kommentar        text, nullable, refused if present and blank
  created_at       timestamptz, default now()
```

`kommentar` is the column name because `project-overview.md` fixes it and that document
calls the data model locked. The screen calls it Begruendung, which is what the mockup
prints and what a person says.

### The transitions

| Action | From | To | Who | Begruendung |
|---|---|---|---|---|
| Absenden | DRAFT | SUBMITTED | the owner | no |
| Erneut absenden | NEEDS_CHANGES | SUBMITTED | the owner | no |
| In Pruefung nehmen | SUBMITTED | IN_REVIEW | Reviewer, Super Admin | no |
| Aenderung anfordern | SUBMITTED, IN_REVIEW | NEEDS_CHANGES | Reviewer, Super Admin | **yes** |
| Ablehnen | SUBMITTED, IN_REVIEW | REJECTED | Reviewer, Super Admin | **yes** |
| Annehmen | SUBMITTED, IN_REVIEW | LOCKED | Reviewer, Super Admin | optional |

A decision may be taken straight from SUBMITTED without going through IN_REVIEW first.
Requiring the extra step would add a click that protects nothing: nothing in this feature
reserves a protocol to one reviewer, so IN_REVIEW is a courtesy to colleagues rather than
a lock. Feature 12's queue is where "who is looking at this" starts to matter.

REJECTED and LOCKED have no row leaving them. Neither does ACCEPTED, which is never
written at all.

### The requests

```
POST /api/v1/protokolle/{id}/pruefung
(no body)

POST /api/v1/protokolle/{id}/entscheidung
{ "entscheidung": "ANNEHMEN" | "AENDERUNG_ANFORDERN" | "ABLEHNEN",
  "kommentar": "Bitte die Leitfaehigkeit nachtragen." }
```

**No `version` on either.** A save carries one because two tabs editing the same answers
overwrite each other; a decision writes no answer, and two reviewers deciding at once are
already handled by the state machine, which refuses the second because the protocol is no
longer in a state it can be decided from.

### The answers

```
200
{ "id": "...", "status": "NEEDS_CHANGES", "locked_at": null }

GET /api/v1/protokolle/{id}/verlauf
200
[ { "id": "...", "von_status": "SUBMITTED", "nach_status": "NEEDS_CHANGES",
    "kommentar": "Bitte die Leitfaehigkeit nachtragen.",
    "akteur_name": "s.lehmann@ffs.example", "created_at": "2026-07-12T16:20:00Z" } ]
```

Newest first, which is the order the mockup's Verlauf prints and the order somebody reads
a history in.

`akteur_name` is the account's email address, because `User` has no display name: the
model in `project-overview.md` has `email`, `rollen` and `locale` and nothing else to call
a person. The mockup prints "Dr. S. Lehmann", which no table can supply today. Naming it
`akteur_name` rather than `akteur_email` means feature 16 can put a real name behind it
without every caller changing. This is worth flagging to FFS eventually; it is not worth a
new column in this feature.

**The owner sees the whole Verlauf**, including who decided. An external consultant
therefore learns which member of FFS staff refused their protocol, which is ordinary in
official correspondence and is the point of a reasoned decision.

### The first event of an old protocol

Every protocol submitted before this feature exists has no `workflow_events` row at all,
because there was no table. Nothing backfills them. The Verlauf of such a protocol is
simply shorter, and 11e prints "Entwurf angelegt" from `created_at` rather than from an
event, so the history always has a beginning.

That is also why no event is written when a draft is created: `created_at` already records
it, and writing an event as well would be two records of one fact that can disagree.

## Testing

The gate is `pytest` from `backend/` and `npm test` from `frontend/`. There is still no
`Verify` command, so the full set is `pytest`, `ruff check .` and `mypy .` from `backend/`,
and `npm test`, `npm run lint` and `npm run build` from `frontend/`.

**Backend logic needing tests: steps 1 to 6, all of it.** This is the feature that decides
whether an official survey record is accepted, and every guard in it has a wrong answer
available. Steps 1, 3, 4, 5 and 6 need a real database, which is what the backend test
setup already gives.

**The three tests that matter most**

1. **A refused transition writes nothing.** Not the status, not an event. A status that
   moved without a history row is a protocol whose past cannot be reconstructed.
2. **A Reviewer cannot read somebody else's draft.** Step 5 widens who may read a
   protocol, and this is the line that widening must not cross.
3. **A Reviewer cannot decide on their own protocol**, and neither can a Super Admin who
   filed one. This is the rule the user chose on 2026-09-14 and the one most likely to be
   lost in a later refactor.

**Permission tests are not optional** on this feature in particular. There must be one per
role per action: a Submitter, a Data Steward, a Reviewer and a Super Admin each tried
against taking into Pruefung and against each of the three decisions.

**Setting up a manual check.** There is no reviewer account in any seed data and no
screen that creates one, so `/check` and `/try` make one with the command line:
`befischung benutzer anlegen --email pruefer@example.org --rolle REVIEWER` from `backend/`.
It has to be a second account: the whole point of the rule chosen on 2026-09-14 is that the
account which filed the protocol cannot decide on it.

**Frontend logic needing tests:** step 7 only. The notice, the page and the list row are
components and ride on screenshot and build evidence, exactly as `coding-standards.md`
says.

## Notes for the AI

- **Ownership goes in the WHERE clause, never a check afterwards.**
  `app/protokolle/dienst.py` explains why at the top of the file. Step 5 adds a second
  loader with a wider clause; it does not add an `if` after the existing one.
- **Do not widen `hole_protokoll`.** Saving, deleting and attaching all go through it. A
  reviewer who could load a protocol through that function could save over it.
- **One transaction per transition.** The status change and its event are written together
  or not at all. A status that moved without its event is the failure this table exists to
  prevent.
- **No German in the backend except in `fehler_http.py`.** The Begruendung a reviewer types
  is data and travels as it was typed; everything else the backend says about a refusal is
  a code, and the sentence lives in the translation table.
- **The roles live in the transition table, not on the route.** `erfordert_rollen` is
  still what the route uses, but the tuple it is given comes from `uebergang/regeln.py`,
  so there is one answer to "who may accept a protocol".
- **Use MUI wherever MUI has a component**, structural ones included. The notice in step 8
  is an `Alert` beside the existing `NichtMehrEntwurf`, not a hand-built box.
- **`pruefe_aenderbar` is the one place that decides what may still be changed.** Widen it
  there. Do not compare against `Status.DRAFT` at a call site.
- **Deleting is not editing.** Step 4 splits them apart deliberately: a protocol FFS has
  seen cannot be deleted by its owner even while they are correcting it.
- **`submitted_at` is set once.** `app/models/protokoll.py` already says so in its own
  comment; step 4 is where that comment becomes true.
- **A Formverstoss is unchanged.** A re-submission runs 11a's rules exactly as a first
  submission does, and this feature adds no rule about the contents of a protocol.
