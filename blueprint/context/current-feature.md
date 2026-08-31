# Feature: 1a - App shell and theme

**From build-plan:** feature 1a (first sub-feature of item 1, Project skeleton)
**Status:** not started

## Goal

Replace the Vite demo scaffold with the real application shell: a header at the top, a main content
area in the middle, and a footer at the bottom, styled from the design tokens locked in
`prototypes/theme.css`, with KERN installed and proven to render.

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
  but the real components come from KERN. Do not copy it wholesale into the app.

The mockups get discarded at this feature's `/complete`. `theme.css` lives on inside the app.

## In scope

- Removing the Vite demo scaffold (`App.css`, the demo `App.tsx`, the hero and logo assets).
- Porting the `theme.css` tokens into the app's stylesheet, both the light and the dark set.
- Installing KERN and confirming its React components render under React 19.
- Reconciling KERN's own tokens with ours, so a stock KERN button carries the BW accent.
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

- [ ] **Step 1 - Clear the Vite scaffold.** Delete `src/App.css`, the demo body of `src/App.tsx`,
      and the unused `src/assets/` images. Strip `src/index.css` back to a reset. Leave a bare
      placeholder so the app still mounts.
      *Done when:* `npm run dev` serves a blank page with no Vite or React logo, no console errors,
      and `npm run build` and `npm run lint` both pass.

- [ ] **Step 2 - Port the design tokens.** Copy the token blocks from `prototypes/theme.css` into
      `src/styles/theme.css` and import it once in `src/main.tsx`. Keep the `:root` and
      `:root[data-theme="dark"]` structure and the variable names unchanged, so the mockups stay a
      valid reference.
      *Done when:* every `--` variable from the prototype resolves in devtools, and setting
      `data-theme="dark"` on `<html>` by hand visibly flips the background and text.

- [ ] **Step 3 - Install KERN and prove it renders.** Add `@kern-ux/native` (2.7.2, the CSS, fonts
      and tokens) and `@kern-ux-annex/kern-react-kit` (2.40.0, the React components). Render one
      KERN button and one KERN text input on the placeholder page.
      *Done when:* both render with KERN's own styling, `npm run build` passes, and `npm install`
      reports no peer-dependency errors against React 19.2. **This is the ADR 0005 risk check.** If
      the kit fights React 19 or ships broken types, stop here and report rather than working around
      it. Do not quietly swap in a different library either. FFS have confirmed KERN is not
      mandatory (see the amendment on ADR 0005), so replacing it is now allowed, but it is a
      decision to take together with a new ADR, not a step to improvise inside.

- [ ] **Step 4 - Reconcile KERN's tokens with ours.** KERN ships its own custom properties, its own
      reset, and its own bundled fonts, so decide per token which wins and write the mapping in one
      place. Ours wins for the BW accent and the surface ramp; KERN's wins for spacing, focus
      behaviour and component internals. Three specific collisions to settle, not just the colours:
      - **Fonts.** `prototypes/theme.css` names `Source Sans 3` as a stand-in. `@kern-ux/native`
        bundles its own typeface. **KERN's font wins**, since ADR 0005 adopted KERN partly to
        satisfy the state typography requirement. Update `--font-sans` to KERN's actual family and
        note the change, rather than fighting it.
      - **The reset.** KERN native ships one. Drop whatever remains in `src/index.css` from step 1
        if it duplicates KERN's, so there is exactly one reset.
      - **Import order.** KERN's stylesheet must load before ours or our token overrides lose.
      *Done when:* a stock KERN button renders in the BW accent with no per-component overrides, the
      page renders in KERN's font, and `src/styles/theme.css` carries a comment naming which KERN
      variables are being overridden and why.

- [ ] **Step 5 - Build the shell.** `AppShell` composing `SiteHeader`, a `<main>` landmark, and
      `SiteFooter`, matching the mockups. Header: the FFS org line, the app name, the signed-in
      placeholder. Footer: the org line, the legal links including Barrierefreiheit, the form
      version. Include the skip link.
      KERN has roughly thirty components and may not ship a header or footer at all. If it does not,
      build these as plain semantic HTML styled from the tokens. That is not a workaround, it is what
      ADR 0005 anticipated. Do not pull in another library just to get a header: a header and a
      footer are the clearest case where plain HTML is the right answer, whatever the wider library
      choice turns out to be.
      *Done when:* at 1440px the header and footer match
      `prototypes/protokoll-teil-1.html` side by side; on a page with almost no content the footer
      still sits at the bottom of the viewport; tabbing from the top reveals the skip link first;
      and the page has exactly one `<h1>`, one `<header>`, one `<main>` and one `<footer>`.

- [ ] **Step 6 - Theme toggle.** A real toggle in the header setting `data-theme` on `<html>`,
      persisted, and honouring `prefers-color-scheme` on a first visit with no stored choice.
      *Done when:* clicking flips light and dark across the whole shell, the choice survives a
      reload, and a fresh profile with an OS dark preference opens dark.

## Files / areas

- `frontend/package.json` - KERN dependencies.
- `frontend/src/main.tsx` - stylesheet imports, shell mount.
- `frontend/src/App.tsx` - reduced to the shell plus a placeholder child.
- `frontend/src/styles/theme.css` - **new**, the ported tokens. Load-bearing.
- `frontend/src/components/AppShell.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx` - **new**.
- `frontend/src/hooks/useTheme.ts` - **new**, the toggle and its persistence.
- Deleted: `frontend/src/App.css`, `frontend/src/assets/*`.

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
- **KERN first, and do not switch libraries mid-step.** FFS have confirmed KERN is not mandatory,
  so another library is allowed where KERN genuinely falls short (see the 2026-08-24 amendment on
  ADR 0005). Within this sub-feature, though, the default holds: where KERN falls short, build
  in-house on a headless primitive. Changing the library is a decision to raise, not one to make
  inside a build step.
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
