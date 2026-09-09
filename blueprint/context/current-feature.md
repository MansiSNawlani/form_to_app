# Feature: Meine Protokolle

**From build-plan:** feature 3c
**Status:** built, under review

## Goal

Replace the placeholder home page with the real list of the signed-in account's own
protocols: how many there are, one row each with the water, the survey date, the
occasion and the status, a way back into a draft, a way to throw one away, and a
first-run state for somebody who has none yet.

This is the screen that makes the drafts built in 3a and 3b findable. Until now the only
way back into a protocol is the address of the page it is on, so closing the tab loses it
in practice even though the server still holds it.

## Design reference

- [prototypes/meine-protokolle.html](../../prototypes/meine-protokolle.html) - the approved
  mockup, and the target for this screen.
- [prototypes/mockup.css](../../prototypes/mockup.css) - the classes it uses:
  `.page__head`, `.card`, `table.data`, `.cell-title`, `.cell-sub`, `.badge`, `.empty`.
- [prototypes/theme.css](../../prototypes/theme.css) - already ported to
  `frontend/src/styles/theme.css` in feature 1a. Nothing to port again; every value in
  this feature is a token from there.

The mockup shows a second card headed "Zustand ohne Protokolle" underneath the table.
That is the mockup showing both states at once for comparison, and it says so. The built
page shows one or the other.

## In scope

- The list request: a `GET /api/v1/protokolle` call, its type, and its TanStack Query
  entry.
- The page at `/`, replacing `App.tsx`, for every signed-in account.
- The count line under the title: "6 Protokolle, davon 2 Entwürfe".
- One row per protocol: water and Ortsangabe, survey date, Anlass, status badge, when it
  was last worked on, and the row's action.
- "Weiter ausfüllen", which opens section 1 of that protocol.
- "Neues Protokoll", pointing at the existing `/protokolle/neu` route.
- The empty state for an account with no protocols at all.
- Deleting a draft, behind a confirmation, including the local safety copy and that
  draft's attachments in this browser.
- Loading and failure states for both the list and the delete.
- German strings in `de.json`, and the status vocabulary for all seven statuses.
- The list table's look themed once in `muiTheme.ts`, so feature 12's review queue and
  feature 16's user list inherit it.

## Out of scope

- **The search box and the three filter dropdowns** in the mockup. `GET /protokolle`
  deliberately takes no filter parameters, and its docstring says why: filtering and
  searching belong to feature 12's review queue, which reads across every account rather
  than one person's handful. Sorting is fixed at most recently worked on first, which is
  what the endpoint returns.
- **Paging.** The endpoint is not paginated, for the same reason.
- **Any read-only view of a submitted protocol.** Nothing can leave `DRAFT` yet, so
  "Ansehen" has nowhere to go. Feature 11 adds the workflow and the screen; this feature
  draws the badge for all seven statuses so that feature adds a link rather than a
  vocabulary.
- **Submitting, accepting, rejecting.** Feature 11.
- **Any backend change.** The list and delete endpoints, the ownership filter and the
  summary shape all shipped in 3a.
- **Attachments on the server.** Feature 3d. This feature only cleans up the browser's
  own copies when their draft is deleted.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too
big, so split it.

## Build steps

- [x] **Step 1 - The list call and its query.** Add `Uebersicht` to
      `protokoll/entwurf/typen.ts`, mirroring the backend's `ProtokollUebersicht` field
      for field, snake_case kept. Add `listeProtokolle()` to `entwurf/api.ts` and
      `protokolleAbfrage` to `entwurf/abfragen.ts`. Unlike `entwurfsAbfrage` this one is
      allowed to go stale and refetch: the list holds nothing the browser has typed, so a
      refetch can only make it more correct.
      *Done when:* `npm test` is green and covers the path and method of the call, that a
      refusal arrives as an `ApiFehler`, and that the query key does not collide with
      `entwurfsKey`. Nothing on screen changes yet.

- [x] **Step 2 - The display rules.** A new `protokoll/liste/anzeige.ts` holding the pure
      functions the rows need, each testable without React:
      - the survey date, `YYYY-MM-DD` as stored by `FeldDatum`, into `DD.MM.YYYY`,
        answering null for missing or malformed;
      - "zuletzt bearbeitet" from `updated_at`, as "heute, 14:32", "gestern, 14:32" or a
        plain date, with the current time passed in rather than read from the clock;
      - the row's first line, the water, reusing `entwurf/titel.ts`'s `titelAusTeilen`
        rather than a second rule, and naming the placeholder a draft with nothing typed
        into it falls back to;
      - the row's second line, the Ortsangabe and the length as "Weißenau · 120 m",
        dropping whichever part is missing;
      - the Anlass label, looked up in the `anlass` option list, falling back to the
        stored code so an unknown value still shows something;
      - the status to its label key and badge modifier, all seven of them;
      - the counts: how many protocols, and how many of them are drafts.
      *Done when:* `npm test` covers each function including the empty, missing and
      malformed cases, and the two boundary cases on the date, midnight today and
      midnight yesterday.

- [x] **Step 3 - The page head, and the shared page CSS.** New
      `protokoll/liste/ProtokolleSeite.tsx`, wired to the index route in place of
      `App.tsx`, which is deleted. It renders the title, the count line from step 2, the
      "Neues Protokoll" button, and, while the request is in flight or has failed, the
      matching state. Move `.page__head`, `.page__head-actions`, `.page__sub` and `.card`
      from `protokoll/protokoll.css` to `components/shell.css`, which every screen loads,
      since two pages now use them.
      *Done when:* signed in, `/` shows "Meine Protokolle" with a real count from the
      server and a working "Neues Protokoll"; the protocol screen's head is unchanged;
      with the backend stopped, the page shows the network failure sentence and a way to
      try again rather than an empty page; `npm run build` and `npm run lint` pass.

- [x] **Step 4 - The table of rows.** A `ProtokollZeile.tsx` and the table around it,
      built with MUI's `Table`, `TableRow` and `TableCell`, with the six columns of the
      mockup and the badge. The list look is themed in `muiTheme.ts` as a variant beside
      the catch table's, not per instance: left-aligned, roomier cells, no vertical rules,
      so features 12 and 16 inherit it. The badge is MUI's `Chip`, themed in the same file
      to the mockup's bordered rectangle at the form's own radius rather than Material's
      rounded pill, with one colour per status from the tokens. The action is "Weiter
      ausfüllen" for a draft, linking to
      section 1; any other status shows the badge and no action, since nothing to open
      exists yet.
      *Done when:* an account with several drafts sees them newest-first, each with its
      water, date, Anlass, badge and last-edited time; a draft with nothing typed into it
      yet still reads sensibly rather than as a row of blanks; the link opens the right
      protocol; the table scrolls inside its own frame on a narrow window rather than
      scrolling the page sideways; screenshots in light and dark; keyboard navigation
      reaches every action and the focus ring is visible.

- [x] **Step 5 - The empty state.** The card from the mockup for an account with no
      protocols at all: heading, the sentence explaining that a protocol is filled in over
      several sittings and only submitted deliberately, and the button to start the first
      one. Shown only when the list loaded and is empty, never while it is loading or
      after it failed.
      *Done when:* a fresh account sees it in place of the table; creating a protocol
      replaces it with a one-row table; the count line does not print "0 Protokolle" above
      it.

- [x] **Step 6 - Deleting a draft.** `loescheEntwurf()` in `entwurf/api.ts`, a
      confirmation dialog naming the protocol, and a mutation that refreshes the list on
      success. It also clears that draft's local safety copy and its attachments in this
      browser, best effort: both are keyed by the draft's id and nothing else will ever
      come back for them. A failed delete leaves the row in place and says why. Only a
      draft offers the action.
      *Done when:* deleting asks first and cancel does nothing; confirming removes the row
      without a page reload; deleting the last one leaves the empty state from step 5
      rather than an empty table; reopening the deleted address shows the not-found page;
      its safety copy and attachments are gone from `localStorage` and IndexedDB; with the
      backend stopped, the row stays and a message explains it; `npm test` covers the
      delete call and the cleanup.

## Files / areas

Frontend only.

| File | Why |
|---|---|
| `frontend/src/protokoll/entwurf/typen.ts` | the `Uebersicht` summary type |
| `frontend/src/protokoll/entwurf/api.ts` | `listeProtokolle`, `loescheEntwurf` |
| `frontend/src/protokoll/entwurf/abfragen.ts` | `protokolleAbfrage`, its key and staleness |
| `frontend/src/protokoll/liste/anzeige.ts` + test | the display rules |
| `frontend/src/protokoll/liste/ProtokolleSeite.tsx` | the page |
| `frontend/src/protokoll/liste/ProtokollZeile.tsx` | one row |
| `frontend/src/protokoll/liste/LeererZustand.tsx` | the first-run card |
| `frontend/src/protokoll/liste/LoeschenDialog.tsx` | the confirmation |
| `frontend/src/protokoll/liste/liste.css` | the row classes from the mockup |
| `frontend/src/components/shell.css` | the page head and card rules moved in |
| `frontend/src/protokoll/protokoll.css` | those same rules moved out |
| `frontend/src/theme/muiTheme.ts` | the list table variant and the status `Chip` |
| `frontend/src/routes.tsx` | index route points at the new page |
| `frontend/src/App.tsx` | deleted |
| `frontend/src/i18n/locales/de.json` | every string on the screen |

## Data / contracts

**`Uebersicht`**, mirroring `backend/app/api/schemas.py`'s `ProtokollUebersicht`. Server
keys are kept as they arrive, as `Entwurf` already does, because a renaming layer is one
more place the two halves can disagree.

```ts
interface Uebersicht {
  id: string
  status: Status
  form_version: string
  version: number
  created_at: string
  updated_at: string
  gewaessername: string | null
  ortsangabe: string | null
  laenge: string | null
  datum: string | null
  anlass: string | null
}
```

The five display values are `null` when blank, never `""`: the backend collapses a cleared
answer and an untouched one into one representation, so nothing here has to handle both.

`GET /api/v1/protokolle` answers `Uebersicht[]`, newest first by `updated_at`, filtered to
the caller's own protocols by the server. `DELETE /api/v1/protokolle/{id}` answers 204,
and 409 for anything that is no longer a draft.

The status vocabulary is load-bearing for feature 11: all seven labels and badge modifiers
are defined here, and `LOCKED`'s wording is provisional until feature 11 settles the
workflow language.

## Testing

The frontend gate is on: **`npm test`** from `frontend/`, per `AGENTS.md`.

Logic that must ship a test in its own step:

- **Step 1** - the list call, and the query key and staleness.
- **Step 2** - every function in `anzeige.ts`, with its missing and malformed cases.
- **Step 6** - the delete call and the two local cleanups.

Steps 3, 4 and 5 are components and ride on browser evidence plus `npm run build`, as
`coding-standards.md` requires. Playwright is not installed and this feature does not add
it.

Manual path: sign in, start two protocols, fill a water name into one, return to `/`,
check the count line, the rows, the ordering, both themes, keyboard only, then delete one
and confirm it does not come back after a reload.

No backend change, so `pytest` should be unaffected. Run it once at the end anyway.

## Notes for the AI

- **Use MUI wherever MUI has a component.** `Table`, `TableRow`, `TableCell`, `Button`,
  `Dialog`, `Alert`, and `Chip` for the status badge, decided on 2026-09-09. MUI's `Chip`
  is a rounded Material pill and the mockup draws a bordered rectangle at the form's own
  radius; that is a reason to theme it, not a reason to hand-build the badge.
- **Theme the table once, not per use.** `muiTheme.ts` under `components`. The catch
  table's centred, dense, fully ruled cells are the wrong look here, so this is a second
  variant beside it rather than an override of it.
- No hard-coded colour anywhere. Every value is a token from `styles/theme.css`.
- Every string comes from `de.json`. `protokolle.list.title`, `.empty` and `.new` are
  already there, put under that prefix by feature 1b for exactly this screen, so build on
  them rather than starting a new branch of the file. The count line is the first use of i18next's plural
  forms in this project, so "1 Protokoll" and "2 Protokolle" both read correctly.
  `en.json` stays the stub it is; feature 17 fills it.
- Accessibility is an acceptance criterion, not a later pass: an accessible name on the
  table, the status readable as text and not by colour alone, keyboard access to every row
  action, visible focus in both themes.
- The delete dialog follows `abschnitte/teil7/EntfernenDialog.tsx`: cancel first and
  focused, the destructive button never what a hurried Enter lands on, and the thing being
  deleted named in the question.
- A failure message names the thing, says why in plain words, and says what to do next.
  `useFehlertext` already turns an `ApiFehler` into a sentence; reuse it.
- The list may be refetched freely, unlike `entwurfsAbfrage`, which is pinned at
  `staleTime: Infinity` because the open form holds answers the server has not seen.
  Nothing on this page is unsaved, so returning to it should show current data.
