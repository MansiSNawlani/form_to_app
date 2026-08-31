# Feature: 1a - App shell and theme

**From build-plan:** feature 1a (first sub-feature of item 1, Project skeleton)
**Status:** completed 2026-08-31

> **Revised 2026-08-24: the component library is now MUI, not KERN**
> ([ADR 0006](../../docs/adr/0006-mui-supersedes-kern.md), superseding ADR 0005). KERN was never
> installed, so nothing is thrown away. Steps 1 and 2 were library-agnostic and stand as built.
> Old steps 3 and 4 are merged into one MUI step, because the install risk check they existed to
> run is already answered: `@mui/material` 9.3.1 declares React 19 in its peer range and installed
> clean against React 19.2.8.

## Goal

Replace the Vite demo scaffold with the real application shell: a header at the top, a main content
area in the middle, and a footer at the bottom, styled from the design tokens locked in
`prototypes/theme.css`, with MUI installed and themed so it does not look like Material.

This is the frame every later screen sits inside. Nothing renders in this project until it exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            

## Design reference

The mockups in `prototypes/`, approved on 2026-08-22. These beat a screenshot because they carry
the exact token values.

- [../../prototypes/theme.css](../../prototypes/theme.css) - **the source of truth** for colour,
  type and spacing. Port these values; do not re-pick them.
- [../../prototypes/protokoll-teil-1.html](../../prototypes/protokoll-teil-1.html) - the header and
  footer to match. Its form body belongs to feature 4, not here.
- [../../prototypes/meine-protokolle.html](../../prototypes/meine-protokolle.html) - the same shell
  around a short page, which is what proves the footer sits at the bottom of the viewport rather
  than floating up.
- [../../prototypes/mockup.css](../../prototypes/mockup.css) - throwaway. Read it for layout intent,
  but the real components come from MUI. Do not copy it wholesale into the app.

The mockups get discarded at this feature's `/complete`. `theme.css` lives on inside the app.

## In scope

- Removing the Vite demo scaffold (`App.css`, the demo `App.tsx`, the hero and logo assets).
- Porting the `theme.css` tokens into the app's stylesheet, both the light and the dark set.
- Installing MUI and building its theme from our tokens, so a stock MUI button carries the BW
  accent with no per-component overrides.
- `AppShell`, `SiteHeader` and `SiteFooter` components matching the mockups.
- A working light and dark toggle whose choice survives a reload.

## Out of scope

- **Routing.** The shell has no routes yet. Feature 3 introduces the first real ones, and they will
  be German (see Notes).
- **Translation.** Strings are hard-coded German in this sub-feature and move into a locale file in
  1b. This is deliberate: doing both at once makes the diff unreadable.
- **Any form field.** The form body is feature 4. The species picker and catch table are feature 9.
- **Docker, Postgres, FastAPI.** Sub-feature 1c.
- **The Verify command and GitHub checks.** Separate `/ci` run.
- **The real Baden-Wuerttemberg accent colour.** See Notes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Clear the Vite scaffold.** Delete `src/App.css`, the demo body of `src/App.tsx`,
      and the unused `src/assets/` images. Strip `src/index.css` back to a reset. Leave a bare
      placeholder so the app still mounts.
      *Done when:* `npm run dev` serves a blank page with no Vite or React logo, no console errors,
      and `npm run build` and `npm run lint` both pass.

- [x] **Step 2 - Port the design tokens.** Copy the token blocks from `prototypes/theme.css` into
      `src/styles/theme.css` and import it once in `src/main.tsx`. Keep the `:root` and
      `:root[data-theme="dark"]` structure and the variable names unchanged, so the mockups stay a
      valid reference.
      *Done when:* every `--` variable from the prototype resolves in devtools, and setting
      `data-theme="dark"` on `<html>` by hand visibly flips the background and text.

- [x] **Step 3 - Theme MUI from our tokens.** MUI ships its own palette, its own reset
      (`CssBaseline`) and Material's shape language. Ours wins for colour, radius and elevation;
      MUI's wins for component internals and interaction behaviour. Write the mapping in one place,
      `src/theme/muiTheme.ts`, and render one MUI `Button` and one `TextField` on the placeholder
      page to prove it.
      Four collisions to settle, not just the colours:
      - **Colour values.** MUI derives hover and disabled states with `alpha()`, which cannot
        operate on a `var(--accent)` string, so the palette needs real hex values. Duplicate only
        the subset MUI needs into `src/theme/tokens.ts`, with a comment in both files pointing at
        the other, rather than restating all 57 tokens.
      - **Scheme switching.** Configure `colorSchemeSelector: '[data-theme="%s"]'` so MUI's light
        and dark schemes flip on the same `data-theme` attribute our CSS already uses. One attribute
        drives both, which is what makes step 5's toggle a one-liner.
      - **The reset.** `CssBaseline` replaces what is left in `src/index.css`, so there is exactly
        one reset. It must not fight the `body` rule in `theme.css`.
      - **Shape.** Material's default radius and elevation shadows are wrong here. `--radius` is
        4px and the mockups have no shadows at all.
      *Done when:* a stock `<Button variant="contained">` renders in the BW accent and a stock
      `<TextField>` picks up our surface and border colours, both with no `sx` colour overrides at
      the call site; flipping `data-theme` by hand recolours the MUI components too, not just the
      page; `npm run build` and `npm run lint` pass.

- [x] **Step 4 - Build the shell.** `AppShell` composing `SiteHeader`, a `<main>` landmark, and
      `SiteFooter`, matching the mockups. Header: the `BW` placeholder mark, the FFS org line, the
      app name, the signed-in placeholder. Footer: the org line, the legal links including
      Barrierefreiheit, the form version. Include the skip link.
      Build these as plain semantic HTML styled from the tokens. MUI's `AppBar` is Material
      furniture with elevation and its own layout assumptions, and the mockups want a flat bordered
      bar, so fighting `AppBar` into that shape costs more than writing the header. Use MUI for
      controls inside the shell, not for the shell itself.
      *Done when:* at 1440px the header and footer match
      `prototypes/protokoll-teil-1.html` side by side; on a page with almost no content the footer
      still sits at the bottom of the viewport; tabbing from the top reveals the skip link first;
      and the page has exactly one `<h1>`, one `<header>`, one `<main>` and one `<footer>`.

- [x] **Step 5 - Theme toggle.** A real toggle in the header setting `data-theme` on `<html>`,
      persisted, and honouring `prefers-color-scheme` on a first visit with no stored choice.
      Because step 3 pointed MUI's `colorSchemeSelector` at the same attribute, this sets one
      attribute and both our CSS and MUI follow.
      *Done when:* clicking flips light and dark across the whole shell **and** the MUI components,
      the choice survives a reload, and a fresh profile with an OS dark preference opens dark.

## Files / areas

- `frontend/package.json` - MUI and emotion dependencies.
- `frontend/src/main.tsx` - stylesheet imports, `ThemeProvider`, shell mount.
- `frontend/src/App.tsx` - reduced to the shell plus a placeholder child.
- `frontend/src/styles/theme.css` - the ported tokens. Load-bearing.
- `frontend/src/theme/tokens.ts` - **new**, the palette subset MUI needs, kept in sync with
  `theme.css`.
- `frontend/src/theme/muiTheme.ts` - **new**, the single mapping from our tokens to MUI's theme.
- `frontend/src/components/AppShell.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx` - **new**.
- `frontend/src/hooks/useTheme.ts` - **new**, the toggle and its persistence.
- Deleted: `frontend/src/App.css`, `frontend/src/assets/*`, the demo `public/` icons.

## Data / contracts

No database or API shapes yet. One contract is locked here, and it is load-bearing:

- **The CSS custom property names** in `src/styles/theme.css`. Every later UI feature styles against
  them, and the prototypes are written against them. Renaming a token later is a wide change, so
  settle names now and keep them identical to `prototypes/theme.css`.
- **`data-theme` on `<html>`**, values `light` and `dark`. Feature 2 will read the user's stored
  `locale` and theme preference from their account; this attribute is the hand-off point.

## Testing

**No test runner is configured.** `AGENTS.md` declares no `test` command and the frontend has no
runner at all, so the test gate is off for this sub-feature. That is the right call here anyway:
this feature is entirely components and styling, and `coding-standards.md` says to verify those
with browser evidence and the build rather than unit tests.

Evidence per step is the "done when" above. For the whole feature:

- `npm run build` and `npm run lint` pass from `frontend/`.
- Screenshots at 1440px in both themes, compared against the prototype files.
- One narrow-viewport screenshot at roughly 700px to confirm nothing overflows horizontally.
- Keyboard pass: skip link first, visible focus on every interactive element in both themes.

The first logic worth unit-testing arrives in feature 4 (the coordinate bounds check and the
Vorfluter chain rule). `/tests` should be run before then, not now.

## Notes for the AI

- **Domain language stays German.** User-visible strings are German. Component and variable names
  stay English, since they are general programming vocabulary, not domain terms. See
  `coding-standards.md`.
- **MUI, themed, never stock.** The library question is settled by ADR 0006 and should not be
  reopened. The live risk is different: it is that the app drifts into looking like a Material app.
  No Material purple, no pill buttons, no elevation shadows, no uppercase button labels. If a
  screen starts looking like a Google product, that is a defect.
- **The shell is hand-built, the controls are MUI.** Header and footer are semantic HTML styled
  from tokens. Buttons, inputs, selects and the eventual autocomplete are MUI.
- **No hard-coded colours anywhere.** Every value comes from a token. This is the one rule that
  makes the dark theme work without a second pass.
- **The accent colour is provisional.** `prototypes/theme.css` uses `#17457a`, chosen to sit in the
  right place, not sampled from the official state palette. Carry the `TODO` comment across into
  `src/styles/theme.css` so it stays visible until FFS supplies the real values. Do not quietly
  drop it.
- **The `BW` box in the header is a placeholder** for the state coat of arms, which FFS has to
  supply. Keep it obviously provisional rather than making it look finished.
- **Accessibility is a requirement, not a later pass.** Correct landmarks, real labels, visible
  focus, sufficient contrast in both themes.
- **Route language is settled: German.** Decided on 2026-08-24. This sub-feature still adds no
  routes, since routing is feature 3, but the question is closed and does not need raising again.

## Completion note

The spec said the mockups in `prototypes/` would be discarded at this feature's `/complete`.
They were not. Only `theme.css` was consumed here, and the HTML mockups remain the design
reference for features 3, 4, 11 and 12. They had also never been committed, so deleting them
would have been unrecoverable. Decided on 2026-08-31 to commit the folder instead and delete it
when the last feature that references it is complete.
