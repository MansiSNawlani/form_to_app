# Feature: Ein Konto anlegen

**From build-plan:** feature 16c
**Status:** built, with browser evidence. Not yet branch-reviewed or logged.

## Goal

Let a Super Admin create an account from inside the application, and tell them plainly what to
pass on to the person it belongs to.

Feature 16a built the endpoint and 16b built the list that reads it. Nothing writes yet, so
today every account after the first is still made with
`docker compose exec backend befischung benutzer anlegen` in a terminal on the machine the
database runs on. This is the sub-feature that removes that for the ordinary case: an FFS
administrator making an account for a consultant, an angling association, or a new colleague.

The screen has one job the command line never had to think about. There is no mail to send the
new account its password in until feature 14, and its owner cannot set their own password at
all, because 16a deliberately left self-service out. So the administrator leaves this screen
holding two things somebody else needs, and the screen has to say so rather than leaving them
to work it out.

Changing an account that already exists is 16d. Nothing here edits anything.

## Design reference

[`prototypes/meine-protokolle.html`](../../prototypes/meine-protokolle.html) for the page
furniture, and the application's own login screen for the form.

There is no mockup for this screen and it does not need one. `page__head`, `card` and the
button placement come from the list pages, and the fields are the ones
[`frontend/src/auth/AnmeldungSeite.tsx`](../../frontend/src/auth/AnmeldungSeite.tsx) already
built: `FormControl`, `FormLabel` and `OutlinedInput`, with the label above the field and the
error under it. That page is the working model for a standalone form on this project, the same
way `PrueflisteSeite` was 16b's model for a list.

## Where it lives

**Its own route, `/verwaltung/benutzer/neu`**, reached from a "Neues Konto" button in the list
page's head.

A route rather than a dialog on the list, for three reasons. The form is five questions, one
of which reveals a sixth, and a dialog that scrolls is worse than a page. Every other screen
in this application is a route, so a dialog would be the only one of its kind. And the
confirmation this screen ends on is something an administrator reads, copies out of, and may
sit on for a minute while they ring somebody, which is not what a dialog is for.

The address follows `protokolle/neu`, which is the pattern the application already set for
"the page where you make one of these".

**The route carries no role check**, the fourth time `routes.tsx` states that rule: the
endpoint admits `SUPER_ADMIN` and nobody else, the page turns a refusal into words, and a
second opinion in the browser could only ever be the wrong one. **The button in the list head
is drawn for everybody who can see the list**, which is only Super Admins already, so it needs
no separate condition.

## The form

Five questions, in this order, and a sixth that appears only when it is needed.

| Field | Control | Required | Notes |
|---|---|---|---|
| E-Mail-Adresse | `OutlinedInput`, `type="email"` | Yes | The account's only name and its login identifier. Stored lower case by the backend |
| Passwort | `OutlinedInput`, `type="password"` with a show/hide toggle | Yes | At least 12 characters. See below |
| Rollen | Six `Checkbox` controls in a `FormGroup` inside a `FormControl` with a `FormLabel` as its legend | At least one | Every role, in `ROLLEN` order, labelled from `common.rollen` |
| Regierungspräsidium | `Select` over the `z.rp` option list | Only when the regional role is ticked | Appears and disappears with that checkbox. See below |
| Sprache | `Select`, Deutsch or English | Yes, defaulted to Deutsch | What the account's own interface opens in |

**The administrator types the password.** Decided on 2026-09-25, choosing it over a generator.
One field, no second "repeat it" field, and a show/hide toggle beside it.

The toggle is what replaces typing it twice, and it is the better of the two: a mistyped
password produces an account nobody can sign in to and only another administrator can repair,
and being able to read back what you typed catches that, where typing it twice blind only
catches disagreement between two attempts. The administrator also has to read the password out
to somebody, so they need to see it anyway. The field starts masked, because somebody may well
be standing behind them.

**Twelve characters is mirrored in Zod, and the backend is still the gate.** That is the
"written twice" rule in `coding-standards.md`, and the number comes from
`MINDESTLAENGE` in `backend/app/security/passwoerter.py`. The browser half exists so the
message appears under the field as it is typed rather than after a round trip.

**All six roles are offered, `INTEGRATION` included.** Leaving it out would mean the command
line stays necessary for one role, which is the whole dependency this feature exists to
remove. It gets a line of hint text saying what it is for, because an `INTEGRATION` account is
refused at sign-in by `melde_an` and an administrator who ticks it expecting a person to be
able to use it has made a mistake the screen can prevent.

No rule about which roles may be held together. The backend has none, and inventing one here
would be a second opinion in the browser about something the server does not check.

## The Regierungspräsidium coupling

The one piece of real logic on this screen, and it is the backend's rule mirrored:

| What the administrator has done | What the backend does |
|---|---|
| Ticked `REGIERUNGSPRAESIDIUM`, chosen no region | Refuses with `REGIERUNGSPRAESIDIUM_FEHLT` |
| Chosen a region without ticking that role | Refuses with `REGIERUNGSPRAESIDIUM_UNZULAESSIG` |
| Ticked it and chosen 1 to 4 | Accepts |
| Neither | Accepts |

So on screen: **the region field is drawn only while that role is ticked, and unticking it
clears the chosen region** rather than leaving a number behind that the request would then be
refused for. The rule lives in a plain function over values, `kontoEingabe`, not inside the
component, so it can be held to its promise without React.

The second row of that table is therefore unreachable through this form by construction, and
the mapping still exists: a refusal this screen cannot cause today is one a later change could,
and an unmapped code falls through to a generic sentence.

**The regional role's label is not enough on its own.** Somebody ticking "Regierungspräsidium"
is saying "this account belongs to a regional authority and sees only its own region", and
feature 13 is what gives it that view. A hint under the checkbox says so, because the
difference between that and a `REVIEWER` is not inferable from six words in a list.

## What the administrator is told afterwards

On success the screen **stays where it is** and replaces the form with a confirmation panel.

It is the only moment the password exists anywhere it can be read. The API never returns it,
and the browser holds it only because it is what was just typed. A redirect to the list would
throw away the one thing the administrator now has to pass on.

The panel says four things:

1. The account was created, naming the address.
2. The address and the password, together, laid out so both can be copied.
3. That the person has to be told these, because the application does not send them, and not
   by an unprotected channel.
4. That they cannot change the password themselves yet, and that an administrator sets a new
   one if it is lost or if it has been seen by the wrong person.

Point 4 is the one that has to be exactly true rather than reassuring. Telling somebody to
"change it on first sign-in" would be telling them to do something the application does not
offer, which is the wording rule from 2026-09-06 read the other way round: a message that names
a way out has to name one that exists.

Two ways onward: **Weiteres Konto anlegen**, which clears the form and puts the cursor back in
the address field, and **Zur Benutzerliste**, which is where the new account is now visible.

**The password never leaves component state.** Not in `localStorage`, not in the query cache,
not in the address bar, not in a log. Leaving the page loses it, which is correct: the copy
that matters belongs to its owner from then on.

## The refusals

Each is shown where the thing it concerns is, which is the standing rule on this project
rather than a list at the top of the page.

| Code | Status | Where it appears |
|---|---|---|
| `EMAIL_UNGUELTIG` | 422 | Under the address field |
| `EMAIL_VERGEBEN` | 409 | Under the address field. The one an administrator actually hits, and the sentence has to point at the list rather than only saying no |
| `ROLLEN_LEER` | 422 | Under the role group. Zod catches it first; the mapping exists because Zod is not a gate |
| `REGIERUNGSPRAESIDIUM_FEHLT` | 422 | Under the region field |
| `REGIERUNGSPRAESIDIUM_UNZULAESSIG` | 422 | Under the region field |
| `REGIERUNGSPRAESIDIUM_UNBEKANNT` | 422 | Under the region field |
| `PASSWORT_ZU_KURZ` | 422 | Under the password field |
| `PASSWORT_ZU_LANG` | 422 | Under the password field |
| `ROLLE_FEHLT` | 403 | Replaces the page, reusing 16b's `KeineBerechtigung` |
| anything else | any | A retryable `Alert` beside the submit button, with the backend's own sentence where there is one |

**The backend's sentences are shown as they arrive.** `fehler_http.py` already writes each of
these to name the thing, say why in ordinary words and end somewhere the reader can act, and it
has a test holding it to that. Rewriting them here would produce a second wording that drifts.

**A failed submit keeps everything typed.** Nothing is cleared, the password included. Somebody
whose address was already taken changes four characters and presses the button again.

## The Regierungspräsidium names, fixed here

Feature 16b found that `backend/app/benutzer/regeln.py` and the option list extracted from the
legacy form disagree about which number is which region. The hand-written table says 1 is
Stuttgart and 2 is Karlsruhe; the extracted list says the opposite. Freiburg and Tübingen agree.

**It is fixed on this branch**, decided on 2026-09-25, following the project's rule that a small
unrelated fault found mid-feature is repaired on the current branch rather than deferred.

This feature is why it can no longer wait. 16b only printed a number that already existed; this
is the screen where somebody chooses one. An administrator picking "Regierungspräsidium
Karlsruhe" stores the number 1, and `befischung benutzer liste` then prints that same account as
"1 Stuttgart".

**The extracted list is the authority, for two reasons.** The number is what FiaKa receives, so
FFS's own form is what pairs it with a place, and the list was read out of that form rather than
typed. And `CONTEXT.md` already lists the four in the form's order. The table in `regeln.py` was
hand-written in feature 2a with no source behind it.

**It is a display-only change.** No stored number changes meaning, no migration, and nothing in
the application branches on the name: `REGIERUNGSPRAESIDIEN` is read in exactly three places and
all three print it. What changes is the words the command line and two error sentences use.

Three copies of the pairing exist and one of them is the fix's whole point, so all three move
together: the table itself, `cli.py`'s `--regierungspraesidium` help text, which restates the
pairing as a literal instead of reading the table, and `README.md`. The help text is made to read
the table so it cannot drift again.

**One consequence, named rather than hidden.** Any account already carrying a region was created
at the command line while it printed the old pairing, so somebody who meant Stuttgart and typed 1
now has an account labelled Karlsruhe everywhere. These are development accounts on a throwaway
database. On a real deployment this would be a question to put to FFS before touching anything,
and 16d is where such an account can be corrected on screen.

## In scope

- The route, the page, and the "Neues Konto" button in 16b's page head.
- The form: five fields, the sixth conditional one, and the Zod schema behind them.
- `kontoEingabe`, a plain function turning what was filled in into the request body, including
  the region coupling.
- The mutation: `POST /api/v1/benutzer`, and `BENUTZER_KEY` invalidated on success so the list
  shows the new account.
- The field-level error mapping in a plain function, and the refusal page reused from 16b.
- The confirmation panel and its two ways onward.
- The backend's region-name fix, and the test that holds it.
- Browser evidence: a Playwright spec and screenshots in both themes.
- German strings in `de.json`. **`en.json` is not touched**, the same as every screen since the
  shell: German defines the key set through `resources.d.ts` and feature 17 fills English in at
  once.

## Out of scope

- **Changing an account, locking it, unlocking it, or resetting a password.** 16d. Nothing on
  this screen touches an account that exists.
- **Any other backend change.** 16a shipped the endpoint, the shape and every refusal. The
  region-name fix is a wording correction to a display table, not new behaviour, and if this
  screen needs anything the API does not send, that is a finding to raise rather than a field to
  add quietly.
- **Sending the new account an email.** Feature 14. Until then the administrator passes the
  password on themselves, which is exactly what the confirmation panel is for.
- **Somebody setting their own password.** 16a's reasoning stands: self-service has to ask for
  the current password first, so it is a different feature with a different rule set.
- **Forcing a password change at next sign-in.** 16a ruled it out: it needs a column on `users`
  and a gate in front of every route.
- **Generating a password.** Considered on 2026-09-25 and not chosen. If FFS later has a rule
  about what a password must look like, this is where it would land.
- **Warning about unsaved input on leaving the page.** Five fields typed in a minute is not a
  draft, and the protocol's local safety copy exists because a protocol is an hour's work over
  several sittings. Adding a navigation guard here would be the first one in the application and
  would need to be right everywhere.
- **Creating a `Person` record alongside the account.** They are deliberately separate: the
  account that files a protocol is not always the person who carried out the survey, and nothing
  asks for a Bearbeiter's contact details at account-creation time.
- **Recording who created the account.** Feature 15, the audit trail. The build-plan note of
  2026-09-23 already records that 15 lands after this and that changes made in between are not
  recorded anywhere; this feature does not build half of one to paper over it.
- **Deleting an account.** Never available anywhere: a deleted account takes the owner of every
  protocol it filed with it. `app/benutzer/dienst.py` has said so since 2a.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big,
so split it.

## Build steps

- [x] **Step 1 - The region names** - the two swapped entries in
      `backend/app/benutzer/regeln.py`, `cli.py`'s `--regierungspraesidium` help text changed to
      read the table rather than restate it, and the line in `README.md`. First, so the dropdown
      built in step 3 agrees with the command line from the moment it exists.
      *Done when:* `pytest` and `ruff check .` pass from `backend/`, a test holds
      `REGIERUNGSPRAESIDIEN[1]` to Karlsruhe and `[2]` to Stuttgart, and
      `befischung benutzer anlegen --help` prints the pairing from the table, matching what
      `optionslisten.json` says.

- [x] **Step 2 - The way in** - a `BENUTZER_NEU` path constant beside `BENUTZERVERWALTUNG` in
      `src/auth/startseite.ts`, the route in `routes.tsx`, the "Neues Konto" button in the list
      page's head, and a page that is a heading, a card and nothing else.
      *Done when:* signed in as a Super Admin the list page shows the button, it reaches
      `/verwaltung/benutzer/neu`, and the page draws inside the shell with the header link still
      marked current. Signed in as a Reviewer the address still reaches the page, because hiding
      a route is not a permission, and the page is empty rather than broken.

- [x] **Step 3 - The fields** - the five controls, the Zod schema, `react-hook-form` wired up,
      and one local field component so the accessibility wiring is written once, following
      `AnmeldungSeite`'s `Anmeldefeld`. No submit yet: the button is drawn and disabled.
      *Done when:* `npm test` covers the schema refusing an empty address, an address that is
      not one, a password under twelve characters and an empty role list, and accepting a filled
      form. On screen every control has a label above it, the password toggle shows and hides
      what was typed, the role checkboxes read in `ROLLEN` order, and every message appears under
      the field it concerns.

- [x] **Step 4 - The region coupling** - `kontoEingabe` as a plain function, the region `Select`
      appearing with the regional role, the chosen region cleared when that role is unticked, and
      the hint under both that checkbox and the `INTEGRATION` one.
      *Done when:* `npm test` covers `kontoEingabe` for the four rows of the coupling table,
      including that a region chosen and then abandoned does not reach the request body. On
      screen ticking Regierungspräsidium reveals the dropdown with the four regions from the
      option list, unticking it hides it, and ticking it again offers nothing pre-selected.

- [x] **Step 5 - Creating the account** - `api.ts` gaining the `POST`, a `useKontoAnlegen`
      mutation invalidating `BENUTZER_KEY`, `feldFuerFehler` as a plain function mapping a code
      to the field it belongs under, the refusal page reused from 16b, and the submit button
      doing its work with its pending state.
      *Done when:* `npm test` covers `feldFuerFehler` for every code in the table above,
      including one it has no field for. Against the running backend a new account is created,
      appears in the list without a manual reload, and can sign in with the password given. A
      duplicate address shows its refusal under the address field with everything still typed, a
      password of eleven characters is refused under the password field, and a Reviewer at this
      address is told who the page is for with a link onward and no retry button.

- [x] **Step 6 - What to pass on** - the confirmation panel, its four statements, the address and
      password laid out to be copied, and the two ways onward.
      *Done when:* after creating an account the panel names the address, shows the password,
      says the person has to be told it and how not to send it, and says that only an
      administrator can set a new one. "Weiteres Konto anlegen" clears every field including the
      password and focuses the address field; "Zur Benutzerliste" lands on the list with the new
      account in it. Reloading the page loses the password rather than showing it again.
      **Also in this step:** 16b's "Keine Konten vorhanden" wording still sends the reader to
      `befischung benutzer anlegen`, which this screen replaces. It points at the button
      instead. Found in step 2.

- [x] **Step 7 - Browser evidence** - `e2e/konto-anlegen.spec.ts` beside the existing specs,
      using `e2e/konten.ts` and its skip-with-a-sentence arrangement, plus screenshots in light
      and dark.
      *Done when:* `npm run e2e` passes with the accounts configured and skips with the usual
      sentence without them. It covers a Super Admin reaching the page from the list button,
      creating an account with a generated-at-random address so the spec can run twice, seeing
      it in the list afterwards, the duplicate-address refusal, the region dropdown appearing
      with its role, and a Reviewer being refused at the address. Every control is found by its
      accessible role and name. Screenshots show the form and the confirmation panel in both
      themes with nothing cut off, and the spacing inside the card is checked by eye.

- [x] **Repair F-01 - a refused address stops being refused once it is corrected** - the
      mutation's error cleared when the form changes, so no server sentence outlives the input
      it was about.
      *Done when:* after a duplicate address is refused, typing a free one removes the message
      without pressing anything, and pressing the button then creates the account. Covered in
      `konto-anlegen.spec.ts` so it cannot come back.

- [x] **Repair F-02 - the address and password announced as required** - `feldAria` passed
      through the input's own slot rather than spread onto the component.
      *Done when:* the browser shows `aria-required="true"` on the input itself rather than on
      the wrapper, and the other aria attributes are still where they were.

- [x] **Repair F-03 and F-04 - two cleanups in one diff** - the focus call that cannot run and
      its comment removed, and the third copy of the locale list replaced by `SUPPORTED_LOCALES`.
      *Done when:* "Weiteres Konto anlegen" still puts the cursor in the address field, and
      `SPRACHEN` and the Zod enum both read the i18n module.

## Files / areas

**New**, all under `frontend/src/verwaltung/benutzer/`:

- `KontoAnlegenSeite.tsx` - the page, the form and its states
- `Rollenauswahl.tsx` - the six checkboxes, their legend and their hints
- `Zugangsdaten.tsx` - the confirmation panel
- `eingabe.ts`, `eingabe.test.ts` - the Zod schema, `kontoEingabe`, and the region coupling
- `fehlerfelder.ts`, `fehlerfelder.test.ts` - which field a refusal belongs under
- `useKontoAnlegen.ts` - the mutation and the invalidation
- `kontoanlegen.css` - only what the shared styles do not already give

**Changed:**

- `frontend/src/verwaltung/benutzer/api.ts` - the `POST`
- `frontend/src/routes.tsx` - the route
- `frontend/src/auth/startseite.ts` and `startseite.test.ts` - the `BENUTZER_NEU` path
- `frontend/src/verwaltung/benutzer/BenutzerlisteSeite.tsx` - the button in the page head
- `frontend/src/i18n/locales/de.json` - a `benutzerverwaltung.anlegen` section. `en.json` is
  left alone; feature 17 fills it
- `frontend/e2e/konto-anlegen.spec.ts` - new
- `README.md` and `docs/screenshots/` - the new screen added to the screen-by-screen tour, as
  every other shipped screen already is, plus the region-name line in step 1

**Backend, step 1 only:**

- `backend/app/benutzer/regeln.py` - the two swapped names
- `backend/app/benutzer/regeln_test.py` - a test holding the pairing to the option list
- `backend/app/cli.py` - the help text reading the table instead of restating it

## Data / contracts

**Nothing new, and no schema change.** Every shape this screen needs was defined by 16a.

`POST /api/v1/benutzer` takes `KontoAnlegenAnfrage` and answers 201 with `BenutzerAntwort`:

```
{ email, passwort, rollen: Rolle[], regierungspraesidium: number | null, locale: 'de' | 'en' }
```

Three properties of that shape this screen depends on, all of them 16a's decisions:

- **`extra="forbid"`.** A misspelled field name is refused rather than dropped, so the request
  body is built by one function rather than spread across the component.
- **`regierungspraesidium` is nullable and omitted means the same as null here.** The
  absent-versus-null distinction is `KontoAendernAnfrage`'s and belongs to 16d; on creation there
  is nothing to leave alone.
- **The password is never returned, never logged and never echoed in a validation error.** The
  confirmation panel shows the value the browser already holds; nothing reads it back.

**The error codes in the refusals table are published contracts**, not names a refactor may
change. `fehlerfelder.ts` branches on them and so will 16d.

**Load-bearing for 16d:** `BENUTZER_KEY` from `abfragen.ts` is what a successful write
invalidates, exported for exactly this reason in 16b. 16d invalidates the same key plus the
account's own entry once it has one.

## Testing

The test gate is on. `npm test` from `frontend/`, vitest, node environment, and `pytest` from
`backend/` for step 1.

Logic that needs a test in the step that adds it:

| Function | Step | The wrong answers it prevents |
|---|---|---|
| `REGIERUNGSPRAESIDIEN` against the option list | 1 | The command line and the screen naming different places for the same number |
| the Zod schema | 3 | A form that can be submitted empty, or one that refuses a password the backend would accept |
| `kontoEingabe` | 4 | A region sent for an account with no regional role, refused by the backend for something the administrator cannot see |
| `feldFuerFehler` | 5 | A refusal about the address appearing under the password, or one with no field at all vanishing silently |

Components and states ride on browser evidence and the build, which step 7 writes down as a
Playwright spec rather than clicking through once.

**The permission evidence is not optional.** `coding-standards.md` says so and this is the
feature where it bites hardest, because the screen hands out roles. Step 5's browser evidence
must include a `REVIEWER` refused at this address, and step 7 keeps that running.

Run `npm run lint`, `npm run build` and `npm test` from `frontend/` before each step is
approved, plus `pytest`, `ruff check .` and `mypy .` from `backend/` for step 1. There is still
no project-wide `Verify` command.

## Notes for the AI

- **MUI wherever MUI has a component.** `Checkbox`, `FormGroup`, `FormControlLabel`, `Select`,
  `MenuItem`, `OutlinedInput`, `Button`, `Alert`, `IconButton` for the password toggle. Not a
  native `<input type="checkbox">` and not a bare `<select>`.
- **The label goes above the field**, so `FormLabel` inside a `FormControl`, never `InputLabel`
  and its notch. The role group's legend is a `FormLabel` on the `FormControl` that wraps the
  `FormGroup`, so the six checkboxes are announced as one named group.
- **The accessibility wiring is written once.** Reuse `protokoll/felder/rahmen.ts`'s `feldAria`
  and `fehlerId` the way `AnmeldungSeite` does. Do not reuse `FeldRahmen` itself: it is typed to
  a path into the answers document and an account has none.
- **Theme once, not per use.** If a control needs styling that another screen will want, it goes
  in `muiTheme.ts` under `components`, not in this feature's stylesheet. `.card` supplies no
  padding on this project, so the form supplies its own inset; that exact fault has now shipped
  twice, most recently on 16b's own search row.
- **Reuse the rules, do not restate them.** The region coupling, the twelve-character minimum
  and what counts as an address are the backend's, mirrored in Zod for the message under the
  field. Where the two could drift, the backend wins and the browser half is a convenience.
- **Route paths are German.** `/verwaltung/benutzer/neu`.
- **Domain terms stay German in identifiers.** `rollen`, `regierungspraesidium`, `passwort`,
  `kontoEingabe`. Ordinary programming vocabulary stays English.
- **Strings live in `de.json`.** Nothing user-facing is written inline, and `en.json` stays as it
  is.
- **No colour hard-coded.** Tokens from `theme.css` through the MUI theme, both themes checked.
- **The password is handled like a password.** Component state only. Never in the query cache,
  never in `localStorage`, never in a URL, never in a console line, and not in a Playwright
  trace that gets committed.
- **Nothing here changes an account that exists.** If a step starts wanting a `PATCH`, it has
  wandered into 16d.
- **No em dashes, en dashes or ellipsis characters** in code, comments or commit messages.

## What the critique changed

Five things, run against the draft before it was presented.

1. **The region-name fix became step 1 rather than a closing note.** The draft had it last, as
   tidying up. Built last, the dropdown in step 3 and the command line disagree for the whole of
   the feature's build, and the browser evidence in step 7 would be taken against labels that
   were about to change.

2. **A step was split in two.** "Creating the account and telling the administrator what to pass
   on" was one step covering a mutation, an error mapping, a refusal page and a confirmation
   panel. It is now steps 5 and 6, because the panel is the part with wording to argue about and
   it should not arrive in the same diff as the plumbing.

3. **The unreachable refusal was kept and labelled.** `REGIERUNGSPRAESIDIUM_UNZULAESSIG` cannot
   be produced by this form, because unticking the role clears the region. The draft dropped it
   from the mapping. It is back, with the reason: a code this screen cannot cause today is one a
   later change could, and an unmapped code falls through to a generic sentence.

4. **"Change it on first sign-in" came out of the confirmation wording.** There is no way for
   an account to change its own password, so that sentence would have told somebody to do
   something the application does not offer. What replaced it says an administrator sets a new
   one, which is true and is the way out that exists.

5. **The navigation guard was named as out of scope rather than left unsaid.** A half-typed form
   is lost on leaving the page. That is the right answer for five fields, and worth stating,
   because the protocol's local safety copy sets the opposite precedent a few screens away.

## Findings

Raised by `/audit` against this branch and resolved before it was completed. The
ids carry the feature's number so they stay unique once the ledger resets.

### 16c/F-01 [P1] closed - A refused address keeps being refused after it is corrected

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:214
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** The server's sentence is read straight off the mutation, which
holds its last error until the next submit. So after "Für diese Adresse gibt es
bereits ein Konto", typing a completely free address leaves that sentence sitting
under the field, still saying the address is taken. Confirmed in the browser: with
the address replaced by an unused one, the alert was still present and unchanged.

It states something untrue about what is currently typed, and it contradicts the
standing rule on this project that feedback must visibly reflect progress as
somebody fixes the thing it is about. The same applies to the password, the roles
and the region, which all read the server's error the same way (lines 225, 243 and
138).

**Suggested fix:** Clear the mutation's error when the field it concerns changes.
The smallest version is to call `anlegen.reset()` from the form's `onChange`, so
any server message disappears as soon as the administrator edits anything; the
message comes back, current, on the next submit.

**Resolution:** 2026-09-26, by /implement. A `verwerfeServerfehler` helper on the
page, called from the form's own `onChange` and from each of the two dropdowns.
The form handler alone was not enough and a browser check caught it: MUI's Select
is a div with a hidden input and emits no change event that reaches the form, so a
stale message survived a change of region. The e2e spec now types a free address
after a refusal and asserts the message is gone.

**Re-reviewed:** 2026-09-26 by /audit (scope: current). Closed. The repair is on
the page at KontoAnlegenSeite.tsx:121 and reached from three places: the form's
`onChange`, and each dropdown's own handler. The browser confirms all four input
kinds clear the message now, including the region dropdown that the first attempt
missed. The guard means no re-render happens when nothing is outstanding, and no
new defect was found in the changed region: a reset while a request is in flight
cannot fire, because the error is null for the whole of it.

### 16c/F-02 [P2] closed - The address and password fields are not announced as required

**File:** frontend/src/verwaltung/benutzer/Kontofeld.tsx:80
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `feldAria(...)` is spread directly onto `OutlinedInput`, so MUI
puts the attributes it does not recognise on the wrapper element instead of on the
input. Measured in the browser: the input carries `aria-describedby` and
`aria-invalid`, and `aria-required="true"` sits on the surrounding div, where it
names nothing and is announced to nobody. Neither field carries a visible required
marker either, so the requirement is conveyed only by the message that appears
after a failed submit.

This is also drift from the pattern the rest of the project follows. Every other
field passes the same helper through `inputProps`: `AnmeldungSeite.tsx:109`,
`FeldText.tsx:96`, and `FeldSuche.tsx:70` via `eingabeAria`. This file is the only
one that spreads it onto the component, which is exactly why the attribute went
astray. `coding-standards.md` makes correct labelling an acceptance criterion on
every UI feature rather than a later pass.

**Suggested fix:** Pass it the way the rest of the project does,
`inputProps={feldAria(...)}` (or `slotProps.htmlInput` for MUI 9), and check in the
browser that `aria-required` lands on the input.

**Resolution:** 2026-09-26, by /implement. Passed through `slotProps.input`, which
is the slot name OutlinedInput takes in MUI 9. Measured again in the browser: the
input now carries `aria-required="true"`, the wrapper carries none, and
`aria-describedby` and `aria-invalid` are unchanged.

**Re-reviewed:** 2026-09-26 by /audit (scope: current). Closed. Measured in the
browser after the repair: the input carries `aria-required="true"`, the wrapper
carries none, and `aria-describedby` (`email-hinweis email-fehler`) and
`aria-invalid` are unchanged. `slotProps.input` is the slot OutlinedInput takes in
MUI 9, and the values registered by React Hook Form still arrive, which the passing
browser suite shows.

### 16c/F-03 [P3] closed - A focus call that cannot do anything, with a comment saying it is needed

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:173
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `document.getElementById('email')?.focus()` runs inside the
handler for "Weiteres Konto anlegen", at a moment when the confirmation panel is
still what is rendered and the form does not exist in the document. The lookup
returns null every time. The focus that actually happens comes from `autoFocus` on
the address field when the form is mounted again, which is why the behaviour looks
correct: the browser check confirmed focus lands on the address field.

The risk is not the behaviour but the four lines of comment asserting that this
call is what puts the cursor back, which will mislead the next reader and would
survive a change to `autoFocus` that silently removes the behaviour.

**Suggested fix:** Delete the call and the comment, and say in one line that the
address field's own `autoFocus` returns the cursor when the form comes back. If the
focus is worth guaranteeing independently of `autoFocus`, do it in an effect after
the form has been rendered rather than in the handler.

**Resolution:** 2026-09-26, by /implement. The call and its comment are gone,
replaced by one line saying the address field's own `autoFocus` moves the cursor.
A browser check confirms focus still lands on the address field afterwards.

**Re-reviewed:** 2026-09-26 by /audit (scope: current). Closed. The call and its
comment are gone, and the replacement line says what actually moves the cursor. The
browser confirms focus still lands on the address field after "Weiteres Konto
anlegen".

### 16c/F-04 [P3] closed - A third copy of the list of supported locales

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:63
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `SPRACHEN = ['de', 'en']` is written here, `z.enum(['de', 'en'])`
again in `eingabe.ts:66`, and `SUPPORTED_LOCALES` already exists and is exported
from `src/i18n/index.ts:26`, where `Locale` is derived from it. Three copies of the
same two-item list, one of which is the established source. Adding a locale for
feature 17 means finding all three.

**Suggested fix:** Import `SUPPORTED_LOCALES` in both places and build the Zod enum
from it, so the i18n module stays the one answer to which locales exist.

**Resolution:** 2026-09-26, by /implement. Importing from `i18n/index.ts` turned
out to break `eingabe.ts`, which must stay testable in a node environment: that
module initialises i18next as it is imported and reaches for `localStorage`, and
the test suite failed with "document is not defined". The list therefore moved to a
new leaf module, `src/i18n/sprachen.ts`, which `index.ts` re-exports so no existing
caller changed. Both copies now read it.

**Re-reviewed:** 2026-09-26 by /audit (scope: current). Closed. One declaration, in
`src/i18n/sprachen.ts`, re-exported by `i18n/index.ts` so no existing caller
changed, and read by both former copies. The leaf module has no imports and no side
effects, which is what keeps `eingabe.ts` testable in a node environment; the suite
passes, which is the property that failed on the first attempt.

### 16c/F-05 [P2] accepted - Three unrelated diagrams were swept into a review-fix commit

**File:** blueprint/history/flow_diagrams/DATA_FLOW_DIAGRAM.puml:1
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** Commit 7aa62c5, whose message is entirely about the four review
findings, also adds 729 lines across three PlantUML architecture diagrams that have
nothing to do with feature 16c. They were untracked files dated 24 September, and a
`git add -A -- blueprint` in that commit picked them up.

Two problems follow. Nobody reviewed them as a diff, which is the one rule this
project's build loop rests on. And `/complete` squashes this branch into a single
feature commit, so the diagrams would enter history permanently attributed to "the
screen for creating an account", which is where somebody looking for their origin
later would never think to search.

Whether they belong in the repository at all is the user's call, not this review's:
they look like deliberate project documentation rather than stray output.

**Suggested fix:** Decide with the user, then either take them out of this branch
and commit them on their own with a message that names them, or keep them and say
so explicitly in the feature's archive entry. Either way, check `git status` before
staging with `-A` on a directory rather than naming the paths.

**Resolution:** 2026-09-27, accepted by Mansi, who chose to keep the diagrams in
feature 16c's commit rather than separate them. Their reason: fewer steps, and the
attribution is recorded where somebody would look for it. The archived spec for
16c says in its own words that the three diagrams travelled with this feature and
were not part of it, so the commit message is not the only record. The habit that
caused it, staging with `-A` over a directory instead of naming paths, stands as
the thing to avoid next time.

## What travelled with this feature and was not part of it

Three PlantUML architecture diagrams under `blueprint/history/flow_diagrams/`, 729
lines of them, are in this feature's commit. They are not feature 16c's work: they
were written on 2026-09-24, sat untracked, and were swept in by a `git add -A` over
`blueprint/` while the review findings were being committed.

Recorded here, and accepted deliberately on 2026-09-27 rather than separated,
because the commit message alone would tell somebody looking for their origin the
wrong thing. They document the application's data flow and its frontend
architecture; they belong to the project, not to the screen for creating an
account.
