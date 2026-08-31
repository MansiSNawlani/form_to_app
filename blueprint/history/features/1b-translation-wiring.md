# Feature: 1b - Translation wiring

**From build-plan:** feature 1b (second sub-feature of item 1, Project skeleton)
**Status:** completed 2026-08-31

## Goal

Put an i18n library behind the app and move every user-visible string in the shell into a German
locale file, so that feature 17 can add English by writing one more file rather than by touching
components.

German is the source locale and the fallback. This feature adds no English translation and no
language switcher.

## Design reference

No new visuals. The shell is already built and this feature must not change how it looks. The
mockups in `prototypes/` remain the reference for wording.

## In scope

- An i18n library, its provider, and a German locale file.
- Moving all 18 shell strings out of components.
- A key naming convention, which is the load-bearing contract here.
- Making `<html lang>` and the document title follow the active locale.
- MUI's own internal strings set to German.
- A stub `en.json` and a fallback rule, to prove the mechanism works.

## Out of scope

- **Any actual English translation.** Feature 17. The stub exists only to prove fallback.
- **A language switcher in the UI.** Feature 2 reads `User.locale` from the account; until then the
  locale is switched from devtools.
- **Number, date and decimal formatting.** German writes decimals with a comma, which matters a
  great deal for the form's numeric fields. That belongs to feature 4, where the first numeric
  input appears. See Notes.
- **Form field labels.** Features 4 to 9.
- **Backend, Docker, Postgres.** Sub-feature 1c.

## Build loop

Build one step at a time, never the whole feature at once.

1. The AI implements just that step.
2. It shows the diff (not full files); you read it and understand it.
3. You approve, then choose whether to commit a checkpoint or roll straight on.

Never accept a step you haven't read. If a diff is too big to review, the step was too big.

## Build steps

- [x] **Step 1 - Install and wire the library.** Add `i18next` and `react-i18next`. Create
      `src/i18n/index.ts` configuring German as both the active locale and the fallback, and
      `src/i18n/locales/de.json`. Mount the provider in `src/main.tsx`. Move exactly one string,
      the skip link, to prove the wiring end to end.
      *Done when:* the skip link text comes from `de.json`, the page renders unchanged, and
      `npm run build` and `npm run lint` pass.

- [x] **Step 2 - Move the shell strings.** All 18, across `AppShell`, `SiteHeader`, `SiteFooter`,
      `ThemeToggle` and `App.tsx`. Includes the footer form version, the one string needing
      interpolation (`Formularversion {{version}}`), so it proves that mechanism too.
      Three strings are **not** translatable and stay literal, with a comment saying why: the `FFS`
      mark, the organisation name, and the application name `Protokoll E-Befischung`. They are
      proper nouns and a domain term.
      *Done when:* no German user-visible string remains literal in any component, and the rendered
      text is byte-identical to before.

- [x] **Step 3 - Type the keys.** Add a declaration so `t('shell.footer.impressum')` is checked at
      compile time and a typo fails the build rather than rendering a raw key at runtime.
      *Done when:* deliberately misspelling a key makes `tsc` fail, shown in the step evidence,
      then reverted.

- [x] **Step 3b - Enable TypeScript strict mode.** Added mid-feature by decision on 2026-08-31.
      `coding-standards.md` requires strict mode; the Vite scaffold never set it and nothing had
      caught it. Enabling it produced zero errors, so it was free today and will not stay free once
      feature 4 starts writing form state and Zod schemas without `strictNullChecks`.
      *Done when:* `strict` is true in `tsconfig.app.json` and `tsconfig.node.json`, and the build
      passes with no errors.

- [x] **Step 4 - Locale plumbing and MUI's own strings.** Four small pieces:
      - `<html lang>` follows the active locale rather than being hard-coded `de`. This is an
        accessibility requirement: it tells a screen reader which language to pronounce.
      - The document title comes from the locale file, so `index.html` stops carrying a German
        string.
      - MUI's built-in strings (`deDE`) applied to the theme. MUI ships English defaults for its
        Autocomplete, pagination and date pickers, so feature 9's species picker would otherwise
        announce "No options" inside an otherwise German form.
      - A stub `en.json` holding two or three keys, plus fallback to German for everything else.
      *Done when:* switching the stored locale to `en` in devtools flips those few keys to English,
      leaves everything else German, and changes `<html lang>` to `en`; switching back restores it.

## Files / areas

- `frontend/package.json` - `i18next`, `react-i18next`.
- `frontend/src/i18n/index.ts` - **new**, configuration and the locale seam.
- `frontend/src/i18n/locales/de.json` - **new**, the source locale. Load-bearing.
- `frontend/src/i18n/locales/en.json` - **new**, stub only.
- `frontend/src/i18n/resources.d.ts` - **new**, key typing.
- `frontend/src/main.tsx` - provider mount.
- `frontend/src/components/AppShell.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `ThemeToggle.tsx`,
  `frontend/src/App.tsx` - strings replaced by `t()` calls.
- `frontend/src/theme/muiTheme.ts` - MUI German locale pack.
- `frontend/index.html` - `lang` and `<title>` handling.

## Data / contracts

Two contracts are locked here, and both are load-bearing.

- **The key naming convention.** Dotted keys grouped by area: `shell.header.*`, `shell.footer.*`,
  `shell.a11y.*`, `common.*`. Features 4 to 9 add several hundred keys under `protokoll.*`, and
  feature 17 mirrors whatever shape exists. Getting this wrong is a wide rename later. Start as one
  file per locale; the prefixes mean it can be split into lazily loaded namespaces later without
  any key changing.
- **The locale seam.** German is the fallback, never English. The active locale is read in one
  place, `src/i18n/index.ts`, so feature 2 can point it at the account's `User.locale` without
  touching any component.

## Testing

**No test runner is configured**, the same position as feature 1a, so the test gate is off. This
feature is configuration and string extraction rather than logic.

Evidence per step is the "done when" above. For the whole feature:

- `npm run build` and `npm run lint` pass.
- A rendered-DOM text comparison before and after step 2, proving the visible text is unchanged.
  This is the real risk in this feature and it is checkable mechanically.
- Screenshots in both themes, confirming nothing shifted.
- The `lang` attribute observed changing in a real browser.

`/tests` is worth running before feature 4, not here. Feature 4 brings the coordinate bounds check
and the Vorfluter chain rule, the first things on this project where a wrong answer is possible.

## Notes for the AI

- **Domain terms stay German in every locale.** This is the trap in this feature. `Probestrecke`,
  `Gewässer`, `Vorfluter`, `Anlass` and the rest are domain vocabulary, not interface chrome, and
  must read identically in the English locale. Only interface wording translates. See
  `coding-standards.md` and `CONTEXT.md`.
- **This feature must not change a single pixel.** If a screenshot differs after step 2, something
  was rewritten rather than moved. Copy wording exactly, including capitalisation and umlauts.
- **`Impressum` and `Barrierefreiheit` are German legal concepts**, not merely words. Do not invent
  English equivalents in the stub. Feature 17 decides with FFS whether they translate at all.
- **The decimal separator decision belongs to feature 4**, but flag it there: German writes `12,5`
  where English writes `12.5`, and the form is full of measurements. Whatever is chosen has to
  match what the backend Pydantic validation accepts.
- **No test runner yet**, so lean on build output, the rendered DOM and screenshots.

## Completion note

Step 3b was added mid-feature and is not in the original reviewed spec. TypeScript strict mode was
off, against `coding-standards.md`, and enabling it produced zero errors. It was folded into this
feature by decision rather than deferred, because it costs nothing today and would have cost more
once feature 4 starts writing form state and Zod schemas without `strictNullChecks`.

`prototypes/` was not discarded here. This feature consumed no mockups, and the folder is still the
design reference for features 3, 4, 11 and 12.
