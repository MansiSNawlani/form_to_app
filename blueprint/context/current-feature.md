# Feature: Einrasten mit Übersteuern

**From build-plan:** feature 18d
**Status:** built (2026-10-16), awaiting review

## Goal

Each boundary point of the stretch is matched to the nearest point on the official water body
network (loaded by 18b). The map shows both the point the surveyor set and the point on the water,
and the protocol keeps both. A point more than 100 m from the water gets a warning and asks for a
one-sentence reason before sending, but the location itself is never refused
(`docs/decisions.md` section 9).

This catches the mistakes the Baden-Württemberg border check from 18b cannot: a point in the
right state but in the wrong field, village or valley.

## Decisions taken while speccing (2026-10-16, Mansi)

| Question | Answer |
|---|---|
| What snapping does to the four coordinate boxes | **Nothing on its own.** The boxes keep what was typed or clicked, as in 18a. The point on the water is shown on the map as a second dot and saved beside the typed one. A button per point copies it into the boxes if the surveyor wants that |
| Which water a point snaps to | **The picked water, else any.** When the Gewässer was picked from the official list (18c), the point snaps to that water in the release it was picked from. When the name was typed freely, it snaps to whatever water in the newest release is nearest |
| When the warning shows | **More than 100 m** between the typed point and the point on the water |
| Whether a reason is needed | **Required.** Sending is held until one sentence explains the distance. The location is never refused, and the reviewer sees the warning and the reason |

## In scope

- A backend service that finds, for one point, the nearest position on a water: on the picked
  water when an identifier and release are given, otherwise on any water of the newest release.
  Flowing waters snap to the line; a point inside a standing water stays where it is (distance 0),
  one outside snaps to its shore
- `GET /api/v1/gewaessernetz/einrasten`, any signed-in account
- Ten answers the app adds on top of the legacy form, in `ZUSAETZLICHE_PFADE`: the snapped
  position, identifier and name of each point's water, the release, and the reason (see Data / contracts)
- At submit, the server works the snapped positions out again itself and stores what it found,
  so a submitted protocol never carries positions the browser made up or that went stale
- At submit, a point more than 100 m from its water without a reason is a `Formverstoss` on the
  reason field, with a message giving the limit and the way out (the warning under the map names
  the point, the water and the distance)
- The map: a second, smaller mark per point on the water, told apart from the typed mark by
  shape and label as well as colour, joined to it by a dashed line
- Under the map, per point: which water it is on and how far away, and a button that moves the
  boxes onto the water
- The warning and the reason box in the form; the same marks, lines, warning and reason read only
  on the review screen
- The snapped positions and the reason in the PDF download
- German and English wording, `CONTEXT.md`, the flow diagrams, `docs/decisions.md` section 9

## Out of scope

- **Drawing the stretch's course along the water** between the two points. 18a deferred it to
  here; it is moved again, to item 20 (the map excerpt drawn from stored geometry), because a
  water's line in AWGN is several parts and cutting the stretch out of it reliably is its own
  piece of work. The two snapped points are what that later work needs, and this feature stores
  them
- Drawing the water body network itself on the map, or picking a water by clicking it
- Changing the four typed boxes without the surveyor pressing the button
- Imported PDFs: the legacy form has none of these answers, so an import never carries them and
  the server works them out at submit like any other protocol
- Checking that the two points snap to the **same** water. Near a confluence they legitimately
  do not; worth raising with FFS later
- Identifiers for Gewässer already on record: 18e. The snapped water's identifier on protocols
  with a typed name is stored here, and 18e may read it, but nothing here writes to `gewaesser`
- Re-checking protocols already submitted. The rule runs at submit only, like 18b's and 18c's
- Making the 100 m configurable per Gewässertyp

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Snapping, in the backend** - `app/gewaessernetz/einrasten.py`. A constant
  `WARNABSTAND_M = 100` and a pure function `ist_fern(abstand_m)`. One service function
  `einrasten(session, punkt, gewaehlt=None)`, where `gewaehlt` is the picked identifier, name and
  release: with it, `ST_ClosestPoint` on that water in that release (matched on identifier and
  name, as `kennung.py` does); without it, the nearest water of the newest release by the
  spatial index (`<->`), placeholder names included, since a ditch called `NN-...` is still a
  water. Returns the identifier, kind, name, release, the position rounded to whole metres and the
  distance in whole metres, or `None` when nothing is loaded or the picked water is not in its
  release. *Done when:* unit tests cover `ist_fern` at 100 and 101; database tests over
  `beispiele.py` prove a point snaps onto a line, a picked water wins over a nearer one, a point
  inside a lake has distance 0, a point outside snaps to its shore, the newest release is used
  without a pick and the named one with it, an `NN-` water is found, and `None` for an empty
  network and for an unknown pick. On the real 2025-05-01 release a snap with and without a pick
  is timed (Evidence); under 100 ms each.

- [x] **Step 2 - The endpoint** - `GET /api/v1/gewaessernetz/einrasten?rw=&hw=&kennung=&name=&version=`
  in `app/api/gewaessernetz.py`, `kennung`, `name` and `version` optional but only all three, one point per
  request so the browser can cache each point on its own. Pydantic schema in `schemas.py`.
  *Done when:* API tests prove 401 without a session, 422 for a missing `hw`, for `kennung`
  without `name` and `version`, and for a `version` not of the form `AWGN JJJJ-MM-TT`, the response shape below, and `stand: null` with `treffer: null` on an empty
  network; the endpoint shows in `/api/v1/docs`.

- [x] **Step 3 - The new answers, worked out again at submit** - `ZUSAETZLICHE_PFADE` gains the
  ten paths with the reason they exist. In `absenden.py`, after the pure rules and the 18c
  identifier check: for each point that passed the coordinate rule, `einrasten` is run and the
  four answers of that point and the release are written from its result; a point that did not
  pass, or found nothing, has its four answers emptied. The reason is never touched. *Done when:*
  tests prove the stored values are the server's even when the draft held others, a picked water
  is snapped to, an empty network empties all nine snapped answers and submits exactly as before,
  and the existing submit, import and zuordnung tests pass.

- [x] **Step 4 - The reason, required when far** - in the same place: either point further than
  `WARNABSTAND_M` from its water and an empty `probestrecke.abstand_begruendung` is a
  `Formverstoss` on the reason with one new message key, naming the point and the distance and
  saying to check the coordinates or explain the distance. A resubmission after `NEEDS_CHANGES`
  goes through the same path. *Done when:* tests for a far point without a reason (refused), with
  one (passes), both points near with no reason (passes), and no release loaded (passes, since
  nothing can be judged).

- [x] **Step 5 - The point on the water, on the map** - `karte/einrasten.ts`: the request through
  TanStack Query, keyed by point and pick, sent only for points that pass the coordinate rule, and
  a pure function deciding what a response writes. Each response's position, identifier and
  release are written to the answers with `setValue` and `shouldDirty`, **only when they differ
  from what is stored**, so opening a draft does not make it unsaved, and **never under
  `useNurLesen()`**, where the stored answers are shown and no request is sent. In
  `Probestreckenkarte.tsx`, a second, smaller mark per point on the water and a dashed line to the
  typed mark. A failed request or an empty network shows nothing extra and the map works as in
  18a. Types in `entwurf/typen.ts`. *Done when:* `npm test`, `npm run lint`, `npm run build` pass;
  unit tests cover what a response writes, that an unchanged response writes nothing, and that a
  point failing the rule sends no request; in the browser, clicking beside the Enz shows the
  second mark on the river, the saved draft holds the snapped answers, reopening the draft shows
  no unsaved change, and picking a water in the Gewässer field moves the second mark onto that
  water; the marks have accessible names. Screenshots in light and dark mode.

- [x] **Step 6 - Distance and the button** - under the map, per point, a line `Untere Grenze: 14 m
  von der Enz` and an MUI button `Auf das Gewässer setzen` that writes the snapped position into
  the two boxes through `setValue`, as a map click does. Wording in `de.json` and `en.json`.
  *Done when:* in the browser the line names the water and distance for each point, the button
  moves the boxes onto the water and the line then reads 0 m, the automatic save runs, and the
  button is reachable and operable by keyboard with visible focus (screenshot).

- [x] **Step 7 - The warning and the reason** - when either point is further than 100 m, an MUI
  `Alert` with severity `warning` under the map names the point, the water and the distance, and
  a `Begründung` text field (label above via `FormLabel`) appears; it also stays visible while it
  holds text. The 100 m is one constant on each side, with a comment naming the other. On the
  review screen (`useNurLesen()`) the marks, lines, distance lines, warning and reason show read
  only, with no button. *Done when:* a unit test covers when the warning shows (100 and 101 m,
  either point); in the browser a point 300 m from the water shows the warning and the box,
  sending without a reason puts the message on the box (`aria-invalid`, message as its
  description), typing a reason lets it send, and the sent protocol's review screen shows the
  warning and the reason (screenshots).

- [x] **Step 8 - The PDF** - the snapped positions, their water and the reason in the PDF
  download. `ausgabe/dokument.py` needed no change: it prints every labelled answer of a block, so
  declaring the labels (`karte/einrasten.ts`) and running `npm run beschriftungen` was enough. *Done when:*
  a backend test proves the PDF text holds a snapped position and the reason, and the
  beschriftungen test passes.

- [x] **Step 9 - Browser test** - `frontend/e2e/einrasten.spec.ts`: a click beside a known water
  shows the second mark and a distance, the button moves the boxes, a far point asks for a reason
  and sending without one is refused at the reason box. Skips with a sentence when no release is
  loaded. *Done when:* it passes against the Compose database with 2025-05-01 loaded, and
  `karte.spec.ts` and `gewaessersuche.spec.ts` still pass.

- [x] **Step 10 - Documentation** - `CONTEXT.md` (Eingerastete Position, Abstandsbegründung, and
  that the typed position stays the record); `docs/decisions.md` section 9 notes what was built
  and the 100 m; the comments in `models/gewaessernetz.py` and `models/probestrecke.py` that say
  snapping comes later; the flow diagrams under `blueprint/history/flow_diagrams/` (the snapping
  request, and the work at submit). *Done when:* no comment in the code still says snapping
  arrives later.

## Files / areas

- `backend/app/gewaessernetz/einrasten.py` and `einrasten_test.py` (new; the tests build their own
  lake and nameless ditch from `beispiele.py`'s helpers)
- `backend/app/api/gewaessernetz.py`, its test, `backend/app/api/schemas.py`
- `backend/app/formular/felder.py` (`ZUSAETZLICHE_PFADE`)
- `backend/app/protokolle/absenden.py` and its test, one message key in the locale files
- `backend/app/protokolle/ausgabe/dokument_test.py`
- `frontend/src/protokoll/karte/einrasten.ts`, its test, `Probestreckenkarte.tsx`,
  `probestreckenkarte.css`, and a small component for the distance lines, warning and reason
- `frontend/src/protokoll/entwurf/typen.ts`
- `frontend/src/i18n/locales/de.json`, `en.json`
- `frontend/e2e/einrasten.spec.ts`
- `database/seed/form_version_20260609/beschriftungen.json`
- `CONTEXT.md`, `docs/decisions.md`, `blueprint/history/flow_diagrams/*.puml`

No migration: everything new is in the answers document (ADR 0003, nothing is queried on), and
the `probestrecken` columns stay the typed coordinates, which are what a stretch is matched on.

## Data / contracts

**Load-bearing for 18e and item 20.**

`GET /api/v1/gewaessernetz/einrasten?rw=478000&hw=5420000&kennung=2384000000000&name=Enz&version=AWGN%202025-05-01`

```json
{
  "stand": "2025-05-01",
  "treffer": {
    "kennung": "2384000000000",
    "art": "FLIESSGEWAESSER",
    "name": "Enz",
    "rw": 478012,
    "hw": 5420033,
    "entfernung_m": 38
  }
}
```

- `stand` and `treffer` are both `null` when nothing is loaded; `treffer` alone is `null` when
  the picked water is not in the release named
- `name` is needed beside `kennung` because a flowing and a standing water's numbers overlap; it
  is compared loosely, as the 18c submit check does
- `rw` and `hw` are whole metres in EPSG:25832, like the typed boxes
- `entfernung_m` is whole metres from the given point

Ten answers added on top of the legacy form, in `ZUSAETZLICHE_PFADE`:

| Path | Value | Set by |
|---|---|---|
| `probestrecke.eingerastet_rw_unten`, `eingerastet_hw_unten` | Lower point on the water | Browser while editing, server at submit |
| `probestrecke.eingerastet_rw_oben`, `eingerastet_hw_oben` | Upper point on the water | Browser while editing, server at submit |
| `probestrecke.eingerastet_kennung_unten`, `eingerastet_kennung_oben` | The identifier of the water each point is on | Browser while editing, server at submit |
| `probestrecke.eingerastet_name_unten`, `eingerastet_name_oben` | That water's name as LUBW writes it, added while building so the review screen and the PDF can name it | Browser while editing, server at submit |
| `probestrecke.eingerastet_version` | `AWGN 2025-05-01`, the same form as 18c's `gis_dataset_version` | Browser while editing, server at submit |
| `probestrecke.abstand_begruendung` | One sentence, free text | The surveyor |

The distance is not stored: it is the straight-line distance between the typed and the snapped position in the
same metre grid, so it is always worked out from them.

New message key: `protokoll.regeln.abstandBegruendungFehlt`.

## Testing

The test gate is on (`pytest` in `backend/`, `npm test` in `frontend/`). In-scope logic needing
tests:

- **Snapping** (step 1): the pick wins, line and lake cases, the release used, nothing loaded
- **Endpoint** (step 2): authorisation and the parameter refusals
- **Submit** (steps 3 and 4): the server's values replace the draft's, and the reason rule at 100
  and 101 m, with and without a release
- **The browser's pure parts** (steps 5 and 7): what a response writes, when no request is sent,
  when the warning shows

The marks, the lines, the button, the warning's look and the review screen ride on screenshots,
the build and the e2e test in step 9.

## Notes for the AI

- **The typed position stays the record.** Nothing but the surveyor's button press changes the
  four boxes, and the `probestrecken` row is still matched on them (18a, decisions.md section 9).
- **Warned, never refused.** The location is never a reason to refuse a protocol. Only a missing
  reason is, and only when a point is far.
- **Server is the gate.** The browser's snapped answers are a convenience for the draft; at submit
  the server works them out again and stores its own. This needs the database, so it lives in
  `gewaessernetz/`, beside `kennung.py`, not in `formregeln/`; say so in the docstring.
- **The 100 m is written twice**, once in Python and once in TypeScript, side by side in intent:
  each comment names the other, like the coordinate bounds.
- **Distinguishable without colour.** The mark on the water carries its own shape and an
  accessible name (`Untere Grenze am Gewässer`), as 18a's marks carry a word.
- **Use MUI** for the button, the alert and the text field, themed through `muiTheme.ts`; label
  above via `FormLabel`; accessibility is an acceptance criterion.
- **Writing rules:** German identifiers, no em dashes, messages that name the thing, the reason
  and the way out; update the flow diagrams in the same feature.
- **FFS may still answer question 16 differently.** The added paths and `AWGN <stand>` follow the
  working answer of 2026-10-14, like 18c's.

## Evidence

- **Snapping timed on the real 2025-05-01 release** (step 1), second call of each, from the host:
  a point near Pforzheim (476000 / 5416000) without a pick 3 ms, landing on a Mühlgraben 793 m
  away; the same point with the Enz picked 4 ms, 903 m; a point in Stuttgart 3 ms, on the
  Nesenbach 58 m away. Far under 100 ms; the nearest-neighbour search uses the existing index.
- **Two answers added while building** (step 5): `eingerastet_name_unten` and `eingerastet_name_oben`.
  The distance line names the water, and on the review screen only the stored answers are there to
  read, so the name is stored beside the identifier. Ten added paths in all.
- **The map in the browser** (steps 5 to 7), against the rebuilt Compose backend and the 2025-05-01
  release, as the throwaway submitter `pruefung-18d@test.de`: a lower point typed at 476414 /
  5415203 in Pforzheim shows `Untere Grenze: 9 m vom Gewässer Enz` and a ring on the Enz; an upper
  point at 476000 / 5416000 shows `793 m vom Gewässer Mühlgraben`, the warning and the reason box.
  The draft saved all nine answers; reloading it left its version at 2, so opening a draft does
  not save it again. The button, pressed by keyboard, moved the lower boxes to 476417 / 5415195
  and the line read 0 m. Picking the Enz in the Gewässer field moved the upper ring onto the Enz
  (903 m). Screenshots in light and dark mode.
- **Submit** (step 7): the backend's complete test protocol, whose real lower point lies 172 m
  from the Eckbach, was refused with 422; the reason box was `aria-invalid` with the message as its
  description, typing a reason cleared it, and the submit then went through (200) with the
  server's positions stored. The read-only page of the sent protocol shows both rings, the dashed
  lines, the distances, the warning and the reason, and no button.
- **Found on the way, fixed separately** (`cc1a58a`): since 18a the map did not zoom to the
  stretch when the lower boundary lies east of the upper one. `fitBounds` read the pair as
  south-west and north-east, took the box to wrap the globe, and the state-wide pan limit held the
  map at the whole state. The box is now grown from both points.
- **Browser tests** (step 9): `einrasten.spec.ts` (2 passed), `karte.spec.ts` (4 passed) and
  `gewaessersuche.spec.ts` (3 passed) against the Compose database with 2025-05-01 loaded, and
  `fehler-am-feld.spec.ts` (4 passed). `karte.spec.ts` now names its markers exactly, since
  "Untere Grenze" is also the start of "Untere Grenze am Gewässer". The specs needing the reviewer
  and admin accounts were not run: their password is not in this environment.
- **Full suites** (step 10): `pytest` 1898 passed, 85 skipped (the FFS source files are not in
  this checkout); `ruff check .`, `mypy .` and `alembic check` clean; `npm run build`,
  `npm run lint` and `npm test` (1585 passed) clean.

## What the code review turned up (2026-10-16)

- **Fixed: a moved point was measured against where it used to be.** While a new request ran, or
  after one failed, the stored position on the water still belonged to the old point, so the
  panel and the map showed a wrong distance, and could show a false warning and the reason box.
  `useEinrasten` now reports such a point as unsicher, and the map and the panel leave it out
  until its answer arrives (`lagen` in `karte/einrasten.ts`). Checked in the browser with the
  request blocked: the line disappears instead of reading 1 km, and returns with the answer.
- **Fixed:** the panel uses MUI's `Typography`, `List` and `ListItem` instead of bare elements,
  and the per-instance rule reaching into the alert's paragraphs is gone.
- **Fixed:** the warning names the water as well as the point and the distance.
- **Fixed:** "either point is far" is now a pure function with a test (`lagen` and `ferne`),
  instead of logic inside the component; the panel reads its answers by name, not by position.
- **Tidied, at Mansi's request:** `Probestreckenkarte()` is down from about 145 lines to about
  80, its words in `useKartentexte` and its points in `useKartenpunkte`; the typed coordinate
  paths live once, as `GESETZT` in `karte/einrasten.ts`; the two `_gewaehlt` helpers share
  `gewaehlt_aus` in `gewaessernetz/einrasten.py`, the endpoint's own one renamed
  `_wahl_aus_anfrage`; and "not known yet" in `Punktstand` is the named state `'unbekannt'`
  instead of `undefined`.
- **Checked, not a gap:** a pick whose release is no longer loaded snaps to nothing, but the 18c
  identifier check refuses such a protocol at submit anyway.

