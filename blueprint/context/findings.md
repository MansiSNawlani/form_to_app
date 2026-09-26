# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-01 [P1] fixed - A refused address keeps being refused after it is corrected

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:214
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** The server's sentence is read straight off the mutation, which
holds its last error until the next submit. So after "Für diese Adresse gibt es
bereits ein Konto", typing a completely free address leaves that sentence sitting
under the field, still saying the address is taken. Confirmed in the browser: with
the address replaced by an unused one, the alert was still present and unchanged.

It states something untrue about what is currently typed, and it contradicts the
standing rule on this project that feedback must visibly reflect progress as
somebody fixes the thing it is about. The same applies to the password, the roles
and the region, which all read the server's error the same way (lines 225, 243 and
138).

**Suggested fix:** Clear the mutation's error when the field it concerns changes.
The smallest version is to call `anlegen.reset()` from the form's `onChange`, so
any server message disappears as soon as the administrator edits anything; the
message comes back, current, on the next submit.

**Resolution:** 2026-09-26, by /implement. A `verwerfeServerfehler` helper on the
page, called from the form's own `onChange` and from each of the two dropdowns.
The form handler alone was not enough and a browser check caught it: MUI's Select
is a div with a hidden input and emits no change event that reaches the form, so a
stale message survived a change of region. The e2e spec now types a free address
after a refusal and asserts the message is gone.

### F-02 [P2] fixed - The address and password fields are not announced as required

**File:** frontend/src/verwaltung/benutzer/Kontofeld.tsx:80
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `feldAria(...)` is spread directly onto `OutlinedInput`, so MUI
puts the attributes it does not recognise on the wrapper element instead of on the
input. Measured in the browser: the input carries `aria-describedby` and
`aria-invalid`, and `aria-required="true"` sits on the surrounding div, where it
names nothing and is announced to nobody. Neither field carries a visible required
marker either, so the requirement is conveyed only by the message that appears
after a failed submit.

This is also drift from the pattern the rest of the project follows. Every other
field passes the same helper through `inputProps`: `AnmeldungSeite.tsx:109`,
`FeldText.tsx:96`, and `FeldSuche.tsx:70` via `eingabeAria`. This file is the only
one that spreads it onto the component, which is exactly why the attribute went
astray. `coding-standards.md` makes correct labelling an acceptance criterion on
every UI feature rather than a later pass.

**Suggested fix:** Pass it the way the rest of the project does,
`inputProps={feldAria(...)}` (or `slotProps.htmlInput` for MUI 9), and check in the
browser that `aria-required` lands on the input.

**Resolution:** 2026-09-26, by /implement. Passed through `slotProps.input`, which
is the slot name OutlinedInput takes in MUI 9. Measured again in the browser: the
input now carries `aria-required="true"`, the wrapper carries none, and
`aria-describedby` and `aria-invalid` are unchanged.

### F-03 [P3] fixed - A focus call that cannot do anything, with a comment saying it is needed

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:173
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `document.getElementById('email')?.focus()` runs inside the
handler for "Weiteres Konto anlegen", at a moment when the confirmation panel is
still what is rendered and the form does not exist in the document. The lookup
returns null every time. The focus that actually happens comes from `autoFocus` on
the address field when the form is mounted again, which is why the behaviour looks
correct: the browser check confirmed focus lands on the address field.

The risk is not the behaviour but the four lines of comment asserting that this
call is what puts the cursor back, which will mislead the next reader and would
survive a change to `autoFocus` that silently removes the behaviour.

**Suggested fix:** Delete the call and the comment, and say in one line that the
address field's own `autoFocus` returns the cursor when the form comes back. If the
focus is worth guaranteeing independently of `autoFocus`, do it in an effect after
the form has been rendered rather than in the handler.

**Resolution:** 2026-09-26, by /implement. The call and its comment are gone,
replaced by one line saying the address field's own `autoFocus` moves the cursor.
A browser check confirms focus still lands on the address field afterwards.

### F-04 [P3] fixed - A third copy of the list of supported locales

**File:** frontend/src/verwaltung/benutzer/KontoAnlegenSeite.tsx:63
**Found:** 2026-09-26 by /audit (scope: current)
**Why it matters:** `SPRACHEN = ['de', 'en']` is written here, `z.enum(['de', 'en'])`
again in `eingabe.ts:66`, and `SUPPORTED_LOCALES` already exists and is exported
from `src/i18n/index.ts:26`, where `Locale` is derived from it. Three copies of the
same two-item list, one of which is the established source. Adding a locale for
feature 17 means finding all three.

**Suggested fix:** Import `SUPPORTED_LOCALES` in both places and build the Zod enum
from it, so the i18n module stays the one answer to which locales exist.

**Resolution:** 2026-09-26, by /implement. Importing from `i18n/index.ts` turned
out to break `eingabe.ts`, which must stay testable in a node environment: that
module initialises i18next as it is imported and reaches for `localStorage`, and
the test suite failed with "document is not defined". The list therefore moved to a
new leaf module, `src/i18n/sprachen.ts`, which `index.ts` re-exports so no existing
caller changed. Both copies now read it.
