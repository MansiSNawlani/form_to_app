# Feature: 4a - Protocol shell and browser draft store

**From build-plan:** feature 4a, the first of three sub-features of item 4 (Form part 1)
**Status:** built, awaiting review

## Goal

Build the frame the whole protocol lives in: a protocol screen at a German route, the six-section
navigation from the mockup, and a draft that survives a page reload. Sections 2 to 6 are empty
placeholders that features 5 to 9 fill in.

This is the first feature built under the build-order change of 2026-09-01. Login (item 2) and
server-side drafts (item 3) come later, so the draft lives in the browser's own storage and no
backend endpoint is added. The point of doing the shell first is that features 4b through 9 then
have somewhere to put their fields, and each one can be tried in a real browser rather than only
read.

## Design reference

`prototypes/protokoll-teil-1.html` is the target, specifically:

- the `steps` navigation, its numbers, labels, and the current-step marking
- the page head: protocol title, draft state, form version, save indicator
- the form action row at the foot: back, forward, save state, close draft

`prototypes/theme.css` was already ported into `frontend/src/styles/theme.css` in feature 1a, so
unlike a first UI feature this one does not begin with a token port. Build against the existing
tokens and `frontend/src/theme/muiTheme.ts`; do not add colours.

Two deliberate departures from the mockup, both because the features they belong to do not exist
yet:

1. The header shows a signed-in user and a logout link. Leave the shell header exactly as feature
   1a built it. Login is item 2.
2. The head links to "Alle Protokolle". Point it at `/`, which is still the placeholder list.

## In scope

- React Router, with the German route paths already fixed in `project-overview.md`.
- `/protokolle/neu` creates a draft and sends the browser to it.
- `/protokolle/:id/abschnitt/:nr` renders one section, so any section is deep-linkable and the
  browser back button behaves.
- The six-section navigation, with any section reachable in any order. Locking the order is
  explicitly rejected in `project-overview.md`.
- The draft store: a typed module over the browser's own storage that creates, reads, writes and
  lists drafts.
- The `antworten` document shape, keyed by the legacy PDF field paths. **Load-bearing:** features
  4b through 9 all write into this, and feature 3 later sends it to the server unchanged.
- The save indicator, driven by the store rather than faked.
- One real field wired end to end (`anlass`), proving the loop: choose a value, leave the page,
  come back, it is still there.
- German strings for all of the above in `frontend/src/i18n/locales/de.json`.

## Out of scope

- **The rest of the part 1 fields.** Feature 4b. Only `anlass` is wired here, as the proof that the
  store works.
- **Validation rules.** Feature 4c. `anlass` gets no rule beyond being a select.
- **Anything on the backend.** No endpoint, no table, no migration, no Alembic. Feature 3 adds
  server saving and swaps the store's storage layer underneath the same interface.
- **Login and ownership.** Item 2. A draft in this build belongs to whoever is sitting at the
  browser.
- **The real submissions list.** `/` keeps the feature 1a placeholder. Feature 3 owns that screen.
- **Deleting drafts, and the "Entwurf schliessen" action.** The button appears in the mockup but
  needs a destination that does not exist yet.
- **Section 2 to 6 content.** They render a named placeholder saying which feature fills them.

## Before you start

**Run `/tests` first.** The frontend has no test runner, and this feature adds the draft store,
which is exactly the kind of logic `coding-standards.md` says must be tested: it serialises,
deserialises, and has to survive corrupt data and a full or blocked storage quota. `AGENTS.md`
already says the frontend runner is worth adding before feature 4. Add vitest, then implement.

If you decide not to, say so explicitly and the store ships on browser evidence alone. Do not
quietly skip it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The answers document type and the draft store** - a pure module: the `Entwurf`
      envelope, the `Antworten` document typed by legacy field path, and create, read, write and
      list over the browser's own storage. No React. *Done when:* the store's unit tests pass,
      covering a round trip, a missing draft, a corrupt stored value, and a storage write that
      throws; nothing renders yet.

- [x] **Step 2 - Routing and draft creation** - install React Router, move the current placeholder
      page onto `/`, add `/protokolle/neu` and `/protokolle/:id/abschnitt/:nr`. `/protokolle/neu`
      creates a draft through the store and redirects to section 1. An unknown draft id shows a
      plain "not found" page rather than a blank screen. *Done when:* visiting `/protokolle/neu`
      lands on `/protokolle/<a real id>/abschnitt/1`, reloading that URL still works, and the
      browser back button returns to `/`.

- [x] **Step 3 - The protocol page and section navigation** - the page head, the six-section nav
      built against the mockup, and section switching by URL. Sections 2 to 6 render a placeholder
      naming the feature that fills them. *Done when:* all six sections are reachable by mouse and
      by keyboard, the current one is marked with `aria-current="step"`, focus lands on the section
      heading after a switch, and it reads correctly in both light and dark.

- [x] **Step 4 - One field wired end to end, and the save indicator** - React Hook Form and Zod
      installed, the form provider around the section, the `anlass` select fed from the extracted
      option list, written through to the store on change with a short debounce, and the save
      indicator showing the real state. *Done when:* choosing an Anlass, navigating to section 4
      and back, then reloading the browser, all leave the choice in place, and the indicator moves
      from saving to saved.

## Files / areas

| Path | Why |
|---|---|
| `frontend/package.json` | adds react-router, react-hook-form, zod |
| `frontend/src/protokoll/entwurf/typen.ts` | the `Entwurf` envelope and the `Antworten` document |
| `frontend/src/protokoll/entwurf/store.ts` | create, read, write and list over browser storage |
| `frontend/src/protokoll/entwurf/store.test.ts` | the store's tests |
| `frontend/src/protokoll/ProtokollSeite.tsx` | the protocol page: head, nav, current section |
| `frontend/src/protokoll/AbschnittNav.tsx` | the six-section navigation |
| `frontend/src/protokoll/SpeicherAnzeige.tsx` | the save indicator |
| `frontend/src/protokoll/abschnitte/Abschnitt1.tsx` | section 1, holding only `anlass` for now |
| `frontend/src/protokoll/optionen.ts` | reads the extracted option lists |
| `frontend/src/routes.tsx`, `frontend/src/main.tsx` | the router |
| `frontend/src/i18n/locales/de.json` | every new string |

## Data / contracts

**Both shapes below are load-bearing. Features 4b through 9 and feature 3 all depend on them, so
they are locked here rather than improvised later.**

The draft envelope, deliberately close to the `Submission` columns in `project-overview.md` so
feature 3 is a plumbing change and not a reshape:

```
Entwurf {
  id            string, from crypto.randomUUID()
  formVersion   "20260609", never migrated (ADR 0004)
  angelegtAm    ISO timestamp
  geaendertAm   ISO timestamp
  antworten     Antworten
}
```

The answers document uses **nested objects whose paths spell out the legacy PDF field path
exactly**, as `coding-standards.md` requires:

```
antworten.anlass                                 -> legacy "anlass"
antworten.probestrecke.gewaesser.vorfluter1      -> legacy "probestrecke.gewaesser.vorfluter1"
antworten.messdaten.uhrzeit                      -> legacy "messdaten.uhrzeit"
```

This is not decoration. React Hook Form addresses fields by dotted name, so a field registered as
`probestrecke.gewaesser.vorfluter1` writes to exactly the right place with no mapping layer, and
the eventual FiaKa transfer stays a direct match.

**Storage.** `localStorage`, one key per draft plus an index key, all prefixed `ffs-entwurf`. It is
synchronous and simple, a protocol is a few kilobytes, and every read and write must be wrapped so
that private browsing, blocked site data and a full quota degrade rather than crash. The same
pattern is already used for the locale in `frontend/src/i18n/index.ts`.

**Option lists.** The single source is `database/seed/form_version_20260609/optionslisten.json`,
regenerated from the PDF. The frontend must not hold a retyped second copy. Import it through a
Vite path alias so there is one file. `optionen.ts` narrows it to the list a component asks for.
If bundling all nine lists proves heavy (`arten` has 123 entries, `probestrecke.monitoringnummer`
has 722), split the import per list; do not solve it by copying values into the code.

## Testing

Assuming `/tests` has added vitest:

| What | How |
|---|---|
| The draft store | Unit tests. Round trip, missing draft, corrupt JSON, a write that throws, and the index staying correct across two drafts. This is the in-scope logic for the gate. |
| Routing and creation | Browser. `/protokolle/neu` redirects to a real id, reload survives, an unknown id shows the not-found page. |
| Section navigation | Browser and keyboard. Tab to the nav, activate each section with Enter, confirm `aria-current` and where focus lands. |
| Persistence end to end | Browser. Choose an Anlass, navigate away, reload, confirm it is still selected. |
| Both themes | Screenshot the protocol page in light and dark. |
| Build | `npm run build` from `frontend/` at the end of every step. |

No backend change, so `pytest` is untouched, though it should still be green before `/complete`.

## Notes for the AI

- **Route paths are German** (`/protokolle/neu`, `/protokolle/:id/abschnitt/:nr`), decided on
  2026-08-24. Component and variable names stay English; domain terms inside them stay German.
- **Every user-visible string comes from `de.json`.** No literal German in a component, exactly as
  feature 1b established.
- **Accessibility is an acceptance criterion, not a later pass.** MUI does not give it for free.
  The section nav is a real `nav` with an ordered list, the current step carries
  `aria-current="step"`, focus is moved deliberately on section change, and focus is visible
  against our tokens in both themes.
- **No colour outside the tokens.** No `sx` colour overrides, no hard-coded hex.
- **The app must not read as a Material app.** Flat surfaces, 4px radius, no elevation shadows.
- Do not add a second component library, and do not add Playwright.

### Four discrepancies found while writing this spec

Recorded here so 4b does not have to rediscover them. None of them block 4a.

1. **`uhrzeit` sits in part 2 in the PDF**, as `messdaten.uhrzeit`, but the mockup and the
   `Submission` model both put the time in part 1. Keep the legacy path, render it in part 1.
2. **There is no `bearbeiter.ort` field in the PDF.** It has `strasse` and `plz` but no town, while
   both the mockup and the `Person` model have one. 4b should add `bearbeiter.ort`, and this is
   worth raising with FFS, since it looks like a gap in the original form.
3. **`anodenfuehrer` appears in the mockup's Bearbeiter block**, but `project-overview.md` puts it
   in `ausruestung`, which is feature 8. Leave it out of part 1.
4. **The mockup's Regierungspraesidium numbering is wrong.** It shows "1 - Stuttgart"; the list
   extracted from the PDF has 1 as Karlsruhe and 2 as Stuttgart. The extracted list wins wherever
   the two disagree, including here.

Also unresolved for 4b: `z.quelle` and `z.ps_nummer` exist in the form but appear nowhere in the
data model in `project-overview.md`. They look like FiaKa transfer metadata rather than survey
data. Decide in 4b whether part 1 shows them.
