# Fix: Refused answers marked at the field

**Type:** Fix
**Status:** in progress
**Branch:** `fix/fehler-am-feld`, from `main`
**Requested by:** FFS feedback, relayed by Mansi on 2026-10-15

> Feature 18c's spec was here and is paused, not dropped. It is in commit `199cd86`
> (`git show 199cd86:blueprint/context/current-feature.md`) and comes back once this fix is
> complete.

## The problem

When the server refuses a protocol, at Absenden or after a PDF import, its problems are shown
in two places only: the collapsible list above the section and the badge count on each step.
The field that caused a problem looks exactly like every other field. In a long section the
surveyor reads the list, then hunts for the box.

FFS asked for the field itself to stand out: a red border and the message line under it, both
for an import and for an ordinary submit.

Half of this already exists. Every field draws through `felder/FeldRahmen.tsx`, which shows a
red border and a message when it is given a `fehlerKey`. Today that key comes only from the
browser's own rules (`useFeldFehler` reads React Hook Form's errors, set by `regeln/schema.ts`).
The server's refusals (`useAbsenden().verstoesse`, the same list an import writes through
`pruefungsStore`) never reach the fields. Mandatory fields are the most common case, and they
are checked only on the server.

## The fix

Hand the server's list to the fields and let the existing error display do the rest.

- A small context, `absenden/verstossKontext.tsx`, provided by `ProtokollFormular` from
  `absendung.verstoesse`, holding a map from path to message key. Its value changes only when
  a submit or an import answers, never on a keystroke, so providing it does not re-render the
  form while somebody types.
- `useFeldFehler(name)` returns the browser's own error first, and otherwise the server's key
  for that path, **as long as the field is still empty**. "Filled in" means what
  `useErledigtePfade` already means by it (a non-blank string), and both read one shared
  function, so the field, the list and the badge can never disagree about whether a problem
  is dealt with.
- The message is the same sentence the list prints for that key (`meldung` in
  `AbsendeProbleme.tsx`, moved somewhere both can call it), including the fallback for a key
  the screen does not know.
- Problems that name a block rather than a field (`summe.*`, `block.*`, `bereich.*`, `paar.*`,
  `widerspruch.*`, `tabelle.arten`, see `istSammelpfad`) outline the block's fieldset in the
  error colour with the message under its legend, and stay until the next submit, the same as
  the list treats them today.
- Accessibility: the message line is reached through the control's `aria-describedby` and
  `aria-invalid` is set, which `feldAria` already does for a `fehlerKey`; block messages are
  referenced by their fieldset.

**Must not break**

- **Typing speed.** The 338 fields do not re-render while somebody types (the catch table's
  206 ms redraw is the reason). Clearing the red once a field is filled needs that field's
  value; subscribe per field, by name, and only where the path is on the list, or measure
  before and after on the catch table.
- **The browser's own rules** keep their onTouched timing and their messages, and win when
  both apply.
- **Read-only view** (`nurlesen`): no red anywhere; a filed protocol is not being asked for
  anything.
- **The list and badges** behave exactly as today.
- **Server is still the gate.** Clearing the red when a field is filled is a hint, not a
  verdict; only the next submit says whether the answer is right.

## Build steps

- [x] **Step 1 - Server refusals reach single fields.** The context, the shared "filled in"
  function and the shared message function, and `useFeldFehler` reading them, which covers
  `FeldText`, `FeldDatum`, `FeldAuswahl`, `FeldRadio`, `FeldSuche` and the catch table's cells
  in one place. *Done when:* `npm test` covers the pure part (which key a field shows given a
  browser error, a server key and a value: browser wins, server key while empty, nothing once
  filled); `npm test`, `npm run lint` and `npm run build` pass; in the browser, Absenden on a
  protocol with empty mandatory fields draws them red with the message under each, typing into
  one clears it while the list marks it ausgefüllt, and the catch table types as fast as
  before (screenshots in Evidence).

- [x] **Step 2 - Block-level refusals outline their block.** A way for each block to look up
  its own path in the context, used by the percentage groups, Einflüsse, Bewirtschaftung, the
  fished areas, the three part 5 pairs and the catch table. *Done when:* a refused percentage
  group and a refused empty catch table each show the outline and message (screenshots); the
  read-only view shows none of it.

- [ ] **Step 3 - Browser test and import path.** Extend an existing e2e spec: submit a protocol
  with an empty mandatory field, expect the field to be invalid (by role and name, with
  `aria-invalid` and its description), fill it, expect it valid. Then import a PDF with gaps
  and confirm the same fields are marked on opening. *Done when:* `npm run e2e` passes and the
  existing specs still pass.

## Evidence

**Step 1** (2026-10-15)

- `npm test`: 67 files, 1534 tests passed, including `absenden/amFeld.test.ts` (8). `npm run lint`,
  `tsc -b` and `npm run build` clean.
- Browser, a fresh draft with only the Bearbeiter name typed, Absenden pressed: section 1 shows
  16 refusals in the panel and the same fields red with the message under each (Anlass,
  Regierungspräsidium, Datum, Uhrzeit, E-Mail, Gewässer, Gewässertyp, Länge, Ortsangabe,
  Vorfluter 1, the six coordinate boxes). Unrefused fields are unchanged.
- `bearbeiter.email`: `aria-invalid="true"` and `aria-describedby="bearbeiter.email-fehler"`
  while empty; cleared on typing; back when emptied again. Choosing an Anlass clears its red.
- After a reload the marks come back with the remembered list.
- Catch table, 40 keystrokes into one cell, three runs: `main` 2672 / 2334 / 2631 ms, this fix
  2692 / 2506 / 2360 ms. No measurable difference.

**Step 2** (2026-10-16)

- `npm test`: 1538 passed, including `blockAnzeige` in `absenden/amFeld.test.ts` (4 more).
  Lint, `tsc -b` and build clean.
- Browser, the same empty draft submitted: section 3 outlines all six percentage groups with
  "Dieser Block ist noch nicht ausgefüllt" on the total's line; section 4 outlines Einflüsse
  and Bewirtschaftung with the message under each; section 6 outlines the catch table with
  "Das Protokoll nennt noch keine Art". Section 5 has none, as an empty draft has no
  half-filled area to refuse.
- Typing 100 into one Umland share lifts that group's message and outline at once.
- Two layout fixes found on the screenshots: an inward outline crossed the section legend, and
  an outward one ran into the fields next to a block. The outline now sits on the block's own
  edge, with padding the side margins cancel.
- The server's message goes into the line the block already had, so a block never shows the
  same sentence twice; the browser's own message wins when both apply.

## Verify

1. Open a draft with some mandatory fields empty and press **Absenden**.
2. The list and badges appear as before, **and** each empty field in the open section has a
   red border and the message under it. Switch sections: the same there.
3. Type into one marked field: its red goes away and the list shows it as ausgefüllt.
4. A refused percentage group or empty catch table is outlined as a block.
5. Import a PDF with gaps: on opening, the same fields are marked without pressing anything.
6. Reload the page: the marks come back with the remembered list.
7. Open a submitted protocol read-only: no red anywhere.
8. Keyboard and screen reader: tabbing to a marked field announces it as invalid with its
   message.

## Files / areas

- `frontend/src/protokoll/absenden/verstossKontext.tsx` (new), `useErledigte.ts`,
  `AbsendeProbleme.tsx`
- `frontend/src/protokoll/felder/fehler.ts` and a test beside the pure part
- `frontend/src/protokoll/ProtokollFormular.tsx` (provide the context)
- The block components named in step 2, and `muiTheme.ts` if the fieldset outline is themed
- `frontend/e2e/` (one spec extended)
- `frontend/src/i18n/locales/de.json`, `en.json` only if a new string is needed (none expected)

No backend change: the server already names the path and key of every problem.
