# Feature: 5b - Part 2 rules

**From build-plan:** feature 5b, under feature 5 (Form part 2)
**Status:** built, awaiting the manual browser pass

## Goal

Make section 2 behave, not just render. Two rules:

1. **Hydrology appears and disappears with the Gewässertyp.** A standing water has no
   current, no line, no flow velocity, so the whole Hydrologie block goes away and its
   answers are set to the legacy form's "does not apply" value.
2. **A Schätzwert has to fall inside the band chosen above it.** Pick `< 2 m` and type
   `95` and the form says so.

Both exist in the legacy PDF and both are broken there. Rule 1 is
[defect 9](../../docs/ffs-defect-list.md): the two Altwasser buttons test for codes the
field can never export, so choosing either leaves whatever the previous type left behind.
Rule 2 is [defect 3](../../docs/ffs-defect-list.md): the check is written
`value < lower AND value <= upper`, so an estimate above its band is never caught.

Fixing them here is what `docs/ffs-defect-list.md` already promises FFS under
"What we intend to do".

## Design reference

No new screen. The Hydrologie block was built in 5a against
[prototypes/protokoll.html](../../prototypes/protokoll.html); this feature only decides
when it is on screen. The one new piece of visible text is a callout, and `.callout` is
already in `protokoll.css` and already used twice in part 1.

The callout keeps the section's own `fieldset` and `Hydrologie` legend around it. A section
that vanished without trace would read as a form that had lost something, where what
actually happened is that the questions do not apply to a lake.

## The two rules, exactly

### Which Gewässertyp means which

Read from the eight per-button handlers in the PDF, verified on 2026-09-02.

| Code | Type | Hydrologie |
|---|---|---|
| `11` | Graben | shown |
| `12` | Kanal | shown |
| `13` | Bach | shown |
| `14` | Fluss | shown |
| `28` | angebundenes Altwasser | shown |
| `21` | See | hidden |
| `26` | Teich | hidden |
| `29` | abgeschnittenes Altwasser | hidden |
| unset | nothing chosen yet | shown |

`28` and `29` are the fix. In the PDF, the `28` button's handler runs
`if (gewaessertyp == 31)` and the `29` button's runs `if (gewaessertyp == 32)`, and the
field exports neither number, so neither branch ever fires. Keyed to the real export
values, a connected oxbow gets the section and a cut-off oxbow does not, which is what the
printed form intends.

**Unset shows the block.** The legacy form starts with it shown, most waters are flowing,
and a section that is missing is worse than a section that turns out not to apply. Nothing
is written to the document while no type is chosen.

### What "does not apply" is written as

Every hydrology radio group in the PDF carries an extra button exporting `0`, parked in
the right margin with no printed label. The standing-water handlers set all nine to `0`
and show the message "Angaben zur Hydrologie sind bei stehenden Gewässern nicht relevant".
Confirmed with Mansi on 2026-09-02: `0` means hydrology does not apply. It is never
offered as an option, which is why 5a's extraction maps it to `null` and leaves it out of
the option lists.

So, when a standing type is chosen:

| Keys | Written |
|---|---|
| the nine band groups (`breite`, `tiefe`, `tiefenvarianz`, `linienfuehrung`, `stroemung`, `fliessgeschwindigkeit`, `wasserfuehrung`, `stillwasserbereich`, `gesamtprofil`) | `'0'` |
| the two estimates (`breite_schaetzwert`, `tiefe_schaetzwert`) | `'0'` |
| the four checkboxes (`mit_flachstellen`, `mit_gumpen`, `furkationen`, `rueckstroemung`) | `''` |

The first two rows are exactly what the legacy handlers write, so the document FiaKa
eventually receives matches what it receives today. **The four checkboxes are ours.** The
legacy handlers do not touch them, so a form switched from Bach to See keeps
"mit Gumpen: Ja" on a pond. There is no `0` for a checkbox, so not ticked is the answer.

And symmetrically, when a flowing type is chosen: any hydrology answer currently holding
`'0'` is cleared to `''`. Without this, switching See back to Bach leaves nine groups
holding a value that means "not applicable" on a water where it does apply. `'0'` is not
in any option list, so the group would render as unanswered while the document said
otherwise.

**Accepted cost: switching to a standing water discards hydrology answers.** A mis-click
on See wipes the block, and clicking back to Bach does not bring it back. That is what the
legacy form does, and the alternative - keeping the answers hidden and alive - recreates
exactly the condition defect 9 complains about, where a protocol carries hydrology left
over from a type the user changed. The mitigation is that the callout says plainly what
happened. Flagged for Mansi rather than decided quietly.

### The Schätzwert bands

Read from the `hydrologie.breite_schaetzwert` and `hydrologie.tiefe_schaetzwert` field
scripts in the PDF, verified on 2026-09-02. Metres, keyed by the band's export value.

| Value | Breite label | Breite band | Tiefe label | Tiefe band |
|---|---|---|---|---|
| `1` | `< 1` | 0 to 1 | `< 0,1` | 0 to 0,1 |
| `2` | `< 2` | 1 to 2 | `< 0,3` | 0,1 to 0,3 |
| `3` | `< 5` | 2 to 5 | `< 0,5` | 0,3 to 0,5 |
| `4` | `< 15` | 5 to 15 | `< 1` | 0,5 to 1 |
| `5` | `< 50` | 15 to 50 | `< 2` | 1 to 2 |
| `6` | `< 100` | 50 to 100 | `< 4` | 2 to 4 |
| `7` | `≥ 100` | 100 upward | `≥ 4` | 4 upward |
| `0` | not applicable, no band | | not applicable, no band | |

**Lower bound inclusive, upper bound exclusive**, except `7`, which has no upper bound.
That is what the printed labels say: `< 2` is the band below 2, and 2 itself belongs to
`< 5`. The legacy code treats both ends as inclusive, so 2 is accepted in two neighbouring
bands; reading the labels literally leaves no gap and no overlap. This is a second
departure from the legacy code beyond the AND/OR fix, so it is called out here rather than
buried.

**`0` is not a band and is not in the table.** The band table is keyed to the option lists,
and `0` is never offered as an option, so putting it in the table would break the guard
test below. It is checked separately instead: when the band carries the not-applicable
marking, the estimate has to carry it too. Nothing in the interface can produce anything
else, because the block is off screen in that state, so this only ever catches a draft
edited by hand.

Three things can be wrong with an estimate:

| Situation | Message |
|---|---|
| an estimate typed with no band chosen | `schaetzwertOhneBand` |
| an estimate that is not a number | `schaetzwertKeineZahl` |
| a number outside the chosen band | `schaetzwertAusserhalbBand` |

An empty estimate is never wrong. A draft is half-finished by definition, and whether an
estimate is required at all is feature 11's gate, exactly as in 4c.

The legacy form, on an estimate with no band chosen, pops an alert and **deletes what was
typed**. We show a message and keep the typing.

**The messages name no numbers.** The chosen band sits directly above the field with its
label visible, and the field's hint already says "Genauer Schätzwert innerhalb der oben
gewählten Bandbreite". Carrying the band bounds into the message would mean extending
`Regelverstoss` to hold interpolation variables, which nothing yet needs. Considered and
rejected; a later feature that genuinely needs it can add it then.

## In scope

- `regeln/hydrologie.ts`: which types are standing, and the writes each direction needs
- The Hydrologie block hidden for a standing type, replaced by the legacy's own callout
- The normalisation applied on opening a draft and on every Gewässertyp change
- `regeln/schaetzwert.ts`: the two band tables and the estimate rule, registered in
  `regeln/schema.ts` like 4c's three rules
- Rechecking an estimate when its band changes, through the existing `useNachpruefung`
- German messages for the three estimate violations and the callout
- Vitest cover for both rule modules

## Out of scope

- **Required-ness.** Nothing here makes a hydrology answer mandatory. The legacy
  `validation()` requires all nine for a flowing type; that is the submit gate and belongs
  to feature 11.
- **The Pydantic half.** Written browser-side only, as the build-plan note of 2026-09-01
  says for every rule in features 4 to 9. Features 2 and 3 close it.
- **The remaining defects.** 1, 2, 4, 5, 6 and 8 belong to features 6, 4 (done), and 11.
  Defect 9's other half - whether FiaKa actually stores `31` and `32` for the two
  Altwasser types - is an FFS question, not a code change.
- **Changing any 5a field, label or option list.** The block itself is finished.
- **A general rule-message interpolation mechanism.** See above.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - the standing-water logic, as plain functions** - `regeln/hydrologie.ts`
      exporting `HYDROLOGIE_NICHT_ZUTREFFEND`, `istStehendesGewaesser(typ)`, the list of
      hydrology paths, and one function that takes the answers document and returns the
      writes needed, empty when nothing needs changing. No React, no i18n, in the shape
      `regel.ts` already sets. *Done when:* `npm test` covers, and passes for, all eight
      Gewässertyp codes plus unset; a standing type returning `'0'` for the nine groups
      and both estimates and `''` for the four checkboxes; a flowing type clearing `'0'`
      back to `''` and leaving a real answer alone; and an already-correct document
      returning no writes at all, so the effect in step 2 cannot loop.

- [x] **Step 2 - section 2 obeys it** - a `useHydrologieAbgleich` hook applying those
      writes through `setValue`, called from `ProtokollFormular` rather than from
      `Abschnitt2`, because the Gewässertyp lives in section 1 and the write has to happen
      whether or not section 2 is open. `Abschnitt2` renders `HydrologieBlock` or the
      callout. *Done when:* choosing See, Teich or abgeschnittenes Altwasser in section 1
      replaces the block in section 2 with the callout; choosing Bach, Graben, Kanal,
      Fluss or angebundenes Altwasser brings it back empty; a reloaded draft that was
      saved as a standing water still shows the callout; a draft saved with real hydrology
      answers and a standing type is normalised on opening rather than left stale; an
      estimate that was showing a message stops showing it once the type makes it moot;
      and the build is clean.

- [x] **Step 3 - the Schätzwert band rule** - `regeln/schaetzwert.ts` with the two band
      tables, a guard test tying every band key to the option list's export values, the
      separate check that a not-applicable band carries a not-applicable estimate,
      registration in `regeln/schema.ts`, the three German messages, and the
      `useNachpruefung` wiring so choosing a band rechecks the estimate under it.
      *Done when:* `npm test` proves every band boundary in both tables, both ends,
      including `7` having no upper bound and `0` accepting only `0`; the guard test fails
      if a band key and the option list disagree; and in the browser, `< 2 m` plus `95`
      shows the outside-band message, `95` with no band chosen shows the other message and
      keeps the 95, and moving the band from `< 2` to `≥ 100` clears the message without
      touching the estimate.

## Files / areas

| File | Why |
|---|---|
| `frontend/src/protokoll/regeln/hydrologie.ts` | new - which types are standing, and the writes |
| `frontend/src/protokoll/regeln/hydrologie.test.ts` | new |
| `frontend/src/protokoll/regeln/useHydrologieAbgleich.ts` | new - applies the writes |
| `frontend/src/protokoll/ProtokollFormular.tsx` | calls the hook, where it is always mounted |
| `frontend/src/protokoll/abschnitte/Abschnitt2.tsx` | block or callout |
| `frontend/src/protokoll/regeln/schaetzwert.ts` | new - the band tables and the rule |
| `frontend/src/protokoll/regeln/schaetzwert.test.ts` | new |
| `frontend/src/protokoll/regeln/schema.ts` | one more entry in `REGELN` |
| `frontend/src/protokoll/abschnitte/teil2/HydrologieBlock.tsx` | the recheck wiring |
| `frontend/src/i18n/locales/de.json` | four new strings |

Nothing in `backend/`, `database/` or `docs/`.

## Data / contracts

- **No change to `Antworten`.** Every key these rules touch was added in 5a.
- **`HYDROLOGIE_NICHT_ZUTREFFEND = '0'` is load-bearing.** It is what a standing water's
  hydrology looks like in a stored draft, so feature 3 sends it, feature 11 must not
  demand a real answer over it, and feature 19 hands it to FiaKa. Export it from one place
  and never write a bare `'0'` anywhere else.
- **`Regelverstoss` stays as 4c left it**: a path and a translation key, no variables.
- The band tables are keyed by the option lists' export values, and a test enforces it.
  This is the same guard that `radio_options` in
  `backend/scripts/extract_form_definition.py` applies on the extraction side: a band and a
  label that disagree should be a failing test, not a silently unreachable branch.

## Testing

`npm test` (vitest) from `frontend/`, per the Commands section of `AGENTS.md`. Both rule
modules are logic where a wrong answer is possible, so both ship tests in their own step,
per the Testing gate in `coding-standards.md`. `useHydrologieAbgleich`, `Abschnitt2` and
`HydrologieBlock` are components and integration surfaces, so they ride on browser
evidence and `npm run build`, and get no unit tests.

Also run `npm run lint` and `npx tsc --noEmit`. There is no Verify command yet.

Manual browser pass, at the end:

1. Section 1, choose **Bach**. Section 2 shows the Hydrologie block.
2. Answer three groups, tick "mit Gumpen", type an estimate.
3. Back to section 1, choose **See**. Section 2 now shows the callout only.
4. Reload. Still the callout.
5. Back to **Bach**. The block returns with all nine groups unanswered and "mit Gumpen"
   unticked.
6. Choose the band `< 2 m`, type `95` in the estimate. The message appears.
7. Move the band to `≥ 100 m`. The message goes without the 95 being touched.
8. Clear the band. The other message appears and the 95 is still there.
9. Keyboard only through steps 5 to 8, and check the callout in dark mode and below 800px.

## Notes for the AI

- **German for the domain, English for programming.** `istStehendesGewaesser`,
  `HYDROLOGIE_PFADE`, `schaetzwert`. Hook and prop names stay English.
- **The rule modules hold no React, no Zod and no German**, matching `regel.ts`. The Zod
  edge is `schema.ts` alone and the German is `de.json` alone.
- **Never write a colour or a bare option value inline.** The callout is `.callout`, which
  exists.
- **The normalisation effect must settle.** It reads the answers, computes the writes, and
  writes nothing when there is nothing to write; otherwise `setValue` retriggers it
  forever. That is why step 1's last done-when exists.
- **`setValue` needs `shouldDirty`** so the automatic save picks the change up, and it must
  not mark the fields touched, or nine groups go red the moment somebody picks See.
- **Subscribe, do not watch.** The hook sits in the component that renders the whole page,
  so a `useWatch` re-renders the header, the step bar and every field in the open section
  on each Gewässertyp change. Found in the browser on 2026-09-02: that happens while MUI's
  dropdown is animating shut, and the menu flickers and can land a click on the wrong
  option. `useNachpruefung` already uses a subscription for the same reason. Parts 3 to 6
  will add more hooks of this kind, so they copy this.
- **Revalidate after writing.** An estimate showing an out-of-band message keeps showing it
  until something triggers the resolver again, so the hook triggers the hydrology paths
  once it has written. Writing and then leaving a stale red message on a field nobody can
  see is the failure to look for here.
- Comment the why, not the what, and name the legacy source where a rule comes from the
  PDF. `coding-standards.md` makes that the one place a comment is always worth having.
- No em dashes anywhere.
