# Coding Standards

> Rewritten for the real stack after the design session. The previous version described a Next.js
> project and no longer applies. Reasoning for the stack choices is in
> [../../docs/decisions.md](../../docs/decisions.md) and the ADRs under `docs/adr/`.

## Repository shape

A monorepo with one directory per deployable component.

```
frontend/     React + TypeScript, built by Vite
backend/      FastAPI + Python
database/     Alembic migrations and seed data
deployment/   Docker Compose, reverse proxy config, deployment manifests
docs/         decisions, ADRs, the FFS defect list
```

## Language

The domain is German and stays German. Identifiers, database columns and API field names use the
German terms, matching the legacy PDF field paths exactly (`probestrecke.gewaesser.vorfluter1`,
`arten.art7.klasse_3`, `messdaten.leitfaehigkeit`). English appears only in interface translation
files.

This is deliberate. It keeps the eventual FiaKa mapping a direct match instead of a lookup table
somebody has to maintain. The vocabulary is defined in [../../CONTEXT.md](../../CONTEXT.md); read it
before naming anything new, and update it when a term is settled.

General programming vocabulary stays English as normal. This rule is about domain terms only.

## TypeScript (frontend)

- Strict mode on
- No `any`. Use `unknown` and narrow it
- Interfaces for props, API responses and domain models
- Inference where it is obvious, explicit types where they help the reader

## React

- Function components only
- One job per component
- Reusable logic goes in custom hooks
- `React.memo` and friends only when a measurement showed a problem, never pre-emptively

### Forms

The protocol has roughly 338 fields, so form performance is a real constraint, not a theoretical
one.

- **React Hook Form** for all form state. Do not hold form values in `useState`, Redux, Zustand or
  a context, because re-rendering the whole form on every keystroke makes typing feel sticky at
  this size.
- **Zod** for browser-side validation, giving instant feedback.
- **TanStack Query** for server calls, including the automatic save.

Browser validation is a convenience, never a gate. Every rule is enforced again in the backend.
Validation is therefore written twice, once in Zod and once in Pydantic. Keep the two definitions
next to each other in the code and change them together.

## Styling and components

- **MUI** for components, themed against our own design tokens
  ([ADR 0006](../../docs/adr/0006-mui-supersedes-kern.md), superseding ADR 0005, which chose KERN)
- **Use MUI wherever MUI has a component**, decided on 2026-09-01 during feature 4a for form
  controls and widened on 2026-09-05 during feature 9a to cover everything else MUI ships. Reach
  for `Select`, `TextField`, `Checkbox`, `RadioGroup` and `Autocomplete` before writing a native
  control, and for `Table`, `TableRow` and `TableCell` before writing a bare `<table>`. There is no
  carve-out for components that only supply styling rather than behaviour: the rule is one rule so
  that it needs no judgement call per case. Where MUI's default composition fights the approved
  mockups, theme MUI to match the mockup in `muiTheme.ts` rather than dropping to a hand-styled
  native element. The label sits above the field, so use `FormLabel` inside a `FormControl`, not
  `InputLabel` and its border notch. A native element is right only where MUI genuinely has no
  equivalent at all, such as a table's `<caption>`; "it lives in a separate MUI X package" does not
  count, and that trade-off is put to the user rather than decided quietly. This matters because
  the form has roughly 338 fields: whatever the first one does, the rest copy
- **Theme a component once, not per use.** Anything MUI renders in more than one place is styled in
  `muiTheme.ts` under `components`, so the next feature to use it inherits the look instead of
  restating it. The catch table's cells were themed this way in feature 9a specifically so the
  review queue in feature 12 and the user list in feature 16 do not each rebuild a table style. A
  per-instance class is for what only that one place needs
- **The tokens in `frontend/src/styles/theme.css` outrank MUI's defaults.** Configure MUI's theme
  from them in one place. Do not scatter per-component `sx` colour overrides, and never hard-code a
  colour to work around the theme
- **The app must not read as a Material app.** The BW accent, the 4px radius, flat surfaces, no
  elevation shadows. The approved mockups in `prototypes/` are the target
- Do not introduce a second component library alongside MUI. Where MUI falls short, build the
  component in-house on a headless primitive and style it from the tokens
- **Accessibility does not come free with MUI**, unlike KERN, where it was the primary design goal.
  Keyboard navigation, label association, visible focus and contrast in both themes are explicit
  acceptance criteria on every UI feature, checked against our tokens rather than assumed
- Light and dark both supported, defined as tokens, never hard-coded colours
- Accessibility is a requirement, not a later pass: keyboard navigation, correct labels, visible
  focus, sufficient contrast

## Python (backend)

- Type hints on everything. `mypy` runs in CI
- **Pydantic** models for every request and response. This is the authoritative validation
- Routers stay thin: parse, authorise, delegate, return. Business rules live in a service layer, not
  in route handlers
- Domain rules (the sum-to-100 blocks, hydrology suppressed for standing waters, young-of-year not
  exceeding a species total, the "no detection" rule) live in plain functions that take and return
  values, so they are testable without a database or an HTTP request
- Format with `ruff`

## API

- REST, versioned under `/api/v1`
- Authorisation is enforced on the server for every protected operation. Never rely on the frontend
  having hidden a button
- OpenAPI documentation is generated by FastAPI and checked into version control

## Database

- PostgreSQL with PostGIS
- All schema changes go through Alembic migrations. Never hand-edit a deployed schema
- **Submission storage follows [ADR 0003](../../docs/adr/0003-json-answers-typed-envelope.md):** the
  envelope is real columns, the form answers are one JSON document. If the application queries,
  sorts or authorises on a value, it is a column. If it is only displayed back to a human, it is
  JSON
- The JSON document is schema-validated on write. A loosely typed column is not an excuse for
  unvalidated data
- Spatial values use EPSG:25832 (ETRS89 / UTM zone 32N), which is what the source forms use

## Errors

- Backend raises typed domain exceptions, translated to HTTP responses in one place
- Never leak internal detail into a user-facing error
- Frontend shows a specific, actionable message next to the field it concerns
- Structured logs with a request id, so one user's report can be traced

## Testing

The switch is a `test` command in the Commands section of `AGENTS.md`. Once it is there, tests are a
gate for logic-bearing steps, not an optional extra.

**What to test.** Logic where a wrong answer is possible. On this project that means: the
percentage block rules, the conditional hydrology rules, the catch table rules, the Vorfluter chain
rule, the coordinate bounds check, the workflow state machine, and every permission check.

**What not to test with unit tests.** Components rendering and integration surfaces. Verify those
with browser evidence and the build.

**The gate.** A step that adds in-scope logic ships a passing test in the same diff. The test
command must be green before the step is approved, before any checkpoint commit, and before
`/complete` merges. An empty suite must fail, not pass, so "no tests ran" never looks like "passed".

**Tools.** `pytest` for the backend, `vitest` for the frontend. Test files sit next to the code they
cover.

**Permission tests are not optional.** There must be a test proving a submitter cannot read another
submitter's submission, and one proving a Regierungspräsidium account cannot see another region.

## Browser verification

Prefer real browser evidence over reading the code and assuming. Playwright is not installed. Do
not add it silently mid-feature; add it only when asked, or when the step is explicitly about
setting up browser automation. Until then use the dev server, screenshots, API output and the build.

## Code quality

- No commented-out code
- No unused imports or variables
- Functions under 50 lines where reasonable

## Comments

Write code that explains itself. Comment only what the code cannot say. Over-commenting is a common
AI tell.

- Comment the **why**, not the **what**. Delete any comment that restates the code
- No banner blocks, section dividers, or narration of obvious code
- A comment earns its place when it captures a non-obvious decision, a gotcha, why a value is what
  it is, or a link to a spec

There is one exception on this project. Where a rule comes from the legacy PDF or from a German
regulation, a short comment naming the source is worth having, because the reason is genuinely not
inferable from the code. For example, why hydrology vanishes for `Gewässertyp` 21, 26 and 32.

## Writing

- No em dashes (U+2014) anywhere: docs, comments, commit messages, specs
- Use a hyphen for `term - description`. Rephrase prose with commas, parentheses or a colon
- Avoid en dashes and the ellipsis character too
