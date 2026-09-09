# Feature: 3b. The form saves to the server

**From build-plan:** feature 3b, the second of four sub-features under item 3
**Status:** built, reviewed, awaiting manual browser check

## Goal

Make a draft protocol survive the browser it was typed into.

Feature 3a built the server half: the `submissions` table and the five endpoints
that create, list, read, save and delete a draft. Nothing on screen uses them
yet. Today the form still writes to `localStorage`, so a protocol filled in on a
laptop exists only on that laptop: another machine shows nothing, clearing site
data destroys it, and nobody at FFS can ever see it.

This sub-feature is the swap. Creating, opening and automatically saving a
protocol all go to the server, the browser stops being the storage, and a local
copy stays behind only as a safety net for the saves that do not land.

Two things get their first honest answer here, both of which the browser-only
store could not have:

- **A save can fail.** The network drops, the session runs out, the backend is
  down. What was typed must not disappear because of it.
- **The same protocol can be open twice.** Two tabs, or a laptop and a desktop.
  The server refuses the second save with a 409 rather than letting one silently
  overwrite the other, and somebody has to be told.

## Design reference

No new screen. `prototypes/protokoll-teil-1.html` remains the reference for the
protocol page, which already carries the save indicator this feature rewires.
`prototypes/meine-protokolle.html` is 3c's, not this one's.

The one new piece of interface is a restore banner at the top of the protocol
card (step 5). It follows the existing card and alert styling already in
`protokoll.css`; no mockup exists for it and none is needed.

## In scope

- `PUT` and `DELETE` in the API client, which today only knows `GET` and `POST`.
- The protocol request and response types on the browser side, mirroring
  `backend/app/api/schemas.py`.
- Creating a protocol through `POST /api/v1/protokolle`, from the
  `/protokolle/neu` loader.
- Opening one through `GET /api/v1/protokolle/{id}`, with its loading, its
  not-found and its could-not-be-reached states.
- Automatic saving through `PUT /api/v1/protokolle/{id}/antworten` as a TanStack
  Query mutation, carrying the version and taking the new one back.
- A local safety copy, written before every save attempt and cleared once the
  server confirms one, so a failed save, a closed tab or a crashed browser does
  not cost what was typed.
- Offering that copy back when the protocol is opened again and it holds
  something the server does not.
- The 409 conflict as its own state on screen, with a message that says what
  happened and what to do about it.
- Deleting the `localStorage` draft store and its tests.

## Out of scope

- **The submissions list.** 3c. `GET /api/v1/protokolle` is not called here, and
  the store's `listEntwuerfe` is deleted rather than rewired, because no screen
  lists drafts yet and 3c builds that page against the list endpoint.
- **Deleting a draft from the interface.** 3c, which is where the delete button
  lives. `DELETE` is added to the API client here because the client is the one
  place methods are declared, not because anything calls it yet.
- **Attachments.** 3d. They stay in IndexedDB, keyed on the draft id, which
  keeps working unchanged: a server-issued id is still a uuid string.
- **Importing drafts already in somebody's `localStorage`.** There are no users
  yet. Existing local entries under `ffs-entwurf:` are left where they are and
  simply stop being read; they are one browser's development leftovers, not
  data. Say so in the review packet rather than writing a migration nobody
  needs.
- **Submitting, reviewing and locking.** Feature 11. This feature only ever
  writes a `DRAFT`.
- **Merging two versions of a protocol.** On a 409 the save is refused and the
  person is told. Working out which of two documents wins needs a rule FFS has
  not given us, and guessing it would lose data quietly rather than loudly.
- **Offline use.** Feature 22. The safety copy rescues a failed save; it is not
  a queue that retries in the background.
- **English wording.** `en.json` is a stub until feature 17. New strings go in
  `de.json` only, as every feature since 1b has done.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - the API client learns the other two methods** - widen
  `AnfrageOptionen.methode` to `GET | POST | PUT | DELETE`, add the protocol
  types mirroring `schemas.py` field for field,
  and add the two protocol error codes the browser branches on
  (`PROTOKOLL_NICHT_GEFUNDEN`, `PROTOKOLL_VERAENDERT`) to `api/fehler.ts`.
  Nothing changes on screen. *Done when:* `client.test.ts` covers a `PUT` with a
  JSON body and a `DELETE` answering 204, `npm test` and `npm run build` pass,
  and each new type in `typen.ts` matches its Pydantic model name for name.

- [x] **Step 2 - the three calls, as their own module** - `entwurf/api.ts` with
  `legeEntwurfAn()`, `holeEntwurf(id)` and `speichereAntworten({ id, version,
  antworten })`, each a thin call through `apiAnfrage`. Nothing imports it yet,
  so the app is untouched and still runs on `localStorage`. *Done when:*
  `api.test.ts` proves each call uses the right method, path and body against a
  stub `fetch`, proves a 404 surfaces as an `ApiFehler` carrying
  `PROTOKOLL_NICHT_GEFUNDEN`, and `npm test` passes.

- [x] **Step 3 - the swap** - creating, opening and saving all go through step
  2's module, and `entwurf/store.ts` plus `store.test.ts` are deleted. `Entwurf`
  in `entwurf/typen.ts` becomes the server's shape, so `ProtokollKopf` reads
  `created_at` and `form_version` in place of `angelegtAm` and `formVersion`.
  `ProtokollSeite` loads through `useQuery` and gains a loading state; the
  `/protokolle/neu` loader awaits the create call and throws on failure into a
  new `errorElement` that says what went wrong and offers to try again. The
  not-found wording stops claiming the draft is missing from this browser.
  *Done when:* starting a protocol lands on section 1 with a uuid the backend
  issued (a 201 in the network tab); typing, reloading and reopening shows the
  same answers; signing in on a second browser and opening the same URL shows
  them too; opening a made-up id shows the not-found page; and stopping the
  backend gives a plain message on both the create and the open path rather than
  a blank screen. **This is the biggest step: if the diff runs long, split the
  create path from the open-and-save path.**

- [x] **Step 4 - the local safety copy** - `entwurf/sicherung.ts`, a small
  `localStorage`-backed module keyed `ffs-sicherung:<id>` holding the id, the
  version, the answers and the moment. `useAutoSave` writes it before every save
  request and deletes it once the server confirms one. Storage is an argument,
  as it was in the old store, so this is testable with no browser. *Done when:*
  `sicherung.test.ts` covers write, read, clear and an unreadable or absent
  entry; stopping the backend, typing, and looking in the browser's application
  tab shows the entry; starting the backend and letting one save land removes
  it; and `npm test` passes.

- [x] **Step 5 - offering it back** - on opening a protocol, if a safety copy
  exists for that id and its answers differ from what the server returned, show
  a banner at the top of the card naming the moment it was kept, with
  "Ubernehmen" and "Verwerfen" (spelled with the umlaut in the real string). The
  first puts the answers into the form and saves; the second deletes the copy. A
  copy matching the server is deleted silently, because it landed after all.
  *Done when:* stopping the backend, typing, closing the tab, starting the
  backend and reopening the protocol shows the banner; taking the offer leaves
  the typed answers on screen and saved; discarding leaves the server's answers
  and the banner does not come back on the next reload; and the banner is
  reachable and operable by keyboard with the focus visible.

- [x] **Step 6 - the conflict** - a 409 becomes its own `SaveState`, not a
  generic failure. Automatic saving stops for that draft rather than retrying
  into the same refusal, and `SpeicherAnzeige` prints a message that names what
  happened, says why, and says what to do. *Done when:* opening the same
  protocol in two tabs, typing in both, and letting each save shows the second
  tab the conflict message rather than the generic "nicht gespeichert"; the
  safety copy for that draft still holds what the second tab typed; and a unit
  test proves the save state a `PROTOKOLL_VERAENDERT` failure produces.

## Files / areas

**Changed**

- `frontend/src/api/client.ts` - `PUT` and `DELETE`.
- `frontend/src/api/typen.ts` - a pointer to where the protocol types went.
- `frontend/src/api/fehler.ts` - the two protocol error codes.
- `frontend/src/protokoll/entwurf/typen.ts` - `Entwurf` takes the server's
  shape; `FORM_VERSION` retires, since the server stamps it. The protocol
  request and response types landed here rather than in `api/typen.ts` as
  drafted, because every one of them carries or describes `Antworten` and
  splitting them across two files would mean reading both to understand either.
- `frontend/src/theme/muiTheme.ts` - `MuiAlert` gains the spacing the four new
  notices would otherwise each restate.
- `frontend/src/protokoll/entwurf/useAutoSave.ts` - a mutation, the version, the
  safety copy, the conflict state.
- `frontend/src/protokoll/ProtokollSeite.tsx` - a query, with loading.
- `frontend/src/protokoll/ProtokollKopf.tsx` - the two renamed fields.
- `frontend/src/protokoll/SpeicherAnzeige.tsx` - the conflict state.
- `frontend/src/routes.tsx` - the loader awaits the create call, with an
  `errorElement`.
- `frontend/src/i18n/locales/de.json` - the new strings.
- `frontend/src/protokoll/protokoll.css` - the banner, if the existing styles do
  not already cover it.

**Added**

- `frontend/src/protokoll/entwurf/api.ts` and `api.test.ts`
- `frontend/src/protokoll/entwurf/sicherung.ts` and `sicherung.test.ts`
- `frontend/src/protokoll/entwurf/browserSpeicher.ts` - the localStorage
  fallback, lifted out of the deleted draft store rather than copied.
- `frontend/src/protokoll/entwurf/abfragen.ts` and `abfragen.test.ts` - the
  shared query definition, so the page and the loader agree on one cache entry.
- `frontend/src/protokoll/entwurf/SicherungAngebot.tsx` - the restore banner.
- `frontend/src/protokoll/SpeicherProblem.tsx` - the panel carrying what a save
  failure means. Added because the indicator beside the heading is a few words
  in a tight row that appears twice on the page: it can say that something is
  wrong but has no room for why or what to do. It covers the ordinary failure as
  well as the conflict, which step 6 did not ask for, because "Nicht
  gespeichert" alone fails this project's error-message rule either way.
- `frontend/src/protokoll/ProtokollAnlegenFehler.tsx` - the create path's error
  element.
- `frontend/src/protokoll/entwurf/useAutoSave.test.ts` - the failed-save mapping.

**Deleted**

- `frontend/src/protokoll/entwurf/store.ts` and `store.test.ts`

**Not touched**

- The backend. Feature 3a built every endpoint this feature calls, and if
  something turns out to be missing that is a finding to raise, not a quiet
  widening.

## Data / contracts

The browser mirrors `backend/app/api/schemas.py`, keeping the backend's own
names, exactly as `api/typen.ts` already does for `BenutzerAntwort`. The JSON
keys are the server's, so `form_version` and `updated_at` stay snake_case rather
than being camel-cased on the way in; a rename would need a mapping layer, and a
mapping layer is one more place for the two halves to disagree.

| Call | Method and path | Sends | Receives |
|---|---|---|---|
| Create | `POST /api/v1/protokolle` | nothing | `ProtokollAntwort`, 201 |
| Open | `GET /api/v1/protokolle/{id}` | nothing | `ProtokollAntwort` |
| Save | `PUT /api/v1/protokolle/{id}/antworten` | `{ version, antworten }` | `SpeicherAntwort` |

`Entwurf` becomes `ProtokollAntwort` under its German name, defined once in
`entwurf/typen.ts`: `id`, `status`, `form_version`, `version`, `antworten`,
`created_at`, `updated_at`. `antworten` keeps the `Antworten` type this app
already has, which is the whole reason feature 4a shaped the envelope after the
`Submission` columns.

**`version` is the load-bearing one.** It arrives with the protocol, travels
back on every save, and comes back incremented in `SpeicherAntwort`. The browser
holds the latest and sends it next time. Send a stale one and the server refuses
with 409 and writes nothing, which is what stops one tab overwriting another. It
is held in a ref beside the answers, never in React state, because a save must
not re-render a 338 field form.

The safety copy is ours alone and never reaches the server:

    key    ffs-sicherung:<protokoll-id>
    value  { id, version, antworten, zeitpunkt }

The error codes the browser branches on, published by
`backend/app/api/fehler_http.py`: `PROTOKOLL_NICHT_GEFUNDEN` (404),
`PROTOKOLL_VERAENDERT` (409), `PROTOKOLL_NICHT_MEHR_ENTWURF` (409),
`ANTWORTEN_UNGUELTIG` (422), plus `NICHT_ANGEMELDET`, which the existing session
handling already deals with. Only the first two get behaviour of their own; the
rest keep the backend's German sentence through `fehlertext`, which is what that
fallback exists for.

## Testing

The test gate is on for the frontend: `npm test` from `frontend/`, vitest, as
`AGENTS.md` records. It runs in a node environment, so everything below takes
its `fetch` or its `Storage` as an argument rather than reaching for a global.

**Logic that must ship a test, per step**

| Step | What gets a test |
|---|---|
| 1 | The client sends a `PUT` with a JSON body, and handles a 204 `DELETE` |
| 2 | Each of the three calls: method, path, body, and a 404 becoming a typed error |
| 4 | The safety copy: write, read, clear, and an unreadable or missing entry |
| 6 | The save state a `PROTOKOLL_VERAENDERT` failure produces |

Steps 3 and 5 are wiring and interface. They ride on browser evidence and the
build, as `coding-standards.md` directs. Playwright is not installed and this
feature does not add it.

**The manual path** needs the stack up (`docker compose up -d --build`) and an
account (`befischung benutzer anlegen ...`), then `npm run dev` in `frontend/`.

1. Sign in, start a protocol, confirm the URL carries a server-issued id and the
   network tab shows a 201.
2. Type in several sections. Watch the indicator go from "Wird gespeichert" to
   "Automatisch gespeichert um ...".
3. Reload. The answers are still there. Sign in on a second browser, open the
   same URL: they are there too.
4. Stop the backend, type, and confirm the indicator says so and the entry
   appears under `ffs-sicherung:` in the application tab.
5. Start the backend, reload, take the banner's offer, confirm the typed answers
   come back and then save.
6. Open the protocol in two tabs, type in both, and confirm the second one is
   told about the conflict rather than silently losing its work.

**The risk worth testing first.** The server checks every answer path against
`database/seed/form_version_20260609/felder.json` and refuses the whole document
if one is unknown. Our `Antworten` type was built from the same legacy form but
by a different route, so a path the browser sends and the seed does not know
would make every save fail with `ANTWORTEN_UNGUELTIG`. Before step 3 is called
done, fill in at least one field in every one of the seven sections and confirm
a save lands. If the two disagree, that is a real finding: report which paths
and which side is wrong rather than loosening the check.

## Open decision for the user

**The automatic save does not go through TanStack Query, and both the In scope
list above and `coding-standards.md` say it should.** That standard reads
"TanStack Query for server calls, including the automatic save", and the code
calls `speichereAntworten` directly from `useAutoSave`.

The reason is measured rather than a preference. `useMutation` subscribes the
component holding it to the mutation's own state, so every save would re-render
`ProtokollFormular`, and with it the whole open section under `FormProvider`,
twice more: once when the request starts and once when it settles. That is the
same re-render the shared `SPEICHERT` constant already exists to avoid, timed at
206 ms on the catch table in feature 9a, and it would land every time somebody
pauses typing. Nothing `useMutation` offers is wanted here either: there is no
cache entry to update, and automatically retrying a refused save is precisely
what must not happen. Reading a protocol does go through `useQuery`, in
`ProtokollSeite`, where the cache and the loading state earn their keep.

This was flagged by both review axes as something to decide rather than settle in
a code comment. Three ways out, and the choice is the user's:

1. Keep the code and narrow the standard, so it reads "TanStack Query for server
   reads; a save that fires while somebody types may call the API directly".
   Cheapest, and records the real rule.
2. Keep the code and write an ADR, since the standard is itself downstream of
   ADR 0006's theming and performance constraints. Heaviest, most durable.
3. Change the code to `useMutation` and accept the re-render, or find a way to
   isolate it in a child component that holds no form state.

Nothing else in this feature depends on the answer.

## Notes for the AI

- **Keep the interface, not the implementation.** The build plan says the store
  is swapped "behind the same interface". Read that as intent, not as a
  signature: three synchronous functions become promises, so the callers change
  too. What must not change is that no component writes a `fetch`, and that the
  protocol page still receives one draft object and one save state.
- **The session cookie does the authorising.** Never send a user id. Every
  endpoint here filters on the caller's own account inside the query, which is
  what `app/protokolle/dienst.py` guarantees, and a 404 for somebody else's
  protocol is deliberate and must not be reworded into "no permission".
- **Do not let saving re-render the form.** `useAutoSave` already goes to
  lengths for this: a shared `SPEICHERT` object, because a fresh literal made
  every keystroke re-render 312 controls, measured at 206 ms in feature 9a. The
  version and the last-saved answers belong in refs. A `useMutation` whose
  pending state feeds `setState` on every keystroke would undo that work.
- **Error messages name the thing, say why, and give a way out.** That is this
  project's standing rule, and it applies to all four new failures here: the
  create that could not reach the server, the protocol that could not be loaded,
  the save that failed, and the conflict. "Nicht gespeichert" alone is not
  enough on any of them.
- **The 800 ms debounce and the unmount flush stay.** The flush now fires a
  request that may outlive the page, which is exactly why the safety copy is
  written before the request rather than after the failure.
- **Route paths stay German**, component and variable names stay English, and
  domain fields keep their legacy German paths. Nothing here renames an answer.
- **MUI for anything the banner needs.** `Alert` and `Button` before a
  hand-rolled div, themed in `muiTheme.ts` if the look needs adjusting.
- The backend is not to be changed. If an endpoint turns out to be missing
  something, stop and raise it.
