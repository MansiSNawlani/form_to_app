# Feature: Die Konten-Endpunkte

**From build-plan:** feature 16a
**Status:** built, all seven steps done, walked through against the running backend

## Goal

Let a signed-in Super Admin do to an account everything that today needs shell access on
the server, and one thing that has never been possible at all: change an account that
already exists.

Feature 2a built the command line because there was no other way to make the first Super
Admin, and that reason still holds for the first one. It does not hold for the ninetieth.
Every account after the first is created by somebody who has no business having a terminal
open on the production database, and today a mistyped email address produces an account
that can never be signed in to and can never be removed, because the command line can
create, list, lock and unlock an account and nothing else.

Backend only. Features 16b, 16c and 16d put screens on top of it.

## Design reference

None. Nothing in this sub-feature appears on a screen.

## Who may call

`SUPER_ADMIN`, and nobody else, on every route here.

Not `FFS_ROLLEN`. A Data Steward corrects survey data and a Reviewer decides on protocols;
neither job involves handing somebody else a role. `project-overview.md` gives account
management to the Super Admin alone and this is the one place that has to be read
narrowly.

Everybody else is refused with 403 rather than with an empty list, for the reason 12a
already gives: the refusal is about the caller, not about the data, and an empty list would
be a different and untrue statement.

A `REGIERUNGSPRAESIDIUM` account is refused like any other. It is read-only over its own
region by design and feature 13 is where it gets a view; it never gets one here.

## The addresses

A router of its own at `app/api/benutzer.py`, mounted at `/api/v1/benutzer`.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/benutzer` | Every account, ordered by email |
| `POST` | `/api/v1/benutzer` | Create one |
| `GET` | `/api/v1/benutzer/{id}` | One account |
| `PATCH` | `/api/v1/benutzer/{id}` | Change email, roles, region, language, locked state |
| `PUT` | `/api/v1/benutzer/{id}/passwort` | Set a new password |

**By id, not by email.** The command line works by email because a person typing a command
knows the address and not the UUID. A screen has the account in its hand, and the address
is the very thing 16d lets somebody change, so identifying an account by the field being
edited would make a rename look like a delete followed by a create.

**Why the locked state is part of `PATCH` and the password is not.** Locking and
role-changing share one safety rule (below), so putting both through one route means the
rule is checked in one place instead of two that can drift. The password is separate for a
different reason: it is the one value in this feature that must never be returned, never be
logged and never appear in a validation error echoing the request back, and keeping it out
of the body that carries five ordinary fields is what makes that easy to hold true.

**No paging, and no search parameter.** The list returns every account. That is the
opposite of what 12a decided for protocols, deliberately: protocols grow without bound and
accounts do not. FFS staff plus the external consultants and associations who file
protocols is a list of tens, maybe low hundreds. 16b filters it in the browser. If the
account list ever passes a few hundred rows this is the decision to revisit, and it is a
parameter added to one endpoint rather than a rewrite.

## The safety rule

**No single change may leave the application without an active Super Admin.**

Without it, one wrong click empties the only role that can hand roles out, and the way back
is a terminal on the production server. That is exactly the dependency this whole feature
exists to remove, so reintroducing it as a failure mode would be a poor trade.

It is one rule covering three ways to break it, which is why it lives in one function
rather than being restated per route:

| The change | Refused when |
|---|---|
| Locking an account | It is the last active Super Admin |
| Taking `SUPER_ADMIN` off an account | It is the last active Super Admin |
| Both at once, in one `PATCH` | Same |

Stated as one condition: after the change, at least one active `SUPER_ADMIN` account must
exist.

**A second, narrower rule: you cannot take your own access away.** A Super Admin may not
lock their own account and may not remove `SUPER_ADMIN` from it, even when three other
Super Admins exist. Both sign the person out of the screen they are standing on, with no
way back except asking somebody else, and neither is ever what somebody meant to do.

One error type for both, not two, because `app/benutzer/fehler.py` sets the standard that
an error exists when it has a different way out, and these have the same one: another Super
Admin has to do it for you. Everything else about your own account stays editable, a
handover is still possible the moment a second Super Admin exists, and 16d confirms it on
screen.

**The rule applies in the service layer, so the command line gets it too.** `setze_aktiv`
is what `befischung benutzer deaktivieren` calls, so from this step that command refuses to
lock the last Super Admin as well, and it needs a message saying so. The escape hatch stays
open either way: `befischung benutzer anlegen --rolle SUPER_ADMIN` still works and is the
documented recovery.

**One limit, named rather than hidden.** Two Super Admins locking each other at the same
instant could both pass the count and both commit, leaving zero. It needs two
administrators acting inside the same few milliseconds, the damage is recoverable at the
command line, and the alternative is a cross-row constraint Postgres cannot express without
a trigger. Accepted knowingly. If it ever happens, the fix is to count inside a
serializable transaction, not to spread the check further.

## What a password reset does not do

Setting a new password does not end the account's existing sessions. The session token is
stateless and holds the account id, so a token already issued stays valid until it expires,
up to eight hours.

That matters most in the case a reset is for: somebody else may have the password. The
answer today is to lock the account, which `aktueller_benutzer` honours on the very next
request because it loads the row every time. 16d's wording has to say that, so the person
resetting a password knows locking is the part that takes effect at once.

Building real token revocation is not this feature's job. It needs somewhere to store what
has been revoked, and it would change every request in the application.

## In scope

**The rules**, as plain functions in `app/benutzer/regeln.py`, no database and no HTTP:

- an active Super Admin survives the change
- nobody takes their own access away

**The service**, in `app/benutzer/dienst.py`:

- `finde_nach_id`
- a count of the active Super Admins other than a given account
- `aendere_benutzer`: email, roles, region, language and locked state, any subset
- `setze_passwort`
- `setze_aktiv` gains the safety rule, and the command line gains the message for it

**The endpoints**, five of them, Super Admin only, with the shapes to match.

**The refusals**, as lines in `app/api/fehler_http.py`, each naming the thing, saying why
in ordinary words and ending somewhere the reader can act.

## Out of scope

- **Any screen.** 16b, 16c and 16d.
- **Deleting an account.** Locking is the model's answer and the reason is in
  `app/benutzer/dienst.py`: a deleted account takes the owner of every protocol it filed
  with it.
- **Somebody changing their own password without an administrator.** Self-service is a
  different feature with a different rule set, since it has to ask for the current password
  first. Today an administrator resets it, which is what the login page's own error message
  already tells people to ask for.
- **Forcing a password change at next sign-in.** It needs a column on `users` and a gate in
  front of every route. Worth having one day, not worth a migration here.
- **Ending sessions on a password reset.** Named above.
- **Recording who changed what.** That is feature 15, the audit trail, and this feature
  deliberately does not build a partial one. The build-plan note of 2026-09-23 records that
  15 now lands after this, and that a role change made in between is not recorded anywhere.
- **Sending the new account an email.** Feature 14. Until then the administrator tells the
  person their password, which is what 16c's wording has to make obvious.
- **A migration.** Nothing in this sub-feature changes the schema. `users` already holds
  every column involved.

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

- [x] **Step 1 - The two new rules** - `LetzterSuperAdmin` and `SelbstEntzugUnzulaessig` in
      `app/benutzer/fehler.py`, and two plain functions in `app/benutzer/regeln.py` that
      raise them. No database, no HTTP, values in and nothing out.
      *Done when:* `pytest` covers both, including the boundary that matters. Removing the
      role from an account when exactly one other active Super Admin exists is allowed and
      when none exists is refused, and locking an account that is not a Super Admin at all
      is something the rule has nothing to say about.

- [x] **Step 2 - The guard on what already exists** - a service function counting the
      active Super Admins other than one account, `finde_nach_id`, `setze_aktiv` calling
      the rule before it writes, and the command line's `deaktivieren` gaining the message
      for the new refusal.
      *Done when:* `pytest` shows `setze_aktiv` refusing to lock the last active Super
      Admin and allowing it once a second one exists, and
      `befischung benutzer deaktivieren` on the only Super Admin prints a refusal that says
      what to do instead rather than a traceback.

- [x] **Step 3 - Changing an account, in the service** - `aendere_benutzer` taking any
      subset of email, roles, region, language and locked state, reusing
      `normalisiere_email`, `normalisiere_rollen` and `pruefe_regierungspraesidium` rather
      than restating them, and `setze_passwort` reusing `hashe_passwort`.
      *Done when:* `pytest` shows a role change, an email change that keeps the account's
      id and therefore its protocols, a duplicate email refused with
      `EmailBereitsVergeben`, a region cleared when the regional role is removed in the
      same call, a region left over from a removed role refused, both safety rules firing
      through this path as well, and a password set whose hash verifies and differs from
      the old one.

- [x] **Step 4 - The shapes and the refusals** - `KontoAnlegenAnfrage`,
      `KontoAendernAnfrage` and `PasswortAnfrage` in `app/api/schemas.py`, `created_at`
      added to `BenutzerAntwort` and to `frontend/src/api/typen.ts`, and a line in
      `app/api/fehler_http.py`'s `UEBERSETZUNG` for every account error these routes can
      now raise.
      *Done when:* `pytest` shows `KontoAendernAnfrage` telling "field absent" apart from
      "field set to null" for `regierungspraesidium`, and every new error producing its
      documented code and status rather than falling through to 500.

- [x] **Step 5 - Reading accounts** - the router, mounted in `app/main.py`, with
      `GET /api/v1/benutzer` and `GET /api/v1/benutzer/{id}`.
      *Done when:* signed in as a Super Admin both answer 200 with no `password_hash`
      anywhere in the body, a `REVIEWER` and a `SUBMITTER` each get 403 from both, an
      unauthenticated caller gets 401, an account that does not exist gets 404, and
      `/api/v1/docs` lists the routes.

- [x] **Step 6 - Creating an account** - `POST /api/v1/benutzer`.
      *Done when:* a created account can sign in with the password given, 201 comes back
      with the account and no hash, a duplicate email is refused with `EMAIL_VERGEBEN` and
      409, a `REGIERUNGSPRAESIDIUM` role with no number and a number with no regional role
      are each refused with their own code, a password under twelve characters is refused,
      and a `REVIEWER` gets 403.

- [x] **Step 7 - Changing an account and its password** - `PATCH /api/v1/benutzer/{id}` and
      `PUT /api/v1/benutzer/{id}/passwort`.
      *Done when:* a role change takes effect on the target account's very next request, a
      locked account is refused at sign-in, the last active Super Admin cannot be locked or
      demoted through either route, a Super Admin cannot lock or demote themselves, an
      empty `PATCH` body changes nothing and answers 200, a password reset lets the account
      sign in with the new password and not the old one, and a `REVIEWER` gets 403 from
      both.

## Files / areas

| File | Why |
|---|---|
| `backend/app/benutzer/fehler.py` | The two new refusals |
| `backend/app/benutzer/regeln.py` | The two new rules, as plain functions |
| `backend/app/benutzer/regeln_test.py` | Their tests |
| `backend/app/benutzer/dienst.py` | `finde_nach_id`, `aendere_benutzer`, `setze_passwort`, the Super Admin count, the guard on `setze_aktiv` |
| `backend/app/benutzer/dienst_test.py` | Their tests |
| `backend/app/cli.py` | The message for the new refusal in `deaktivieren` |
| `backend/app/cli_test.py` | That the message names a way out |
| `backend/app/api/schemas.py` | The three request shapes, `created_at` on `BenutzerAntwort` |
| `backend/app/api/schemas_test.py` | The partial-update semantics |
| `backend/app/api/fehler_http.py` | A `UEBERSETZUNG` line per new refusal |
| `backend/app/api/fehler_http_test.py` | That each maps rather than falling to 500 |
| `backend/app/api/benutzer.py` | New. The five routes |
| `backend/app/api/benutzer_test.py` | New. Route and permission tests |
| `backend/app/main.py` | Mount the router |
| `frontend/src/api/typen.ts` | `created_at` on `BenutzerAntwort`, so the two halves stay identical |

## Data / contracts

**No schema change.** `users` already has every column.

**`BenutzerAntwort` gains `created_at`.** Load-bearing: it is the same shape `/ich` returns
and `frontend/src/api/typen.ts` mirrors, so both move together.

`updated_at` deliberately stays out. `_erneuere_hash_falls_noetig` writes to the row on any
sign-in where the hashing settings have moved on, so the column is not a "last edited" date
and a screen labelling it one would be telling people something untrue.

**`KontoAendernAnfrage` is a partial update, and the distinction is load-bearing.**
`regierungspraesidium` is genuinely nullable, so "not sent" and "sent as null" mean
different things: leave it alone, and clear it. Pydantic's `model_fields_set`, or
`model_dump(exclude_unset=True)`, is what tells them apart, and a plain `| None = None`
default cannot. 16d depends on this, because clearing the region is exactly what happens
when the regional role is taken off an account.

**The error codes**, which 16b, 16c and 16d branch on and which are therefore published
contracts rather than names a refactor may change:

| Code | Status | When |
|---|---|---|
| `EMAIL_UNGUELTIG` | 422 | Not a usable address |
| `EMAIL_VERGEBEN` | 409 | Another account already has it |
| `ROLLEN_LEER` | 422 | No roles given |
| `REGIERUNGSPRAESIDIUM_FEHLT` | 422 | Regional role without a number |
| `REGIERUNGSPRAESIDIUM_UNZULAESSIG` | 422 | Number without the regional role |
| `REGIERUNGSPRAESIDIUM_UNBEKANNT` | 422 | Not 1 to 4 |
| `PASSWORT_ZU_KURZ` | 422 | Under twelve characters |
| `PASSWORT_ZU_LANG` | 422 | Over 1024 |
| `KONTO_NICHT_GEFUNDEN` | 404 | No account with that id |
| `LETZTER_SUPER_ADMIN` | 409 | The change would leave none active |
| `SELBSTENTZUG_UNZULAESSIG` | 409 | Taking your own access away |

**Mapping `BenutzerNichtGefunden` to 404 needs the comment at the top of `fehler_http.py`
updated, not ignored.** That comment warns, correctly, that a 404 would tell an
unauthenticated caller whether an address has an account here, which is what `melde_an`
goes to some trouble to keep unknowable. It is safe now for a reason worth writing down
rather than assuming: every route that can raise it is behind `SUPER_ADMIN`, and the one
unauthenticated route that looks an account up raises `AnmeldungFehlgeschlagen` instead,
which carries no email on purpose. The comment should say that, so the next person adding
an unauthenticated lookup meets the constraint rather than rediscovering it.

## Testing

`pytest`, from `backend/`. The gate is on: this sub-feature is nothing but logic where a
wrong answer is possible, so every step ships tests in the same diff.

**The logic that must have a test:**

- both safety rules, as plain functions, including the boundaries
- `aendere_benutzer` for each field, and for the combinations that interact, such as
  removing the regional role and its number in one call
- the partial-update distinction between absent and null
- every new error reaching its documented code and status

**The permission tests are not optional.** `coding-standards.md` says so, and this is the
feature where that standard bites hardest, since these routes hand out roles. There must be
a test per route proving a `REVIEWER`, a `SUBMITTER` and a `REGIERUNGSPRAESIDIUM` account
are each refused with 403, and a test proving an unauthenticated caller gets 401 rather
than 403.

**One test worth writing even though it looks redundant:** a role taken away takes effect on
the target's very next request. `aktueller_benutzer` loads the row on every request
specifically so that it does, and that is the property this whole feature leans on. A test
holds it if somebody ever moves the roles into the token for speed.

**Browser evidence:** none for this sub-feature. Nothing here draws. `/api/v1/docs` showing
the five routes, plus a walkthrough with `curl` or the docs page, is the evidence for steps
5 to 7, and `/try` writes that path up.

## Notes for the AI

- **Reuse the rules that exist.** `normalisiere_email`, `normalisiere_rollen` and
  `pruefe_regierungspraesidium` already say what a valid account looks like, and the check
  constraints on `users` already guarantee it. Restating any of them in the router or in a
  Pydantic validator would create a second opinion, and one of the two would eventually be
  wrong. The router parses, authorises, delegates and returns; the rules stay where they
  are.
- **The exceptions carry facts, never wording.** `app/benutzer/fehler.py` says so and
  feature 17 depends on it. German sentences live in `cli.py` and in `fehler_http.py`'s
  table, nowhere else.
- **Every refusal names the thing, says why in ordinary words, and says what to do
  instead.** The standard set on 2026-09-06, and `fehler_http.py` already has a test that
  holds the account messages to it.
- **The password hash never leaves the backend.** Not in a response, not in a log, not in a
  `repr`. `User.__repr__` is already written to keep it out and `BenutzerAntwort` already
  omits it; nothing added here may undo either.
- **Domain terms stay German.** `aendere_benutzer`, `sperre`, `passwort`. Ordinary
  programming vocabulary stays English.
- **The service commits**, as the module docstring in `dienst.py` explains. Keep that
  rather than moving the commit out to the router for one function.
- **No em dashes, en dashes or ellipsis characters** in code, comments or commit messages.
