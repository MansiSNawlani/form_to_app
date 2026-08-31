# Fix: LAZBW brand colours replace the placeholder accent

**Type: Fix**
**Status:** completed 2026-08-31, merged via PR #4 (b23a750)

## Why

Feature 1a shipped with a deliberately provisional accent, `#17457a`, a navy chosen to sit in the
right place rather than sampled from anything real. It carried a `TODO` and sat at the top of the
open FFS list.

The real colours are now known, taken from the live LAZBW site at `lazbw.landwirtschaft-bw.de`:

- `#597425`, the LAZBW green, the main colour
- `#f2e006`, the logo yellow, a secondary that appears in the logo and is used sparingly

FFS is part of LAZBW, so this is the authoritative brand, not a guess.

## In scope

- Replacing the accent ramp in both schemes, in `frontend/src/styles/theme.css`.
- Mirroring it in `frontend/src/theme/tokens.ts`, which MUI's palette reads.
- Adding `--logo-yellow` and `--logo-yellow-ink` as brand constants.
- Keeping `prototypes/theme.css` in step, since it is still the design reference for features
  3, 4, 11 and 12.
- Updating the header mark and favicon, which were navy placeholders.

## Out of scope

- **The grey ramp.** Still the placeholder, and still faintly blue-tinted from when the accent was
  navy. See Follow-ups.
- **The semantic status colours.** `--ok` is a green and now sits closer to the brand. See
  Follow-ups.
- **The typeface.** Still unresolved and still on the FFS list.

## What the contrast work settled

Green behaves differently from navy, so two relationships had to be re-derived rather than
recoloured in place.

- **The focus ring inverted.** The navy accent was very dark, so a *brighter* ring stood out
  against it. `#597425` is much lighter, so a brighter ring sinks into the page. The light-scheme
  ring is therefore darker than the accent, `#3d4f19`, at 7.95:1 on the page against the 3:1 WCAG
  needs for a UI element. The dark scheme keeps the original brighter-than-accent relationship,
  because on a dark ground brighter is what gains contrast.
- **The yellow cannot carry white text.** It scores 1.36:1 with white and cannot be a text colour
  on a light background either. It is only ever a fill with `--logo-yellow-ink` on it, at 12.10:1.
  It is deliberately not wired into MUI's palette, because that would invite white-on-yellow.

## Build steps

- [x] **Step 1 - Re-derive and validate the palette.** Compute the hover, soft, focus and
      dark-scheme values from the given green, and check every pair the UI actually renders.
      *Done when:* all 18 rendered pairs meet WCAG AA, or 3:1 for UI elements.

- [x] **Step 2 - Apply to the token files and the brand mark.** `theme.css`, `tokens.ts`,
      `prototypes/theme.css`, the header mark and the favicon.
      *Done when:* the built app renders the LAZBW green in both schemes, build and lint pass.

## Testing

No test runner, same as feature 1a: this is tokens and styling, which `coding-standards.md` says to
verify with browser evidence and the build.

Evidence: a contrast script covering all 18 rendered pairs, computed colours read back out of a
real browser in both schemes, and screenshots at 1440px.

## Follow-ups, not blocking

1. **The grey ramp is still a placeholder** and is faintly blue-tinted, chosen to sit under a navy
   accent. It has not been resampled now that the accent is green.
2. **`--ok` is `#1d6b40`,** a success green that now sits nearer the brand green. Distinguishable,
   since one is teal-ish and the other olive, but worth a look when the status colours are next
   reviewed.
3. **The header mark and favicon are still placeholders.** They now read `FFS` on the LAZBW green
   with a yellow rule echoing the logo, rather than pretending to be the real mark.

## Completion note

Merged to main through GitHub PR #4 rather than by `/complete`, so this archive was written
afterwards. The three follow-ups above are still open: the grey ramp is unresampled, `--ok` sits
near the brand green, and the header mark and favicon remain placeholders.
