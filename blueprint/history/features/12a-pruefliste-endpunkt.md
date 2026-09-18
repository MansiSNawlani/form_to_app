# Feature: Die Pruefliste, der Endpunkt

**From build-plan:** feature 12a
**Status:** built, branch-reviewed on both axes, walked through against the running
backend, and merged.

## Goal

Give FFS staff one question they can ask the server: which protocols are waiting to be
worked on, narrowed to the ones they care about.

Every list in the application so far answers "what have **I** got". This is the first one
that reads across every account, and it is the screen a reviewer will live on. It is
backend only: the query, who may ask it, the filters, the order and the paging. Feature
12b puts a page on top of it.

It is also where the envelope columns feature 11b promoted finally earn their keep. Meine
Protokolle reads the water and the place out of the `antworten` JSON document, because a
draft has no Probestrecke behind it. A protocol in this queue always does, so this query
reads real indexed columns and joins to the real Gewaesser row. That was the stated reason
for building the relational envelope at 11b rather than here.

## Design reference

None. Nothing in this sub-feature appears on a screen.

The filter controls sketched in `prototypes/meine-protokolle.html` (the Suche box and the
Status, Jahr and Anlass dropdowns, lines 47 to 81) are what these parameters exist to
serve, and 12b builds them. `app/api/protokolle.py`'s list route already says in its own
docstring that those four belong to the review queue rather than to Meine Protokolle.

## What the Pruefliste is, and is not

**It lists protocols that have been handed in.** Every protocol whose status is not
`DRAFT`, whatever account filed it.

That is deliberately **not** the question `_sichtbar` in `app/protokolle/dienst.py`
answers. The two are easy to confuse and must not be merged:

| Question | Answered by | Includes the caller's own drafts |
|---|---|---|
| May this account look at this protocol? | `_sichtbar` | Yes |
| Is this protocol work waiting for FFS? | this feature | No |

A reviewer who is halfway through filling in a protocol of their own has not handed FFS any
work, so it does not belong in a work queue. Their own drafts stay on Meine Protokolle,
where they already are.

A reviewer's own **submitted** protocol does appear here. It is real work waiting for
somebody, and 11f already refuses that somebody the right to be them: the decision rail
shows "somebody else has to decide" when the reader filed it. Hiding the row instead would
mean a protocol nobody could see was waiting.

## Who may ask

`FFS_ROLLEN` from `app/protokolle/dienst.py`: `REVIEWER`, `DATA_STEWARD`, `SUPER_ADMIN`.
The same three that may already open a protocol they did not file, imported from that tuple
rather than retyped, so there is one answer to who FFS staff are.

Everybody else is refused with 403, **including a `REGIERUNGSPRAESIDIUM` account.** That
role is read-only over its own region and building it is feature 13. Letting it see
everything now and narrowing it later is a leak with a date on it, which is the reasoning
`FFS_ROLLEN` already carries and the reason a regional account is not in that tuple.

A 403 rather than an empty list, because the refusal is about the caller and not about the
data: an empty list would say "there is no work", which is a different and untrue
statement.

## The address

`GET /api/v1/pruefliste`, in its own router at `app/api/pruefliste.py`.

**Not** `GET /api/v1/protokolle/pruefliste`. A literal path segment sitting beside a UUID
path parameter is order-dependent: declared after `/{protokoll_id}`, FastAPI tries to read
"pruefliste" as a UUID and answers 422, and the only thing keeping it working is the order
two routes happen to be written in. It is also genuinely a different resource, a view
across protocols with its own paging envelope, rather than one protocol.

## In scope

**The query**

- Every protocol that is not a `DRAFT`, joined to its Probestrecke, its Gewaesser and the
  account that filed it, so a row carries the water, the place, the monitoring number and
  the region without a second request.
- The total count over the same filters, so the screen can draw a pager.

**The filters**

| Parameter | Shape | What it does |
|---|---|---|
| `status` | repeatable | Any of the given states. `DRAFT` is refused as a value with 422 |
| `anlass` | one code | The coded Anlass, e.g. `wrrl` |
| `jahr` | one year | The year of the Befischung, read from the `datum` column |
| `suche` | free text | Case-insensitive, over the Gewaesser name, the Ortsangabe and the Monitoringstrecken-Nr. |

`status` is repeatable because the screen's own default needs two of them at once
(`SUBMITTED` and `IN_REVIEW`, the protocols nobody has decided on). `anlass` and `jahr` are
single because the mockup gives each one dropdown. The asymmetry is the screen's needs, not
an oversight.

`DRAFT` is kept out by declaring the parameter over an enum narrower than `Status` rather
than by a hand-written check, so the refusal is FastAPI's own 422 and the API docs list the
six acceptable values instead of seven with one that always fails.

**The search box, in detail**

- Whitespace splits it into terms, and **every term must match at least one of the three
  columns.** Typing "Schussen Weissenau" finds the row whose water is Schussen and whose
  Ortsangabe is Weissenau. Requiring one term to match all three, or matching the whole
  string as typed, would find nothing and the box would look broken.
- `%` and `_` are escaped before the value reaches `ILIKE`. Unescaped, typing `50%` matches
  every protocol in the database, which reads as a search box that does not work.

**The order**

Four, chosen with `sortierung`:

| Value | Meaning |
|---|---|
| `eingereicht_alt` (default) | Longest wait first |
| `eingereicht_neu` | Most recently handed in first |
| `datum_neu` | The day of the Befischung, newest first |
| `gewaesser` | The water A to Z, then the Ortsangabe |

**The default is deliberately the oldest hand-in, not the newest.** This is a work queue,
and a queue whose default buries the protocol that has been waiting three weeks under this
morning's is a queue that grows a tail nobody sees. Meine Protokolle sorts the other way on
purpose, because that list answers "what was I just doing".

Every order is tie-broken by the protocol's id, for the reason `liste_protokolle` already
gives: two rows written in one transaction share a timestamp to the microsecond, and a test
asserting an order without a tie-break fails now and then for no reason anybody can
reproduce.

No NULL handling is needed on `submitted_at` or `datum`. The `umschlag_bei_abgabe` check
constraint guarantees both are present on any protocol that has left `DRAFT`, which is
every row this query can return.

**The paging**

- `seite`, 1-based, default 1. `pro_seite`, default 25, at most 100.
- The answer carries `zeilen`, `gesamt`, `seite`, `pro_seite` and `seiten`.
- `seiten` is never below 1, so an empty result reads "Seite 1 von 1" rather than
  "Seite 1 von 0".
- A page past the end answers an empty `zeilen` with the true `gesamt`, not a 404. The
  screen then says there is nothing here and the pager offers the way back.

**The tests**

- The value functions, without a database.
- The query against a real database: what it lists, what it never lists, each filter, each
  order, the paging and the count.
- The permission tests `coding-standards.md` makes non-optional: each of the three FFS roles
  gets through, a plain Submitter is refused, and a Regierungspraesidium account is refused.

## Out of scope

- **Searching by species.** Feature 12c, together with the JSONB index that keeps it fast.
  It is the one filter that is not a column comparison, which is exactly why it was split
  off.
- **Any screen.** Feature 12b. Nothing in `frontend/` is touched by this sub-feature.
- **Vorheriges and Naechstes**, and with them any notion of a protocol's neighbours. Feature
  12d. This feature only has to make them possible, which the Data section below states as a
  rule.
- **Regional scoping.** A `REGIERUNGSPRAESIDIUM` account is refused outright here. Feature 13
  gives it its own narrowed view.
- **Filtering by Bearbeiter, or by the account that filed it.** Both come back on every row,
  so the screen can print them, but neither is a filter yet. The mockup does not ask for one,
  and inventing filters is how a filter bar becomes unusable.
- **Any new index or migration.** See the notes below.
- **Any change to Meine Protokolle**, its endpoint, or `liste_protokolle`. The two lists
  answer different questions and stay two functions.
- **A checked-in `openapi.json`.** See the notes below.

## Notes, needing nothing from you

Two things worth knowing before the build. Neither is a decision waiting on you.

**No migration, and that is a considered answer rather than a gap.** Every column this query
joins on is already indexed: `probestrecke_id`, `gewaesser_id` and `owner_user_id` all carry
one. `status`, `datum` and `submitted_at` do not, so the database reads the submissions
table and sorts what it finds. At the size FFS works at, thousands of protocols rather than
millions, that is milliseconds, and an index would be a cost with no payer. What would
change the answer is the table passing roughly a hundred thousand rows, or the queue
becoming something a machine polls rather than something a person opens. Feature 12c brings
the one index this queue genuinely needs, over the JSON document.

**`coding-standards.md` asks for the generated OpenAPI document to be checked into version
control, and no such file exists in the repository.** That is true of every endpoint built so
far and is not something this feature introduces. Fixing it project-wide is a `/fix`, not a
thing to do quietly inside a feature branch.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Step 1 has nothing to open, and it is first because step 4 is built on its answers. From
step 3 onward every step is something you can try in the API docs at
http://localhost:8000/api/v1/docs.

- [x] **Step 1 - What a search box and a page number mean, as values** - one module,
      `app/protokolle/pruefliste/parameter.py`, over plain values, with no SQLAlchemy and no
      database in it. It escapes `%` and `_` in a search term, splits a search string into
      terms and drops the empty ones, clamps `seite` to at least 1 and `pro_seite` into 1 to
      100, turns a year into the first and last day of it, and works out how many pages a
      total makes at a given page size, never fewer than one.
      *Done when:* `pytest` from `backend/` covers a search for `50%` escaping to something
      that matches only a literal `50%`; a search of `"  Schussen   Weissenau  "` becoming two
      terms; an all-whitespace search becoming no terms at all, which is the same as no
      search; `seite=0` and `seite=-3` both landing on 1; `pro_seite=0` on 1 and
      `pro_seite=5000` on 100; the year 2026 becoming 2026-01-01 to 2026-12-31; and a total of
      0 making 1 page rather than 0. `ruff check .` and `mypy .` pass.

- [x] **Step 2 - The query: what the Pruefliste actually is** - a new package
      `app/protokolle/pruefliste/`, with `dienst.py` holding the `Pruefzeile` dataclass and
      `liste_pruefliste`. One statement joining `submissions` to `probestrecken`, `gewaesser`
      and `users`, filtered to `status != DRAFT`, ordered oldest hand-in first with the id as
      the tie-break, sliced by `seite` and `pro_seite`. A second statement counting the same
      set, because the pager needs a total and the count has to see the same filters the rows
      do.
      No filters and no choice of order yet. The joins to Probestrecke and Gewaesser are inner
      joins, and that is a statement rather than an oversight: `umschlag_bei_abgabe` guarantees
      a non-draft protocol has a Probestrecke, so an outer join would be pretending a row could
      arrive without a water and then quietly printing nothing for it.
      *Done when:* `pytest` proves, against a real database, that a reviewer's call returns a
      protocol filed by a different account; that no `DRAFT` appears, including the caller's
      own; that the caller's own `SUBMITTED` protocol does appear; that a row carries the
      Gewaesser name, the Ortsangabe, the Monitoringstrecken-Nr., the Regierungspraesidium, the
      Bearbeiter name and the filer's e-mail address; that the oldest hand-in comes first; and
      that `seite=2, pro_seite=2` over five protocols returns the third and fourth with
      `gesamt` still 5. `ruff check .` and `mypy .` pass.

- [x] **Step 3 - The route, and who may call it** - `app/api/pruefliste.py` with
      `GET /api/v1/pruefliste`, taking `seite` and `pro_seite`, guarded by
      `erfordert_rollen(*FFS_ROLLEN)`, registered in `app/main.py`. `PruefzeileAntwort` and
      `PrueflisteAntwort` in `app/api/schemas.py` alongside the other response models, with the
      paging envelope exactly as the Data section fixes it.
      *Done when:* the endpoint appears in the API docs with its parameters and its envelope,
      and answers; `pytest` proves a Reviewer, a Data Steward and a Super Admin each get 200, a
      plain Submitter gets 403, a `REGIERUNGSPRAESIDIUM` account gets 403 rather than an empty
      list, and a caller with no session gets 401; a request with no parameters answers page 1
      of 25 with a true `gesamt`; `pro_seite=500` is answered at 100 rather than refused;
      `ruff check .` and `mypy .` pass.

- [x] **Step 4 - The filters** - `status`, `anlass`, `jahr` and `suche`, applied to both the
      row query and the count, and taken as query parameters on the route. `DRAFT` refused as a
      `status` value with 422, since the queue never lists one and silently returning nothing
      would look like a database with no protocols in it. The search built from step 1's terms:
      every term has to match the Gewaesser name, the Ortsangabe or the Monitoringstrecken-Nr.,
      compared case-insensitively.
      *Done when:* `pytest` proves `status=SUBMITTED&status=IN_REVIEW` returns exactly those two
      states and `gesamt` counts only them; `anlass=wrrl` excludes a `best` protocol; `jahr=2025`
      excludes one surveyed on 2026-01-01 and includes one surveyed on 2025-12-31; a search for a
      word in the Ortsangabe alone finds the row; a two-word search where one word is in the
      water name and the other in the Ortsangabe finds it; a two-word search where only one word
      matches anything finds nothing; a search for `50%` does not return every row; searching in
      the wrong case still finds the row; `status=DRAFT` answers 422; and filters combine rather
      than replace each other. `ruff check .` and `mypy .` pass.

- [x] **Step 5 - The four orders, and the final pass** - `sortierung` as a query parameter over
      the four values, each tie-broken by the id, defaulting to the longest wait first. An
      unknown value answers 422 rather than quietly falling back to the default, because a screen
      asking for an order it does not get is a bug that hides itself.
      Then the pass over the whole sub-feature: read the generated docs as somebody meeting the
      endpoint for the first time, and check that every parameter's description says what it does
      rather than repeating its name.
      *Done when:* `pytest` covers all four orders against a fixture where each gives a different
      answer, and an unknown `sortierung` answering 422; `pytest`, `ruff check .` and `mypy .` all
      pass from `backend/`; `npm test`, `npm run lint` and `npm run build` still pass from
      `frontend/`, which they must, since nothing there changed.

## Files / areas

**New, under `backend/app/protokolle/pruefliste/`**

- `__init__.py`
- `parameter.py` and `parameter_test.py` - the search terms, the page numbers, the year.
- `dienst.py` and `dienst_test.py` - the `Pruefzeile` row and the query that builds it.

**New, under `backend/app/api/`**

- `pruefliste.py` and `pruefliste_test.py` - the route, its parameters and its refusals.

**Changed**

- `backend/app/main.py` - one `include_router` line.
- `backend/app/api/schemas.py` - `PruefzeileAntwort` and `PrueflisteAntwort`.

**Read, not changed**

- `backend/app/protokolle/dienst.py` - `FFS_ROLLEN` is imported from here, and `_sichtbar` is
  the function this feature deliberately does not reuse.
- `backend/app/api/abhaengigkeiten.py` - `erfordert_rollen`, unchanged.
- `backend/app/models/` - every column this joins already exists.
- `frontend/` - nothing at all.

**Changed beyond the list above, found by the branch review on 2026-09-17**

- `backend/conftest.py` - the shared `anlegen` fixture gained a `regierungspraesidium`
  argument, defaulting to none. Forced by this spec's own mandatory test that a regional
  account is refused: such an account cannot be created without a region.
- `backend/app/api/schemas_test.py` - new, and not in the spec's test list. It pins
  `Pruefstatus` against `Status`, so a state added to the protocol later cannot silently
  become unaskable here.

## What the build decided that the spec did not

Four things the code settles which the spec left open. Recorded here rather than removed,
because each is load-bearing for 12b, 12c or 12d.

1. **`SEITE_MAX`, an upper clamp on the page number.** The spec only asked for a lower one.
   Without an upper one a page number of 10^30 becomes a row offset larger than the database
   driver can send, and a silly query parameter becomes a 500.
2. **`jahr` is bounded to a year a date can express.** Otherwise the same thing: building
   the first day of year 99999 raises, and the caller gets a 500 instead of a 422.
3. **`suche` is capped at 200 characters**, so a search cannot be an arbitrarily large
   request before anything looks at it. The same guard, and the same reasoning, as
   `EMAIL_HOECHSTLAENGE` in `schemas.py`.
4. **The `gewaesser` order sorts on the lowercased name and Ortsangabe.** Defect 2 in
   `docs/ffs-defect-list.md` is the legacy form lowercasing water body names, so both
   spellings are genuinely in the data and a case-sensitive A to Z would file one block
   after the other. It also makes the order independent of the database's collation.

## Data / contracts

**Load-bearing. 12b renders this, 12c adds a filter to it, and 12d walks it.**

`PruefzeileAntwort`, one protocol as the queue shows it:

| Field | Source | Note |
|---|---|---|
| `id` | `submissions.id` | |
| `status` | `submissions.status` | Never `DRAFT` |
| `form_version` | `submissions.form_version` | |
| `datum` | `submissions.datum` | The day of the Befischung, a real date |
| `anlass` | `submissions.anlass` | The code, not the label |
| `bearbeiter_name` | `submissions.bearbeiter_name` | Frozen at submit |
| `submitted_at` | `submissions.submitted_at` | |
| `updated_at` | `submissions.updated_at` | |
| `eingereicht_von` | `users.email` | The account that filed it |
| `gewaessername` | `gewaesser.name` | As the surveyor typed it, never normalised |
| `ortsangabe` | `probestrecken.ortsangabe` | |
| `laenge_m` | `probestrecken.laenge_m` | An integer here, unlike the list's string |
| `monitoringstrecke_nr` | `probestrecken.monitoringstrecke_nr` | Null for most stretches |
| `regierungspraesidium` | `probestrecken.regierungspraesidium` | 1 to 4. Feature 13 reads it |

`PrueflisteAntwort`, the envelope: `zeilen`, `gesamt`, `seite`, `pro_seite`, `seiten`.

**Deliberately not `ProtokollUebersicht`.** That model is Meine Protokolle's. It reads five
values out of the JSON document because a draft has no envelope, and it carries no Bearbeiter,
no filer and no region. Widening it to serve both screens would put nullable fields on a list
that never needs them and tie two screens to one shape. Two lists, two models.

**One rule this feature has to honour for 12d's sake:** everything that changes which rows come
back, and in what order, is a query parameter. Nothing may come from session state or a
server-side default the caller cannot see. 12d's Vorheriges and Naechstes have to rebuild the
same list from a URL alone, and a hidden input would make "the protocol before this one" depend
on what the reviewer happened to do earlier.

**No schema change.** No migration, no new column, no new index.

## Testing

`pytest`, from `backend/`. It runs against a real `befischung_test` database, so Docker has to
be up; without it the suite reports "not run here" rather than passing.

**Gets a unit test, no database needed** (`parameter_test.py`): the `ILIKE` escaping, the
splitting of a search string into terms, the clamping of `seite` and `pro_seite`, the year to
date range, and the page count.

**Gets a database test** (`dienst_test.py`): what the query lists and what it never lists, each
filter on its own and in combination, each of the four orders, the paging slice, and the total
agreeing with the filters.

**Gets a permission test** (`pruefliste_test.py`), which `coding-standards.md` makes
non-optional: each of the three FFS roles admitted, a Submitter refused, a
`REGIERUNGSPRAESIDIUM` account refused, and no session refused.

**Not tested again here:** `erfordert_rollen` itself, covered by
`app/api/abhaengigkeiten_test.py`, and the envelope constraint, covered by
`app/models/protokoll_test.py`.

**Nothing to click.** This sub-feature has no screen. The manual path is the API docs at
http://localhost:8000/api/v1/docs, signed in as a reviewer, trying each filter and reading what
comes back.

## Notes for the AI

- **Visibility goes in the query, never a check afterwards.** `app/protokolle/dienst.py` opens
  with that rule and gives the reason: a function that forgets the clause returns nothing at
  all, which fails loudly, while a check after the load is one forgotten line from a leak.
- **Do not reuse or widen `_sichtbar`.** It answers a different question, stated in the table
  above. Widening it would widen every other caller at the same time.
- **Import `FFS_ROLLEN`, do not retype the three roles.** One answer to who FFS staff are.
- **The relational envelope, not the answers document.** This query never reads
  `Submission.antworten`. That is the whole payoff of feature 11b and the reason a draft is not
  in this list.
- **Escape the `ILIKE` wildcards.** A search box where `%` matches everything is the bug this
  feature is most likely to ship.
- **No migration.** If a step appears to need one, stop and say so rather than adding it; the
  notes above explain why none is expected.
- **Nothing in `frontend/`.** If a step seems to need a frontend change, that is 12b arriving
  early, and it is a thing to raise rather than to build.
- **Type hints on everything, routers stay thin.** Parse, authorise, delegate, return. The query
  belongs in `pruefliste/dienst.py` and the value logic in `pruefliste/parameter.py`, so both can
  be tested without HTTP.
- **German domain terms, German routes, no em dashes** anywhere, comments included.
- **Comment the why, not the what**, at the density of the surrounding package. The three
  comments genuinely owed here are why the Pruefliste is not `_sichtbar`, why the default order
  is the oldest hand-in, and why the joins are inner.
