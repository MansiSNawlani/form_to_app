# Feature: Gewässersuche

**From build-plan:** feature 18c
**Status:** not started
**Branch:** `feature/18c-gewaessersuche`

## Goal

The Gewässer field in section 1 searches LUBW's official water body network (loaded by 18b) as
the surveyor types. Picking a result fills in the name, the official identifier
(`amtliche_id`) and, where it fits the form's five boxes, the Vorfluter chain. A water the
network does not hold is still typed freely and filed without an identifier, never refused.

This is the first time an identifier reaches a protocol, so it is also where the identifier
travels through the answers, is checked at submit and lands on the `Gewaesser` row.

## Decisions taken while speccing (2026-10-15, Mansi)

| Question | Answer |
|---|---|
| Does a pick fill the Vorfluter boxes? | **Yes, when the chain fits.** LUBW's chain is written into the five boxes when it reaches the Rhein or the Donau within five links. When it is longer (about 950 small waters need 6 to 9) or the water is a standing one, the boxes are left as they are and a short note says why |
| How are 102 Mühlbäche told apart? | **Each result names what it flows into**, and when the stretch already has coordinates (typed or set on the map), **the nearest waters come first** with their distance |
| Where is the identifier shown? | **Form, review screen and PDF download**: a read-only line under the Gewässer name |

## Facts checked against the loaded 2025-05-01 release

- 20 421 flowing, 11 509 standing waters. 3 171 flowing and 9 879 standing names are
  placeholders like `NN-YBP`.
- The most repeated names: Mühlbach 102, Riedgraben 72, Mühlkanal 63, Tobelbach 54.
- Every flowing water's `vorfluter_kennung` resolves to another row except the Rhein's and the
  Donau's, which have none. Links to the Rhein or Donau: 1 for 731 waters, 2 to 5 for 18 735,
  6 to 9 for 953.
- `pg_trgm` and `unaccent` are available but not installed.

## In scope

- A search over the newest release by name: case-insensitive, umlaut-tolerant (`Muehlbach`
  finds `Mühlbach`), prefix matches before matches inside the name, placeholder `NN-` names left
  out, at most 20 results; ordered by distance when a point is given
- The Vorfluter chain for each flowing result, built from `vorfluter_kennung`, offered only when
  it fits the form
- `GET /api/v1/gewaessernetz/suche`, any signed-in account
- Two answers the app adds on top of the legacy form, `probestrecke.gewaesser.amtliche_id` and
  `probestrecke.gewaesser.gis_dataset_version`, in `ZUSAETZLICHE_PFADE` beside `bearbeiter.ort`
- At submit: an identifier must exist in the release it names, and the name must still be that
  water's name (compared loosely); otherwise a message on the Gewässer field with a way out
- The Gewässer row: a protocol carrying an identifier is matched on the identifier and a new row
  is written with `amtliche_id` and `gis_dataset_version` set
- The Gewässer field as an MUI `Autocomplete` with free text; picking fills, typing clears the
  identifier; a quiet fallback when no release is loaded or the search fails
- The read-only identifier line in the form, on the review screen and in the PDF download
- German and English wording, `CONTEXT.md`, the flow diagrams, and the "until feature 18"
  comments that this feature makes untrue

## Out of scope

- Snapping a point to the network and the far-from-water warning: 18d
- Searching by clicking the map, or drawing the network on the map: 18d
- Identifiers for Gewässer already on record, and merging duplicate rows: 18e
- Matching a protocol **without** an identifier to a row **with** one. A typed "Neckar" is not
  silently given the Neckar's identifier: refused, never guessed at. 18e proposes those
- A Vorfluter chain for standing waters (AWGN gives a catchment, not a receiving water)
- Checking that the picked water's kind agrees with the Gewässertyp (a See picked for type 13
  Bach). Worth raising with FFS; not a rule anyone has asked for yet
- Re-checking protocols already submitted. The new check runs at submit only
- Searching any release but the newest
- A trigram index, unless step 1's measurement shows the plain query is too slow

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [ ] **Step 1 - The search, in the backend** - `app/gewaessernetz/suche.py`. Two pure functions:
  `suchform(text)` (lower, trim, `ä ö ü ß` to `ae oe ue ss`, used on both sides of the
  comparison and spelled identically in the SQL) and `kette_fuer_formular(namen)` (the chain if
  it reaches an end point within five links, by `formregeln/vorfluter.ist_endpunkt`, else
  `None`). One service function `suche(session, text, punkte)` over the newest release: a
  recursive query for each result's chain, capped at six links. *Done when:* unit tests cover the
  folding, the chain cut-off at five and six, a chain that never ends, and a standing water;
  database tests over a small release built with `beispiele.py` prove prefix-before-contains,
  placeholders left out, the 20 limit, nearest-first with a point, only the newest release
  searched, and an empty result when nothing is loaded. Against the real release, `Mühlbach`
  with and without a point is timed (Evidence); under 150 ms means no index.

- [ ] **Step 2 - The endpoint** - `app/api/gewaessernetz.py`: `GET /api/v1/gewaessernetz/suche?q=
  &rw=&hw=`, `rw` and `hw` repeatable in pairs (up to the stretch's two points), signed-in only,
  `q` at least 2 characters after trimming. Pydantic schemas in `schemas.py`. Router stays thin.
  *Done when:* API tests prove 401 without a session, 422 for a one-letter `q` and for an
  unpaired `rw`, the response shape below, and `stand: null` with no results on an empty
  network; the endpoint shows in `/api/v1/docs`.

- [ ] **Step 3 - The identifier in the answers and on the row** - `ZUSAETZLICHE_PFADE` gains the
  two paths, with the reason and a pointer to question 16. `zuordnung/regeln.py` reads them into
  `Gewaesserangaben`; `zuordnung/dienst.py` matches a protocol with an identifier on
  `amtliche_id` alone, and one without only against rows that have none. A new row carries both
  values. *Done when:* tests prove two protocols picking the same water share one row, a picked
  water and a typed one of the same name and chain get two rows, an identified row is never
  matched by a typed name, and no `UPDATE` appears; the import still refuses neither path (it
  never sees them) and the existing zuordnung, submit and import tests pass.

- [ ] **Step 4 - The check at submit** - in `absenden.py`, after the pure rules and before
  `ordne_zu`: an identifier without a release, a release not loaded, an identifier not in that
  release, or a name that no longer matches (by `normalisiert`) is a `Formverstoss` on
  `probestrecke.gewaesser.gewaessername` with one new message key, whose wording says to pick the
  water from the list again or to clear the name and type it. A release that has since been
  replaced by a newer one still counts, since releases are kept. A resubmission after
  `NEEDS_CHANGES` goes through the same `sende_ab`, so it is checked the same way. *Done when:*
  tests for each of the four refusals and for a release without an identifier, plus a pick that
  passes, plus a protocol with no identifier that passes exactly as before.

- [ ] **Step 5 - The search field** - `felder/Gewaessersuche.tsx`: MUI `Autocomplete` with
  `freeSolo` inside the usual `FeldRahmen`, replacing the `FeldText` for the Gewässer name.
  TanStack Query for the request, debounced, starting at 2 characters, without points yet. Each
  option shows the name and `fließt in <Vorfluter>` or `stehendes Gewässer`. Picking writes the
  name, the identifier and the release; typing anything that differs from the picked name clears
  the identifier and the release. Every write goes through `setValue` with `shouldDirty` and
  `shouldValidate`, so the automatic save sees it. No release loaded or a failed request: the
  field behaves as a plain text box and a hint says the official list is unavailable. Types in
  `entwurf/typen.ts`; wording in `de.json` and `en.json`. *Done when:* `npm test`, `npm run lint`,
  `npm run build` pass; unit tests for the pure parts (what a pick writes, when typing clears); in
  the browser, picking `Neckar` saves the identifier (visible in the saved draft) and editing the
  name clears it; keyboard only works throughout and the screen reader name is the field's label;
  with the backend's network empty, the field still takes a typed name.

- [ ] **Step 6 - Chain and distance** - picking a flowing water whose chain fits writes all five
  Vorfluter boxes (emptying the ones past its end) and rechecks them, so a stale chain message
  clears; when it does not fit, or the water is standing, the boxes stay and a note under the
  field says why. The boundary points that pass the coordinate rule are sent with the search, and
  each option shows its distance. *Done when:* a unit test covers what a fitting, a long and a
  standing pick write to the boxes; in the browser, `Mühlb` with coordinates near Pforzheim lists
  the nearest Mühlbach first with its distance, picking it fills the chain with no message
  standing, and a long-chain water leaves the boxes and shows the note (screenshots in Evidence).

- [ ] **Step 7 - The identifier shown** - a read-only line `Amtliche Kennung: <id> (AWGN
  <stand>)` under the Gewässer field when one is set, the same line on the review screen
  (`nurlesen`), and the identifier in the PDF download (`ausgabe/dokument.py`, and
  `npm run beschriftungen` regenerated if the label list changes). *Done when:* the line shows in
  both screens for a picked water and not for a typed one (screenshot); a backend test proves the
  PDF text contains the identifier; the beschriftungen test passes.

- [ ] **Step 8 - Browser test** - `frontend/e2e/gewaessersuche.spec.ts`: search, pick, the chain
  filled, the identifier line, typing clears it, save and reload keeps it. Skips with a sentence
  when no release is loaded, the same way the suite skips without accounts. *Done when:* it passes
  against the Compose database with 2025-05-01 loaded, and `karte.spec.ts` still passes.

- [ ] **Step 9 - Documentation** - `CONTEXT.md` (Amtliche Kennung, how a pick and a typed name
  differ); the comments in `models/gewaesser.py`, `zuordnung/regeln.py` and `zuordnung/dienst.py`
  that say the identifier stays empty until feature 18; the flow diagrams under
  `blueprint/history/flow_diagrams/` (the search request and the identifier on the save and
  submit path); `docs/ffs-questions.md` question 16 notes that the two added answers depend on
  its answer. *Done when:* no comment in the code still says the identifier arrives later.

## Files / areas

- `backend/app/gewaessernetz/suche.py`, `suche_test.py`, `beispiele.py` (a few more tiny waters)
- `backend/app/api/gewaessernetz.py`, its test, `backend/app/api/schemas.py`, `backend/app/main.py`
- `backend/app/formular/felder.py` (`ZUSAETZLICHE_PFADE`)
- `backend/app/protokolle/zuordnung/regeln.py`, `dienst.py` and their tests
- `backend/app/protokolle/absenden.py` and its test, one message key in the locale files
- `backend/app/protokolle/ausgabe/dokument.py` and its test
- `frontend/src/protokoll/felder/Gewaessersuche.tsx` (new), a small pure module beside it with
  its test, `abschnitte/teil1/ProbestreckeBlock.tsx`
- `frontend/src/protokoll/entwurf/typen.ts`, `nurlesen/` (the read-only line)
- `frontend/src/i18n/locales/de.json`, `en.json`
- `frontend/e2e/gewaessersuche.spec.ts`
- `database/seed/form_version_20260609/beschriftungen.json` if regenerated
- `CONTEXT.md`, `docs/ffs-questions.md`, `blueprint/history/flow_diagrams/*.puml`

No migration: `amtliche_id` and `gis_dataset_version` have existed on `gewaesser` since v1.

## Data / contracts

**Load-bearing for 18d and 18e.**

`GET /api/v1/gewaessernetz/suche?q=muehlb&rw=478000&hw=5420000&rw=478400&hw=5421000`

```json
{
  "stand": "2025-05-01",
  "treffer": [
    {
      "kennung": "2381333920000",
      "art": "FLIESSGEWAESSER",
      "name": "Mühlbach",
      "vorfluter_name": "Enz",
      "vorfluter": ["Enz", "Neckar", "Rhein"],
      "entfernung_m": 640
    }
  ]
}
```

- `stand` is `null` and `treffer` empty when no release is loaded
- `vorfluter` is `null` when the chain is longer than five, never ends, or the water is standing;
  `vorfluter_name` is `null` for a standing water
- `entfernung_m` is `null` without a point, else whole metres to the nearest of the points given

Two answers added on top of the legacy form, in `ZUSAETZLICHE_PFADE`:

| Path | Value | Set by |
|---|---|---|
| `probestrecke.gewaesser.amtliche_id` | The `kennung`, as text | A pick; cleared by typing |
| `probestrecke.gewaesser.gis_dataset_version` | `AWGN 2025-05-01`, the form 18b fixed | A pick; cleared by typing |

Both or neither: one without the other is refused at submit with the same message. Named after
the `Gewaesser` columns they end up in.

`Gewaesser` rows, matching rule from step 3 on:

- identifier present: match on `amtliche_id`; else create with name, chain, `amtliche_id`,
  `gis_dataset_version`
- identifier absent: match on name and chain **among rows with no `amtliche_id`**, as today

New message key: `protokoll.regeln.gewaesserKennungPasstNicht`.

## Testing

The test gate is on (`pytest` in `backend/`, `npm test` in `frontend/`). In-scope logic needing
tests:

- **Search** (step 1): folding, ordering, the limit, placeholders, newest release, chain cut-off
- **Endpoint** (step 2): authorisation and the parameter refusals
- **Matching** (step 3): the identifier rule and that a typed name never gains an identifier
- **Submit check** (step 4): each refusal and both passes
- **The field's pure parts** (steps 5 and 6): what a pick writes to the name, the identifier and the boxes, what typing clears

The control itself, the list's look, the note and the read-only line ride on screenshots, the
build and the e2e test in step 8.

## Notes for the AI

- **The typed name stays the record of what was typed.** A pick writes LUBW's spelling because
  the surveyor chose it; nothing ever rewrites a typed name (defect 2). Compare loosely, store
  faithfully.
- **Refused, never guessed at.** No identifier is attached to a protocol that did not pick one,
  and no existing `Gewaesser` row is updated. 18e owns both.
- **Server is the gate.** The browser clears a stale identifier, but the submit check is what
  guarantees the name and the identifier still belong together. This check needs the database,
  so it lives in the service layer, not in `formregeln/`; say so in its docstring, since every
  other rule is pure.
- **Folding must match on both sides.** `suchform` in Python and the expression in SQL are one
  rule written twice; a test runs both over the same names.
- **The search is not authorisation-sensitive** (the network is open data), but it still needs a
  session, like every other endpoint.
- **Use MUI's `Autocomplete`**, themed through `muiTheme.ts` where it differs from the species
  search's look; label above via `FormLabel`; accessibility is an acceptance criterion.
- **Writing rules:** German identifiers, no em dashes, messages that name the thing, the reason
  and the way out; update the flow diagrams in the same feature.
- **FFS may still answer question 16 differently.** The added paths and `AWGN <stand>` are the
  working answer of 2026-10-14.
