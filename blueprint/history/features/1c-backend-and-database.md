# Feature: 1c - Backend and database

**From build-plan:** feature 1c (third and last sub-feature of item 1, Project skeleton)
**Status:** completed 2026-08-31

## Goal

Stand up the other half of the application: PostgreSQL with PostGIS and the FastAPI service, both
in Docker Compose, with a readiness endpoint that actually proves the database is reachable, and a
frontend that can call the backend in development.

After this, item 1 is complete and the project has a working skeleton end to end.

## Starting point

The backend is a skeleton, not a blank page, and this feature builds on it rather than replacing
it:

- `backend/app/main.py` - FastAPI app, `/api/v1/health` liveness, docs at `/api/v1/docs`. Its
  docstring already says "Feature 1 extends this with a database readiness check".
- `backend/app/main_test.py` - one passing test.
- `backend/pyproject.toml` - fastapi, uvicorn, pydantic, pydantic-settings; dev extras pytest,
  httpx, ruff, mypy. `mypy` is already `strict = true` and ruff targets py312.

What does not exist yet: any virtual environment, any installed dependency, any Dockerfile, any
Compose file, and anything at all in `deployment/`. `database/migrations/` is an empty placeholder.

## In scope

- Configuration through `pydantic-settings`, so no connection string is hard-coded.
- A SQLAlchemy async engine and the database module feature 2 will build sessions on.
- `/api/v1/ready`, returning 503 rather than 200 when the database is unreachable.
- A backend `Dockerfile` and `.dockerignore`.
- `docker-compose.yml` with a PostGIS-enabled Postgres and the backend, both with healthchecks and
  a named volume so data survives a restart.
- The PostGIS extension created at first boot, unused until feature 18.
- A Vite dev proxy so the frontend reaches the backend without CORS.
- `.env.example` committed, `.env` ignored.
- Updating `AGENTS.md` commands to the ones that actually work.

## Out of scope

- **Alembic and any schema.** There are no tables yet. Feature 2 creates the first ones and owns
  the first migration. `database/migrations/` stays a placeholder.
- **A production reverse proxy.** `project-overview.md` lists one as the only public entry point in
  deployment. In development the Vite dev server proxies `/api`, which is sufficient and much
  better for hot reload. The real proxy belongs to `/release`. See Decisions.
- **The frontend in a container.** It stays on the host in development. It is a static build in
  production, so containerising it belongs with the proxy work.
- **The Verify command and GitHub checks.** `AGENTS.md` makes CI a separate explicit `/ci` run.
- **Any authentication.** Feature 2.
- **Any PostGIS query.** The extension is installed and left alone until feature 18.

## Decisions taken before building

These change the work materially, so they are called out rather than assumed.

1. **Turn the backend test gate on?** `/api/v1/ready` is the first real backend logic on this
   project, and `pytest` is already configured with a passing example. `AGENTS.md` currently
   declares no `test` command on purpose, which means the test gate is off. My recommendation is to
   declare the backend test command in this feature, because a readiness check that has never been
   tested against a down database is exactly the kind of thing that fails in production. The
   alternative is a separate `/tests` run.

2. **SQLAlchemy now, or just a driver?** Readiness only needs `SELECT 1`. Recommendation is to add
   SQLAlchemy 2 async plus `asyncpg` now, because both are already the declared stack and feature 2
   needs sessions immediately. The cheaper alternative is `psycopg` alone, at the cost of redoing
   it in feature 2.

3. **Python version.** `pyproject.toml` requires >=3.12 and both ruff and mypy target 3.12. This
   machine has 3.14.4. Recommendation is to pin `python:3.12-slim` in the image so the container
   matches the tool configuration, and to note the host mismatch rather than silently developing
   against a different version from the one that ships.

## Build loop

Build one step at a time, never the whole feature at once.

1. The AI implements just that step.
2. It shows the diff (not full files); you read it and understand it.
3. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big.

## Build steps

- [x] **Step 1 - Local environment and dependencies.** Create the virtual environment, add the
      database dependencies to `pyproject.toml`, install, and confirm the existing app and test
      still work. This step exists because nothing here has ever been run.
      *Done when:* `uvicorn app.main:app` serves `/api/v1/health` returning `{"status":"ok"}`,
      `pytest` passes, and `ruff check .` and `mypy .` are clean.

- [x] **Step 2 - Settings and the database module.** `app/config.py` reading configuration from the
      environment through `pydantic-settings`, and `app/db.py` holding the async engine. No
      connection string, host, or password appears in code.
      *Done when:* the app starts with settings read from `.env`, and starting it with a
      deliberately wrong database URL still starts the process rather than crashing at import, since
      a readiness probe cannot report on a service that refused to boot.

- [x] **Step 3 - The readiness endpoint, with tests.** `/api/v1/ready` runs `SELECT 1` and returns
      200 when the database answers, 503 when it does not. Liveness and readiness stay separate:
      liveness says the process is up, readiness says it can do useful work, and a platform uses
      them differently.
      *Done when:* a test proves the 200 path and a test proves the 503 path with the database
      unreachable, both without needing a real database, and `pytest` passes.

- [x] **Step 4 - Containerise the backend.** `backend/Dockerfile` and `.dockerignore`. Non-root
      user, no dev dependencies in the image, and no secrets baked in.
      *Done when:* the image builds and a container run against no database serves
      `/api/v1/health` as 200 and `/api/v1/ready` as 503, which is the correct answer.

- [x] **Step 5 - Compose the stack.** `docker-compose.yml` with a PostGIS-enabled Postgres and the
      backend. A named volume for the data, a healthcheck on each service, the backend waiting for
      the database to be healthy, and an init script creating the PostGIS extension.
      `.env.example` committed and `.env` git-ignored.
      *Done when:* `docker compose up` brings both services to healthy, `/api/v1/ready` returns 200,
      `SELECT postgis_version()` answers, and stopping and restarting the stack keeps the data.

- [x] **Step 6 - Connect the frontend, and fix the docs.** Vite dev proxy for `/api`, and update the
      `AGENTS.md` Commands section to the commands that were actually exercised here.
      *Done when:* with the stack up, a fetch to a relative `/api/v1/health` from the Vite dev
      server returns 200 with no CORS error, and every command listed in `AGENTS.md` has been run.

## Files / areas

- `backend/pyproject.toml` - SQLAlchemy, asyncpg.
- `backend/app/config.py` - **new**, settings.
- `backend/app/db.py` - **new**, the async engine. Load-bearing for feature 2.
- `backend/app/main.py` - the readiness route.
- `backend/app/ready_test.py` - **new**, both readiness paths.
- `backend/Dockerfile`, `backend/.dockerignore` - **new**.
- `docker-compose.yml` - **new**, repository root.
- `database/init/01-postgis.sql` - **new**, extension creation.
- `.env.example` - **new**. `.env` added to `.gitignore`.
- `frontend/vite.config.ts` - the dev proxy.
- `AGENTS.md` - the Commands section.

## Data / contracts

No tables yet, so no schema contract. Three things are locked here and later features depend on
them:

- **The API prefix `/api/v1`**, already established by the existing health route.
- **`app/db.py` as the single place a database connection is obtained.** Feature 2 builds its
  session dependency on this rather than creating a second engine.
- **Configuration comes from the environment, never from code.** `project-overview.md` requires
  secrets to come from the deployment environment. A committed connection string would break that
  on day one.

## Testing

Unlike 1a and 1b, this feature contains real logic: readiness must report failure correctly. The
`pytest` configuration and one example test already exist in `backend/`.

- Step 3 ships tests for both the reachable and unreachable paths, which is the point of the
  endpoint.
- Infrastructure is verified by running it: `docker compose up`, the endpoints answering, PostGIS
  responding, and data surviving a restart.
- Whether `pytest` becomes a declared gate in `AGENTS.md` is decision 1 above.

## Notes for the AI

- **Docker Desktop is installed but the daemon was not running** when this spec was written.
  `docker info` failed. It has to be started before steps 4 to 6 can be proven, and those steps
  must not be reported as passing on the strength of the config looking right.
- **Never commit a real secret.** `.env.example` carries placeholder values and `.env` is ignored.
  Local development passwords are still not real credentials and should look obviously local.
- **503 is the correct readiness answer when the database is down**, not 200 and not a crash. A
  platform reads this to decide whether to send traffic, so getting it backwards silently routes
  users to a broken service.
- **Do not create tables, models, or migrations.** Feature 2 owns the first schema. This feature
  proves connectivity only.
- **The domain stays German** for domain terms, but this feature has almost none: configuration,
  health and readiness are general programming vocabulary and stay English.
- **`AGENTS.md` currently documents commands that have never been run.** Fix that in step 6 rather
  than leaving the file describing an environment that does not exist.

## Completion note

All three decisions were approved as recommended, except the Python pin, which was re-opened
mid-build. The original recommendation assumed 3.12 was available locally; it is not, only 3.14.4
is installed. Presented with that, the conservative base won: the image is pinned to
`python:3.12-slim` while development runs 3.14, so a version-specific bug can only appear inside
the container. That trade-off is recorded in the Dockerfile and in `AGENTS.md`, not only here.

Three things were built differently from the reviewed spec:

- `database_url` is typed `PostgresDsn` rather than `str`. The first version accepted an empty
  string, which would have let a blank environment variable through in deployment and surfaced much
  later as a confusing connection error. `PostgresDsn` rejects empty, malformed and wrong-database
  URLs while still accepting an unreachable host, which is the distinction this feature rests on.
- `.env.example` was created in step 2 rather than step 5, because step 2's done-when needed a real
  env file to load. It was then consolidated so a single root `.env` serves both Docker Compose and
  host-run uvicorn, with `app/config.py` reading `../.env` and then `.env`.
- A 5 second connect timeout was added to the engine. It was not in the spec, but without it an
  unreachable host leaves the readiness probe hanging until the platform's own timeout fires, which
  reads as a hung service rather than an unready one.

The readiness tests were mutation-tested rather than merely run: the 503 path, the liveness
independence, and the error swallowing were each broken deliberately and confirmed to fail the
right test before being restored.

The test gate is now on. `AGENTS.md` declares `pytest` from `backend/`. The frontend still has no
runner, which is worth fixing with `/tests` before feature 4 brings the coordinate bounds check and
the Vorfluter chain rule.

`prototypes/` was not discarded here. This feature consumed no mockups, and the folder remains the
design reference for features 3, 4, 11 and 12.
