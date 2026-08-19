# Defects found in the existing PDF form

Found while reading `Formular_Protokoll_E-Befischung_V20260609.pdf` and its embedded JavaScript
(`all_js_Formular.js`, `validation.js`) in preparation for building the replacement web
application.

Two of these mean data already in FiaKa is wrong, so they need FFS attention regardless of what
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

## 7. Large rivers cannot be recorded as 100 m or wider

**Severity: medium. Possible data loss.**

When any flowing water type is selected (`Graben`, `Kanal`, `Bach`, `Fluss`, `angebundenes
Altwasser`), the code hides the last option in several hydrology groups. That includes
`>= 100 m` for mean width and `>= 4 m` for mean depth.

This is reasonable for a ditch or a stream. For the Rhein or the Donau it makes the correct
answer unselectable, and the surveyor has to pick a band they know is wrong.

Please confirm whether hiding these options for `Fluss` is intended.

## 8. The Vorfluter chain is not verified at submit

**Severity: low.**

While the user types, the form correctly requires each `Vorfluter` in turn until one of them is
`Rhein` or `Donau`. But the final `validation()` only checks that `Vorfluter 1` is filled in. A
user who fills the first box and clears the rest passes validation with an incomplete chain.

Combined with defect 2, multi-word names in the chain would not have matched anyway.

---

## What we intend to do

Fix all eight in the new application. This means new records will be more correct than historical
ones, and specifically:

- Substrate percentages will be enforced to total exactly 100
- Water body names will be stored exactly as entered
- Estimates outside their chosen band will be rejected
- The full Vorfluter chain will be verified

Defects 2 and 1 mean historical FiaKa data cannot be assumed clean. If any reporting depends on
joining by water body name, or on substrate percentages summing correctly, that reporting needs
review.
