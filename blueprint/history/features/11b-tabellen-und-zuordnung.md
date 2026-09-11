# Feature: 11b - Gewaesser, Probestrecke and Person as real tables

**From build-plan:** feature 11b
**Status:** built, all six steps done, reviewed on both axes

## Goal

Give the protocol a place to point at. Today a Probestrecke exists only as a dozen
answers inside one submission's `antworten` document, so two surveys of the same
stretch in two years are two unrelated blobs of text and nothing in the database
knows they describe the same place.

This feature creates the three tables project-overview.md has always specified -
`Gewaesser`, `Probestrecke` and `Person` - adds the envelope columns on
`submissions` that point at them, and writes the matching that decides, when a
protocol is submitted, whether its stretch is one already on record or a new one.

**Nothing changes on screen.** Like 11a, this is a half that 11c wires up. The
matching function is delivered here with database-backed tests and is called by
Absenden in 11c.

## In scope

- `Gewaesser`, `Probestrecke` and `Person` models plus the migration creating them.
- The eight envelope columns on `submissions` that `app/models/protokoll.py`
  promised feature 11 would add: `probestrecke_id`, `person_id`,
  `bearbeiter_name`, `anlass`, `datum`, `uhrzeit`, `submitted_at`, `locked_at`,
  with the check constraint that makes them required the moment a submission
  leaves DRAFT.
- Reading the answers document into the typed values those columns need: the
  Gewaessertyp and the length as integers, the four coordinates as integers, the
  Regierungspraesidium as an integer, the date and the time as real date and time
  values.
- The matching itself: find an existing Gewaesser, Probestrecke and Person, or
  create one, and hand back the three ids.

## Out of scope

- **The Absenden endpoint, the button, and the status on Meine Protokolle.** That
  is 11c. Nothing calls the matching function in this feature.
- **The workflow_events table and the transitions.** That is 11d. `submitted_at`
  and `locked_at` are columns here; who is allowed to set them is 11d's question.
- **`amtliche_id` and `gis_dataset_version`.** The columns are created, nullable
  and empty, exactly as project-overview.md requires so that feature 18 is a
  backfill script and not a schema change. Nothing writes them.
- **Editing or merging a Probestrecke after the fact.** No administration screen,
  no duplicate merge tool. See the note on duplicates below.
- **Any change to the frontend.** No TypeScript twin is needed: matching happens
  once, on the server, at submit.

## Design reference

None. No screen changes. The mockups relevant to feature 11 belong to 11c and 11e.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Gewaesser and Person as models** - `app/models/gewaesser.py` and
      `app/models/person.py`, both registered in `app/models/__init__.py`. Gewaesser
      carries `name`, the `vorfluter` chain as a text array capped at five, and the
      two nullable GIS columns. Person carries the seven contact fields and the
      nullable link to a `User`. No migration yet.
      *Done when:* `alembic check` names both tables as present in the models and
      missing from the database, and `ruff check .` and `mypy .` pass.

- [x] **Step 2 - Probestrecke as a model** - `app/models/probestrecke.py`: the
      foreign key to Gewaesser, `monitoringstrecke_nr` unique where it is present,
      `ortsangabe`, `gewaessertyp`, `laenge_m`, the four boundary coordinates and
      `regierungspraesidium`. Check constraints for the eight known Gewaessertyp
      codes, a Regierungspraesidium of 1 to 4, and a positive length.
      *Done when:* `alembic check` names all three tables as missing from the
      database, and lint and types pass.

- [x] **Step 3 - the migration that creates the three tables** - one Alembic
      revision, drafted with `--autogenerate` and then read and corrected by hand,
      as `AGENTS.md` requires. The constraints spelled out in SQL, not imported
      from `app/`.
      *Done when:* `alembic upgrade head` succeeds on a database that already holds
      drafts, `alembic check` then reports no changes, and `alembic downgrade -1`
      removes all three tables cleanly.

- [x] **Step 4 - the envelope columns on submissions** - the eight columns, all
      nullable, plus two check constraints: everything except `locked_at` is
      required once `status` is anything but DRAFT, and `locked_at` is set exactly
      when the status is LOCKED. Model change and migration together, since neither
      is testable without the other.
      *Done when:* an existing draft survives `alembic upgrade head` untouched;
      `pytest` includes a test proving the database itself rejects a row with
      status SUBMITTED and a null `probestrecke_id`; `alembic check` is clean.

- [x] **Step 5 - reading the answers into match keys, as plain functions** -
      `app/protokolle/zuordnung/regeln.py`. Takes the answers document and returns
      the typed values and the three comparison keys. No database, no session, in
      keeping with `coding-standards.md`.
      *Done when:* `pytest` covers, at minimum: a water body name matching
      regardless of case and surrounding spaces while the stored spelling stays
      exactly as typed; two waters with the same name but different Vorfluter
      chains producing different keys; `2026-13-45` and `25:00` refused rather than
      guessed at; a missing required answer raising a named error rather than
      writing a half row.

- [x] **Step 6 - find or create, against the database** -
      `app/protokolle/zuordnung/dienst.py`, one function taking a session, an
      answers document and the submitting account, returning the three ids. Reuse
      rules as decided below.
      *Done when:* `pytest` proves, against a real database: two protocols on the
      same stretch share one Probestrecke row and one Gewaesser row; a different
      Vorfluter chain creates a second Gewaesser; the same Monitoringstrecken-Nr.
      reuses the stretch and leaves its stored coordinates untouched; a protocol
      carrying a monitoring number does **not** attach to an identically placed
      stretch that has none; and the same Bearbeiter filing again with a new
      telephone number reuses the existing Person row without changing a single
      column on it.

## Files / areas

**New**

- `backend/app/models/gewaesser.py`, `person.py`, `probestrecke.py`
- `backend/app/protokolle/zuordnung/__init__.py`, `regeln.py`, `regeln_test.py`,
  `dienst.py`, `dienst_test.py`
- Two migrations under `database/migrations/versions/`

**Changed**

- `backend/app/models/__init__.py` - the three new models, so autogenerate sees them
- `backend/app/models/protokoll.py` - the eight envelope columns, and the docstring
  paragraph that currently says they are not here yet
- `backend/app/protokolle/fehler.py` - the error raised when a required answer is
  missing at match time
- `CONTEXT.md` - if the matching settles a term, per the domain docs rule

## Data / contracts

These are load-bearing. Feature 12 filters and sorts on these columns, feature 13
reads `regierungspraesidium`, and feature 18 backfills `amtliche_id`.

**`gewaesser`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | text | Stored exactly as typed. Defect 2 is the legacy form lowercasing these |
| `vorfluter` | text array | Ordered, one to five entries |
| `amtliche_id` | text, null | Created empty in v1, backfilled by feature 18 |
| `gis_dataset_version` | text, null | Which dataset the identifier came from |

**`probestrecken`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `gewaesser_id` | uuid | |
| `monitoringstrecke_nr` | text, null | Unique where present |
| `ortsangabe` | text | |
| `gewaessertyp` | int | One of `11 12 13 14 21 26 28 29`, never `31` or `32` |
| `laenge_m` | int | Positive |
| `untere_grenze_rechtswert` / `_hochwert` | int | EPSG:25832 |
| `obere_grenze_rechtswert` / `_hochwert` | int | EPSG:25832 |
| `regierungspraesidium` | int | 1 to 4, read from the `z.rp` answer |

**`personen`**

`id`, `name`, `firma`, `strasse`, `plz`, `ort`, `telefon`, `email`, and a nullable
`user_id`.

**`submissions`, added**

`probestrecke_id`, `person_id`, `bearbeiter_name`, `anlass`, `datum`, `uhrzeit`,
`submitted_at`, `locked_at`. All nullable at the column level; the check constraint
is what requires them once the status is not DRAFT.

### The rule that governs all three: read or create, never update

**The matching never writes to a row that already exists.** It either finds a
matching row and uses it as it stands, or it creates a new one. There is no third
case and no exception.

This was decided on 2026-09-11, after the first draft allowed two carve-outs: a
Person's contact details refreshed on each new protocol, and a
Monitoringstrecken-Nr. stamped onto a stretch that had none. Both write to rows
that already-submitted protocols point at. A protocol here is an official survey
record on its way to a state database, and anything an accepted one depends on has
to be as fixed as the protocol itself. A rule with no exceptions is also one a
reader can trust without checking the carve-out list.

The cost is duplicates, and that cost is paid deliberately. Feature 18 brings the
official water body dataset, which is the first point at which merging two records
can be done correctly, and it is a step a person runs rather than something that
happens quietly at submit.

### The three matching keys

**Person, matched on the email address.** Case and surrounding spaces ignored for
the comparison, stored exactly as typed. A match reuses the row untouched, so the
row keeps the contact details it was first created with. Nothing is lost: every
protocol carries its own copy of the Bearbeiter's details in its `antworten`
document, so a protocol always displays the details it was actually filed with.
The Person row is the identity behind an email address, not a live address book.

> Worth noting, since it reads against project-overview.md's line about contact
> details being "held once and reused rather than repeated inside every
> submission": they are in fact repeated, because the answers document has always
> held them. Correcting a stale Person row is a deliberate administrative action
> for a later feature, not something submitting a protocol does.

**Gewaesser, matched on the name together with the whole Vorfluter chain.** The
name alone is not an identity. Baden-Wuerttemberg has many a Muehlbach, and the
authoritative identifier that would settle it, `amtliche_id`, is empty until
feature 18. The chain is what places the water in the drainage network, so a
Muehlbach flowing to the Neckar and a Muehlbach flowing to the Iller are two
different waters and get two rows.

**Probestrecke, matched on the Monitoringstrecken-Nr. when the protocol carries
one, and otherwise on its Gewaesser plus all four boundary coordinates.** The
monitoring number is an officially assigned, stable identifier, which is why the
column is unique. Without one, the four coordinates are the only thing that fixes
the stretch. The two keys never cross: a protocol with a number never matches a
stretch without one, even at identical coordinates.

Three consequences, all accepted knowingly:

1. **A typo creates a duplicate.** "Neckar" and "Nekar" become two water bodies,
   and the survey history for that water is split across both.
2. **Coordinates must match exactly.** One metre out is a different stretch. A
   tolerance would need snapping, and snapping needs the same dataset, so it is
   also feature 18.
3. **A stretch that gains a monitoring number gains a second record.** The
   protocols filed before it was numbered stay on the unnumbered record; the ones
   filed after go on the numbered one. Both are correct about what was typed, and
   neither is rewritten. Whether FFS would rather see this flagged at submit is
   worth asking, and belongs in `docs/ffs-questions.md`.

## Testing

`pytest` from `backend/` is the gate, and every step in this feature except step 3
carries logic where a wrong answer is possible, so every one of them ships a test.

- **Steps 1 and 2** rely on `alembic check`, lint and types. Model declarations
  carry no logic.
- **Step 3** is verified by running the migration up, checking, and down.
- **Step 4** needs a database-backed test: the check constraint must reject a
  submitted row with a missing envelope. That guarantee only exists in Postgres,
  which is exactly why the backend tests run against a real database.
- **Steps 5 and 6** are the real test surface, listed in the done-whens above.

No frontend change, so `npm test` and the frontend build are untouched.

There is still no `Verify` command, so the gate is `pytest`, `ruff check .` and
`mypy .` from `backend/`.

## Notes for the AI

- **German domain names.** The model classes are `Gewaesser`, `Probestrecke` and
  `Person`, not English translations: `CONTEXT.md` explicitly rejects "site",
  "stretch" and "water". Tables are `gewaesser`, `probestrecken` and `personen`.
  Note this differs from `users`, `submissions` and `attachments`, where an
  ordinary English word existed.
- **Compare loosely, store faithfully.** Normalising a name for comparison is fine;
  writing the normalised form to the database is defect 2, one of the three legacy
  bugs that put wrong data into FiaKa. `formregeln/vorfluter.py` already does this
  correctly and is the pattern to copy.
- **Migrations never import from `app/`.** The attachments migration explains why at
  the top of the file. Spell the constraints out in SQL.
- **An autogenerated migration is a draft.** Read every generated file before
  keeping it. Alembic misses check constraints and will happily generate a drop for
  a model it was not told about.
- **Coordinate bounds stay out of the database.** `formregeln/koordinaten.py` says
  the numbers are still to be confirmed with FFS. A check constraint would make
  changing them a migration.
- **Ownership stays in the query.** Anything this feature adds that reads
  submissions follows `app/protokolle/dienst.py`: the account asking goes in the
  WHERE clause, never into a check afterwards.
- **The matching assumes the rules already passed.** 11c runs
  `pruefe_vollstaendigkeit` before calling this. If a required answer is missing
  anyway, raise a named domain error rather than writing a partial row.
- **Read or create, never update.** `zuordnung/dienst.py` issues SELECTs and
  INSERTs and no UPDATE at all. If a step seems to need one, the design is wrong,
  not the rule. Say so and stop rather than adding an exception.
