# Feature: Entscheiden

**From build-plan:** feature 11f
**Status:** spec written, not started

## Goal

Let a reviewer act on a protocol they have just read, and let everybody read what has
happened to it so far.

Feature 11e put a whole submitted protocol on screen and left the right-hand column of
that screen empty. This fills it: the Verlauf, so anyone can see who did what and when,
and the decision panel, so a reviewer can take a protocol into Pruefung and then accept
it, send it back for a correction, or reject it.

It is the last thing missing before the review workflow is usable end to end. Everything
underneath it exists already: 11d built the state machine, the workflow_events table,
every transition, the Begruendung rule and the locking, and 11e already wrote the three
API calls, the types, the cached history query and the error codes. **This feature adds
no backend code and no new route.** It is one column of one page.

## Design reference

`prototypes/pruefung-protokoll.html`, right-hand column, and `prototypes/mockup.css` for
the styles it uses: `.panel__head`, `.panel__body`, `.decision`, `.history`. These are
exactly the four classes 11e deliberately did not port, because they belong here.

The `.review` grid, the card, the summary bar and everything in the left column were
built in 11e and are not touched.

Four things in the mockup are deliberately not built as drawn:

- **Vorheriges and Naechstes**, and the **Pruefliste crumb.** They move through the review
  queue, which is feature 12. Already ruled out in 11e for the same reason.
- **The Spaeter button** beside Entscheidung speichern. It leaves without deciding, which
  is what the Alle Protokolle button in the page head already does. A second button doing
  the same thing in the same viewport is one more thing to read, not one more thing to do.
- **The preselected radio.** The mockup shows Aenderung anfordern already chosen. Nothing
  is preselected here: a decision nobody made must not be sitting ready under a button.
- **The Entwurf angelegt line** at the foot of the Verlauf is built, but not from a
  workflow event, because none exists. See below.

## What the browser has to restate, and why

Three rules that live in `backend/app/protokolle/uebergang/regeln.py` decide what this
panel draws:

| Rule | The server's answer |
|---|---|
| Who may decide | `PRUEFERROLLEN`: `REVIEWER`, `SUPER_ADMIN` |
| Which states a decision can be made from | `SUBMITTED` and `IN_REVIEW` |
| Which state In Pruefung nehmen works from | `SUBMITTED` only |
| Which decisions need a Begruendung | `AENDERUNG_ANFORDERN` and `ABLEHNEN` |

`pruefung/typen.ts` left this open in 11e: read them from the server, or restate them in
the browser with a test pinning them to the server's answer. **Restated, with the test.**
It follows the project's existing precedent, where `coding-standards.md` has every form
rule written twice, once in Zod and once in Pydantic, kept next to each other and changed
together. A fifth endpoint whose only job is to describe four constants would be a request
on every page load to learn something that changes when somebody edits a Python file.

**The server stays the gate.** Nothing the browser decides here is a permission. It
decides what to draw, and every one of these moves is refused again on the server, which
is where `PruefungsSeite`'s own comment already says the answer belongs.

## Whose screen shows what

The rail is not the same for everybody who can reach the page. There are five cases and
one pure function decides between them:

| Who is reading | What the rail shows |
|---|---|
| A Reviewer or Super Admin, protocol `SUBMITTED` | In Pruefung nehmen, the decision panel, the Verlauf |
| A Reviewer or Super Admin, protocol `IN_REVIEW` | The decision panel, the Verlauf |
| A Reviewer or Super Admin, protocol already decided (`NEEDS_CHANGES`, `REJECTED`, `LOCKED`) | A sentence saying it is decided, the Verlauf |
| A Reviewer or Super Admin looking at a protocol **they filed themselves** | A sentence saying somebody else has to decide, the Verlauf |
| Anybody else who may read it: a Data Steward, the surveyor on their own protocol | The Verlauf only |

A Data Steward can read and correct submitted data but the yes or no is not theirs, fixed
with the user on 2026-09-14 and written into `PRUEFERROLLEN`. They are shown the history
and no panel, rather than a panel whose button would be refused.

**Own protocol is decided by comparing e-mail addresses.** `eingereicht_von` on the
protocol is the owner's address and `email` on the session is the reader's, and the
address is this application's login identifier, so it is unique. That is why this feature
needs nothing added to the backend to know it.

## The Verlauf, and the one line in it that is not an event

The server sends the history newest first and the screen never re-sorts it. Each entry
prints what happened, who did it, when, and the reviewer's own words underneath when there
are any.

What happened is read from `nach_status`, not from `von_status`: `SUBMITTED` is
Eingereicht, `IN_REVIEW` is In Pruefung genommen, `NEEDS_CHANGES` is Aenderung
angefordert, `REJECTED` is Abgelehnt, `LOCKED` is Angenommen und gesperrt. A re-submission
after a correction is Eingereicht again, which is correct: it is the same action.

**Nothing writes a workflow event when a draft is created**, so the oldest entry the
server can send is Eingereicht. The mockup's bottom line, Entwurf angelegt, is drawn from
the protocol's own `created_at` and `eingereicht_von`, which are already on the payload
and are both certainly true: the draft was made by the account that owns it, on that day.
It is marked in the code as synthesized rather than recorded, so nobody later mistakes it
for a row in `workflow_events`. The alternative, a backend change writing an event at
draft creation, would leave every protocol already in the database without one and is not
worth a migration for a single line.

## In scope

**The rail itself**

- `ProtokollAnsicht` gains a `rail` slot, filling the second column of the `.review` grid
  that 11e built and left empty.
- `.panel__head`, `.panel__body`, `.decision` and `.history` ported from `mockup.css`
  against our own tokens, never a hard-coded colour.

**The Verlauf**

- Every entry with its action, its actor, its timestamp and its Begruendung quoted.
- The synthesized Entwurf angelegt line at the foot.
- Still loading, and could not be loaded, each saying so. An empty history is impossible
  on this screen, since a protocol that reached it was submitted, but the component
  survives one.

**In Pruefung nehmen**

- The button, shown only where the table above says so, and what it invalidates when it
  succeeds.

**The decision**

- The three decisions as one radio group with the mockup's own descriptions, none of them
  preselected.
- The Begruendung box, shown for all three, with the hint saying when it is required and
  that the submitter reads it.
- One button that saves the decision.
- Annehmen and Ablehnen ask for confirmation first, because both are final.
- After it goes through, the page stays where it is and redraws: the badge, the status
  sentence and the Verlauf all move.

**When it will not go through**

- A required Begruendung left empty, caught in the browser before the call and beside the
  box, and caught again when the server says `BEGRUENDUNG_FEHLT`.
- `UEBERGANG_NICHT_MOEGLICH`, which usually means a colleague decided first, with the way
  out being to load the protocol afresh rather than to press the button again.
- `EIGENES_PROTOKOLL` and a missing role, which the rail should already have prevented but
  which are still answered rather than swallowed.
- Anything else, through the shared `fehlertext`.

**The surveyor's own protocol**

- The same Verlauf, no decision panel, on the read-only view at the protocol's own
  address. A rejected protocol currently gives its owner no way at all to find out why,
  which is a hole rather than a missing convenience.

**The words**

- Every German string under `protokoll.*` in `de.json`. `en.json` stays for feature 17.

## Out of scope

- **Any backend change.** Every endpoint, rule and error code this needs was built in 11d.
  If a step turns out to need one, that is a finding to raise rather than a thing to add
  quietly.
- **The review queue**, and with it the Vorheriges, Naechstes and Pruefliste controls, and
  any "on to the next protocol" step after a decision. Feature 12.
- **Reserving a protocol to one reviewer.** `IN_REVIEW` is a courtesy to colleagues and
  `regeln.py` says so; two reviewers can still both have it open, and the second one to
  press the button is told the transition is no longer possible.
- **Editing a decision, or undoing one.** `REJECTED` and `LOCKED` are final by design.
- **Notifying the submitter.** E-mail is feature 14. The submitter finds out by opening
  the protocol, which is exactly what this feature makes possible.
- **`ACCEPTED`.** Annehmen writes `LOCKED` in one action, fixed on 2026-09-11.
- **Regional access.** A Regierungspraesidium account sees nothing new. Feature 13.
- **Anything in the left column.** The protocol as 11e draws it is not touched.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Step 1 is the only one with nothing to look at, and it is first because steps 3 to 5 all
branch on its answers. Every step after it changes something visible on a page you can
open.

- [ ] **Step 1 - What the browser is allowed to draw** - two plain modules over values, no
      React. `pruefung/entscheidungen.ts` answers, from a status, a list of roles and
      whether the reader filed it, which of the five rails to draw and whether In Pruefung
      nehmen is offered, and separately whether a given decision needs a Begruendung.
      `pruefung/verlaufsbeschriftung.ts` answers which label an entry carries, from its
      `nach_status`. Both name `backend/app/protokolle/uebergang/regeln.py` as the
      original in a comment, since a rule with two homes has to say where it came from.
      *Done when:* `npm test` covers every status in the enum for both modules, including
      `DRAFT` and `ACCEPTED`, which this screen never sees but which the compiler requires
      an answer for; that a Data Steward and a plain Submitter get no panel; that a
      Reviewer looking at their own protocol gets none either; that Annehmen needs no
      Begruendung and the other two do; and that a status the labels do not know prints
      something rather than nothing. `npm run lint` and `npm run build` pass.

- [ ] **Step 2 - The rail exists, with the Verlauf in it** - `ProtokollAnsicht` gains its
      `rail` prop and renders it as the second column. `Pruefungsrail` is the component
      that stacks the panels, holding only the Verlauf for now. `.panel__head`,
      `.panel__body` and `.history` ported from `mockup.css` into `protokoll.css` against
      our tokens. The `Verlauf` panel reads the `verlaufsAbfrage` 11e already wrote: every
      entry with its label, actor, German timestamp through the `zeitpunktAnzeige` the list
      already owns, and its Begruendung as a blockquote. The synthesized Entwurf angelegt
      line at the foot. `PruefungsSeite` passes it.
      The rail takes the width the grid gives it rather than sitting in a narrow column,
      which is this project's standing layout preference and what 11e's `.review` already
      does.
      *Done when:* a reviewer opens a protocol that has been sent back once and sees four
      entries newest first, the change request quoted under its own line; a protocol only
      just submitted shows Eingereicht and Entwurf angelegt; the panel says so while the
      history is loading and says so again if it fails, and never renders an empty list as
      though nothing had happened; screenshots in both themes; `npm run lint` and
      `npm run build` pass.

- [ ] **Step 3 - In Pruefung nehmen** - the button at the head of the rail, drawn only when
      step 1 says so, calling the `nimmInPruefung` 11e already wrote. On success it
      invalidates the protocol, the history and the list, since all three now say something
      different. Disabled while the call is in flight, because a second press would be
      refused as a transition that is no longer possible and would read as a fault.
      *Done when:* a reviewer opens a `SUBMITTED` protocol, presses it once, and the status
      badge and the Verlauf both change without a reload; the button is gone afterwards; a
      Data Steward and the protocol's own owner never see it; `npm run lint` and
      `npm run build` pass.

- [ ] **Step 4 - The decision panel, working** - `.decision` ported. The three radios with
      the mockup's descriptions, none preselected. The Begruendung box with its hint. One
      button, calling `entscheide`, invalidating the same three caches. The four rails that
      are not a decision panel, from step 1: already decided, your own protocol, not your
      job, and nothing at all for a reader who is none of these.
      The radio group is MUI's `RadioGroup` inside a `FormControl` with a `FormLabel` above
      it, and the box is MUI's `TextField` multiline, which is what `coding-standards.md`
      asks for wherever MUI has the component; where MUI's default composition fights the
      mockup, `muiTheme.ts` is changed rather than the element hand-styled.
      If the diff runs long, the four alternative rails split off as their own step; they
      are a sentence each and depend on nothing the panel does.
      *Done when:* a reviewer sends a protocol back with a reason and the page redraws as
      `NEEDS_CHANGES` with the new entry in the Verlauf; the submitter, signed in
      separately, then opens that protocol and finds it editable with the reason above the
      form, which is 11d's behaviour and must still work; a Data Steward sees the history
      and no panel; screenshots of all five rails in both themes; `npm run lint` and
      `npm run build` pass.

- [ ] **Step 5 - When it will not go through** - pressing save with a required Begruendung
      empty puts the message beside the box and never calls the server, and the server's
      own `BEGRUENDUNG_FEHLT` lands in the same place, so one refusal has one home on
      screen. `UEBERGANG_NICHT_MOEGLICH` says a decision has already been made and offers
      loading the protocol afresh, since pressing again cannot help. `EIGENES_PROTOKOLL`
      and a missing role keep the backend's own sentence. Everything else goes through
      `fehlertext`. Every message names the thing, says why in ordinary words and says what
      to do instead, which is this project's rule for a user-facing error.
      *Done when:* choosing Ablehnen with an empty box shows the message next to the box
      with no request sent, proven in the network tab; deciding twice on the same protocol
      in two tabs shows the second one the already-decided message and the reload way out;
      the message clears when the next attempt starts rather than sitting over a repaired
      form; `npm run lint` and `npm run build` pass.

- [ ] **Step 6 - Asking before the two that cannot be undone** - Annehmen and Ablehnen go
      through the existing `BestaetigungsDialog` first, naming what the decision does:
      accepting locks the protocol and releases it for FiaKa, rejecting is final. Aenderung
      anfordern does not ask, because it is the reversible one: the protocol goes back to
      its author and comes round again.
      *Done when:* both dialogs appear, cancelling leaves the protocol untouched and the
      chosen radio still chosen, confirming decides; the dialog is reachable and dismissable
      by keyboard; `npm run lint` and `npm run build` pass.

- [ ] **Step 7 - The surveyor's own history** - `ProtokollSeite` passes the same `Verlauf`
      as the rail on its read-only branch. No decision panel, which step 1's function
      already refuses them. The form itself is not touched: a `NEEDS_CHANGES` protocol
      still opens as an editable form with `AenderungAngefordert` above it.
      *Done when:* a submitter opens a protocol that was rejected and reads the reason,
      which today they cannot see anywhere in the application; a `LOCKED` one shows the
      acceptance; their still-editable `NEEDS_CHANGES` protocol is unchanged; screenshots
      in both themes.

- [ ] **Step 8 - The words and the final pass** - every German string added in steps 2 to 6
      under `protokoll.*` in `de.json`, none left hard-coded. A pass with a keyboard and
      against the tokens: the radio group is one tab stop and arrow keys move within it,
      the Begruendung box is labelled by its `FormLabel` and described by its hint, the
      error beside it is announced rather than only coloured, focus is visible on every
      control in both themes, and the muted timestamp text in the Verlauf meets contrast.
      *Done when:* `npm test`, `npm run lint` and `npm run build` pass from `frontend/`;
      `pytest`, `ruff check .` and `mypy .` still pass from `backend/`, which they should,
      since nothing there changed; the whole rail is operable from the keyboard alone, top
      to bottom, without reaching for the mouse.

## Files / areas

**New, all under `frontend/src/protokoll/pruefung/`**

- `entscheidungen.ts` and `entscheidungen.test.ts` - who may do what, and what needs a
  reason.
- `verlaufsbeschriftung.ts` and `verlaufsbeschriftung.test.ts` - what a history entry is
  called.
- `Verlauf.tsx` - the history panel.
- `Entscheidungspanel.tsx` - the decision panel and its four alternatives.
- `Pruefungsrail.tsx` - the panels stacked, and which of them to draw.

**Changed**

- `frontend/src/protokoll/nurlesen/ProtokollAnsicht.tsx` - the `rail` slot.
- `frontend/src/protokoll/pruefung/PruefungsSeite.tsx` - passes the full rail.
- `frontend/src/protokoll/ProtokollSeite.tsx` - passes the Verlauf only.
- `frontend/src/protokoll/protokoll.css` - the four ported classes.
- `frontend/src/i18n/locales/de.json` - the new strings.
- `frontend/src/theme/muiTheme.ts` - only if the radio group or the text box needs it, and
  themed once rather than per use.

**Read, not changed**

- `frontend/src/protokoll/pruefung/api.ts`, `typen.ts`, `abfragen.ts` - all three written
  in 11e and complete.
- `frontend/src/api/fehler.ts` - `BEGRUENDUNG_FEHLT`, `UEBERGANG_NICHT_MOEGLICH` and
  `EIGENES_PROTOKOLL` all exist.
- `backend/` - nothing at all.

## Data / contracts

**Nothing new travels over the wire.** Every shape this feature needs is already defined
on both sides and was exercised by 11d's tests and 11e's:

| Call | Shape |
|---|---|
| `POST /protokolle/{id}/pruefung` | no body, answers `UebergangAntwort` |
| `POST /protokolle/{id}/entscheidung` | `EntscheidungAnfrage`, answers `UebergangAntwort` |
| `GET /protokolle/{id}/verlauf` | answers `VerlaufEintrag[]`, newest first |

The one thing this feature does add is a browser-side copy of four constants from
`backend/app/protokolle/uebergang/regeln.py`. Load-bearing in the sense that it can drift:
a change to `PRUEFERROLLEN`, to the states a decision may be made from, or to
`begruendung_noetig` has to be made in `entscheidungen.ts` in the same breath, and the
tests in step 1 exist to make a forgotten one fail loudly rather than quietly.

Cache keys, all three already defined: `entwurfsKey(id)`, `verlaufsKey(id)`,
`protokolleKey()`. Every successful move invalidates all three, because the status, the
history and the row in the list all change together.

## Testing

`npm test` is the frontend gate, from `frontend/`.

**Gets a unit test**, because a wrong answer is possible and cheap to make:

- `entscheidungen.ts` - which rail, whether In Pruefung nehmen is offered, whether a
  decision needs a Begruendung. Every status and every role combination that matters.
- `verlaufsbeschriftung.ts` - the label per `nach_status`, and an unknown one.

**Rides on browser evidence and the build**, as `coding-standards.md` says: the panels
themselves, the mutations, the dialogs and the layout.

**Not tested again here:** the three API calls, which `pruefung/api.test.ts` already
covers, and every backend rule, which `backend/app/protokolle/uebergang/regeln_test.py`
and `app/api/uebergang_test.py` already cover against a real database.

**The two-account walkthrough**, which is the only way to see this feature actually work
and is worth doing once at step 4 and again at step 7: sign in as a submitter, send a
protocol; sign in as a reviewer, take it into Pruefung and ask for a change with a reason;
sign back in as the submitter and read the reason on the protocol.

## Notes for the AI

- **No backend change.** If something appears to need one, stop and say so rather than
  adding it. The whole premise of this feature is that 11d finished the server side.
- **The server is the gate, the browser decides what to draw.** Nothing in
  `entscheidungen.ts` is a permission, and `PruefungsSeite`'s existing comment about why
  there is no role check on the page itself still stands: the page is reachable, the
  actions on it are refused server-side.
- **Invalidating the protocol refetches the document the read-only view is mounted on.**
  Harmless here, because nothing on this page is typed and nothing is unsaved, which is
  exactly why `entwurfsAbfrage`'s rule against background refetching does not apply. Worth
  knowing before assuming the page can be left alone after a decision.
- **MUI wherever MUI has the component**, including the radio group, the text box, the
  buttons and the dialog. Theme it once in `muiTheme.ts` rather than per use, and the label
  sits above the field, so `FormLabel` inside a `FormControl`, never `InputLabel`.
- **Tokens outrank MUI's defaults.** The four ported classes use `var(--border)`,
  `var(--muted)`, `var(--surface-sunken)` and the rest, exactly as the mockup does. No
  hard-coded colour, and no elevation shadow.
- **Feedback goes next to the thing it concerns.** The missing-Begruendung message sits by
  the box, not at the top of the page.
- **Every error message names the thing, says why in plain words and says what to do
  instead.** A refusal with no way out is not finished.
- **New locale keys are typed.** `i18n/resources.d.ts` means a key used in a component and
  missing from `de.json` fails the build rather than printing the key on screen.
- **German domain terms, German routes, no em dashes** anywhere, including in comments.
- **Comment the why, not the what**, and keep the density of the surrounding files: this
  package's existing modules explain decisions and never narrate code. The one place a
  comment is owed is the copied rules in `entscheidungen.ts`, naming the Python file they
  came from.
