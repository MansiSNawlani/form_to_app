# Feature: Das Gewässernetz laden

**From build-plan:** feature 18b
**Status:** built, awaiting review
**Branch:** `feature/18b-gewaessernetz-laden`

## Goal

Load LUBW's official water body network (AWGN) into PostGIS, one dataset release at a time, with
a command an administrator runs. Replace the rectangle in the coordinate check with the real
Baden-Württemberg border, so a point in Bavaria, Hesse, Alsace or Switzerland is caught as well as
a typo. 18c (search), 18d (snapping) and 18e (identifiers) all read the table this builds.

## Decisions taken while speccing (2026-10-14, Mansi)

| Question | Answer |
|---|---|
| Where the border comes from | BKG's **VG250** (Verwaltungsgebiete 1:250 000, Stand 01.01.), open data under dl-de/by-2.0 |
| How strict the border is | A point **more than 2 km outside** the border is refused. Within 2 km it passes, so stretches on the Rhein, Main, Tauber and Iller are not refused for sitting on the far bank |
| What a standing water stores in `amtliche_id` | Its AWGN **`SEE_ID`**. A flowing water stores its 13-digit Gewässerkennzahl |
| What happens to an older release | **Kept.** Releases sit side by side, so an identifier can always be looked up in the release it came from. 18c and 18d use the newest |

## What the real files hold (inspected on 2026-10-14)

Both AWGN archives were downloaded and read before this spec was written, so the column names
below are facts, not guesses.

| | Fließgewässer | Stehende Gewässer |
|---|---|---|
| Download | `https://rips-datenlink.lubw.de/UDO_download/Fliessgewaessernetz.zip` (80 MB) | `https://rips-datenlink.lubw.de/UDO_download/StehendeGewaesser.zip` (10 MB) |
| Shape type | 23, **PolyLineM** (lines carrying a measure) | 5, Polygon, some multipart |
| Records | 20 421, **one per water**, no grouping needed | 11 509 |
| Identifier | `GEW_KENNZA`, a **float** in the DBF (`2381333920000.0`, with fifteen decimal places), always 13 digits, unique | `SEE_ID`, a float (`7174.0`), unique |
| Name | `GEW_NAME`, never empty | `LANGNAME`; 9 879 of them are placeholders like `NN-YBP` |
| Also useful | `VOR_GEW_KE`, `VOR_GEW_NA` (the receiving water's GKZ and name) | `FGKZ_NR` (GKZ of the catchment it lies in) |
| Release | `STAND_FACH` = `Mai 2025` | same |

Both are ETRS89 / UTM zone 32N (EPSG:25832), encoded in Windows-1252 (DBF codepage byte `0x58`).
The flowing-water network reaches past the state border (bounding box 354 000 to 642 000 east).
**The file names inside the zips contain `ä` stored in a way that unpacks as `Gew+ñssernetz`**, so
the reader finds the `.shp` by extension, never by name.

VG250's `VG250_LAN.shp` holds Baden-Württemberg as several records with `ARS = '08'`: the land
(`GF 4`), water areas (`GF 1`, `GF 2`) and a separate `Baden-Württemberg (Bodensee)`. The
international part of the Bodensee belongs to no state there, and FFS sits on the Bodensee, so
the border is joined with AWGN's `Bodensee - Obersee` (38252) and `Bodensee - Untersee` (38253).

## In scope

- Two tables: the loaded releases (`gewaessernetz_stand`) and the waters in them
  (`gewaessernetz`), with geometry in EPSG:25832 and a spatial index
- A reader that turns the two AWGN shapefiles into plain records, refusing a wrong file,
  a wrong coordinate system and a missing column with a message that gives a way out
- A service that loads one release in one transaction, and refuses a release already loaded
- `befischung gewaessernetz laden` and `befischung gewaessernetz liste`
- A one-off script that builds the 2 km-widened Baden-Württemberg border from VG250 plus the
  Bodensee, simplified, and writes it to a committed file under `database/seed/`
- The coordinate rule checking each boundary point against that border, in Pydantic's half and
  Zod's half, with one new message in German and English
- The 18a map showing a marker only for a point that passes the border, as it does today for
  the rectangle
- Commands, vocabulary, attribution and flow diagrams brought up to date

## Out of scope

- Searching the network by name: 18c. No name index or `pg_trgm` here
- Snapping and the far-from-water warning: 18d
- Writing `amtliche_id` or `gis_dataset_version` onto any Gewässer: 18c and 18e
- Drawing the network on the map, and any API endpoint that reads it
- Downloading from LUBW automatically, scheduled reloads, or deleting an old release
- Re-checking protocols already submitted or accepted against the new border. The rule runs
  where it runs today: on save, on import and on submit

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Tables and migration** - add `geoalchemy2` and `pyshp` to the backend's runtime
  dependencies. Model `GewaessernetzStand` and `Gewaessernetz` in `app/models/gewaessernetz.py`
  as under Data / contracts, and one hand-checked Alembic migration. *Done when:* `alembic upgrade
  head`, `alembic downgrade -1`, `alembic upgrade head` and `alembic check` all run clean against
  the compose database; `\d gewaessernetz` shows the geometry column with SRID 25832, the GIST
  index, the unique key and the geometry-type check; `pytest`, `ruff check .` and `mypy .` pass.

- [x] **Step 2 - Reading the shapefiles** - `app/gewaessernetz/lesen.py`: plain functions taking
  a `.zip` or a directory and yielding `Netzeintrag` records (art, kennung, name, Vorfluter
  kennung and name, geometry as WKB in 2D). Kennung formatting: GKZ float to a 13-digit string,
  `SEE_ID` float to an integer string. It also reports the release the file names in
  `STAND_FACH`. Typed errors in `app/gewaessernetz/fehler.py` for: no
  `.shp` in the archive, a shapefile of the wrong kind (no `GEW_KENNZA` and no `SEE_ID`), a `.prj`
  that is not ETRS89 UTM 32N, a flowing-water file given where the standing one belongs and the
  other way round. *Done when:* tests beside it, using tiny shapefiles written by pyshp into
  `tmp_path` (so they never need `Resources/`), cover every formatting rule and every refusal, and
  a PolyLineM comes out without its measure; reading the real archive yields 20 421 and 11 509
  records (run by hand, recorded in Evidence).

- [x] **Step 3 - Loading a release** - `app/gewaessernetz/dienst.py`: `lade_stand(session,
  stand, fliessgewaesser, stehende)` inserts the release row and every water in one transaction,
  in batches, and raises `StandBereitsGeladen` for a release already present. Geometry goes in
  through `ST_Multi(ST_GeomFromWKB(:wkb, 25832))`. *Done when:* database tests (skipping when no
  database is reachable) prove a small release lands with the right counts, a second load of the
  same release is refused and leaves the first untouched, a failure halfway leaves nothing behind,
  and two releases sit side by side.

- [x] **Step 4 - The command** - `befischung gewaessernetz laden --stand 2025-05-01
  --fliessgewaesser <zip> --stehende <zip>` and `befischung gewaessernetz liste`, messages in
  German naming the thing, the reason and the way out, as `cli.py` already does. Prints progress,
  the two counts and the time taken. *Done when:* `cli_test.py` covers success, the duplicate
  release, a missing file, a wrong file, a `--stand` that is not a date, and a `--stand` whose
  month and year disagree with the files' `STAND_FACH` (`Mai 2025` for `2025-05-01`); the real 2025-05-01 release loads into the compose
  database from the host and `liste` shows it with 20 421 and 11 509 waters (recorded in
  Evidence, with the load time and the table size).

- [x] **Step 5 - The border file** - `backend/scripts/landesgrenze.py`, a one-off like
  `extract_form_definition.py`: reads every `ARS = '08'` record of `VG250_LAN.shp` and the two
  Bodensee polygons from AWGN, unions them, widens by 2 000 m, simplifies with a tolerance of at most 100 m (so the margin never shrinks
  below 1.9 km), rounds to whole metres
  and writes `database/seed/landesgrenze/landesgrenze_bw.json` with its source, release, licence
  and widening recorded in the file. `shapely` joins the backend's dev dependencies only, since
  nothing at run time needs it. *Done when:* the file is committed and under 100 KB; a test beside
  the script regenerates it and compares when the source files are present and skips with a
  message naming them when they are not; a second test, always run, checks the committed file:
  one or more polygons, every coordinate an integer inside the old rectangle.

- [x] **Step 6 - The backend rule** - `formregeln/landesgrenze.py`: a pure point-in-polygon
  (even-odd, holes respected) over the committed file, read once. `koordinaten.py` checks each of
  the two boundary points after both its values pass the rectangle, and adds
  `protokoll.regeln.koordinateAusserhalbLandes` to **both fields of that point**. The rectangle
  stays: it is what names a swapped Rechtswert and Hochwert. *Done when:* tests prove Stuttgart,
  a point on the French half of the Rhein at Kehl, mid-Obersee, mid-Untersee and Neu-Ulm (within
  2 km) pass; Colmar, Munich, Würzburg, Zürich and Frankfurt are refused; every existing backend test still passes,
  including the demo, import and e2e fixture protocols.

- [x] **Step 7 - The browser rule and the map** - `regeln/landesgrenze.ts` reading the same JSON
  file (`vite.config.ts` widens its existing allow entry from `form_version_20260609` to
  `database/seed`), the same algorithm and the same test cases as step 6, ported case for case.
  `koordinaten.ts` and `karte/umrechnung.ts` use it, so the marker vanishes for a point outside
  the border exactly as it does today outside the rectangle. German and English wording for the
  new key. *Done when:* `npm test`, `npm run lint` and `npm run build` pass; in the browser,
  typing Munich's coordinates into section 1 shows the message next to both boxes and no marker,
  and Stuttgart's shows a marker and no message (screenshot in Evidence); `npm run e2e` still
  passes.

- [x] **Step 8 - Documentation** - `AGENTS.md` Commands: the two `gewaessernetz` commands, the
  border script, and where to download AWGN and VG250 into `Resources/` (untracked). `CONTEXT.md`:
  the term **Gewässernetz**. The licence wording for both datasets in `docs/` beside the existing
  basemap.de attribution. The flow diagrams under `blueprint/history/flow_diagrams/` gain the
  network table, the load command and the border file. The comments in `koordinaten.py` and
  `koordinaten.ts` that say the real border "belongs to feature 18" are rewritten. *Done when:*
  a reader following `AGENTS.md` alone could load a release onto a fresh database.

## Files / areas

- `backend/pyproject.toml` - `geoalchemy2`, `pyshp`; `shapely` under dev
- `backend/app/models/gewaessernetz.py`, `backend/app/models/__init__.py`
- `database/migrations/versions/20261014_8f948c3df12b_gewaessernetz.py`
- `backend/app/gewaessernetz/` - `lesen.py`, `dienst.py`, `fehler.py`, `beispiele.py` (tiny
  AWGN-shaped shapefiles for tests) and their tests
- `backend/app/cli.py`, `backend/app/cli_gewaessernetz_test.py` (its own file, as
  `cli_demo_test.py` is, rather than `cli_test.py`, whose fixtures are about accounts)
- `backend/scripts/landesgrenze.py` and its test
- `database/seed/landesgrenze/landesgrenze_bw.json` (generated, committed)
- `backend/app/config.py`, `backend/Dockerfile`, `.env.example` - `LANDESGRENZE_DATEI`
- `backend/app/protokolle/formregeln/landesgrenze.py`, `koordinaten.py` and their tests
- `frontend/src/protokoll/regeln/landesgrenze.ts`, `koordinaten.ts` and their tests
- `frontend/src/protokoll/karte/umrechnung.ts` and its test
- `frontend/src/protokoll/abschnitte/teil1/ProbestreckeBlock.tsx` - the two boxes of a point
  recheck each other
- `frontend/vite.config.ts`, `frontend/tsconfig.app.json`, `frontend/src/i18n/index.ts`,
  `frontend/src/i18n/locales/de.json`, `en.json`
- `frontend/e2e/karte.spec.ts`
- `AGENTS.md`, `CONTEXT.md`, `docs/datenquellen.md`, `docs/deployment-vercel.md`,
  `blueprint/history/flow_diagrams/FRONTEND_ARCHITECTURE_DIAGRAM.puml`

## Data / contracts

**Load-bearing for 18c, 18d and 18e.**

`gewaessernetz_stand`, one row per loaded release:

| Column | Type | Notes |
|---|---|---|
| `stand` | date, primary key | The first of the month the files name, `2025-05-01` for `Mai 2025`; any other day is refused, so one release cannot load twice under two dates. Written to `Gewaesser.gis_dataset_version` as `AWGN 2025-05-01` by 18c and 18e |
| `geladen_am` | timestamptz | The newest `stand` (by the date it names, not by `geladen_am`) is what search and snapping use |
| `anzahl_fliessgewaesser`, `anzahl_stehende` | int | Recorded at load, shown by `liste` |

`gewaessernetz`, one row per water per release:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Generated in Python, as every id here |
| `stand` | date, FK to `gewaessernetz_stand`, `ON DELETE CASCADE` | |
| `art` | enum `FLIESSGEWAESSER` \| `STEHENDES_GEWAESSER` | Tells a GKZ from a See-ID |
| `kennung` | text | 13-digit GKZ, or the `SEE_ID` as an integer string. What goes into `amtliche_id` |
| `name` | text | Exactly as LUBW writes it. Placeholder names like `NN-YBP` kept as they are; 18c decides how to show them |
| `vorfluter_kennung`, `vorfluter_name` | text, nullable | Flowing waters only. 18c may build the Vorfluter chain from these |
| `geometrie` | `geometry(GEOMETRY, 25832)` | `MULTILINESTRING` for flowing, `MULTIPOLYGON` for standing, 2D, checked against `art` |

Unique on `(stand, art, kennung)`. GIST index on `geometrie`. Rows are never updated: a release
is loaded whole or not at all.

`database/seed/landesgrenze/landesgrenze_bw.json`:

```
{ "quelle": "<both datasets, their releases and licences, in words>",
  "veraenderung": "<the Veraenderungshinweis dl-de/by-2-0 asks for>",
  "srid": 25832, "verbreiterung_m": 2000,
  "polygone": [ [ <outer ring>, <hole>, <hole> ], [ <outer ring> ] ] }
```

Each ring is a list of `[rw, hw]` pairs. The release and the licence sit inside `quelle` rather
than in keys of their own, because the file draws on two datasets with two of each; the code reads
only `polygone` and `verbreiterung_m`.

Each polygon is its outer ring followed by any holes, integer metres in EPSG:25832.

New message key: `protokoll.regeln.koordinateAusserhalbLandes`.

## Testing

The test gate is on (`pytest` in `backend/`, `npm test` in `frontend/`). In-scope logic needing
tests:

- **The reader** (step 2): identifier formatting, dropping the measure, every refusal
- **The loader** (step 3): counts, the duplicate release, rollback on failure, two releases
- **The command** (step 4): success and each refusal, through `cli_test.py`'s existing pattern
- **The border file** (step 5): regenerates identically when the sources are present
- **Point in polygon** (steps 6 and 7): the same named places on both sides, plus holes and a
  point exactly on an edge

The map marker and the message's placement ride on a screenshot and the existing e2e suite.
The real-data load is evidence, not a test, because the archives are not in the repository.

## Notes for the AI

- **Server is the gate.** The border check runs in both halves, but the backend's verdict is
  what counts. Both read one file, so they cannot disagree about where the border is.
- **The rules stay pure.** `landesgrenze.py` takes values and returns values: no database, no
  HTTP. The border is a committed file precisely so the rule needs no table.
- **GeoAlchemy2 creates its own spatial index** unless told not to. Set `spatial_index=False`
  and declare the GIST index explicitly, or `alembic check` reports drift. Check the existing
  `env.py` filter for PostGIS's own tables still covers what GeoAlchemy2 adds.
- **The test database needs PostGIS.** It already has it through the baseline migration; check
  before assuming.
- **Loading is a deploy step, like migrating.** Never at startup. The archives are large, so the
  documented path is running the command from the host against `localhost:5432`, not copying
  80 MB into the container.
- **Identifiers are text.** A GKZ read as a float must never be written through `str(float)`:
  `2381333920000.0` is not a GKZ. Format through `int()` and check it is 13 digits.
- **Attribution is a licence condition**, for AWGN (CC BY 4.0, LUBW) and VG250 (dl-de/by-2.0,
  © GeoBasis-DE / BKG), and the border file is a modified work of VG250, so it says so.
- **Writing rules:** German identifiers, no em dashes, messages that name the thing, the reason
  and the way out. Update the flow diagrams in the same feature
  (a standing request from Mansi).
- **FFS may still answer question 16 differently.** Keep the AWGN-specific column names inside
  `lesen.py`, so another dataset is a new reader, not a new table.

## What building it turned up

- **Nothing had ever switched PostGIS on.** The development database had the extension only
  because the postgis/postgis image creates it on first start; the test database pytest creates
  did not, and neither would a managed one. The 18b migration now runs `CREATE EXTENSION IF NOT
  EXISTS postgis` and leaves it in place on downgrade.
- **pyshp hands back requested fields in the file's order**, not the order asked for, so
  `iterRecords(fields=[...])` silently reads the wrong column. The reader reads by name.
- **The border is one polygon with one hole.** Büsingen merges into the state once widened, and
  the hole is the Hessian enclave in the Neckar valley around Neckarsteinach, more than 2 km from
  any part of Baden-Württemberg. 855 points, 15 KB.
- **`stand` is a date, not text** as first drafted, so "the newest release" is an ORDER BY. The
  code review found that the files name only a month, so `2025-05-01` and `2025-05-15` would have
  loaded the same download twice; the date must now be the first of the month.
- **Row ids are written by Python**, as every id in this schema is. The first version let the
  database generate them, because the insert is written as SQL text and the model's default does
  not apply to it; the code review caught it.
- **The flow diagrams are about the frontend and the save path**, so the network table and the
  load command, which neither touches, have no place in them. What changed in them is the border
  file both halves of the coordinate check read.
- **A cross-field message went stale.** With the message on both boxes of a point, correcting the
  Hochwert left the Rechtswert's message standing, because React Hook Form rechecks only the box
  being edited. `ProbestreckeBlock.tsx` now rechecks the other box of the same point through the
  existing `useNachpruefung`, as the Vorfluter boxes already do. The browser test caught it.
- **The rectangle's corners are now refused**, by the border check. The tests that said "a value on
  either bound passes" now say the rectangle itself does not complain there.
- **Munich, Colmar and Zürich lie outside the rectangle**, so the rectangle catches them before the
  border check runs. The rule tests use Würzburg and Strasbourg, which only the border catches.

## Evidence

- **Real archives read** (step 2): 20 421 flowing and 11 509 standing waters, every record valid,
  both `Mai 2025`, 11 s and 5 s.
- **Real release loaded** (step 4), from the host into the Compose database:
  `befischung gewaessernetz laden --stand 2025-05-01 ...` in 15 s; `liste` shows
  `2025-05-01  20421  11509`; the table is 95 MB. Nearest water to Stuttgart's centre is the
  Nesenbach (GKZ 2383400000000), and both Bodensee basins are present (38252, 38253).
- **Migration:** upgrade, downgrade, upgrade and `alembic check` clean.
- **Container:** the rebuilt backend image reads `/srv/seed/landesgrenze/landesgrenze_bw.json` and
  refuses a point in Würzburg on both boxes.
- **Tests:** backend 1 780 passed, 85 skipped; frontend 1 526 passed; `ruff`, `mypy`, `oxlint` and
  `npm run build` clean. `npm run e2e` for `karte.spec.ts`: 4 passed, again after the review fixes, including the new border
  test, run with a throwaway submitter `pruefung-18b@test.de` on the development database. The
  other e2e specs need the reviewer and admin accounts, whose password is not in this
  environment, and were not run.
- **Screenshot:** Würzburg typed as the lower boundary shows the message under both boxes and no
  marker; Stuttgart as the upper boundary shows its marker.
