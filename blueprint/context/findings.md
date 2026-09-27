# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-06 [P3] fixed - Two stacked comments explain the same two lines

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:125
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** Two comment blocks sit back to back above the two `useWatch`
calls, one explaining the region coupling and one explaining why `useWatch` rather
than `watch()`. The second was added when the call changed and the first was left
in place, so eleven lines of comment now introduce two lines of code and partly
restate each other. `coding-standards.md` names over-commenting as a common AI tell
and asks for the why, once.

**Suggested fix:** Merge them into one short block: the coupling is read live from
these two fields, and `useWatch` is used so a keystroke in an unrelated field does
not re-render the form.

**Resolution:** 2026-09-27, by /complete before the work commit. The two
blocks are now one of six lines, covering both points once. Not re-reviewed, so it
stays `fixed` rather than `closed`; it is a P3 and blocks nothing.
