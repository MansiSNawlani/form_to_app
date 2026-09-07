# Protokoll E-Befischung

Web application replacing the Fischereiforschungsstelle Baden-Württemberg's PDF-based
electrofishing survey form, with drafts, review, and a controlled path into the state fisheries
database.

## Start here

| Document | What it covers |
|---|---|
| [docs/decisions.md](docs/decisions.md) | What we decided before building, and why. Written for non-developers too |
| [CONTEXT.md](CONTEXT.md) | The domain glossary. The German terms and what they mean |
| [blueprint/context/project-overview.md](blueprint/context/project-overview.md) | The data model, feature list and stack. The single source of truth |
| [docs/adr/](docs/adr/) | The five hard-to-reverse architecture decisions |
| [docs/ffs-defect-list.md](docs/ffs-defect-list.md) | Bugs found in the legacy PDF form, for FFS |
| [AGENTS.md](AGENTS.md) | How AI coding agents should work in this repository |

## Layout

```
frontend/     React + TypeScript, built by Vite
backend/      FastAPI + Python
database/     Alembic migrations and seed data
deployment/   Docker Compose, reverse proxy config
docs/         decisions, ADRs, the FFS defect list
blueprint/    the plans and the build workflow
```

## Running it

The full containerised stack arrives with build item 1. Until then, the two halves run separately.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

**Backend** (needs Python 3.12 or newer)

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate      # Windows
source .venv/bin/activate   # macOS and Linux
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

API docs are then at `http://localhost:8000/api/v1/docs`.

## Creating the first account

There is no sign-up page, by design: every account is created by an administrator. That leaves a
chicken and egg at the very start, because creating an account requires being signed in as a Super
Admin and to begin with there is not one. The first account is therefore made from the command
line, by somebody with access to the machine.

With the stack running, from `backend/`:

```bash
alembic upgrade head                      # once, so the users table exists
befischung benutzer anlegen --email you@example.org --rolle SUPER_ADMIN
```

The password is asked for, twice, and is never typed as an option. An option would land in your
shell history and be visible to anyone who can list running processes.

The other account commands:

```bash
befischung benutzer liste
befischung benutzer deaktivieren --email you@example.org
befischung benutzer aktivieren --email you@example.org
befischung benutzer --help
```

Deactivating keeps the account and stops it signing in. Accounts are never deleted, because a
deleted account would take the owner of every protocol it filed with it.

The six roles are `SUBMITTER`, `DATA_STEWARD`, `REVIEWER`, `SUPER_ADMIN`, `REGIERUNGSPRAESIDIUM`
and `INTEGRATION`. Give `--rolle` more than once for an account that holds several. A
`REGIERUNGSPRAESIDIUM` account also needs `--regierungspraesidium`, a number from 1 to 4:
1 Stuttgart, 2 Karlsruhe, 3 Freiburg, 4 Tübingen.

## Language

The domain is German and stays German. Identifiers, database columns and API fields use the German
terms, matching the legacy PDF form's field paths. English exists only in the interface translation
files. [CONTEXT.md](CONTEXT.md) explains the vocabulary.
