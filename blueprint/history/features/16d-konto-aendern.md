# Feature: Ein Konto aendern

**From build-plan:** feature 16d
**Status:** built and proved. Unit tests, lint, build and the full Playwright suite all
green (55 passed, 1 pre-existing skip), with screenshots taken in both themes.

## Goal

Let a Super Admin change an account that already exists: its address, its roles, its
region and its language, plus the three things that are not fields at all, namely
locking it, unlocking it, and giving somebody a new password after they have lost
theirs.

This is the half of feature 16 that the command line never had. `befischung benutzer`
can create an account, list accounts, lock one and unlock one. It cannot change one.
So today a mistyped address produces an account nobody can sign in to and nobody can
repair, a colleague who moves from surveying to reviewing needs a second account, and
somebody who has forgotten their password waits for whoever has shell access on the
machine the database runs on.

Feature 16a built every endpoint this needs and 16c built the screen that writes the
first one. This is the last sub-feature of 16, and once it ships nothing about an
ordinary account requires a terminal.

## Design reference

[`prototypes/meine-protokolle.html`](../../prototypes/meine-protokolle.html) for the
page furniture, and the application's own
[`KontoAnlegenSeite.tsx`](../../frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx)
for the form.

No new mockup, and none is needed. `page__head` and `card` come from the list pages,
and every control on this screen already exists on the create screen: `Kontofeld`,
`Rollenauswahl`, the region `Select` and the language `Select`. This feature reuses
them rather than building a second set, which is the whole reason 16c pulled them out
into components.

## Where it lives

**Its own route, `/verwaltung/benutzer/:id`**, reached from a new action button in each
row of 16b's table. `BenutzerZeile.tsx` already says in a comment that this is where
the row grows an action.

A route rather than a dialog on the list, for the reasons 16c gave and one more of its
own. The page carries three separate jobs (the fields, locking, the password), the
password ends in a panel an administrator reads and copies out of, and an account's
own address is a link worth being able to send somebody.

**The id in the address, not the email.** 16a decided that for the API and it holds
here for the same reason: the address is the very thing this screen can change, so a
URL built out of it would stop working the moment somebody used the screen.

**The route carries no role check**, the fifth time `routes.tsx` states that rule. The
endpoints admit `SUPER_ADMIN` and nobody else, the page turns a refusal into words,
and a second opinion in the browser could only ever be the wrong one.

## What the page holds

Three cards, in this order, because that is the order of how likely each is and how
hard each is to undo.

| Card | What it does | Which endpoint |
|---|---|---|
| **Die Angaben** | Email, roles, region, language, with a save button | `PATCH /api/v1/benutzer/{id}` |
| **Zugang** | Lock or unlock the account | `PATCH /api/v1/benutzer/{id}`, `ist_aktiv` alone |
| **Passwort** | Set a new one | `PUT /api/v1/benutzer/{id}/passwort` |

Above them, in the page head, the account's address as the heading, and underneath it
two facts that are read and never edited: when it was created, and whether it is
currently active. `updated_at` is deliberately not offered, because the backend does
not send one and the reason is written down in `typen.ts`: it moves whenever a sign-in
upgrades the stored password hash, so it is not a "last edited" date and a screen must
not label it one.

**Locking is its own card rather than a checkbox in the form.** Locking somebody out is
something an administrator does at a moment, because a person has left or an account
has been compromised, not something they adjust while correcting a typo in an address.
A checkbox sitting between the roles and the language is something you can change by
accident and not notice you have saved.

**The password is its own card for the reason 16a separated the endpoint.** It is the
one value here that must never be returned, never logged and never echoed in a
validation error, and keeping it away from the five ordinary fields is what makes that
easy to hold true.

**Each card sends only its own answers.** Somebody who types a new address, changes
their mind about saving it and then presses "Konto sperren" must not have the address
saved as well. So the lock action sends `ist_aktiv` and nothing else, built from the
account rather than from the form, and the password card reads no field of the form at
all. Three cards on one page is only safe if each one's button does exactly what its
own card says.

## Only what changed is sent

`PATCH` leaves out what it is not told about, which 16a built deliberately, and this
screen is what that was for. The request body is built by comparing the form against
the account as it was loaded, in a plain function, and a field nobody touched is not in
the body at all.

Three things follow, and all three are worth having rather than incidental:

1. **Two administrators editing different fields do not overwrite each other.** An
   account has no version column and there is no `KONTO_VERAENDERT` refusal, so sending
   the whole form every time would mean the second save silently undid the first.
   Sending only what changed narrows that to the same field being edited twice at once.
2. **Nothing is sent when nothing changed.** The screen says so rather than making a
   request that would answer 200 and do nothing, which reads as a save that did not
   take.
3. **Taking the regional role away has to clear the number in the same request.** This
   is the load-bearing one. `aendere_benutzer` refuses a leftover number rather than
   tidying it up, and the comment in `dienst.py` says why: dropping it quietly would be
   the service deciding what somebody meant, and the number is the field that scopes
   what a regional account can see. So when the role goes, the body carries
   `regierungspraesidium: null` alongside the new roles.

**What "as it was loaded" means, since the account is refetched.** The comparison is
against the account the form was last filled from, not against whatever the query
happens to hold. Two rules follow:

- **After a successful save the form is refilled from the answer.** The saved values are
  then the new baseline, so "nothing changed" is true again and a second press of the
  button sends nothing.
- **A background refetch never refills the form.** React Query refetches on window
  focus, and a page that reset its fields because somebody alt-tabbed away and back
  would throw away what they had typed. The answer to a save refills it; nothing else
  does.

## The region coupling, same rule, one more case

16c's coupling is reused unchanged: the region field is drawn only while
`REGIERUNGSPRAESIDIUM` is ticked, and unticking it clears the chosen number on screen.
What is new is the one case a create form cannot have, an account that already carries
a number:

| What the administrator does | What the body carries |
|---|---|
| Leaves the roles and the region alone | Neither field |
| Changes the region, role still ticked | `regierungspraesidium: <new number>` |
| Unticks the regional role | `rollen` and `regierungspraesidium: null` |
| Ticks the regional role and chooses a number | `rollen` and `regierungspraesidium: <number>` |
| Ticks the regional role and chooses nothing | Nothing is sent, and the message says why, under the field |

## Your own account, said before it is refused

16a built two safety rules and 16b already marks which row is yours specifically
because of them. On your own account:

- **You cannot lock yourself.** The lock button is not drawn at all. In its place is a
  sentence saying another Super Admin has to do it, because a button that can only fail
  is worse than no button.
- **You cannot take `SUPER_ADMIN` off yourself.** The checkbox stays operable, and a
  message appears under the role group as soon as it is unticked, before the button is
  pressed.

Both are mirrors of a server rule rather than opinions of their own, which is the
"written twice" arrangement `coding-standards.md` asks for, and they live in a plain
function over values so they can be held to their promise without a browser. The server
is still the gate: if either refusal arrives anyway, its sentence is shown.

**The "last active Super Admin" rule is not mirrored**, and that is deliberate. The
browser would have to count active Super Admins from a cached list, which is a second
opinion built on stale data. 16a's spec also measured that over HTTP this rule can only
ever fire on the caller's own account, since reaching the route at all proves one active
Super Admin exists. So the screen mirrors the rule that needs no count, and shows the
server's sentence for the other.

## What a password reset does and does not do

The panel afterwards says four things, and the third is the one that has to be exactly
true rather than reassuring:

1. The password was changed, naming the address.
2. The address and the new password, laid out so both can be copied, because the API
   never returns a password and the browser holds it only because it was just typed.
3. **The account's existing sessions are not ended.** 16a wrote this down: the session
   token is stateless, so one issued before the reset stays valid until it expires, up
   to eight hours. Where a reset is because somebody else may have had the old password,
   **locking the account is the part that takes effect at once**, on the very next
   request, and the sentence says so and points at the card above.
4. The person still cannot change it themselves, so an administrator sets a new one if
   it is lost again.

## The refusals

Each shown where the thing it concerns is, which is the standing rule on this project
rather than a list at the top of the page.

| Code | Status | Where it appears |
|---|---|---|
| `EMAIL_UNGUELTIG` | 422 | Under the address field |
| `EMAIL_VERGEBEN` | 409 | Under the address field |
| `ROLLEN_LEER` | 422 | Under the role group |
| `REGIERUNGSPRAESIDIUM_FEHLT` | 422 | Under the region field |
| `REGIERUNGSPRAESIDIUM_UNZULAESSIG` | 422 | Under the region field |
| `REGIERUNGSPRAESIDIUM_UNBEKANNT` | 422 | Under the region field |
| `PASSWORT_ZU_KURZ` | 422 | Under the password field, in the password card |
| `PASSWORT_ZU_LANG` | 422 | Under the password field |
| `LETZTER_SUPER_ADMIN` | 409 | Beside the button that was pressed |
| `SELBSTENTZUG_UNZULAESSIG` | 409 | Beside the button that was pressed |
| `KONTO_NICHT_GEFUNDEN` | 404 | Replaces the page: no such account, with a link to the list and no retry |
| `ROLLE_FEHLT` | 403 | Replaces the page, reusing 16b's `KeineBerechtigung` |
| anything else | any | A retryable `Alert` in the card whose button was pressed |

**The backend's sentences are shown as they arrive.** `fehler_http.py` already writes
each to name the thing, say why in ordinary words and end somewhere the reader can act,
and it has a test holding it to that. A second wording here would drift.

**A failed save keeps everything typed**, the same as 16c, and a refusal is dropped as
soon as anything changes so no server sentence outlives the input it was about. 16c
learned the second half the hard way: MUI's `Select` emits no change event that reaches
the form, so the two dropdowns clear the refusal themselves.

## Four states before the form exists

The page loads one account, so it has the same answers 16b's list has:

| State | What is on screen |
|---|---|
| Loading | A live region saying the account is being loaded |
| Loaded | The three cards |
| `KONTO_NICHT_GEFUNDEN` | A panel saying no account has that id, with a link to the list. Not retryable |
| `ROLLE_FEHLT` | `KeineBerechtigung`, reused from 16b |
| Anything else | `Ladefehler`, reused from 16b, with its retry |

**Its own query, keyed by id**, rather than picking the account out of the cached list.
A deep link and a reload both have to work, and a page that could only render when the
list happened to be in the cache would be a page that works only when you arrive from
the list.

## In scope

- The route, the path helper beside `BENUTZER_NEU`, and the action column in 16b's table
  with an "Aendern" link per row.
- `PATCH` added to `api/client.ts`'s method union. It is not there yet: feature 3b added
  `PUT` and `DELETE`, and nothing since has needed a partial update.
- The account query, keyed by id, and the load states above.
- The fields card: the four controls prefilled from the account, reusing `Kontofeld`,
  `Rollenauswahl` and both `Select`s, with its own Zod schema (no password).
- `formularAusKonto` and `kontoAenderung`, plain functions: one filling the form from an
  account, one turning the form back into the smallest request that expresses what
  changed, including the region coupling.
- The self-protection rule as a plain function, and the two places it shows.
- The lock and unlock actions, the confirmation dialog for locking, and no dialog for
  unlocking.
- The password card, its `PUT`, and the panel afterwards, following 16c's `Zugangsdaten`
  with wording of its own.
- The mutations, invalidating both `BENUTZER_KEY` and this account's own key, plus
  `SITZUNGS_KEY` when the account being changed is the caller's own, so a language
  change takes effect at once and a changed address is not still shown in the header.
- Browser evidence: a Playwright spec and screenshots in both themes.
- German strings in `de.json`. **`en.json` is not touched**, the same as every screen
  since the shell: German defines the key set through `resources.d.ts` and feature 17
  fills English in at once.
- **The flow diagrams under `blueprint/history/flow_diagrams/`**, in this same branch.
  They currently have no `verwaltung/` package at all, because they were written on 16c's
  branch from the code as it stood, and this feature adds a route and a folder they
  describe.

## Out of scope

- **Any backend change.** 16a shipped all five endpoints, both safety rules, every
  request shape and every refusal, and this screen needs nothing that is not already
  there. If it turns out to, that is a finding to raise rather than a field to add
  quietly.
- **Deleting an account.** Never available anywhere. A deleted account takes the owner
  of every protocol it filed with it, and `app/benutzer/dienst.py` has said so since
  feature 2a. Locking is the model's answer and this screen is where it is done.
- **Somebody changing their own password without an administrator.** 16a's reasoning
  stands: self-service has to ask for the current password first, so it is a different
  feature with a different rule set.
- **Forcing a password change at next sign-in.** 16a ruled it out: it needs a column on
  `users` and a gate in front of every route.
- **Ending an account's sessions when its password is reset, or when it is locked.** A
  lock already takes effect on the next request, because `aktueller_benutzer` loads the
  row every time. Real token revocation needs somewhere to store what has been revoked
  and would change every request in the application.
- **Recording who changed what.** Feature 15, the audit trail. The build-plan note of
  2026-09-23 already records that 15 lands after 16 and that a role change made in
  between is not recorded anywhere. This feature does not build half of one.
- **Telling the account it was changed.** Feature 14, the notifications.
- **Guarding against two administrators editing the same account at the same moment.**
  There is no version on an account and no `KONTO_VERAENDERT` refusal. Sending only the
  changed fields narrows it as far as it can be narrowed without a backend change. Named
  here rather than discovered later.
- **Editing the `Person` record.** An account and the Bearbeiter whose contact details a
  protocol carries are deliberately separate entities.
- **An account changing its own language from the header.** That is a different feature.
  This screen sets the field because an administrator creating an account already does.
- **A warning about unsaved input on leaving the page.** 16c's reasoning stands: four
  fields corrected in a minute is not a draft, and a navigation guard would be the first
  in the application and would have to be right everywhere.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too
big, so split it.

## Build steps

- [x] **Step 1 - The way in** - a `benutzerPfad(id)` helper beside `BENUTZER_NEU` in
      `auth/startseite.ts`, the route in `routes.tsx`, a sixth column in
      `BenutzerTabelle` with an "Aendern" link per row, and a page that is a heading and
      nothing else.
      *Done when:* signed in as a Super Admin every row has an "Aendern" button, it
      reaches `/verwaltung/benutzer/<id>`, and the page draws inside the shell with the
      header link still marked current. The new column has a header cell, so the table
      still has one heading per column. Signed in as a Reviewer the address still reaches
      the page, because hiding a route is not a permission, and the page is empty rather
      than broken.

- [x] **Step 2 - The account, and the answers before any form** - `PATCH` added to
      `client.ts`'s method union, `holeKonto` in `api.ts`, `kontoAbfrage(id)` in
      `abfragen.ts` over `GET /benutzer/{id}`, the page head naming the address with the
      creation date and current status under it, and the loading, not-found, refused and
      load-error states. Still no form.
      *Done when:* the page names that account's address, its creation date and whether
      it is active. A made-up uuid shows the not-found panel with a link to the list and
      no retry button. With the backend stopped it shows `Ladefehler`, and its retry
      works once the backend is back. A Reviewer sees `KeineBerechtigung`. A reload draws
      the same thing, because the query does not depend on the list being cached.

- [x] **Step 3 - The fields, prefilled** - `aendern.ts` with the schema, the form type
      and `formularAusKonto`, `Kontofeld` made generic over the form it belongs to, and
      the fields card built from it plus `Rollenauswahl` and the two `Select`s, with
      `react-hook-form` wired up. The save button is drawn and does nothing yet.
      *Done when:* `npm test` covers `formularAusKonto` for an account with a region,
      one without, and one holding several roles, and the schema refusing an empty
      address, an address with no `@` and an empty role list. On screen every control
      shows that account's current value, the roles read in `ROLLEN` order, the region
      field appears only for a regional account and shows its number's name, and
      unticking the regional role hides it.

- [x] **Step 4 - Saving what changed** - `kontoAenderung` as a plain function,
      `aendereKonto` in `api.ts`, `useKontoAendern` invalidating the account's key,
      `BENUTZER_KEY` and, on the caller's own account, `SITZUNGS_KEY`, the field-level
      refusals reusing `feldFuerFehler`, and the "nothing changed" message.
      *Done when:* `npm test` covers `kontoAenderung` returning nothing to send when
      nothing changed, the address alone, the roles alone, the language alone, the region
      alone, a regional role removed carrying `regierungspraesidium: null` in the same
      body, a regional role added carrying its number, a regional role ticked with no
      number chosen being unsendable, and `ist_aktiv` never appearing in this body at
      all. Against the running backend: a changed address can be signed in with and the
      old one cannot, the list shows it without a manual reload, an address already in
      use is refused under the field with everything still typed and the message goes
      away as soon as the address is corrected, a role added takes effect on that
      account's next request, and changing your own language switches the interface at
      once.

- [x] **Step 5 - Your own account** - `selbstschutz` as a plain function over values
      naming which of the two protected changes is being attempted, the message under
      the role group when `SUPER_ADMIN` is unticked on your own account, and
      `SELBSTENTZUG_UNZULAESSIG` and `LETZTER_SUPER_ADMIN` shown beside the button when
      the server refuses anyway.
      *Done when:* `npm test` covers the rule for your own account losing `SUPER_ADMIN`,
      your own account keeping it, somebody else's account losing it, and your own
      account with something else changed. On screen, unticking `SUPER_ADMIN` on your
      own account shows the message under the role group before the button is pressed,
      and doing the same to another Super Admin's account shows nothing and saves.

- [x] **Step 6 - Locking and unlocking** - the Zugang card, the `PATCH` carrying
      `ist_aktiv` alone, a confirmation dialog for locking following
      `liste/LoeschenDialog.tsx`, no dialog for unlocking, and the sentence in place of
      the button on your own account.
      *Done when:* locking an account, then that account is refused at sign-in with the
      backend's own wording, and the list shows its "Gesperrt" badge without a reload.
      Unlocking lets it sign in again. Cancelling the dialog changes nothing. On your own
      account there is no button, and the sentence in its place says another Super Admin
      has to do it. The card states the current status in words, so the action and the
      state are never read from the button alone.

- [x] **Step 7 - A new password** - the Passwort card, one field with the show and hide
      toggle reusing `Kontofeld`, `setzeKontoPasswort` in `api.ts`, the mutation, and the
      panel afterwards with its four statements.
      *Done when:* a new password lets that account sign in and the old one does not. The
      panel names the address, shows the password so it can be copied, says the person
      has to be told it and by what sort of channel, says the existing session can last
      up to eight hours and that locking is what takes effect at once, and says only an
      administrator can set another. A password of eleven characters is refused under the
      field before any request is made. Leaving the page loses the password rather than
      showing it again, and the field is empty when the page is returned to.

- [x] **Step 8 - Browser evidence** - `e2e/konto-aendern.spec.ts` beside the existing
      specs, using `e2e/konten.ts` and its skip-with-a-sentence arrangement, plus
      screenshots in light and dark.
      *Done when:* `npm run e2e` passes with the accounts configured and skips with the
      usual sentence without them. The spec creates its own throwaway account with a
      random address so it can run twice and never touches the three accounts the other
      specs sign in with, then changes its address, adds a role, locks it, unlocks it and
      sets a new password, checking the list afterwards each time. It also covers the
      not-found address, a Reviewer being refused, and the message that appears when
      `SUPER_ADMIN` is unticked on the administrator's own account. Every control is
      found by its accessible role and name. Screenshots show the three cards and the
      password panel in both themes with nothing cut off.

- [x] **Step 9 - The diagrams** - `FRONTEND_ARCHITECTURE_DIAGRAM.puml` and its layered
      view gain the `verwaltung/benutzer/` package they are missing, with this feature's
      files in it, and `routes.tsx`'s note gains the administration addresses. Not
      optional: the standing instruction is that a diagram is part of the diff that
      changes what it describes.
      *Done when:* both diagrams still render, every file they name exists, and the
      folder map lists `verwaltung/benutzer/` with its one-line job the same way it lists
      every other folder under `frontend/src/`.

## Added while completing, after the spec was written

Two things the spec did not ask for, both requested on 2026-09-28 while the branch was
being closed out, and both recorded here rather than left to be found in the diff.

**The way back is a breadcrumb, not a button.** "Zur Benutzerliste" sat in the save row
beside "Aenderungen speichern", where it read as a third action of equal weight. Leaving
the page is navigation rather than something this screen does to the account, so it moved
to a breadcrumb above the heading: `Benutzerverwaltung > Konto aendern`. The crumb names
this page's kind rather than the address, because the heading directly below is already
the address.

It reuses the crumb the reviewer's screen has had since feature 11e, and those two classes
moved from `protokoll/protokoll.css` to `components/shell.css` on the way, since they
belong with `page__head` rather than to either feature. The crumb sits in a named `nav`
landmark, which is both correct for a breadcrumb and necessary: the header carries a
"Benutzerverwaltung" link to the same place, so without the landmark the two links cannot
be told apart by name, by a screen reader or by a test.

The not-found and no-permission panels keep their own button. Those are dead ends, where a
button is the right offer.

**The account list gained a status filter**, `Alle`, `Nur aktive`, `Nur gesperrte`, beside
the search box. This is 16b's screen rather than this one, and it is here because an
account is never deleted in this application, only locked: the locked ones accumulate for
as long as the installation runs, and "somebody cannot sign in, is it their account or
their password" is the question an administrator actually arrives with. On the development
database it already reads 9 of 125.

It filters in the browser like the search box does, for the reason 16a gave when its
endpoint took no parameters: the whole list is in hand and accounts are tens, not
unbounded. `gefilterteKonten` now takes both dimensions, because how many rows are showing
is one question and the count beside the box answers it; two functions applied in turn
would let the page ask it of one filter and report the other. The count and the empty state
both moved off "something was typed" and onto "something is narrowing the list", and the
reset button clears both, since clearing only the term while a status still hid every row
would look like the button had not worked.

Three small structural changes came with it: `Trefferzahl` is its own component, because a
count owned by one of the two things it reports on is how it comes to report only that one;
`Suchfeld` is now just the field; and the row's stylesheet hook is `benutzer__filter`
rather than `benutzer__suche`.

## Files / areas

| File | Why |
|---|---|
| `frontend/src/api/client.ts` | `PATCH` added to the method union |
| `frontend/src/auth/startseite.ts` | `benutzerPfad(id)`, beside `BENUTZER_NEU` |
| `frontend/src/routes.tsx` | The `verwaltung/benutzer/:id` route |
| `frontend/src/verwaltung/benutzer/BenutzerTabelle.tsx` | The action column and its header |
| `frontend/src/verwaltung/benutzer/BenutzerZeile.tsx` | The "Aendern" link, replacing the comment that promised it |
| `frontend/src/verwaltung/benutzer/abfragen.ts` | `kontoAbfrage(id)` and its key |
| `frontend/src/verwaltung/benutzer/api.ts` | `holeKonto`, `aendereKonto`, `setzeKontoPasswort`, and the two request types |
| `frontend/src/verwaltung/benutzer/aendern.ts` | New. The schema, `formularAusKonto`, `kontoAenderung`, `selbstschutz` |
| `frontend/src/verwaltung/benutzer/aendern.test.ts` | New. Their tests |
| `frontend/src/verwaltung/benutzer/KontoAendernSeite.tsx` | New. The page and its load states |
| `frontend/src/verwaltung/benutzer/Angabenkarte.tsx` | New. The fields card |
| `frontend/src/verwaltung/benutzer/Zugangskarte.tsx` | New. Locking and unlocking |
| `frontend/src/verwaltung/benutzer/Passwortkarte.tsx` | New. The new password and its panel |
| `frontend/src/verwaltung/benutzer/Regionsfeld.tsx` | New. The region field, shared with the create screen rather than written twice |
| `frontend/src/verwaltung/benutzer/useFeldmeldung.ts` | New. One place that turns a schema message key into German, shared by all three account forms |
| `frontend/src/verwaltung/benutzer/KeinKonto.tsx` | New. The not-found panel |
| `frontend/src/verwaltung/benutzer/useKontoAendern.ts` | New. The mutations and what each invalidates |
| `frontend/src/verwaltung/benutzer/Kontofeld.tsx` | Made generic over the form it belongs to, since the edit form and the password card are different shapes from the create form |
| `frontend/src/api/fehler.ts` | `KONTO_NICHT_GEFUNDEN`, which this page branches on |
| `frontend/src/verwaltung/benutzer/Ladefehler.tsx` | An optional title, so one account does not report that "die Konten" could not be loaded |
| `frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx`, `Rollenauswahl.tsx`, `Zugangsdaten.tsx`, `eingabe.ts` | The shared field labels moved out of `benutzerverwaltung.anlegen.*`, and the region field and message helper taken from here rather than copied |
| `frontend/src/verwaltung/benutzer/kontoaendern.css` | New, if the create screen's stylesheet does not already carry what is needed |
| `frontend/src/i18n/locales/de.json` | Every string on the screen |
| `frontend/e2e/konto-aendern.spec.ts` | New. Browser evidence |
| `blueprint/history/flow_diagrams/FRONTEND_ARCHITECTURE_DIAGRAM.puml` | The missing `verwaltung/` package and this route |
| `blueprint/history/flow_diagrams/FRONTEND_ARCHITECTURE_DIAGRAM_LAYERED_VIEW.puml` | The same code in the layered view |

**No backend file is in that table, and that is the test of this spec.** If a step needs
one, stop and raise it rather than adding it.

**Two things in that table are 16c's files rather than this feature's**, and both were
found by the branch review rather than planned here. The shared field labels sat under
`benutzerverwaltung.anlegen.*` while both screens read them, so an edit screen would have
been showing labels filed under "creating an account"; and the region field and the
message helper existed once each and were about to exist twice. Both are the kind of
small repair `ai-interaction.md` says rides on the current branch. No confirmation dialog
of this feature's own was needed in the end: `components/BestaetigungsDialog` already
does exactly this job for the protocol list and the attachments, so locking reuses it.

## Data / contracts

**No schema change and no new endpoint.** Everything here is 16a's, unchanged.

**`KontoAendernAnfrage`, mirrored in the browser.** The backend model sets
`extra="forbid"`, so the TypeScript type is written field for field rather than loosely,
the same way `KontoAnlegenAnfrage` already is: a misspelled name is then a build error
here instead of a refusal from the server.

```ts
export interface KontoAendernAnfrage {
  email?: string
  rollen?: Rolle[]
  /** Sent as null to clear the region. Absent means leave it alone. */
  regierungspraesidium?: number | null
  locale?: Locale
  ist_aktiv?: boolean
}
```

**Absent and null mean different things on exactly one field**, and this is the screen
16a wrote that distinction for. `regierungspraesidium` absent leaves the region as it
is; `regierungspraesidium: null` clears it. On the other four, null is refused by the
server, so a field is either present with a value or not present at all. A type using
`| null` on all five would be a type that can express a request the API rejects.

**`PasswortAnfrage`** is `{ passwort: string }`, and the answer is the account, never
the password.

**The error codes are published contracts**, listed in 16a's spec and in the table
above. `fehlerfelder.ts` already maps eight of them to the field they belong under and
is reused as it stands.

## Testing

`npm test` (vitest, from `frontend/`) and `npm run e2e` for the browser evidence. No
backend test, because no backend code changes.

**The logic that must have a test**, all of it in `aendern.ts` and all of it plain
functions over values, testable without a browser:

- `formularAusKonto`: an account with a region, without one, and with several roles.
- `kontoAenderung`: every row of the coupling table above, nothing-changed, each
  single-field change, and that `ist_aktiv` never appears in it.
- `selbstschutz`: your own account losing `SUPER_ADMIN`, keeping it, somebody else's
  losing it, and your own with something else changed.
- The Zod schema: an empty address, an address with no `@`, an empty role list.

**What is not unit tested:** the components and the page's load states. Those ride on
browser evidence and the build, exactly as `coding-standards.md` says.

**Browser evidence is the gate for the screen itself**, and the standard set on
2026-09-18 applies: every control is addressed by its accessible role and name, so a
selector that cannot find "the button named Konto sperren" is a control a screen reader
cannot announce either. A screenshot is taken as well, because feature 12b shipped two
dropdowns that drew as empty boxes and every test passed.

**One thing the e2e spec must not do:** change any of the three accounts the other specs
sign in with. It creates its own account with a random address and changes that. A spec
that renamed `E2E_EMAIL_EINREICHER` would break every other suite and the failure would
look like something else entirely.

## Notes for the AI

- **No backend change.** Named twice above on purpose. 16a built all of it.
- **Reuse 16c's components rather than copying them.** `Kontofeld`, `Rollenauswahl`,
  `KeineBerechtigung`, `Ladefehler`, `feldFuerFehler` and `Zugangsdaten` all exist. If
  one needs widening, widen it; a second copy of a field is how two screens come to
  disagree about a label association, which is the mistake `AnmeldungSeite` already
  records having made.
- **Use MUI wherever MUI has a component**, including the dialog and the table cell. A
  theme change goes in `muiTheme.ts`, not into a per-instance `sx` colour.
- **The tokens in `theme.css` outrank MUI's defaults.** No hard-coded colour, and both
  themes checked.
- **Every refusal names the thing, says why in ordinary words, and says what to do
  instead.** The standard set on 2026-09-06. The backend's sentences already do it, so
  show them rather than rewording them; the browser's own messages have to meet the same
  bar.
- **The password never leaves component state.** Not `localStorage`, not the query cache,
  not the address bar, not a log. Leaving the page loses it, which is correct.
- **Domain terms stay German.** `kontoAenderung`, `sperren`, `entsperren`,
  `selbstschutz`. Ordinary programming vocabulary stays English.
- **Route paths are German**, and the id is a path segment, not a query parameter.
- **Accessibility is an acceptance criterion, not a later pass.** Label above the field,
  `FormLabel` inside a `FormControl` and never `InputLabel`, the dialog's focus trapped
  and its heading named, every message tied to its field with `aria-describedby`, and
  visible focus in both themes.
- **The diagrams are part of the diff.** Step 9 is not optional and not follow-up work.
- **No em dashes, en dashes or ellipsis characters** in code, comments, strings or commit
  messages.
