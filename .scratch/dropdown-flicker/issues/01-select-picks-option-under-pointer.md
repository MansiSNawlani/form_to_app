# A dropdown sometimes picks the option under the pointer

Status: open, parked on 2026-09-03 by Mansi to be picked up later
Affects: every `FeldAuswahl` on the form, built in feature 4b. Worst on `z.quelle`.
Found while: building feature 5b. Not caused by it.

## What happens

Opening a dropdown with the mouse sometimes selects an option on its own, rather
than opening and waiting. It flickers, and the value it lands on is the one the
mouse pointer happens to be over. Trying again usually works.

Reported on `probestrecke.gewaessertyp` first, then on `z.quelle`, which is worse.

## What we know

Established by testing in the browser on 2026-09-02 and 2026-09-03.

| Observation | Rules out |
|---|---|
| Never happens with the keyboard (Alt+Down, arrows, Enter) | the form state, React Hook Form, the validation rules |
| Happens on a freshly loaded page with no other field touched | the automatic save and its indicator |
| Nothing on the page visibly moves | a layout shift moving the menu's anchor |
| Comes and goes rather than always or never | anything deterministic in our own code |
| Chrome, maximised window | not yet reproduced elsewhere, see below |

Worst on `z.quelle`, which has 13 options and therefore the tallest menu on the
form. `probestrecke.gewaessertyp` has 8 and is milder.

## Three fixes tried, none worked

Each was reverted, so none of them is in the code. The commits are on
`feature/5b-part-2-rules`.

1. **Removed a page-wide re-render.** `useHydrologieAbgleich` watched the
   Gewaessertyp from `ProtokollFormular`, which re-rendered the whole page on
   every change of that field. Changed to a subscription (commit `b18a903`).
   **Kept**, because it is right on its own merits and matches
   `useNachpruefung`, but it did not fix this. The Gewaessertyp appeared to
   improve, then the same fault turned up on the Quelle, and the fault is
   intermittent, so that reading was probably luck.
2. **Removed the menu's open and close animation** (`39070b3`, reverted in
   `12e1832`). No effect.
3. **Capped the menu height** so a long list cannot be repositioned over its own
   control (`a569830`, reverted in `d950627`). No effect.

## The best theory so far, and why it is not the whole answer

Read out of `node_modules/@mui/material` on 2026-09-02. All three parts are
really there:

- `Select/SelectInput.js` opens the menu on **mousedown**, not on click
  (`onMouseDown: handleMouseDown`), so the menu appears while the button is
  still held.
- The same file selects an option on **mouseup**: `handleItemMouseUp` calls
  `event.currentTarget.click()` on the item under the pointer, to emulate a
  native select's press, drag and release. It is suppressed for the first
  `UNSELECTED_MOUSE_UP_DELAY`, which is 200ms.
- `Popover/Popover.js` slides a paper that does not fit below its anchor
  upward until it does (`if (bottom > heightThreshold) top -= diff`), which can
  leave the menu covering the control and the pointer.

Together those would produce exactly this symptom, and would explain why it is
mouse-only, why nothing moves on the page, and why it depends on how long the
button is held. **But capping the menu height did not fix it**, so either the
menu still overlaps the pointer for another reason, or the mouseup selection is
being reached by a different route.

## Where to start next time

1. **Reproduce it under instrumentation.** This is the real blocker: every
   attempt so far has been reasoning from source rather than watching it happen.
   Playwright is not installed, and `coding-standards.md` says not to add it
   mid-feature without being asked. Ask, then add it. Features 11 and 12 will
   want browser automation anyway.
2. Log `mousedown`, `mouseup` and `click` targets plus the menu's bounding box
   at the moment it opens. That settles in one run whether the menu is really
   under the pointer.
3. Check whether it reproduces in a second browser and in a non-maximised
   window. Everything so far is one browser at one size.
4. If it is confirmed as MUI's press-drag-release emulation, the question to
   answer is whether it can be switched off. There is no public prop for it, so
   the options are a wrapper that swallows the first mouseup, or an upstream
   issue.

## Comments

Parked on 2026-09-03. It is a usability defect, not a data-correctness one: a
wrong value is visible in the field and can be corrected, and every rule that
guards the data still runs. That is why it is not blocking feature 5b.
