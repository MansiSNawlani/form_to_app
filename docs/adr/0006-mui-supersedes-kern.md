# MUI is the component library, superseding ADR 0005

The interface is built on MUI, themed hard against the project's own design tokens. This
supersedes [ADR 0005](0005-kern-design-system.md), which chose the KERN UX Standard and explicitly
rejected MUI.

## Why the earlier decision changed

ADR 0005 rested on a premise that turned out to be wrong. It assumed the requirement to follow
Baden-Württemberg state design guidance obliged us to adopt a German public-sector design system,
and KERN was the only installable one. FFS confirmed on 2026-08-24 that they impose no such
mandate, which removed the constraint the whole decision was built on.

With that gone, the remaining comparison is an ordinary engineering one, and it does not favour
KERN. KERN has roughly thirty components, no data grid, no date picker and no autocomplete. This
application is a 338 field protocol whose two hardest screens are a species picker over hundreds of
entries needing type-ahead and a catch table with live row totals. Under ADR 0005 both were to be
built in-house on headless primitives. MUI ships an autocomplete and a table, so the two highest
risk pieces of work become configuration rather than construction.

The KERN React kit was also the project's largest unretired risk. It is roughly a year old, the
throwaway prototype meant to test it was deferred on 2026-08-22, and that risk was scheduled to
land in full on feature 9, the catch table. Choosing MUI retires that risk outright.

## What we are giving up, and the mitigation

ADR 0005's objection to MUI still stands on its own terms and is not dismissed here: MUI is
structurally Material Design, an American consumer design language. Nothing about this decision
makes stock Material a good fit for a German state authority, and if FFS later hardens the design
guidance into a real requirement, this is the decision they would challenge.

The mitigation is that MUI is a theming engine as much as a component set. The design tokens in
`frontend/src/styles/theme.css`, approved on 2026-08-22, remain the source of truth for colour,
type and spacing, and MUI's theme is configured from them rather than the other way round. The
target is that the application does not read as a Material app. Concretely that means the sober
Baden-Württemberg accent instead of Material's palette, the barely-rounded 4px radius instead of
Material's pill shapes, no elevation shadows, and the flat official surfaces the mockups in
`prototypes/` show.

Accessibility was the other reason KERN was attractive, and it is a hard requirement here rather
than a preference. MUI's components are built on correct ARIA patterns, but unlike KERN
accessibility is not its primary design goal, so it does not come for free. Keyboard navigation,
label association, visible focus and contrast in both themes stay explicit acceptance criteria on
every UI feature, and contrast in particular has to be checked against our own tokens rather than
assumed from MUI's defaults.

## Consequences

- `@mui/material` 9.3.1 with `@emotion/react` and `@emotion/styled`. The installed version declares
  React 19 support in its peer range and installs clean against React 19.2.8 with no warnings.
- MUI replaces KERN everywhere. `@kern-ux/native` and `@kern-ux-annex/kern-react-kit` are never
  installed, so there is no migration to do. Feature 1a had reached the token port and no further.
- The two in-house components ADR 0005 planned, the species picker and the catch table, are
  reconsidered. Autocomplete is very likely MUI's. The catch table is decided when feature 9 is
  specced, since a 338 cell grid with live totals may still be better hand-built than fought into a
  generic component.
- One component library only. That rule survives the change of which library it is.
- The design tokens outrank MUI's defaults. Where the two disagree, ours wins, and the mapping
  lives in one place rather than being scattered as per-component overrides.
