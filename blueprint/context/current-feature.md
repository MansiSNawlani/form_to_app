# Feature: 2a - The User record and the admin command

**From build-plan:** feature 2a
**Status:** not started

## Goal

Give the application its first database table and its first real account. Until now the
backend has had no tables at all: `db.py` opens a connection and `/api/v1/ready` runs
`SELECT 1` against nothing. This feature creates the `users` table, the machinery that
changes the database schema safely (Alembic), the password hashing, and a command line
command that creates the first Super Admin.

It matters because everything after it is blocked on it. Feature 2b cannot sign anybody in
until there is somebody to sign in. Feature 3 cannot store a submission until there is an
owner to attach it to. Feature 11's review workflow needs two different people, which is
the reason it was set aside on 2026-09-07 and this was pulled forward.

**There is no screen at the end of this feature.** Its evidence is `pytest`, the migration
running, and a `psql` query. That is the honest shape of it: the table has to exist before
anything can log in.

## Where this sits in the build order

`build-plan.md` reordered the build on 2026-09-01 to 4, 5, 6, 7, 8, 9, then 2, 3, then 10
onward. Features 4 to 9 are done and 10 was pulled forward by decision on 2026-09-06, so by
the plan's own order feature 2 is next. Confirmed on 2026-09-07, after feature 11 was found
to be half-blocked on exactly this.

## Notes for someone new to Python backends

Four things in this feature have no frontend counterpart. Read this before the first diff.

**A migration** is a small, ordered script that changes the database's shape: add a table,
add a column, add a constraint. The database remembers which ones it has run, so every
machine and the deployed server end up with the same shape. The alternative is somebody
typing `CREATE TABLE` by hand on the server, which is how two environments quietly stop
matching. `coding-standards.md` already forbids that.

**Alembic** is the tool that writes and runs those scripts for SQLAlchemy. It can look at
your Python models, compare them to the live database, and generate the difference. That
generated script is a draft, never a final answer, and gets read by hand before it is kept.

**A password hash** is a one way scramble. The database stores the scramble, never the
password. When somebody signs in you scramble what they typed and compare the scrambles, so
a stolen database does not hand over anybody's password. It has to be a *slow* scramble on
purpose, so that guessing billions of passwords costs real time.

**A CLI command** is a way to run code without a web request. The first Super Admin cannot
be created through the application, because creating accounts requires being signed in as a
Super Admin, and there is not one yet. Somebody with access to the server runs a command
instead. This is the standard answer to that chicken and egg, not a workaround.

## Design reference

None. This feature renders nothing. `prototypes/` covers the submissions list, part 1 and
the reviewer view, and none of them show an account.

## Decisions taken here, and why

These are framework conventions rather than product choices, so they are taken rather than
put to the user. Each says what it rules out, so any of them can be overturned on sight.

| Decision | Why this one |
|---|---|
| **Migrations live in `database/migrations/`, driven from `backend/`** | `coding-standards.md` already puts them there. `alembic.ini` sits in `backend/` with `script_location = ../database/migrations`, so the command runs where the virtual environment is and the files land where the repository shape says. |
| **Alembic runs async, on the same asyncpg driver as the app** | The alternative is installing a second Postgres driver just for migrations and keeping two connection URLs in step. One driver, one URL, one thing to configure wrongly. |
| **`env.py` reads the URL from `app.config.get_settings()`** | Not from `alembic.ini`. The settings object already knows where the database is and already refuses to start on a missing or malformed URL. Two places to configure a database URL is how they drift apart. |
| **Argon2id for hashing, via `argon2-cffi`** | The current first recommendation for password storage. `argon2-cffi` is used directly rather than through a wrapper library, because it already offers `check_needs_rehash`, which is the only thing a wrapper would add. |
| **Roles are a `TEXT[]` column with a check constraint** | Postgres has a native `ENUM` type, but changing one later cannot run inside a transaction and a value can effectively never be removed. A text array checked by a constraint gives the same guarantee and a later change is an ordinary migration. The valid values are a Python `StrEnum` so the application side is still typed. |
| **A user must have at least one role** | `cardinality(rollen) > 0` as a check constraint. An account with no roles can do nothing at all, so it is a mistake rather than a state worth supporting. |
| **Email is stored lower case** | It is the login identifier, and `Anna@ffs.de` and `anna@ffs.de` must not be two accounts. Normalising on write plus a plain unique index is simpler and more portable than a case insensitive column type. |
| **UUID version 4 primary keys, generated in Python** | Generated application side so an object has its id before it reaches the database. Version 7 would index better, but it arrived in the standard library in Python 3.14 and `pyproject.toml` targets 3.12. |
| **Timestamps are timezone aware, defaulted by the database** | `TIMESTAMP WITH TIME ZONE` with a server side `now()`. A naive timestamp is ambiguous the first time the server and a user are in different zones. |
| **`typer` for the command line** | By the author of FastAPI and the conventional choice in this ecosystem. It gives help text, argument validation and exit codes for free. |
| **The password is never a command line argument** | Prompted for, hidden, and asked twice. An argument would land in the shell history and be visible to anyone running `ps` while it ran. |
| **Command names are German** | `benutzer anlegen`, matching the German route paths decided on 2026-08-24. Component and variable names inside stay English as usual. Easy to overturn; it affects four strings. |
| **Migrations are never run automatically when the application starts** | A tempting shortcut, and a bad one: when the service runs as more than one container, they all start at once and all try to migrate at once. Migrating is a deploy step somebody runs, which is also what makes a failed migration visible rather than a crash loop. |
| **The password policy is a length minimum and nothing else** | Not a check against known breached password lists. That is good advice in general, but it means either a large word list in the repository or a call to an outside service, and these accounts are created one at a time by an administrator for named staff. Worth revisiting if FFS ever opens self service, which they have said they will not. |

## The table

Straight from the `User` model in `project-overview.md`. Entity names there are English where
the concept is generic and German where it is domain specific, and the columns inside follow
the same rule, so the table is `users` and its columns are as listed.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key, generated application side |
| `email` | `text` | unique, stored lower case, the login identifier |
| `password_hash` | `text` | Argon2id. Never reversible, never logged, never returned by an API |
| `rollen` | `text[]` | at least one, every value one of the six |
| `regierungspraesidium` | `smallint`, nullable | 1 to 4. Set only on a `REGIERUNGSPRAESIDIUM` account |
| `locale` | `text` | `de` or `en`, defaults to `de` |
| `ist_aktiv` | `boolean` | defaults true. Feature 2b refuses a false one at sign in |
| `created_at`, `updated_at` | `timestamptz` | database defaulted |

The six roles, as `project-overview.md` fixes them: `SUBMITTER`, `DATA_STEWARD`, `REVIEWER`,
`SUPER_ADMIN`, `REGIERUNGSPRAESIDIUM`, `INTEGRATION`.

`locale` is unused until feature 17. It is included now because it is part of the locked
model and adding it later is a second migration for one column.

## In scope

- Alembic set up and proven to run forwards and backwards.
- The `users` table, its constraints, and its migration.
- The six roles as a typed Python enum, enforced in the database too.
- Password hashing, and the password length policy.
- The two account rules that are not the database's job: email normalisation, and the
  Regierungspräsidium number belonging only to a regional account.
- A test database, so this and every later backend feature can test against real Postgres
  rather than a substitute that behaves differently.
- The command line command: create an account, activate one, deactivate one, list them.
- The new commands written into `AGENTS.md`, which is where this project records commands
  that have actually been run.

## Out of scope

- **Signing in.** No endpoints, no JWT, no cookie, no session. That is 2b, and it is the
  reason `password_hash` is written but never yet compared against anything.
- **Any HTTP surface at all.** This feature adds no route. `main.py` is untouched.
- **A user administration screen.** Activating and deactivating happens on the command line
  here. The screen is feature 16.
- **Changing a password, resetting a forgotten one, or expiring one.** Not in the build plan
  for feature 2. A Super Admin sets a password with the command for now.
- **The `Person` table.** A separate entity in the model and not needed until feature 3.
- **Every other table.** `Submission`, `Probestrecke`, `Gewaesser` and the rest belong to the
  features that use them.
- **Seeding real FFS accounts.** Who gets an account is FFS's to decide, not ours to guess.
- **Stopping an `INTEGRATION` account being created.** The model says that account is machine
  only and cannot log in interactively. That is a refusal at sign in, so it belongs to 2b.
  The command here creates the account like any other.
- **Running migrations as part of starting the application or the container.** See the
  decision above. `docker-compose.yml` is untouched.
- **New configuration or secrets.** 2a needs none: the database URL already exists. The JWT
  signing secret arrives with 2b. If a step starts wanting a new environment variable, stop
  and ask, because it probably means something from 2b has leaked in.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Alembic wired up, with nothing in it yet.** Add `alembic` to
      `pyproject.toml`, `backend/alembic.ini` with `script_location = ../database/migrations`,
      and the async `env.py` in `database/migrations/`, reading the database URL from
      `app.config.get_settings()` rather than from the ini file. Then one empty revision, so
      the round trip is proven before there is anything to lose. Record the commands in
      `AGENTS.md` only after running them.

      Deliberately no table in this step. Wiring a migration tool up and creating the first
      table at the same time means a failure could be either, and this is the one step whose
      failure mode is "the database is now in a shape nothing agrees on".
      *Done when:* with the Compose stack up, `alembic upgrade head` from `backend/` creates
      the `alembic_version` table and `alembic downgrade base` removes it again, both
      verified in `psql`; `alembic current` reports the revision; and `AGENTS.md` carries the
      commands that were actually run.

- [ ] **Step 2 - The `User` model and the table.** `app/models/base.py` with the declarative
      base, `app/models/benutzer.py` with the `Rolle` enum and the `User` model, and the
      generated migration read line by line before it is kept. All eight columns, the unique
      email index, and the four check constraints: at least one role, every role a known one,
      `regierungspraesidium` between 1 and 4, `locale` one of two values.

      The check constraints are named explicitly rather than left to Alembic's autogeneration,
      because an unnamed constraint cannot be dropped by a later migration without looking up
      whatever name Postgres invented.

      `updated_at` needs watching. A database default fills it on insert and then never
      changes it, so a row edited a year later still claims it was last touched on the day it
      was created. SQLAlchemy's `onupdate` fixes that for anything written through the model,
      which is everything this project does.
      *Done when:* `alembic upgrade head` creates `users` and `\d users` in `psql` shows every
      column, the unique index and all four constraints; inserting a second row with the same
      email in different case is rejected; inserting a row with an empty `rollen` array is
      rejected; inserting an unknown role string is rejected; `alembic downgrade base` drops
      the table cleanly; and `mypy .` and `ruff check .` are both green.

- [ ] **Step 3 - Password hashing and the password policy.** `app/security/passwoerter.py`:
      `hashe_passwort`, `pruefe_passwort`, `braucht_neuen_hash`, and `pruefe_passwortregel`.
      Plain functions over strings, no database and no HTTP, which is what
      `coding-standards.md` asks of any rule where a wrong answer is possible.

      The policy is a minimum length of 12 and nothing else. No required digit, no required
      symbol, no maximum: composition rules are current advice against, because they push
      people towards `Passwort1!` and towards writing it down. Argon2 has no length ceiling of
      its own, unlike bcrypt, so a long passphrase is genuinely accepted rather than silently
      truncated.
      *Done when:* `pytest` passes new cases in `app/security/passwoerter_test.py` covering: a
      hash never equal to the password it came from, the right password verifying, a wrong one
      failing, two hashes of the same password differing because the salt differs, an
      eleven character password rejected and a twelve character one accepted, a 200 character
      passphrase accepted and verifying correctly, and `braucht_neuen_hash` answering false
      for a hash made with the current settings.

- [ ] **Step 4 - The two account rules.** `app/benutzer/regeln.py`: `normalisiere_email`
      (trim and lower case) and `pruefe_regierungspraesidium`, which says that the number is
      required on a `REGIERUNGSPRAESIDIUM` account and forbidden on any other. Plain
      functions again, and the second is a genuine domain rule: a regional account with no
      region would see every region, which is the opposite of what the role is for.
      *Done when:* `pytest` passes new cases in `app/benutzer/regeln_test.py` covering email
      trimmed and lower cased, an already lower case email unchanged, a regional account
      without a number rejected, a regional account with a number accepted, a number 5 or 0
      rejected, and a submitter carrying a number rejected.

- [ ] **Step 5 - A test database.** Add `pytest-asyncio` and `backend/conftest.py`. One
      fixture per test run creates a separate `befischung_test` database and runs the
      migrations into it. One fixture per test opens a transaction, hands the test a session
      inside it, and rolls it back at the end, so every test starts from an empty table
      without anything being created or dropped in between.

      Rolling back rather than rebuilding, because rebuilding a database per test makes a
      suite that nobody runs. A separate database rather than the development one, because a
      test that escapes its rollback must not be able to delete real rows.

      Tests run against real Postgres, not an in-memory substitute. A substitute has no array
      columns and no check constraints, so it would pass on exactly the rows step 2 exists to
      reject. When no database is reachable the fixture skips with a message saying to start
      the Compose stack, so a missing Docker reads as "not run here" rather than as a failure.

      One throwaway test proves the fixture, and nothing else is built in this step. A fixture
      and the code that uses it in one diff means a failure could be either.
      *Done when:* `pytest` passes a test that writes a row and a following test that finds
      the table empty, proving the rollback; `befischung_test` exists in `psql` and the
      development database is untouched; and with the Compose stack stopped, `pytest` reports
      skips with a message naming what to start, and exits zero rather than failing.

- [ ] **Step 6 - The four account functions.** `app/benutzer/dienst.py` with
      `lege_benutzer_an`, `finde_nach_email`, `setze_aktiv` and `liste_benutzer`, and
      `app/benutzer/fehler.py` with the domain errors they raise. This is where steps 2 to 5
      come together: the model, the hashing, the rules and the test database.

      A duplicate email is caught and re-raised as a named domain error rather than allowed
      out as a raw database error. `coding-standards.md` requires typed domain exceptions
      translated to HTTP in one place, and 2b's endpoints will translate these.
      *Done when:* `pytest` passes new cases in `app/benutzer/dienst_test.py` covering an
      account created and read back with its roles intact, its password verifying and its
      stored hash not equal to the password, a duplicate email refused as the named domain
      error, an email differing only in case counting as a duplicate, a regional account
      without its number refused, deactivating and reactivating, and the list coming back in
      a stable order.

- [ ] **Step 7 - Creating an account from the command line.** `app/cli.py`, a Typer
      application with a `benutzer` group, and `anlegen` in it. Registered as a console
      script in `pyproject.toml` so it runs as `befischung` as well as `python -m app.cli`.
      The password is prompted for, hidden, and asked twice. Roles are a repeatable option
      validated against the enum, so a typo is refused before the database is touched.

      Every failure this command can hit gets a message that names the thing, says why in
      ordinary words and says what to do instead, which is the standard set for this project
      on 2026-09-06 and recorded in `error-messages-must-give-a-way-out`: a duplicate email,
      an unknown role, a password under the minimum, the two entries not matching, a missing
      Regierungspräsidium number on a regional account, and a database that is not running.
      The database one matters most, because it is the failure a new developer hits first and
      the one a raw stack trace explains worst.
      *Done when:* against the Compose stack, `benutzer anlegen` creates a Super Admin that
      `psql` shows with the right roles and an Argon2 hash; the password appears in neither
      the shell history nor `ps` output while it runs; entering two different passwords is
      refused without writing anything; a duplicate email, an unknown role, a short password
      and a regional account with no number each fail with a message naming the problem and a
      way out, and each exits non-zero; running it with the stack stopped says what to start
      rather than printing a stack trace; and `--help` reads sensibly.

- [ ] **Step 8 - Activating, deactivating and listing, and the documentation.** The other
      three commands: `aktivieren`, `deaktivieren`, `liste`. `liste` prints email, roles and
      active state, and never the hash. Deactivating an account that is already inactive says
      so rather than pretending to work.

      Then write the commands into `AGENTS.md` under Commands, and a short "creating the
      first account" note into `README.md`. A new developer cannot guess this step exists, and
      `AGENTS.md` records only commands that have actually been run, so this happens after
      they have been.
      *Done when:* `benutzer deaktivieren` then `liste` shows the account inactive and
      `aktivieren` reverses it; an unknown email fails with a message naming it; `liste` on an
      empty table says so rather than printing nothing; no hash appears in any output;
      `pytest`, `mypy .` and `ruff check .` are all green from `backend/`; and `AGENTS.md` and
      `README.md` carry only commands that were run during this step.

## Files / areas

**New**

- `backend/alembic.ini` - Alembic's configuration, pointed at `database/migrations`
- `database/migrations/env.py`, `script.py.mako`, `versions/` - the migration environment
- `database/migrations/versions/*_users.py` - the first real migration
- `backend/app/models/base.py`, `backend/app/models/benutzer.py` - the declarative base and
  the `User` model
- `backend/app/security/passwoerter.py` + `_test.py` - hashing and the password policy
- `backend/app/benutzer/regeln.py` + `_test.py` - email normalisation, the regional rule
- `backend/app/benutzer/dienst.py` + `_test.py` - the four account functions
- `backend/app/benutzer/fehler.py` - the domain errors this feature can raise
- `backend/app/cli.py` - the Typer application
- `backend/conftest.py` - the test database fixture

**Changed**

- `backend/pyproject.toml` - `alembic`, `argon2-cffi`, `typer`, `email-validator`,
  `pytest-asyncio`, and the console script entry point
- `AGENTS.md` - the migration and account commands, under Commands
- `README.md` - a short note on creating the first account

**Untouched**

- `backend/app/main.py` and everything under `frontend/`. This feature adds no route and no
  screen.

## Data / contracts

**Load-bearing, and hard to change later.** Every later backend feature builds on these.

- The `users` table shape above, and the six role values exactly as spelled.
- `Rolle` as a Python `StrEnum`, so a role is both a typed value and its own database string
  with no mapping table in between.
- `app/models/base.py` as the single declarative base. Every later model inherits from it, and
  Alembic's autogeneration only sees tables registered on it. A second base is how a table
  goes missing from a migration.
- The domain errors in `app/benutzer/fehler.py`. `coding-standards.md` requires typed domain
  exceptions translated to HTTP in one place, so 2b's endpoints translate these rather than
  inventing their own.
- `get_session` in `app/db.py` stays the only way a session is obtained. A second engine would
  mean two connection pools competing for the same Postgres connection limit, which `db.py`
  already warns about.

## Testing

The test gate is on for the backend: `AGENTS.md` declares `pytest`, from `backend/`. Every
step here adds logic where a wrong answer is possible, so every step ships tests in the same
diff.

| Step | Tested how |
|---|---|
| 1 | Not unit tested. Proven by running `upgrade` and `downgrade` and reading `psql` |
| 2 | Constraints proven by `psql` inserts that must fail. `mypy` and `ruff` green |
| 3 | `pytest`, no database needed |
| 4 | `pytest`, no database needed |
| 5 | The fixture proves itself: a write in one test, an empty table in the next |
| 6 | `pytest` against real Postgres, skipping readably when it is down |
| 7 | Running the command for real, including every failure path |
| 8 | Running the three commands for real. `pytest`, `mypy` and `ruff` green |

There is no `Verify` command on this project yet, so the gate is `pytest`, `mypy .` and
`ruff check .`, all run from `backend/`. The frontend is untouched, so `npm test` and
`npm run build` are not part of this feature's evidence.

**No permission tests here.** `coding-standards.md` requires a test that one submitter cannot
read another's submission, and one that a Regierungspräsidium account cannot see another
region. Neither can exist yet: there are no submissions and no way to be signed in. They
belong to 2b and 3, and this feature builds the roles they will check.

## Notes for the AI

- **Read the generated migration before keeping it.** Alembic's autogeneration misses check
  constraints, gets server defaults wrong, and will happily generate a drop it inferred from
  a model you forgot to import. Treat the generated file as a first draft.
- **Never log or return a password or a hash.** Not in a debug line, not in an error message,
  not in the `liste` output, not in a test failure message.
- **German for domain terms, English for programming vocabulary**, as `coding-standards.md`
  sets out. `rollen`, `ist_aktiv`, `regierungspraesidium`, `benutzer` are domain. `session`,
  `hash`, `base`, `engine` are not.
- **No em dashes anywhere**, including migration docstrings and commit messages.
- **`mypy` is in strict mode.** SQLAlchemy 2.0 models need `Mapped[...]` and
  `mapped_column(...)` annotations for it to pass; the older `Column()` style will not type
  check.
- **Keep routers out of this.** There is no router. If a step starts wanting one, it has
  drifted into 2b.
- **The rules go in plain functions**, taking and returning values, so they are testable with
  no database and no HTTP request. That is what makes them movable next to the Zod rules the
  frontend already has.
- **The migration files are neither linted nor type checked.** `ruff` and `mypy` run from
  `backend/`, and the migrations live under `database/`. An accepted cost of following the
  repository shape in `coding-standards.md`; it means a migration gets read by a human
  instead, which it needs anyway.
- **Ask before adding a dependency** not already named in this spec.
