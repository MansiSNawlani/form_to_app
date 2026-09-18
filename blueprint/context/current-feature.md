# Feature: Suche nach Art

**From build-plan:** feature 12c
**Status:** built on feature/12c-suche-nach-art, all six steps done and checked

## Goal

Let FFS staff ask the Pruefliste one question it cannot answer today: **which
protocols caught this species.**

Every filter the queue already has compares one column. This one has to look
inside the `antworten` document, at up to 26 catch rows, for every protocol in the
table. That is why it was split out of 12b on 2026-09-17: the queue had to work
before this risk was taken.

The payoff is the reason the catch table exists. A Hecht record in a water nobody
expected is the kind of thing FFS is looking for, and finding it today means
opening protocols one at a time and scrolling to part 6.

## Design reference

`prototypes/meine-protokolle.html`, lines 47 to 81, which is what 12b built the
filter bar from. It sketches four controls and no species picker, so this one is
an addition to the mockup rather than something it already shows. It sits in the
same row, is built from the same `FormControl` plus `FormLabel` pair as the other
five, and the row stays one line at desktop width.

## What it searches, and what it does not

**"Does the catch table name this species."** Not "did it catch more than zero".

A row that names a species and leaves its counts blank is still a row somebody
wrote that species into, and the survey found it. Reading the counts as well
would mean deciding what a blank means, and `regel.py` already says the form
cannot tell "not touched" from "deliberately empty".

**The four "kein Nachweis" codes are ordinary entries in the picker**, exactly as
they are in the catch table itself. That is not an accident of reuse: it makes
"show me every survey that found nothing" a question the queue can answer, which
is a real FFS question and needs no extra code.

**Exact code, never the label.** `arten.artN.name` stores the export code, and
the label is display only and gets an English translation in feature 17. Matching
on the label would mean a filter that changes what it finds when somebody
switches language.

**One species per search, not several.** The screen gives it one dropdown, the way
Anlass has one. Two species at once is a different question (both, or either?)
and there is nobody asking for it yet.

## In scope

- `art` on `Prueffilter` and the WHERE clause that answers it
- A GIN index over the species codes, and the Alembic migration that adds it
- `art` as a query parameter on `GET /api/v1/pruefliste`
- `art` in the address bar on `/pruefung`, surviving a reload and a pasted link
- The species picker in the filter bar, reading the form's own 123 entry list
- Browser evidence that the whole path works, and a screenshot of the wider bar

## Out of scope

- **Searching several species at once.** One dropdown, one species.
- **Filtering on how many were caught.** "Hecht, more than ten" is a different
  feature and nobody has asked for it.
- **Showing which species a row caught in the table.** The queue's columns are
  12b's and do not change here.
- **Validating the code against the current species list.** Deliberate, see below.
- **Feature 12d's Vorheriges and Naechstes.** They will carry this filter with
  them because it lives in the address bar like the other five, and that is all
  this feature owes them.
- **English strings.** `en.json` has no `pruefliste` block at all; feature 17
  fills the whole file.

## Decisions taken while specifying

**The query is a containment test over an extracted array.**

```sql
jsonb_path_query_array(antworten, '$.arten.*.name') @> '["HECH"]'::jsonb
```

`$.arten.*.name` walks whichever of `art1` to `art26` exist and collects the
codes; `@>` then asks whether the chosen one is among them. Checked against the
running Postgres 17 on 2026-09-18: the extraction, the containment test and the
index below were all accepted.

The alternative, twenty-six `antworten->'arten'->'artN'->>'name' = :code` clauses
joined by OR, is indexable only with twenty-six indexes and hard-codes the row
count into the query. The row count is the printed form's, and feature 23 may yet
meet a document with a different one.

**The index is a GIN index on that same expression.**

```sql
CREATE INDEX ix_submissions_artcodes
  ON submissions
  USING gin ((jsonb_path_query_array(antworten, '$.arten.*.name')) jsonb_path_ops)
```

The expression in the index and the expression in the query have to match
character for character or the planner will not use it, so both come from one
constant in the service module and the migration quotes that same string.

`jsonb_path_ops` rather than the default `jsonb_ops`: it indexes only the values,
which is all `@>` needs here, and it is the smaller and faster of the two for
exactly this query. The default also indexes every key, which on a document this
size is a large index built to answer questions nobody asks.

**Not `CREATE INDEX CONCURRENTLY`.** Alembic runs a migration inside a
transaction and `CONCURRENTLY` cannot run in one. A plain build takes a write lock
on `submissions`, which on a table of this size is a moment, and applying
migrations is already a deploy step somebody runs rather than something that
happens on start-up.

**An unknown code is passed through and matches nothing**, the same way `anlass`
already behaves, rather than being refused. Checking it against the current
species list would be checking it against the *current* form version's list, and a
protocol frozen on an older `form_version` may legitimately name a code that list
no longer carries. ADR 0004 is explicit that versions are never migrated. The
picker only ever offers real codes, so this only arises for a hand-typed address.

**Nothing is written.** This feature adds one index and reads. No protocol's
answers are touched.

## Build steps

- [x] **Step 1 - The query.** Add `art: str | None` to `Prueffilter` and the
      containment clause to `_bedingungen` in
      `backend/app/protokolle/pruefliste/dienst.py`, with the jsonpath kept as one
      named constant. Tests in `dienst_test.py`: a protocol naming the code is
      found; one not naming it is not; the code is found in a late row as well as
      the first; an unknown code returns nothing rather than raising; the filter
      combines with status and year; and `gesamt` counts the same rows the page
      shows. *Done when:* `pytest` passes from `backend/`, the new tests fail if
      the clause is removed, and `ruff check .` and `mypy .` are clean.
- [x] **Step 2 - The index.** One Alembic migration adding
      `ix_submissions_artcodes` and dropping it on downgrade, with the index also
      declared on the model so `alembic check` stays quiet. *Done when:*
      `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head`
      all succeed, `alembic check` reports no difference, and an `EXPLAIN` on a
      table holding a few thousand rows shows a Bitmap Index Scan on the new index
      rather than a Seq Scan. Build the volume inside `BEGIN ... ROLLBACK` with an
      `ANALYZE` before the `EXPLAIN`, so the development database keeps no
      synthetic protocols afterwards.

      *Evidence, 2026-09-18:* at 50,000 protocols the planner chooses
      `Bitmap Index Scan on ix_submissions_artcodes` with default settings. At
      5,000 it prefers a sequential read, which is the right call on a table that
      small and not a fault in the index: forced off sequential scans at that size
      it uses the index too. The development database was left at its own 18
      protocols.
- [x] **Step 3 - The endpoint.** `art` as a `Query` parameter on
      `GET /api/v1/pruefliste`, length-capped like `suche`, documented in German
      on the route the way its five neighbours are. Tests in
      `backend/app/api/pruefliste_test.py`: the parameter narrows the answer, an
      unknown code answers an empty page with `gesamt` 0 rather than a 422, and it
      is still refused for a non-FFS account. *Done when:* `pytest` passes and the
      parameter is visible and described at `/api/v1/docs`.
- [x] **Step 4 - The address bar.** `art` on `Prueflistenabfrage`, read by
      `abfrageAus`, written by `alsSuchparameter` and `alsEndpunktParameter`, and
      added to `FILTERFELDER` so it counts as a filter for the empty state and the
      reset button. Tests in `parameter.test.ts`. *Done when:* `npm test` passes,
      including a test that setting a species resets to page 1 and one that
      `istGefiltert` is true for a species alone.
- [x] **Step 5 - The picker.** Split the form-free control out of
      `felder/Suche.tsx` so `Filterleiste.tsx` can use the same Autocomplete
      without a `useFormContext`, then add the sixth control, its two German
      strings, and whatever the filter row's CSS needs to stay on one line.
      *Done when:* picking a species narrows the list and puts `art=` in the
      address bar, clearing it returns to all species, the control is reachable and
      operable by keyboard alone, and `npm run build` and `npm run lint` are clean.
- [x] **Step 6 - Browser evidence.** Tests in `frontend/e2e/pruefliste.spec.ts`
      addressing the control by its accessible role and name: the species filter
      narrows the count to what the endpoint says for the same code, it survives a
      reload, Back undoes it, and the control announces what it is set to. Plus one
      screenshot of the six-control bar at desktop width, and one at roughly 400px.
      *Done when:* `npm run e2e` passes with the stack up and both screenshots show
      a filter row that has not broken its layout.

      *Evidence, 2026-09-18:* the screenshots were taken with a throwaway spec and
      not kept, the way feature 12b's were. At 1440px the six controls sit on one
      line at an even height, and the species picker reads "Alle Arten" in
      placeholder grey beside the Alle entries of the dropdowns. At 400px the row
      stacks into two columns and the picker carries its clear button. **They
      caught a fault the tests did not:** a sixth control at the old equal share
      cut the search placeholder to "Gewaesser oder Ortsangal" and the order to
      "Laengste Wartezeit z...", which is why those two now have their own widths.

## Files / areas

**Backend**

- `app/protokolle/pruefliste/dienst.py` - `Prueffilter.art`, the clause, the
  jsonpath constant
- `app/protokolle/pruefliste/dienst_test.py` - the query tests
- `app/models/protokoll.py` - the index declaration, so `alembic check` agrees
- `database/migrations/versions/<new>.py` - the index
- `app/api/pruefliste.py` - the query parameter
- `app/api/pruefliste_test.py` - the endpoint tests

**Frontend**

- `src/protokoll/pruefliste/parameter.ts` and `parameter.test.ts` - `art`
- `src/protokoll/pruefliste/Filterleiste.tsx` - the picker
- `src/protokoll/felder/Suche.tsx` - the form-free control split out
- `src/protokoll/pruefliste/pruefliste.css` - the six-control row
- `src/i18n/locales/de.json` - `pruefliste.filter.art`, `pruefliste.filter.artAlle`
- `e2e/pruefliste.spec.ts` - the browser evidence

## Data / contracts

**No schema change beyond one index.** No column is added, no answer is written.

| Contract | Shape | Load-bearing for |
|---|---|---|
| `GET /api/v1/pruefliste?art=<code>` | one export code, exact match, unknown code is an empty page | 12d, which rebuilds this list from a URL |
| `?art=` in `/pruefung`'s address bar | the same code, absent when not narrowed | 12d's Vorheriges and Naechstes |
| The jsonpath `$.arten.*.name` | `ARTCODES_PFAD` for the query, written out again in the migration and a third time in the model's `Index`, all meaning the same path | any later query over the catch |

The picker's entries come from `optionen('arten')`, which reads
`database/seed/form_version_20260609/optionslisten.json`, the same file the catch
table itself reads. Nothing is retyped, so the queue and the form cannot disagree
about what a species is called.

## Testing

The test gate is on for both runtimes: `pytest` from `backend/`, `npm test` from
`frontend/`.

| Logic | Where it is tested |
|---|---|
| The species clause, alone and combined with other filters | `dienst_test.py`, step 1 |
| The count seeing the same filter as the rows | `dienst_test.py`, step 1 |
| The parameter, and an unknown code | `pruefliste_test.py`, step 3 |
| `art` in and out of the address bar, and the page-1 reset | `parameter.test.ts`, step 4 |

The picker itself is a component and gets browser evidence rather than a unit
test, which is what `coding-standards.md` asks for.

**The index needs its own evidence, and a passing test is not it.** A test suite
with a handful of rows passes whether or not the planner ever touches the index.
Step 2's `EXPLAIN` on a few thousand rows is the only thing that proves this
feature does what it was split out to do.

## Notes for the AI

- **Read `AGENTS.md`'s Commands section before running anything.** Backend
  commands run from `backend/` through `.venv`; the database must be up.
- The jsonpath appears in three places and cannot be one constant: a migration
  must not import `app/`, and Alembic compares the model's `Index` against the
  spelling Postgres reflects back. `TestArtindex` is what holds them together. It
  asks the database whether the real query can use the real index, because a copy
  that drifts is an index the planner silently stops using and no string
  comparison could tell you that.
- `Prueffilter` is handed to both the row query and the count query on purpose.
  Add the field to the dataclass, not to one call site.
- MUI wherever MUI has a component. The picker is an `Autocomplete` in a
  `FormControl` with a `FormLabel` above it, like the other five controls.
- A MUI Select or Autocomplete is not named by `<label for>`. Follow what
  `Filterleiste.tsx` already does with `labelId` and `SelectDisplayProps`, and
  prove the name with a role-and-name selector in step 6.
- The filter row must stay on one line at desktop width and grow downward rather
  than wrapping into a ragged second row. Check the screenshot, not just the build.
- German domain names throughout: `art` is the parameter, matching
  `arten.artN.name`.
- No em dashes anywhere, including in the German strings.
