# Protokoll E-Befischung - Project Overview

> Web application replacing the Fischereiforschungsstelle Baden-Württemberg's PDF-based
> electrofishing survey form, with drafts, review, and a controlled path into the state
> fisheries database.

> **Generated file. Don't hand-edit.** Produced by `/overview` from
> [../project-plan.md](../project-plan.md) and [../build-plan.md](../build-plan.md).
> When the plans change, re-run `/overview`.

## Problem

FFS collects electrofishing survey data on a four page PDF form, the Protokoll E-Befischung. It
only works in Adobe Acrobat with JavaScript enabled and does not work in a browser at all.
Completed forms are emailed to FFS and the responsible regional authority, then keyed into FiaKa,
the official fisheries database, by hand.

That process cannot save and resume a partial form, has no review step, no search across past
surveys, and no audit trail. It also carries validation bugs that have let incorrect data through
for years, two of which mean data already in FiaKa is wrong.

## Users

No public sign-up. Every account is created by an administrator.

| Role | Needs | Sees |
|---|---|---|
| **Submitter** | Fill in long protocols over several sittings, resume anywhere | Only their own submissions |
| **Data Steward** | Correct and quality-check submitted data | All submissions |
| **Reviewer** | Accept, reject, or request changes | All submissions |
| **Super Admin** | Manage accounts and roles | Everything, plus administration |
| **Regierungspräsidium** | Confirm that permit holders filed properly | Own region only, read-only, no drafts |
| **Integration account** | Transfer accepted records to FiaKa | Machine only, no interactive login |

Submitters are often external: consultants, engineering firms and angling associations, not only
FFS staff.

## Features

In `build-plan.md` order. **Items 4 to 9 are the headline**: they are the protocol itself, and
everything else exists to support them. Item 9 carries the most risk.

1. **Project skeleton** - Docker Compose, Postgres with PostGIS, FastAPI, the React shell, KERN
   themed, translation and theme wiring, and the Verify command.
2. **Accounts and login** - JWT in an httpOnly cookie, the six roles, first-admin command,
   activate and deactivate.
3. **Draft lifecycle** - create a submission, automatic saving, local safety copy, "my
   submissions" list.
4. **Form part 1** - occasion, recorder details, and the Probestrecke, with the Vorfluter chain
   and coordinate entry bounded to Baden-Württemberg.
5. **Form part 2** - measurements and hydrology, with hydrology suppressed entirely for standing
   water types.
6. **Form part 3** - the six percentage blocks, each with a running total and a sum-to-100 rule.
7. **Form part 4** - in-water structures, usage influences, fishery management, stocking history.
8. **Form part 5** - equipment and fished areas.
9. **Form part 6** - the catch table: species picker, size classes, row totals, the young-of-year
   rule and the "no detection" rule.
10. **Attachments** - photo and map excerpt upload.
11. **Review workflow** - the state machine, rejection reasons, change requests, locking.
12. **Review queue** - list, filter and search, including by species.
13. **Regional access** - the Regierungspräsidium read-only role.
14. **Notifications** - email on submission and status change, plus a weekly digest, via a
    background worker.
15. **Audit trail** - who changed what data, and when.
16. **User administration** - account and role management.
17. **English translation** - the second locale filled in.

After MVP: the map picker and official water body dataset (18), transfer to FiaKa (19), PDF
generation (20), the Protokoll Krebs (21), offline field use (22).

## Data model

The central split, fixed by [ADR 0003](../../docs/adr/0003-json-answers-typed-envelope.md): if the
application queries, sorts, or authorises on a value it is a column; if it is only displayed back
to a human it lives in the `antworten` JSON document.

Domain fields use German names matching the legacy PDF field paths exactly.

### User

- `id` (uuid)
- `email` (string, unique) - the login identifier
- `password_hash` (string) - modern adaptive hash, never reversible
- `rollen` (enum list) - `SUBMITTER`, `DATA_STEWARD`, `REVIEWER`, `SUPER_ADMIN`,
  `REGIERUNGSPRAESIDIUM`, `INTEGRATION`
- `regierungspraesidium` (int 1-4, nullable) - set only on regional accounts, scopes what they see
- `locale` (`de` | `en`)
- `ist_aktiv` (bool) - deactivated accounts cannot authenticate
- `created_at`, `updated_at` (timestamp)

### Person

The `Bearbeiter`'s contact details, held once and reused rather than repeated inside every
submission. Separate from `User` because the account that files a protocol is not always the
person who carried out the survey.

- `id` (uuid)
- `name`, `firma`, `strasse`, `plz`, `ort`, `telefon`, `email` (string)
- optional link to `User`

### Gewaesser

- `id` (uuid)
- `name` (string) - stored exactly as entered, no casing transformation
- `vorfluter` (ordered string list, max 5) - the receiving-water chain, which must terminate at
  Rhein or Donau
- `amtliche_id` (string, nullable) - the authoritative GIS identifier. **Added in v1 and left
  empty**, backfilled by feature 18
- `gis_dataset_version` (string, nullable) - which dataset the identifier came from

> Locked shape. The nullable `amtliche_id` exists from v1 specifically so feature 18 is a backfill
> script rather than a schema change.

### Probestrecke

Its own entity, fixed by [ADR 0001](../../docs/adr/0001-probestrecke-is-a-first-class-entity.md).
The same stretch surveyed in different years is one record with several submissions against it.

- `id` (uuid)
- `gewaesser_id` -> `Gewaesser`
- `monitoringstrecke_nr` (string, nullable, unique when present) - natural key for WRRL and FFH
  monitoring sites
- `ortsangabe` (string)
- `gewaessertyp` (int) - `11` Graben, `12` Kanal, `13` Bach, `14` Fluss, `21` See, `26` Teich,
  `31` angebundenes Altwasser, `32` abgeschnittenes Altwasser
- `laenge_m` (int)
- `untere_grenze_rechtswert`, `untere_grenze_hochwert` (int) - EPSG:25832
- `obere_grenze_rechtswert`, `obere_grenze_hochwert` (int) - EPSG:25832
- `regierungspraesidium` (int 1-4) - drives regional access and notification routing

> Locked shape. `gewaessertyp` values below 20 plus `31` require the hydrology section; `21`, `26`
> and `32` suppress it entirely. Feature 5 depends on this.

### Submission

- `id` (uuid)
- `probestrecke_id` -> `Probestrecke`
- `person_id` -> `Person` - the Bearbeiter
- `owner_user_id` -> `User` - the account that filed it
- `bearbeiter_name` (string) - frozen snapshot, so historical records still read correctly if the
  Person record later changes
- `form_version` (string) - e.g. `20260609`. Never migrated
- `status` (enum) - `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `NEEDS_CHANGES`, `REJECTED`, `ACCEPTED`,
  `LOCKED`
- `anlass` (string) - coded. Values containing `wrrl` or `ffh` make `monitoringstrecke_nr` required
- `datum` (date), `uhrzeit` (time)
- `antworten` (JSON) - all roughly 338 form answers, schema-validated on write
- `created_at`, `updated_at`, `submitted_at`, `locked_at` (timestamp)

### The `antworten` document

Sketch of the shape. Exact keys follow the legacy field paths.

```
messdaten            wassertemperatur, leitfaehigkeit, sichttiefe, regenfaelle,
                     truebung, schaumbildung
hydrologie           breite, tiefe, tiefenvarianz, linienfuehrung, stroemung,
                     fliessgeschwindigkeit, wasserfuehrung, stillwasserbereich,
                     gesamtprofil, plus the two Schaetzwert estimates
umland                8 percentages, must total exactly 100
ufer                  randstreifen, neigung (4, total 100), bewuchs (9, total 100),
                      uferverbau (8, total 100), damm, wurzeln
gewaessersohle        substrat (8, total 100), sohlverbau (6, total 100), besonderheiten
strukturen            7 ratings, each 0 to 3
einfluesse            multi-select
bewirtschaftung       multi-select, plus the Fischereiausübungsberechtigter and
                      the Besatzmassnahmen rows
ausruestung           egeraet, spannung, ausgangsleistung, bauweise, anoden,
                      kathodentyp, anodenfuehrer
befischte_bereiche    2 rows: strecke, effektive breite, richtung, methode
arten                 list of { code, klassen[10], null_plus }
bemerkungen           free text
```

> Locked shape. `arten[].null_plus` may never exceed the sum of that row's `klassen`. An empty
> `arten` list requires one of the four "no detection" codes (`OFAN`, `OFAF`, `KNKR`, `KNMU`).
> Features 6, 9 and 12 all depend on this document's shape.

### FormVersion

- `version` (string, primary key) - e.g. `20260609`
- `definition` (JSON) - the field, option and validation definition for that version
- `gueltig_ab` (date)

> Locked by [ADR 0004](../../docs/adr/0004-freeze-form-versions.md). Submissions are never migrated
> between versions, so historical definitions must remain renderable read-only forever.

### Attachment

- `id` (uuid), `submission_id` -> `Submission`
- `art` (enum) - `KARTENAUSSCHNITT` | `FOTO`
- `dateiname`, `mime_type` (string), `groesse` (int), `storage_key` (string)
- `created_at` (timestamp)

### WorkflowEvent

- `id` (uuid), `submission_id` -> `Submission`, `actor_user_id` -> `User`
- `von_status`, `nach_status` (enum)
- `kommentar` (text, nullable) - required for `REJECTED` and `NEEDS_CHANGES`
- `created_at` (timestamp)

### AuditEvent

- `id` (uuid), `actor_user_id` -> `User`
- `entity` (string), `entity_id` (uuid), `feld` (string)
- `alt_wert`, `neu_wert` (text)
- `created_at` (timestamp)

## Tech stack

| Technology | Role |
|---|---|
| **React + TypeScript, built by Vite** | The frontend, built to static files ([ADR 0002](../../docs/adr/0002-vite-react-not-nextjs.md)) |
| **React Hook Form** | Form state. Required at 338 fields, where re-rendering everything per keystroke makes typing sticky |
| **Zod** | Browser-side validation for instant feedback. Never a gate |
| **TanStack Query** | Server calls, retries, and the automatic-save indicator |
| **KERN UX Standard** | Components, themed with BW colours ([ADR 0005](../../docs/adr/0005-kern-design-system.md)). Species picker and catch table built in-house |
| **FastAPI + Python** | The backend and the authoritative validation gate |
| **Pydantic** | Request and response validation. The rules enforced here are the real ones |
| **PostgreSQL + PostGIS** | Storage. PostGIS is present from v1 but only exercised by feature 18 |
| **Alembic** | Schema migrations |
| **MapLibre GL JS** | Maps, from feature 18 onward |
| **Docker + Docker Compose** | Packaging and local development |

## Monetization

Not applicable. This is a tool for a state authority, funded as such. No billing, subscription or
advertising, and none should be added.

## UI/UX

Plain and official rather than decorative, which is what the Baden-Württemberg guidance calls for
and what KERN is built to deliver. High contrast, large targets, obvious labels. Light and dark
both supported via tokens.

The protocol is long, so it is split into sections shown one at a time with a progress list, and
users may jump to any section in any order. Locking the order makes surveyors type placeholder
values to get past a gate and never return. Saving is automatic and its state always visible.

Accessibility is a requirement from the start: keyboard navigation, correct labels, visible focus,
sufficient contrast.

Main screens:

- `/` - the user's own submissions, or the review queue for staff
- `/protokolle/neu` - start a protocol
- `/protokolle/:id` - the protocol, section by section
- `/protokolle/:id/pruefung` - reviewer view with accept, reject and request-changes
- `/pruefung` - the review queue with filters and search
- `/verwaltung/benutzer` - user administration

> TODO: neither plan specifies whether routes are German or English. The German forms above follow
> the domain-language decision but are a guess.

## Deployment

Docker containers on an FFS-approved platform, with a reverse proxy as the only public entry point.

| Container | Public? |
|---|---|
| reverse proxy | Yes, the only entry point |
| frontend build, served by a minimal web server | No |
| FastAPI service | No, routed through the proxy |
| PostgreSQL with PostGIS | No, persistent storage, never ephemeral |
| background worker (email and reminders) | No |

- Health and readiness endpoints on the backend so the platform can judge service health
- Secrets supplied by the deployment environment, never from the repository or a container image
- Backups stored away from the database host, with the restore procedure tested rather than assumed
- FiaKa is never reachable from the public application. Transfer happens in feature 19 through a
  dedicated machine account

> TODO: the container platform, the mail server for notifications, and the domain are all still to
> be confirmed with FFS.

## Open questions

Ordered by how much they could still change.

1. **The backend language is committed but unconfirmed.** `project-plan.md` §5 names FastAPI and
   Python, but `docs/decisions.md` §14 still lists "is FastAPI genuinely required, or was it the
   requirements author's preference?" as open. If the answer is "preference", ADR 0002 says to
   revisit the whole two-service split, because it stops paying for itself. Settle this before
   feature 1.

2. **Coordinates sit in two places across the documents.** This overview puts the boundary
   coordinates on `Probestrecke`, where they belong, since a stretch has boundaries independent of
   any one visit. `docs/decisions.md` §7 lists coordinates among the `Submission` columns. These
   need reconciling. Per-submission as-surveyed coordinates become relevant with feature 18, which
   requires storing both typed and snapped values.

3. **Build item 1 bundles roughly seven things** - Compose, database, backend, frontend, theming,
   translation wiring and Verify. It will almost certainly split into 1a, 1b and so on when
   `/feature` specs it. That is expected, not a problem, but do not expect it to be one step.

4. **Route language is unspecified** by either plan. See the TODO under UI/UX.

5. **Option lists are not yet extracted** - the species list, `Anlass` values, monitoring stretch
   numbers and cathode types. This is on the pre-build list in `build-plan.md` and blocks features
   4 and 9, not features 1 to 3.

6. **Data retention is undefined.** `project-plan.md` §8 defers it to FFS. It does not block
   building, but the `Person` and `Submission` split already assumes personal details can be
   anonymised independently of the survey record. If FFS decides otherwise, revisit.

7. **`project-plan.md` §3 does not list user administration** among the MVP features, though §2
   gives Super Admins that job and `build-plan.md` has it as item 16. Minor, but the plan's feature
   list should gain a line.

Not a plan conflict, but worth restating: the original requirements document makes the mapping
features mandatory for the first release. Both plans deliberately defer them to feature 18, with
only the `amtliche_id` column added in v1 to keep that a backfill. That deviation is recorded in
`docs/decisions.md` §9 and should be agreed with whoever owns the requirements.
