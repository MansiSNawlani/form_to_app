# Feature: 18a - Karte zur Probestrecke

**From build-plan:** feature 18a
**Status:** complete (2026-10-14)
**Branch:** `feature/18a-karte-zur-probestrecke`, from `main` after 17e was merged

## Goal

Put a map beside the four boundary coordinates in section 1. It shows where the two typed points
actually are, so a swapped or mistyped number shows up as a point in the wrong place rather than
going unnoticed. It also lets a surveyor set a point by clicking or dragging instead of reading
UTM metres off another map. The review screen shows the same map read only, so a reviewer sees
the stretch's location at a glance.

This is the part of feature 18 that needs no official water body dataset. The typed coordinates
stay the record: the map reads them and writes them, and stores nothing of its own.

## Design reference

No mockup covers the map. `prototypes/protokoll-teil-1.html`, `prototypes/pruefung-protokoll.html`
and the existing section 1 layout set
everything around it: the coordinate callout, the field grid, the tokens in
`frontend/src/styles/theme.css`. The map sits full width below the four coordinate fields, where
the "Die Kartenauswahl folgt später" hint is now. Take a screenshot in light and dark mode at
step 2 and step 3 for review, since this is the first non-form element in the protocol.

## In scope

- **MapLibre GL JS** (`maplibre-gl`) as the map library, as decided in decisions.md section 5.
- **basemap.de Web Vektor** as the background, colour variant:
  `https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json`. It is free,
  needs no key, sends `Access-Control-Allow-Origin: *`, and is the federal mapping agency's
  official map.
- **The attribution its licence requires**, visibly on the map: "© GeoBasis-DE / BKG (2026)
  CC BY 4.0", with "BKG" linking to `https://www.bkg.bund.de` and "CC BY 4.0" linking to
  `https://creativecommons.org/licenses/by/4.0/`. Use the style's own attribution if it carries
  exactly this, otherwise set it ourselves.
- **Converting between EPSG:25832 and WGS84**, both ways, with `proj4`. Map positions are written
  back as whole metres, because `regeln/koordinaten.ts` accepts only whole numbers.
- **Two markers**, Untere Grenze and Obere Grenze. They must be distinguishable without colour (a
  letter or short label on each) and carry an accessible name.
- **Typed to map:** a point appears when both of its numbers are whole numbers inside
  `BW_GRENZEN`, and disappears otherwise. The map fits itself to whatever points exist: both
  points, one point, or the Baden-Württemberg extent when there are none.
- **Map to typed:** a choice of which boundary is being set (MUI `ToggleButtonGroup`, Untere /
  Obere Grenze). Untere Grenze is chosen when the section opens. Clicking the map sets the chosen boundary. Dragging a marker moves it. Both write the
  two fields through React Hook Form, so the boxes update, the coordinate rule runs, and the
  automatic save picks the change up like any typed change.
- **Read-only mode:** under `useNurLesen()` (the review screen, and a sent protocol read back by
  its submitter) the map shows the markers with no toggle, no click and no drag.
- **Failure states:** if WebGL is unavailable, or the background map cannot be loaded, the map
  area shows one sentence saying so and that the coordinates can still be typed. The form never
  breaks because of the map.
- **Loaded on demand:** the map component is loaded with `React.lazy`, so MapLibre's weight is
  only paid when section 1 or the review screen opens, and the rest of the app's bundle stays as
  it is.
- **Texts in both locale files.** The old `kartenHinweis` key is removed from `de.json` and
  `en.json`, and every new string is added to both (the rule since feature 17).

## Out of scope

- The water body dataset, snapping, water body search and `amtliche_id`: 18b to 18e.
- The real Baden-Württemberg border. The rectangle in `regeln/koordinaten.ts` stays until 18b.
- A line drawn between the two points. A stream bends, so a straight line between the boundaries
  would show a route the water does not take. The stretch's actual course comes with snapping in
  18d.
- Any backend change. Nothing new is stored: the four `utm_*` answers are the record, exactly as
  before, so there is no migration and no change to the Pydantic rules.
- The map in the downloaded PDF. That is item 20.
- Choosing between the colour, grey and relief backgrounds, and a separate dark background map.
  The colour map is used in both themes; only the controls around it follow the tokens.
- Offline maps (feature 22).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Converting coordinates** - add `proj4` and write
  `frontend/src/protokoll/karte/umrechnung.ts`: plain functions from a typed
  Rechtswert/Hochwert pair to a map position, and from a map position back to whole metres. The
  first returns nothing for empty, non-whole or out-of-bounds input, and reuses `BW_GRENZEN` and
  the whole-number test from `regeln/koordinaten.ts` rather than restating them. Tests beside it:
  a point on the zone's central meridian (9° E converts to Rechtswert 500000 exactly), a known
  point checked against an independent source (an official online converter or `pyproj`, named in
  the test, never `proj4` itself), a round trip that comes back to the same whole metres, and each kind of refused
  input. *Done when:* `npm test` passes with the new tests, and `npm run build` and `npm run lint`
  are clean.
- [x] **Step 2 - The map shows the typed points** - add `maplibre-gl`, write
  `karte/Probestreckenkarte.tsx` (lazy-loaded) with the basemap.de style, the attribution, the two
  labelled markers read from the form with `useWatch`, the fitting rules, and the two failure
  messages. Mount it in `ProbestreckeBlock.tsx` in place of the `kartenHinweis` paragraph, with
  the texts in both locale files. Display only: no clicking yet. *Done when:* in the running app,
  typing both coordinates of a boundary makes its marker appear in the right place, clearing one
  number removes it, an out-of-bounds value shows no marker and the existing rule message, and
  the attribution is visible with both links working. Screenshots in light and dark mode. Build,
  lint and tests are clean, and the main bundle has not grown by MapLibre's size.
- [x] **Step 3 - Setting points on the map** - the Untere / Obere Grenze toggle, click to place,
  drag to move, both writing whole metres through `setValue` with the options that mark the field
  dirty and validate it, so the automatic save runs. Under `useNurLesen()` the toggle is absent and
  the markers neither drag nor respond to clicks. *Done when:* clicking sets both boxes of the
  chosen boundary, dragging changes them, the save indicator shows a save, a reload keeps the
  values, and the review screen for a sent protocol shows the markers with no way to move them.
  Keyboard: the toggle is reachable and operable by keyboard with visible focus, and the typed
  boxes remain the full keyboard path. Screenshots of both modes.
- [x] **Step 4 - Browser tests** - `frontend/e2e/karte.spec.ts`, addressing controls by role and
  name: typing coordinates shows the marker, clicking the map with Untere Grenze chosen fills
  both lower boxes, and with requests to `sgx.geodatenzentrum.de` blocked the failure message
  appears while the boxes still accept input. *Done when:* `npm run e2e` passes with the stack
  running and the test accounts set, and skips with its usual message when they are not.

## Files / areas

- `frontend/package.json`: `maplibre-gl`, `proj4` (and `@types/proj4` if it ships no types)
- `frontend/src/protokoll/karte/umrechnung.ts` and `umrechnung.test.ts` (new)
- `frontend/src/protokoll/karte/Probestreckenkarte.tsx` (new), and a small stylesheet beside it
  or in `protokoll.css` for the marker labels and the map's height, from tokens
- `frontend/src/protokoll/regeln/koordinaten.ts`: export what the conversion reuses, nothing more
- `frontend/src/protokoll/abschnitte/teil1/ProbestreckeBlock.tsx`: mount the map, drop the hint
- `frontend/src/i18n/locales/de.json`, `en.json`: the new strings, `kartenHinweis` removed
- `frontend/e2e/karte.spec.ts` (new)
- `CONTEXT.md` only if a new domain term turns up; none is expected

## Data / contracts

- **No change to stored data.** The map reads and writes the existing
  `probestrecke.utm_rw_unten`, `utm_hw_unten`, `utm_rw_oben`, `utm_hw_oben`, as whole-metre
  values in EPSG:25832, exactly what a typed value is.
- **Load-bearing for 18b to 18d:** `umrechnung.ts` is the one place that converts between the
  form's coordinates and the map's. Snapping in 18d will need typed and snapped positions kept
  apart; that is 18d's contract to define, and nothing here may assume the typed values are the
  only ones that will ever exist.
- **External dependency:** the basemap.de style URL above. It is fetched by the browser directly,
  not proxied through our backend.

## Testing

- **Unit tests (vitest):** the conversion in step 1 is logic where a wrong answer is possible and
  invisible (a point 300 m off still looks plausible), so it is tested against an independent
  reference, not only against itself.
- **Browser evidence:** steps 2 and 3 are a component and an integration surface, verified in the
  running app with screenshots in both themes, per `coding-standards.md`.
- **Playwright (step 4):** written down so it runs again. Headless Chromium renders WebGL in
  software, and MapLibre's markers are ordinary DOM elements, which is what the tests address.
- Build, lint and both test commands green before each step is approved.

## Notes for the AI

- **Frontend only.** No endpoint, migration or Pydantic change. If a step seems to need one, stop
  and ask.
- **The boxes are the record and the map follows them.** Never keep a second copy of the
  coordinates in component state. Read them with `useWatch`, write them with `setValue`, so React
  Hook Form stays the only owner (coding-standards.md, Forms).
- **Do not refit the map after a map edit.** Fit when the typed values change from the boxes and
  on first load, not after a click or drag, or the map jumps under the pointer.
- **Restrict panning** to a margin around Baden-Württemberg with `maxBounds`, so the map cannot be
  lost somewhere over the Atlantic.
- **MUI for everything around the map** (the toggle, the failure message as an `Alert` if it fits
  the existing look). MapLibre owns the canvas; there is no MUI equivalent, which is the case
  decisions.md section 5 already records.
- **Accessibility:** the map canvas is not usable by keyboard, and that is acceptable only because
  the four boxes do the same job fully. Give the map region an accessible name, give each marker
  one, keep the toggle keyboard-operable with visible focus, and never convey which marker is
  which by colour alone.
- **Import MapLibre's CSS** with the lazy component, not globally.
- **Licence attribution is a requirement, not decoration.** It must stay visible at every map size.
- **German identifiers** for domain things (`Probestreckenkarte`, `umrechnung`, `untere` /
  `obere`); general programming words stay English.
- **No em dashes** in code, comments or texts.
- **Privacy note for FFS** is in `docs/ffs-questions.md` question 16: tiles come from BKG's
  servers. Nothing to build for it now.

## What building it turned up

- **MapLibre 6 could not find its worker.** It looks for `maplibre-gl-worker.mjs` beside its own
  module, and neither Vite's pre-bundling nor the production build puts it there, so the map
  never finished loading and a deployment would have shipped a blank map. `basiskarte.ts` now
  imports the worker with `?url` and hands it to `setWorkerUrl`; the build emits it as its own
  asset.
- **The style's attribution is replaced, not added to.** basemap.de's style carries
  "basemap.de / BKG" without the links or the CC BY 4.0 wording its own terms ask for, so
  `ladeStil()` strips it and the map shows the licence's wording instead.
- **The map is rebuilt when the language changes**, so its control labels follow. A load
  counter in `useBasiskarte` makes the markers redraw on the new map, which they otherwise did
  not.
- **The toggle is one Tab stop.** MUI 9's `ToggleButtonGroup` uses a roving tab index: Tab
  reaches the group, the arrow keys move between Untere and Obere Grenze. That is the standard
  pattern for a button group and is what the browser check exercises.
- **A click outside the rectangle fills the boxes and shows no marker.** That is by design: the
  coordinate rule then says what is wrong, and the marker only ever stands for values the form
  accepts.
- **One `fetch()` outside `api/client.ts`.** The flow diagrams said `client.ts` held the only
  `fetch()`. `basiskarte.ts` fetches the style from BKG's server, without cookies or protocol
  data, and the diagrams now say "the only fetch() to our backend".

## Evidence

- `npm test`: 1498 passed, 22 of them in `karte/umrechnung.test.ts` against pyproj 3.8.0
- `npm run lint`: clean
- `npm run build`: clean. MapLibre and proj4 in a lazy 1,183 kB chunk plus the 508 kB worker;
  the main bundle grew by about 2 kB
- `npm run e2e`: 72 passed, 2 skipped, including the 3 tests in `e2e/karte.spec.ts`
- Browser, by script: screenshots in both themes; click, drag, keyboard toggle, automatic save,
  reload; the read-only map on a sent protocol (NEEDS_CHANGES) with no toggle and no draggable
  marker; the language switch; the failure message with basemap.de blocked
- Not checked: a browser without WebGL at all
