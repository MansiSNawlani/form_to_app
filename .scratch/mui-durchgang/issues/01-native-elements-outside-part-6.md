# Sections 1 to 5 and the shell were built before the MUI rule was widened

Status: open, parked on 2026-09-05 by Mansi to be picked up after feature 9b
Affects: every section of the protocol, plus the app shell from feature 1a
Found while: converting part 6's catch table to MUI table components, 9a

## Why this exists

Until 2026-09-05 the standard read "form controls come from MUI wherever MUI has
one". Everything built under it obeyed it: every `Select`, `TextField`,
`Checkbox`, `RadioGroup` and `Autocomplete` on the protocol is MUI.

That day the rule widened to "use MUI wherever MUI has a component", with no
carve-out for components that only supply styling rather than behaviour. Part 6's
catch table was converted in the same sitting, but sections 1 to 5 and the app
shell were built under the narrower rule and were not revisited. This ticket is
the sweep that squares them with the rule now in force.

Nothing here is broken. Every item below works, is accessible, and matches the
mockups. This is drift against a standard that changed after the code was
written, not a defect.

## What is actually still native

Surveyed on 2026-09-05 across `frontend/src` by tag. The list is short, because
the controls were already MUI.

| Native | Count | MUI equivalent | Call |
|---|---|---|---|
| `fieldset` + `legend` | 27 each | `FormControl component="fieldset"` with `FormLabel component="legend"` | the real work, see below |
| `nav` + `ol` + `li` in `AbschnittNav.tsx` | 1 | `Stepper` with `Step` and `StepButton`, or `Breadcrumbs` | needs a look, see below |
| `header`, `footer`, `main` in the shell | 1 each | `AppBar` with `Toolbar`, and `Container` | needs a decision, see below |
| `p role="status"` block messages | 4 | `Alert`, or `FormHelperText` | probably yes |
| `form` in `ProtokollFormular.tsx` | 1 | none. `FormControl` is not a form | leave native |
| `caption` in `ArtenTabelle.tsx` | 1 | none | leave native, already decided in 9a |

## The three that need thought rather than a find and replace

**1. The 27 fieldsets.** MUI's equivalent is real: `FormControl component="fieldset"`
paired with `FormLabel component="legend"` renders exactly those elements, and it
is the composition MUI's own grouped-control examples use. So the rule says
convert. Two things to check before doing it. `FormControl` sets
`display: inline-flex` and `min-width: 0` on itself, which is not what
`.form-section` and `.form-block` currently do, so the section and block CSS has
to be re-fitted rather than left alone. And `.form-section--tabelle` exists only
because a bare fieldset defaults to `min-inline-size: min-content`; if
`FormControl` already sets `min-width: 0` that override may become dead code, so
check whether it can go rather than carrying it forward untested.

**2. `AbschnittNav`.** MUI's `Stepper` is the closest thing, and `nonLinear` with
`StepButton` matches what the nav has to do, since `project-overview.md` requires
that users may jump to any section in any order. But a `Stepper` brings a strong
visual model of its own, and the current nav was built against the approved
mockups. Compare it against `prototypes/` before converting, and if the themed
`Stepper` cannot be made to match, that is a genuine "MUI has no equivalent for
this shape" case worth writing down rather than forcing.

**3. The shell.** The header and footer were hand-built in feature 1a, and the
memory of that decision explicitly carved out "page furniture" as outside the
form-controls rule. The widened rule removes that carve-out, so the question is
live again: `AppBar` and `Toolbar` for the header, `Container` for the page
width. Worth noting that `AppBar` defaults to `position: fixed` with an elevation
shadow, and `coding-standards.md` says flat surfaces and no elevation shadows, so
this is a themed conversion or none at all.

## What to check when it is done

- `npm test`, `npm run lint`, `npx tsc -b` and `npm run build` all pass.
- Every section still reads correctly in light and dark, screenshotted at desktop
  and at 700px.
- The keystroke cost in part 6 at 26 rows is still around 2.3ms. `FormControl`
  wraps every block on the page, so a conversion that re-renders more than it
  should would show up here first and nowhere else.
- Keyboard navigation, label association and visible focus are unchanged. A
  `fieldset` and `legend` pair is what groups the radio and checkbox blocks for a
  screen reader, so a conversion that quietly drops the `component` props would
  break grouping without breaking anything visible.

## Comments

Raised by Mansi on 2026-09-05, straight after the part 6 table conversion:
validate whether all sections, including the earlier ones, use MUI components.
Parked deliberately so feature 9a can close and 9b can be built first.
