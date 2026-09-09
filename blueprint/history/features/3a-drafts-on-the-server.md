# Feature: 3a. Drafts on the server

**From build-plan:** feature 3a, the first of four sub-features under item 3
**Status:** complete

## Goal

Give a draft protocol a home on the server instead of in one browser.

Everything built so far lives in the browser it was typed into. Fill in a
protocol on a laptop and it is on that laptop: a different machine shows
nothing, clearing site data destroys it, and nobody else can ever see it. This
sub-feature builds the backend half of the fix: the `submissions` table, the
endpoints that create, list, read, save and delete a draft, and the ownership
rule that keeps one surveyor's draft out of another's hands.

Nothing on screen changes here. 3b swaps the browser store for these endpoints,
3c builds the list page, 3d does the same for attachments. This one is backend
only, and its evidence is `pytest` and the API docs rather than a screenshot.

## In scope

- A `submissions` table holding the draft envelope and the answers document,
  with its Alembic migration.
- Five routes under `/api/v1/protokolle`: create, list, read, save answers,
  delete.
- Ownership enforced on every one of them, with the permission tests
  `coding-standards.md` makes non-optional.
- A shape check on the answers document on write, driven by the extracted form
  definition, so nothing unknown can be stored.
- The form definition seed reaching the backend container, which it does not
  today.

## Out of scope

- **Anything on screen.** 3b and 3c.
- **Attachments.** 3d. The `attachments` table and file storage are not built
  here.
- **Submitting, reviewing, locking.** Feature 11. This sub-feature only ever
  writes the `DRAFT` status, even though the column can hold all seven.
- **The rest of the typed envelope**, meaning `probestrecke_id`, `person_id`,
  `bearbeiter_name`, `anlass`, `datum`, `uhrzeit`, `submitted_at` and
  `locked_at`. See Data and contracts for why they wait for feature 11.
- **The `Probestrecke`, `Person` and `Gewaesser` tables.** Feature 11 creates
  them, because that is where a validated submission first has real values to
  put in them.
- **The `FormVersion` table.** Feature 11 needs the stored rule definitions;
  this one needs a list of field names, which it reads from the seed file.
- **The form's own rules**, meaning sum-to-100, the hydrology suppression, the
  catch table rules, the Vorfluter chain and the coordinate bounds. Those are
  the gate on submitting, not on saving a draft. See Notes for the AI.
- **Importing drafts already sitting in somebody's browser.** There are no users
  yet, so there is nothing to import.

## Design reference

None. Nothing here is visible. `prototypes/meine-protokolle.html` is 3c's
reference, and the list endpoint built here is shaped to feed it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The form definition reaches the backend.** A module that reads
      `database/seed/form_version_20260609/felder.json` and exposes the set of
      legal answer paths, together with the one documented addition the app made
      that the PDF has no field for, `bearbeiter.ort`. The backend image cannot
      see that file today: its build context is `./backend`, so the seed sits
      outside it. The image is rebuilt to mirror the repository's own layout, so
      one relative path works both on a developer's machine and inside the
      container. *Done when:* `pytest` passes, including a test pinning the
      number of known paths and a handful of representative ones
      (`probestrecke.gewaesser.vorfluter5`, `arten.art26.0plus`,
      `bewirschaftung.fischereiausuebungsberechtigter` with its real umlaut);
      and `docker compose up -d --build` leaves `/api/v1/ready` answering 200.

- [x] **Step 2 - The answers document is checked on write.** A plain function
      taking the parsed document and returning what is wrong with it, holding no
      HTTP and no database, in the shape `app/benutzer/regeln.py` already uses.
      It enforces four things: the document is an object, every leaf sits at a
      known path, every leaf value is a string, and no value or document exceeds
      its size cap. Its typed error joins the table in `app/api/fehler_http.py`
      with a message naming the offending paths. *Done when:* `pytest` covers a
      valid document, an unknown path, a value that is not a string, an
      over-long value and an over-large document; and the refusal names the
      paths at fault without quoting their values back.

- [x] **Step 3 - The submissions table.** The `Submission` model and its
      migration: `id`, `owner_user_id`, `status`, `form_version`, `antworten`,
      `created_at`, `updated_at`, with a check constraint listing the seven
      statuses the way `rollen_bekannt` lists the six roles. The generated
      migration is read before it is kept, as `AGENTS.md` requires. *Done when:*
      `alembic upgrade head`, `alembic downgrade -1` and `alembic upgrade head`
      all run cleanly; `alembic check` reports no drift; `pytest` passes, since
      the suite migrates its own database and therefore exercises the migration.

- [x] **Step 4 - Creating and reading one draft.** `POST /api/v1/protokolle`
      creating an empty draft owned by the signed-in account, and
      `GET /api/v1/protokolle/{id}` returning one in full, with the service
      functions under them. The `form_version` written on create comes from the
      seed loaded in step 1, so there is one place that knows which version this
      is. *Done when:* `pytest` proves both routes; a permission test proves one
      submitter cannot read another submitter's draft and receives 404 rather
      than 403; and an unknown id also answers 404, so the two are
      indistinguishable from outside.

- [x] **Step 5 - The list.** `GET /api/v1/protokolle` returning the signed-in
      account's own drafts as summaries, newest first, with the five display
      values read out of the JSONB in the query rather than by loading each
      document. *Done when:* `pytest` proves the list holds only the caller's
      own drafts, is ordered by `updated_at` descending with `id` breaking a tie,
      carries the summary fields and not the answers document, and comes back
      empty rather than failing for an account with no drafts.

- [x] **Step 6 - Saving and deleting.** `PUT /api/v1/protokolle/{id}/antworten`
      replacing the document once step 2's check passes, and
      `DELETE /api/v1/protokolle/{id}` removing a draft. Both owner-only. The
      save carries the `version` it is based on and is refused with 409 if the
      draft has moved on since, which is what stops one open tab overwriting
      another's work. Deleting is refused once the status has left `DRAFT`.
      *Done when:* `pytest` proves a save round-trips and raises `version`, a
      refused document leaves the stored one untouched, a stale `version` is
      refused with 409 and changes nothing, `updated_at` moves on a save, a
      stranger can neither save nor delete, and deleting a non-draft is refused.

## Files / areas

**New**

- `backend/app/formular/felder.py` - loads the seed and exposes the known paths.
- `backend/app/protokolle/regeln.py` - the shape check, as a plain function.
- `backend/app/protokolle/fehler.py` - the typed errors this feature raises.
- `backend/app/protokolle/dienst.py` - create, read, list, save, delete, each
  scoped to an owner.
- `backend/app/models/protokoll.py` - the `Submission` model.
- `backend/app/api/protokolle.py` - the five routes, thin.
- `database/migrations/versions/<new>_submissions.py`
- Test files beside each of the above, as `coding-standards.md` places them.

**Changed**

- `backend/Dockerfile` and `docker-compose.yml` - the build context, so the
  image carries the seed.
- `backend/app/models/__init__.py` - the new model imported, or autogenerate
  will draft a migration dropping its table.
- `backend/app/api/schemas.py` - the request and response shapes.
- `backend/app/api/fehler_http.py` - the new refusals and their status codes.
- `backend/app/main.py` - the router included.
- `AGENTS.md` - only if a command changes.

## Data / contracts

### The `submissions` table

Load-bearing. Features 11, 12, 13 and 15 all build on this table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, primary key | Generated in Python, as `User.id` is |
| `owner_user_id` | uuid, foreign key to `users.id`, not null | Every query filters on it |
| `status` | text, not null, default `DRAFT` | Check constraint over the seven values |
| `form_version` | text, not null | `20260609`. Never migrated, per ADR 0004 |
| `antworten` | JSONB, not null, default `{}` | The whole answers document |
| `version` | integer, not null, default 1 | Raised by every save. See below |
| `created_at` | timestamptz, not null | |
| `updated_at` | timestamptz, not null | `onupdate`, so automatic saving moves it |

**`version` is what stops one tab quietly wiping another.** A save replaces the
whole answers document, so two tabs open on the same protocol are two copies
racing each other: the one that saves second overwrites everything the first put
in, with nothing on screen to say so. On a form filled in over several sittings
that is real lost work, and `anlagen/store.ts` already records that the same
protocol open twice is an ordinary thing here rather than an edge case.

So a save sends the `version` it was working from. If the stored version has
moved on, the save is refused with 409 and nothing changes. 3b decides what the
browser then says to the person; this sub-feature only makes the collision
visible instead of silent.

It is a column, which is the reason to add it now. Adding one later means
choosing a starting version for rows that already exist and a window where saves
are unguarded, and the whole cost today is one integer.

**The rest of the envelope waits for feature 11, deliberately.**
`project-overview.md` also lists `probestrecke_id`, `person_id`,
`bearbeiter_name`, `anlass`, `datum`, `uhrzeit`, `submitted_at` and `locked_at`
on this entity. Every one of them describes a submission that has been filled in
and checked. A draft has none of them: `probestrecke_id` would have to point at
a `Probestrecke` row with no coordinates and no water type, which is a row the
model says cannot exist. Adding the columns now as nullable, with nothing ever
writing them, would be a schema making a promise it does not keep. Feature 11
adds them in its own migration, next to the tables they point at and the
constraint that makes them required the moment a submission leaves `DRAFT`.

The cost, accepted knowingly: feature 11 writes a second migration against this
table. That is one extra migration against a table with no production rows in
it, which is the cheap half of the trade.

### The routes

Paths are German, following the decision of 2026-08-24 that already gives us
`/api/v1/anmeldung` and the page route `/protokolle/:id`. The table is
`submissions` because that is the entity's name in `project-overview.md` and in
`CONTEXT.md`; the route is `protokolle` because that is what the person using it
is working on, and because a reader following the page route to the API should
find the same word.

| Method and path | Does | Answers |
|---|---|---|
| `POST /api/v1/protokolle` | Creates an empty draft for the signed-in account | 201 with the full draft |
| `GET /api/v1/protokolle` | That account's own drafts, newest first | 200 with a list of summaries |
| `GET /api/v1/protokolle/{id}` | One draft in full | 200, or 404 |
| `PUT /api/v1/protokolle/{id}/antworten` | Replaces the answers document | 200 with the envelope, or 422, or 409 |
| `DELETE /api/v1/protokolle/{id}` | Removes a draft | 204, or 404, or 409 |

The save's 409 is a stale `version`; the delete's is a draft that has already
been submitted. The two are different refusals with different messages, and
`fehler_http.py` keeps them apart.

**A draft that is not yours answers 404, not 403.** A 403 confirms the id
exists, which is a fact about somebody else's work that a stranger has no
business learning. This follows the reasoning already written into
`fehler_http.py` about `BenutzerNichtGefunden`.

**The list returns summaries, not documents.** Twenty drafts each carrying 338
answers is a large response for drawing six table rows. The summary carries what
`prototypes/meine-protokolle.html` prints and nothing else:

```
id, status, form_version, version, created_at, updated_at,
gewaessername, ortsangabe, laenge, datum, anlass
```

The last five are read straight out of the JSONB in the query rather than by
loading each document and picking through it in Python, so the full document
never crosses the wire for a list. They are read, not stored: feature 12's
review queue is where they become real indexed columns, because that is the
first screen filtering across every account's submissions rather than one
person's handful.

### Known limits, accepted

- **No cap on how many drafts an account may create.** A surveyor has a handful.
  The failure worth worrying about is a loop in the browser leaving empty drafts
  behind, and the answer to that is the delete built in step 6 plus a careful
  loader in 3b, not a number on the server.
- **The list is not paginated.** It is one person's own drafts, filtered by
  owner. Feature 12's queue reads across every account and is where paging
  becomes real.
- **No index beyond the primary key and the owner column.** At this size nothing
  else pays for itself, and feature 12 is where the queue's own access patterns
  decide what to add.

### The shape check

ADR 0003 requires the JSON document to be schema-validated on write. For a
draft, that means its shape, not its rules:

- The top level is an object.
- Every leaf path appears in `felder.json`, plus the documented additions.
- Every leaf value is a string, matching the frontend's `Antworten` type, where
  every value is a string because a half-typed number is not a number.
- No single value is longer than its cap, and no document is larger than its
  cap. The caps exist so a request cannot be arbitrarily large before anything
  looks at it, the same reason `EMAIL_HOECHSTLAENGE` exists in `schemas.py`.

Unknown paths are refused rather than ignored. The allow-list comes from the
same seed the form was built from, so a field the frontend invented and the form
definition never had is a bug, and this is where it surfaces instead of sitting
silently in the database.

`bearbeiter.ort` is the one path the app has that the PDF does not, added in
feature 4b and recorded as question 1 in `docs/ffs-questions.md`. It is listed
explicitly in the code rather than waved through by a loose rule, so the list of
things we added on top of the legacy form stays readable.

## Testing

`pytest`, from `backend/`, is the gate. Every step here is logic-bearing, so
every step ships passing tests in the same diff. There is no UI in this
sub-feature, so there is no screenshot evidence to lean on.

What needs a test, by step:

| Step | Tests |
|---|---|
| 1 | The known-path set: its size, several representative paths, and that the additions list is exactly what the code documents |
| 2 | The shape check: a valid document, an unknown path, a non-string value, an over-long value, an over-large document, and an empty document, which is valid |
| 3 | The migration, exercised by the suite building its own database; plus `alembic check` reporting no drift |
| 4 | Create and read; an unknown id answers 404; **a submitter cannot read another submitter's draft, and gets the same 404** |
| 5 | The list holds only the caller's own; ordering, with a tie broken by `id`; the summary fields and not the document; an empty list for a new account |
| 6 | Save round-trips and raises `version`; a refused document changes nothing; a stale `version` is refused with 409 and changes nothing; `updated_at` moves; **a submitter cannot save or delete another submitter's draft**; a non-draft cannot be deleted |

The bold rows are the permission tests `coding-standards.md` calls non-optional.

Manual check, once step 6 is in: `docker compose up -d --build`, then the API
docs at http://localhost:8000/api/v1/docs, signed in as an account made with
`befischung benutzer anlegen`.

## Notes for the AI

- **Backend only.** Do not touch anything under `frontend/`. If a step seems to
  need a frontend change, that is a sign the step belongs to 3b.
- **A draft is incomplete by definition, and that is not an error.** Nothing
  here requires a field, refuses an empty document, or enforces a form rule. The
  rules in `frontend/src/protokoll/regeln/` gain their Pydantic halves in
  feature 11, on submit, where a complete document is a fair thing to demand.
  This leaves the "written twice" rule in `coding-standards.md` half-met for one
  more feature, which the build plan's own note already accepts.
- **Every query is filtered by `owner_user_id`.** Not checked after loading. A
  filter that is part of the query cannot be forgotten by a later route that
  copies the loading and not the check.
- **Routers stay thin.** Parse, authorise, delegate, return. The rules live in
  `app/protokolle/regeln.py` and the database work in
  `app/protokolle/dienst.py`, so both can be tested without an HTTP request,
  exactly as `app/benutzer/` is.
- **Refusals carry no user input back.** `fehler_http.py` exists because
  FastAPI's own validation response quotes the rejected value. A shape refusal
  names the paths that were wrong, never the values at them.
- **Use the existing dependencies.** `AngemeldeterBenutzer` from
  `app/api/abhaengigkeiten.py` is how a route learns who is calling. Do not read
  the cookie anywhere else.
- **A generated migration is a draft.** Read it before keeping it, as
  `AGENTS.md` says. Autogenerate does not see check constraints, gets server
  defaults wrong, and drafts a drop for any model it was not told about.
- **Every message names the thing, says why, and says what to do.** The standard
  set on 2026-09-06, and the reason `fehler_http.py` reads the way it does.
- **No em dashes anywhere**, per the Writing section of `coding-standards.md`.
