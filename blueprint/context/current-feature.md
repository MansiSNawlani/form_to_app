# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Demo-Anmeldung: two buttons to try the app without an account

**Type:** Fix

**Branch:** `fix/demo-anmeldung`

## The problem

Mansi wants to share a link to the deployed app, to show the work and to collect
feedback from the FFS team. Today the only way in is an account with a password.
Creating accounts for every visitor, or handing out a shared password, is not wanted.

## The fix

Two buttons on the sign-in page:

- **"Demo: als Einreicher ansehen"** signs in as a fixed demo account with the role
  `SUBMITTER`.
- **"Demo: als Prüfer ansehen"** signs in as a fixed demo account with the role
  `REVIEWER`.

Nobody types a password. Everybody who clicks the same button shares the same account,
and that is accepted.

Decisions made by Mansi on 2026-09-30:

1. **A switch, off unless set.** A new setting `DEMO_MODUS` (default `false`). While it
   is off, the backend refuses demo sign-in and the page does not draw the buttons. The
   refusal is on the server, so calling the endpoint directly does not get round it.
2. **Its own database.** The existing deployment holds real protocols, so the demo runs
   as a separate deployment with its own empty `DATABASE_URL`, never the real one. That
   is a deployment step Mansi does, not code; the spec documents it.
3. **Example protocols.** The demo starts with 4 invented protocols in different states,
   so a reviewer who clicks in first does not face an empty queue.
4. **Reset by hand.** A command Mansi runs, `befischung demo zuruecksetzen`, removes what
   visitors added and puts the examples back. A scheduled reset is a possible later
   step, not part of this fix.

### How it fits the existing code

- **Endpoints**, in `backend/app/api/anmeldung.py` beside the normal sign-in:
  - `GET /api/v1/anmeldung/demo` answers `{ "aktiv": true | false }`, open to anybody,
    so the page knows whether to draw the buttons.
  - `POST /api/v1/anmeldung/demo` with `{ "rolle": "SUBMITTER" | "REVIEWER" }` sets the
    same session cookie as a normal sign-in (`setze_sitzung`) and answers with the
    account. Any other role is refused, so the demo can never become a Super Admin.
    With the switch off it answers 404, as if it did not exist.
- **The rule** ("may this demo sign-in happen?") is a plain function in a new
  `backend/app/demo/` package, so it is testable without a request. The route stays thin.
- **The two accounts** have fixed addresses on the reserved `.example` domain (RFC 2606, never deliverable; `.invalid` was the first choice but the address checker refuses it)
  (`demo-einreicher@befischung.example`, `demo-pruefer@befischung.example`) and a password hash of a
  random value nobody is told, so the normal sign-in form can never open them.
- **The examples** are built from `VOLLSTAENDIG` in
  `backend/app/protokolle/formregeln/beispiele.py`, with names and places changed so the
  four look different. They go through the real services (`lege_entwurf_an`,
  `speichere_antworten`, `sende_ab`, `fuehre_uebergang_aus`), so they pass exactly the
  same checks as anything typed in. Invented data only, never anything from `Resources/`.

| Beispiel | Status | Why it is there |
|---|---|---|
| 1 | `DRAFT` | the submitter sees a half-finished protocol to carry on with |
| 2 | `SUBMITTED` | the reviewer has something waiting in the queue |
| 3 | `NEEDS_CHANGES` | shows a reviewer's comment coming back to the submitter |
| 4 | `LOCKED` | accepted by the reviewer (the app files an acceptance as `LOCKED`); shows the end of the road and the PDF download |

### What it must not break

- **The reset only ever touches demo data.** It deletes protocols owned by the two demo
  accounts (the reviewer can start one too; found in review) with their history and
  attachment files, then the Probestrecken, Gewässer
  and Personen nothing else refers to any more. It never runs a blanket delete. Even
  pointed at the real database by mistake, it could not remove a real protocol.
- **The reset refuses unless `DEMO_MODUS` is on**, as a second guard, with a message
  that says why and what to set.
- Normal sign-in, sign-out and the session guard behave exactly as they do today.
- Every new string exists in both `de.json` and `en.json` (the 17a guard test checks
  this).

### Not in scope

- A scheduled reset (Mansi will add one later only if resetting by hand gets tedious).
- A "this is a demo" banner inside the app.
- Separating one visitor's work from another's.

## Build steps

- [x] **1. The switch and the demo sign-in endpoint (backend).** `demo_modus` in
  `config.py` with a `HINWEISE` entry; the `backend/app/demo/` package with the rule and
  the account lookup; the two routes in `anmeldung.py`.
  **Done when:** pytest shows: switch off gives 404 on both POST and a `false` from GET;
  switch on signs in as each of the two roles and sets the cookie; any other role is
  refused; a missing demo account gives a message naming the command to run; the demo
  accounts cannot sign in through the normal form.

- [x] **2. The accounts, the examples and the reset command (backend).**
  `befischung demo zuruecksetzen` in `cli.py`: refuse unless `DEMO_MODUS` is on, remove
  the protocols both demo accounts own and the leftovers, create the two accounts if missing,
  create the 4 examples. Running it twice gives the same result.
  **Done when:** pytest shows: the command refuses with the switch off; after it runs
  there are exactly 4 demo protocols in the 4 statuses above; a protocol owned by a
  normal account survives the reset untouched; a second run leaves 4, not 8.

- [x] **3. The two buttons (frontend).** `AnmeldungSeite.tsx` asks
  `GET /api/v1/anmeldung/demo` and, only when it says `aktiv`, draws the two buttons
  below the normal form, as MUI `Button`s with visible focus. A click signs in and goes
  where a normal sign-in would (`zielNachAnmeldung`). German and English strings.
  **Done when:** with the switch on, a screenshot shows the buttons in light and dark,
  each one lands on the right start page for its role, and they are reachable by
  keyboard; with it off, the page looks exactly as it does today. `npm run build`,
  `npm run lint` and `npm test` pass.

- [x] **4. Browser test, diagrams and the how-to.** A Playwright test in `frontend/e2e/`
  that signs in through each button (skipping with a sentence when the switch is off);
  the sign-in path in `blueprint/history/flow_diagrams/` updated; `AGENTS.md` Commands
  and `.env.example` gain `DEMO_MODUS` and the reset command; the README gets a short
  section on setting up the demo as its own deployment with its own database.
  **Done when:** `npm run e2e` passes the new test against a stack with the switch on,
  and the diagrams name only files that exist.

## Verify

1. Set `DEMO_MODUS=true` in `.env`, restart the stack, run
   `docker compose exec backend befischung demo zuruecksetzen`.
2. Open http://localhost:5173/anmeldung and click **Demo: als Prüfer ansehen**. The
   review queue shows the example waiting for review.
3. Sign out, click **Demo: als Einreicher ansehen**. The list shows the draft, the one
   needing changes, and the accepted one.
4. Set `DEMO_MODUS=false`, restart. The buttons are gone, and
   `POST /api/v1/anmeldung/demo` answers 404.
