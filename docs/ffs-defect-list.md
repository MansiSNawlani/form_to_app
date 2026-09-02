# Defects found in the existing PDF form

Found while reading `Formular_Protokoll_E-Befischung_V20260609.pdf` and its embedded JavaScript
(`all_js_Formular.js`, `validation.js`) in preparation for building the replacement web
application.

Three of these mean data already in FiaKa is wrong, so they need FFS attention regardless of what
happens with the new application. The rest will be fixed in the new application, which means new
records will differ from historical ones. That divergence is intentional and is flagged per item.

Send this to FFS for confirmation before building begins.

---

## 1. Substrate percentages are never checked at submit

**Severity: high. Historical data is affected.**

Five of the six percentage groups are checked before the form is allowed to save or send:
`Umland`, `Neigung`, `Uferbewuchs`, `Uferverbauung` and `Sohlverbauung`. The sixth,
`Substratverteilung`, is not.

The `check_ok_substrat` indicator is correctly maintained as the user types, so the red star and
green tick behave normally on screen. But `validation()` never reads it. A protocol whose
substrate percentages total 43 or 12 or 0 passes validation and is sent.

Every substrate distribution in FiaKa should be treated as possibly incomplete until checked.

## 2. Water body names are silently corrupted

**Severity: high. Historical data is affected.**

The `Gewässername` field converts the whole entry to lower case, then capitalises only the first
letter.

- `Schwarzer Regen` is stored as `Schwarzer regen`
- `Große Lauter` is stored as `Große lauter`
- `Alte Donau` is stored as `Alte donau`

The same code runs on all five `Vorfluter` fields, so the receiving-water chain is corrupted the
same way.

This affects any query that joins or groups on water body name. It also means the check for
`Rhein` and `Donau` at the end of the chain still works (single words), but multi-word names
never match anything reliably.

The same code also crashes if the field is emptied after having content, because it reads the
first character of an empty string.

## 3. Estimated width and depth are only half validated

**Severity: medium.**

After choosing a band for `mittlere Breite` or `mittlere Tiefe`, the user types an estimate, which
is meant to fall inside the chosen band.

The check is written as `value < lower AND value <= upper`. It should be `value < lower OR value >
upper`. As written, an estimate above the chosen band never triggers an error. A user can select
`0,1 - < 0,3 m` and enter `95`, and the form accepts it.

## 4. The Lehm field throws instead of warning

**Severity: medium.**

When the substrate percentages exceed 100, every field shows a warning. Except `Lehm / Ton`, which
calls `app.alert0(...)`. There is no such function, so the script throws instead. Depending on the
reader, the user sees nothing at all and the value is left in an invalid state.

## 5. The two send buttons use different email addresses

**Severity: medium.**

The form has two send actions, and they route to different addresses for the same
Regierungspräsidium.

| RP | First send action | Second send action |
|---|---|---|
| Karlsruhe | `Elisabeth.Schweikert@rpk.bwl.de` | `fiaka@rpk.bwl.de` |
| Stuttgart | `Fischerei@rps.bwl.de` | `fiaka@rps.bwl.de` |
| Freiburg | `Abteilung3@rpf.bwl.de` | `fiaka@rpf.bwl.de` |
| Tübingen | `fischereibehoerde@rpt.bwl.de` | `fischereibehoerde@rpt.bwl.de` |

Which set is correct is an FFS question. Separately, a named individual's address is hard-coded
into a form distributed to the public, which is a maintenance problem when that person changes
role and a data protection question in its own right.

## 6. One export path drops the survey date

**Severity: medium.**

The two export actions list different fields to export. The first includes `datum`. The second
omits it. A protocol exported through the second path arrives without its survey date.

## 7. Withdrawn. Not a defect

**Withdrawn on 2026-09-02, before this list was sent.** No action needed, and nothing to confirm.

This item previously claimed that selecting a flowing water type hides the widest band in several
hydrology groups, making `>= 100 m` unselectable on the Rhein. That was a misreading, found while
building the hydrology section.

The handlers hide fields named `hydrologie.breite.7`, `hydrologie.tiefenvarianz.3` and so on.
Those are **positions in the button list, not export values**. Every hydrology group ends with one
extra button, exporting `0`, parked in the right margin outside the printed table with no label
beside it. In each case the hidden position is that last button, not the widest band:
`hydrologie.breite` has eight buttons, positions 0 to 7 holding values 1 to 7 and then 0, so
position 7 is the `0` button and the `>= 100 m` band sits at position 6, untouched.

The `0` button is how the form marks hydrology as not applicable. The standing water handlers set
every hydrology group to `0` and show the message "Angaben zur Hydrologie sind bei stehenden
Gewässern nicht relevant". The flowing water handlers hide that button, because for a flowing
water the section does apply. The behaviour is correct.

The item is left in place rather than deleted so the numbering of items 8 and 9, which are quoted
elsewhere, still lines up.

## 8. The Vorfluter chain is not verified at submit

**Severity: low.**

While the user types, the form correctly requires each `Vorfluter` in turn until one of them is
`Rhein` or `Donau`. But the final `validation()` only checks that `Vorfluter 1` is filled in. A
user who fills the first box and clears the rest passes validation with an incomplete chain.

Combined with defect 2, multi-word names in the chain would not have matched anyway.

## 9. Both Altwasser options are dead buttons

**Severity: high. Historical data is affected.**

`probestrecke.gewaessertyp` is a radio group. Its eight buttons export the values `11`, `12`, `13`,
`14`, `21`, `26`, `28` and `29`. The JavaScript behind the two Altwasser buttons tests for values
the field can never hold:

- the button exporting `28` (angebundenes Altwasser) runs `if (gewaessertyp == 31)`
- the button exporting `29` (abgeschnittenes Altwasser) runs `if (gewaessertyp == 32)`

Neither branch ever executes. Selecting either Altwasser type therefore leaves the hydrology
section showing whatever the previously selected type left behind, instead of switching it. For a
connected oxbow the section should appear, and for a cut-off oxbow it should disappear.

`validation()` compounds this. It requires the hydrology answers when the type is `< 20` or `== 31`.
Angebundenes Altwasser is `28`, so it satisfies neither test, and a protocol for a connected oxbow
can be sent with the entire hydrology section empty.

Records in FiaKa for either Altwasser type should be treated as possibly missing hydrology, or as
carrying hydrology left over from a type the user selected earlier and changed.

Please also confirm the intended codes. If FiaKa stores `31` and `32` for the two Altwasser types,
then the form has been exporting the wrong numbers as well, and the affected records need
remapping rather than only rechecking.

---

## What we intend to do

Fix all nine in the new application. This means new records will be more correct than historical
ones, and specifically:

- Substrate percentages will be enforced to total exactly 100
- Water body names will be stored exactly as entered
- Estimates outside their chosen band will be rejected
- The full Vorfluter chain will be verified
- Hydrology will appear and be required for angebundenes Altwasser, and disappear for
  abgeschnittenes Altwasser, keyed to the codes the field actually exports

Defects 1, 2 and 9 mean historical FiaKa data cannot be assumed clean. If any reporting depends on
joining by water body name, on substrate percentages summing correctly, or on hydrology being
present for oxbows, that reporting needs review.
