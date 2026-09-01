# AGENTS.md

Instructions for AI coding agents working in this project. This is the cross-tool
entry point: Codex, Cursor, GitHub Copilot, Gemini CLI, Aider, Zed, Windsurf, and
others read `AGENTS.md`. Claude Code reads `CLAUDE.md`, which imports this file, so
there is a single source of truth.

## What this is

A web application replacing the Fischereiforschungsstelle Baden-Württemberg's PDF-based
electrofishing survey form, the Protokoll E-Befischung. Users log in, fill in the
protocol over several sittings, and submit it. FFS staff review it, and accepted
protocols are later transferred into FiaKa, the official fisheries database.

The domain is German and stays German: identifiers, database columns and API fields
use the German terms from the legacy form. English exists only in interface
translation files. Read `CONTEXT.md` for the vocabulary and `docs/decisions.md` for
why the stack and data model are what they are.

This project is built with the **AI Blueprint**, a workflow layer, not an
app skeleton. To start a new project, scaffold the app first in an empty folder
(create-next-app, Vite, etc.), then overlay these files on top. Never run a
framework scaffolder inside a directory that already holds the blueprint files
(`AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `blueprint/`); it fails
because the directory isn't empty.

New here? `README.md` explains the whole workflow.

## Read these for full context

- `blueprint/context/project-overview.md` - the project's source of truth
- `blueprint/context/coding-standards.md` - conventions to follow
- `blueprint/context/ai-interaction.md` - how to work with the user on this project
- `blueprint/context/current-feature.md` - the one feature, fix, or rollback being built right now

## Workflow

Build one feature, fix, or rollback at a time, behind review gates. Each step's instructions
are plain markdown skills any capable agent can read and follow. The workflow is
exposed through tool-specific adapters:

- Codex: `.agents/skills/<skill>/SKILL.md`
- Claude Code: `.claude/skills/<skill>/SKILL.md`

Unused adapters can be removed. Codex-only projects can delete `CLAUDE.md` and
`.claude/`. Claude Code-only projects can delete `.agents/`, but should keep
`AGENTS.md` because `CLAUDE.md` imports it.

When changing shared workflow behavior, update the matching skill in both
adapter folders so Codex and Claude Code stay aligned.

Core skills:

- `onboard` - tune commands, standards, visibility, ignore rules, and tool adapters after overlaying the Blueprint onto a freshly scaffolded or early project
- `doctor` - read-only Blueprint health check for setup, adapters, plans, overview freshness, and workflow drift
- `adopt` - bootstrap the Blueprint into an existing brownfield app with shipped features
- `overview` - distill the two planning docs into `blueprint/context/project-overview.md`
- `brief` - read-only briefing on an upcoming build-plan feature (scope, dependencies, size) before you spec it
- `feature` - turn a build-plan item into a spec, or propose a reviewed plan addition for a genuinely new feature
- `fix` - document an ad-hoc bug or change into `blueprint/context/current-feature.md`
- `tests` - add or normalize unit testing and turn on the test gate
- `ci` - explicitly set up one project-specific Verify command and matching automatic GitHub checks
- `implement` - build the current spec one small, reviewed step at a time
- `check` - prove the current spec against the running app
- `try` - read-only manual review guide: where to go, what to click, what to expect
- `audit` - branch-aware or full-project review for code quality, security, performance, tests, and standards drift; records findings with durable IDs and statuses in `blueprint/context/findings.md`, where open or fixed P0/P1 findings block `complete`
- `rollback` - plan a safe reversal of a completed feature from its archive and exact git commit, with later-dependency review before code changes
- `complete` - run the final safety pass, log features, fixes, or rollbacks under `blueprint/history/`, then merge with approval
- `release` - optional Render or Vercel deployment readiness, local config, env review, and smoke-test planning
- `prototype` - optional, pre-build static mockups to lock the look
- `status` - read-only progress summary, workflow drift warning, and suggested next action

In Codex, invoke these as skills (`$onboard`, `$overview`, `$feature`,
`$implement`, and so on) or ask naturally, such as "run the overview." In Claude
Code, use the slash commands (`/onboard`, `/overview`, `/feature`, and so on). In
tools without native skills, follow the matching `SKILL.md` manually. The
conventions in `blueprint/context/` apply however a step is invoked.

Optional explicit-only skill: `autopilot` can run one bounded spec/build/check
and targeted-audit pass when directly invoked. It may create checkpoint commits
on the feature or fix branch after passing steps, repair confirmed P0/P1 findings
within scope, and rerun affected checks. It stops before `/complete`, merge, push,
deploy, or destructive actions.

Deployment is also explicit. `/release` can prepare local Render or Vercel config
and run readiness checks, but it must stop before deploy, remote service changes,
push, or publish unless the user gives a separate yes in the current chat.

## Automatic verification

Automatic GitHub checks are a separate explicit setup. `/onboard` and `/adopt`
only report existing checks and point to `/ci` or `$ci` when none exist. Running
`/ci` inspects the real project and defines one `Verify` command from checks that
already exist. Use this order when available: typecheck, tests, then build. Never
invent a test runner or another check just to fill the command.

For JavaScript and TypeScript projects, prefer a package script such as `verify`
and use the detected package manager. For other stacks, use the native task
runner or exact combined command. Record the exact command under Commands below.

The optional `.github/workflows/verify.yml` must run that same command for pull
requests and pushes to the default branch. Preserve existing workflows, use the
project's real runtime and install command, and grant only `contents: read` by
default. This setup does not add local git hooks, coverage, browser tests,
security scans, or version matrices. Those remain later project choices.

GitHub branch protection or a ruleset can require the check after the repository
is pushed, but that is a separate remote setting. Missing automatic GitHub
checks do not make the Blueprint unusable.

## Commands

A monorepo with two runtimes. There is no root `package.json`; run commands from
the relevant directory. Every command below was run on 2026-08-31 during feature
1c; do not add one here that has not been executed.

**The stack** (from the repository root, needs Docker Desktop running)

- Copy `.env.example` to `.env` once. It is git-ignored.
- Start: `docker compose up -d --build`
- Status: `docker compose ps`
- Stop, keeping data: `docker compose down`
- Stop and **delete the database**: `docker compose down -v`
- Backend: http://localhost:8000, API docs http://localhost:8000/api/v1/docs
- Postgres is published on `localhost:5432`, so the backend can also be run
  directly on the host against the same database.

**Frontend** (from `frontend/`)

- Dev server: `npm run dev` (http://localhost:5173, proxies `/api` to the backend)
- Build: `npm run build`
- Preview the build: `npm run preview`
- Lint: `npm run lint`
- Tests: `npm test` (vitest, added in feature 4a)

**Backend** (from `backend/`)

The virtual environment is not committed. Create it once:

- `py -m venv .venv` on Windows, `python3 -m venv .venv` elsewhere
- `.venv\Scripts\python -m pip install -e ".[dev]"` (Windows) or
  `.venv/bin/python -m pip install -e ".[dev]"`

Then, with `.venv` on PATH or via `.venv\Scripts\python -m`:

- Dev server: `uvicorn app.main:app --reload` (http://localhost:8000)
- Tests: `pytest`
- Lint: `ruff check .`
- Types: `mypy .`

**Test command: `pytest`, from `backend/`.** Switched on in feature 1c, because
that feature added the first backend logic where a wrong answer is possible: the
readiness check. The gate applies to logic-bearing backend steps.

**Frontend test command: `npm test`, from `frontend/`.** Vitest, added in feature 4a
for the draft store, which decides whether a half-finished protocol survives a
reload. It runs in a node environment: the store takes its storage as an
argument, so it needs no DOM. Components and integration surfaces are still
verified with browser evidence and the build, not with unit tests, exactly as
`coding-standards.md` says. An empty run exits non-zero, so "no tests ran" can
never read as "passed".

Note the Python version gap: `pyproject.toml`, ruff and mypy all target 3.12 and
the container image is pinned to `python:3.12-slim`, but development on the
current machine runs 3.14. Accepted knowingly on 2026-08-31.

There is no `Verify` command yet. Run `/ci` to define one and add matching GitHub
checks; that is a separate setup step from the feature loop.
