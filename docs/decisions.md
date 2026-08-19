# Design decisions

A record of what we decided before building, and why. Written to be readable by someone who was
not in the discussion, including people at FFS who are not developers.

Each section states the decision, the alternatives we looked at, and the reason we picked one.
Where a decision could be reversed later, it says so.

---

## 1. What this project is

FFS collects electrofishing survey data on a four page PDF form called the Protokoll
E-Befischung. The form only works in Adobe Acrobat with JavaScript switched on, which its own
help document warns about. Filled forms are emailed to FFS and to the responsible regional
authority, and someone at FFS then loads the data into FiaKa, the official fisheries database.

We are replacing the form with a web application. Users log in, fill in the protocol over as many
sittings as they need, and submit it. FFS staff review it. Accepted protocols are later
transferred into FiaKa automatically.

---

## 2. The forms turned out to be bigger than the requirements said

The requirements document says the form has "approximately 150 fields". That number is wrong by
more than double.

The catch table alone is 26 species rows, each with a species name, ten size class counts, a
young-of-year count and a calculated total. That is **338 fields** before counting any of the
other roughly 120. Any estimate or acceptance criterion anchored to 150 needs revisiting.

We only discovered this by reading the JavaScript embedded in the PDF
(`all_js_Formular.js`), which turned out to be a far better specification than any written
document. It gives the exact field names, the numeric codes behind each option, and every
validation rule.

---

## 3. The existing form has bugs, and two of them mean FiaKa data is already wrong

Full details are in [ffs-defect-list.md](./ffs-defect-list.md). The two serious ones:

**Substrate percentages are never checked.** Five of the six percentage blocks are validated
before the form can be sent. The sixth, the bed substrate distribution, is not. Its on-screen tick
works correctly, but the final check never reads it. Protocols whose substrate totals 43 percent
have been sent and accepted for years.

**Water body names are silently corrupted.** The form lowercases the whole name and then
capitalises only the first letter. "Schwarzer Regen" becomes "Schwarzer regen". The same code runs
on all five receiving-water fields.

**Decision:** fix all eight defects in the new application, and send the list to FFS before
building starts. New records will therefore be more correct than historical ones. FFS needs to
know that, because any report that joins on water body name or relies on substrate percentages
adding up is affected.

---

## 4. Frontend: React with Vite, not Next.js

The repository started as a Next.js project. We are removing it.

**Why.** Next.js earns its keep through what it does on the server: rendering pages, server
actions, fetching data server-side. When a separate FastAPI service owns all the data and logic,
none of that is available. You would run a Node server in production whose real job is handing out
files.

| Option | Verdict |
|---|---|
| Vite + React, FastAPI backend | **Chosen.** Builds to static files, served by a small web server. Matches the requirements diagram exactly. One less moving part. |
| Next.js alone, no FastAPI | Would have been good, but the backend needs to be Python. |
| Next.js + FastAPI | Works, but carries Next.js's weight without its benefit. |

Neither option is more modern than the other. Both are current and well supported. Vite plus React
is simply the normal choice for an application that sits behind a login and talks to a separate
API.

---

## 5. Component library: KERN, not MUI or Ant Design

The requirements say the interface must follow Baden-Württemberg state design guidance.

**We checked whether that guidance exists as code. It does not.** The state design portal at
`design.landbw.de` covers logo, colour, typography, image style, print layout and icons. There is
no stylesheet, no component library, no npm package, no Figma kit. Taken literally, that
requirement means a developer reads a PDF and matches it by hand.

**KERN UX Standard is the better route.** It is an open source design system built for German
public administration, started by Hamburg and Schleswig-Holstein, licensed EUPL-1.2, with a React
kit. Accessibility is its main design goal, which also covers much of the accessibility
requirement.

### How KERN differs from the libraries you may know

The difference is bigger than how it looks.

| | MUI / Ant / CoreUI | KERN |
|---|---|---|
| What it actually is | A JavaScript framework that builds controls for you | A styling layer over plain HTML |
| Package name | `@mui/material` | `@kern-ux/native` (the name is the philosophy) |
| Roughly how many components | 100 or more | About 30, aimed at government forms |
| Data grid, date picker, autocomplete | Yes | Mostly not |
| How it looks | Material, Ant, Bootstrap-ish | Plain and official |
| Accessibility | Good if used correctly | The main design goal |
| Satisfies the BW design requirement | No | Yes |

**On whether it looks modern enough.** KERN looks plain and official rather than designed. That is
deliberate. Government design systems optimise for contrast, large targets, clear labels and old
devices, and strip out decoration. Plain is not the same as dated: GOV.UK is the most admired
government interface anywhere and it is extremely plain. More importantly, a Material Design look
would actively fail the BW design requirement.

**On map inputs.** No component library provides one. Not KERN, not MUI, not Ant. Maps always come
from a dedicated mapping library, and MapLibre GL JS is the choice here. The component library only
styles what sits around the map: the coordinate boxes, the search field, the buttons.

**Known risk.** KERN itself is at version 2.7.2 and reasonably mature. The React kit is only about
a year old. We will find out how solid it is by building the hardest screen first.

**Where KERN will need help.** Two parts of this form are hard, and they are exactly where "plain
HTML, minimal JavaScript" is weakest: the species picker (hundreds of entries, needs type-ahead)
and the catch table (338 cells with live totals). We will build those two ourselves on top of
headless helpers, styled to match KERN. We will not mix in a second full design system.

---

## 6. A Probestrecke is a thing, not a section of a form

A **Probestrecke** is the stretch of water a survey covers.

The paper form treats it as part of the document, and the requirements document follows suit. Under
that model every survey is a standalone record, and asking "how has this stretch changed over ten
years?" means guessing from approximate coordinates and inconsistently spelled names.

**Decision: give it its own record with its own identity.** A submission points at a Probestrecke.
A Probestrecke points at a water body. The same stretch surveyed in 2026 and 2031 is one
Probestrecke with two submissions against it.

**Why it had to be decided now.** This is the hardest thing on the whole list to add later. Once
several thousand flat records exist, grouping them into stretches means matching corrupted names
against approximate coordinates. Adding it now costs one table and one foreign key.

Recorded as [ADR 0001](./adr/0001-probestrecke-is-a-first-class-entity.md).

---

## 7. Storage: JSON for the answers, real columns for everything the app runs on

338 form fields have to live somewhere.

| Option | Trade-off |
|---|---|
| A column for every field | Easy to search. But every form version change means a database migration, and 338 columns is unmanageable. |
| One JSON document per submission | Flexible, and form versions cost nothing. Searching inside it is more awkward. |
| **Split** | **Chosen.** |

**Real columns:** id, owner, status, form version, created and updated dates, the Probestrecke
link, the water body, coordinates, survey date, Regierungspräsidium, the survey occasion, and the
monitoring number.

**JSON document:** all the form answers. The percentage blocks, the influences, the structure
ratings, the bank and bed descriptions, the equipment.

**Why the split.** The columns are not answers, they are what the application runs on. Every review
queue page filters on them and every permission check reads owner and status. If status lived
inside a JSON document, the queue could not be indexed and every permission check would have to
parse a document first.

**What we gave up.** Searching "which submissions found Barbe" still works, because Postgres can
index inside JSON. What gets slow is the next question: "how has the Barbe population changed over
ten years?" That means unpacking JSON on every row.

**This is reversible.** If that analysis becomes a real requirement, we read the JSON once and
build a normalised catch table alongside it. The cost is a backfill script, not a redesign.

Recorded as [ADR 0003](./adr/0003-json-answers-typed-envelope.md).

---

## 8. Old submissions keep their old form forever

FFS changes the form regularly. The version history shows changes in 2021, 2022, 2023, 2024 and
2026. So it will change while the application is live.

| Option | Consequence |
|---|---|
| Move everything onto the newest version | Historical records show questions that were not actually asked at the time. |
| **Freeze. Every submission keeps its version.** | **Chosen.** The application has to be able to display old versions read-only. |

**Why.** This is the normal rule for official records. The record must show what was actually asked
and what was actually answered, not a later reinterpretation.

A draft started on the old version finishes on the old version, with a note telling the user.

Recorded as [ADR 0004](./adr/0004-freeze-form-versions.md).

---

## 9. The map work is deferred, but the shape of the data is not

The requirements make the mapping features mandatory for the first release. All of them depend on
an official water body dataset that the requirements themselves list as an open question owned by
somebody else. We are not letting that block the build.

**Deferred to version 2:** the map itself, clicking to place points, snapping to the water body,
searching water bodies by name, and the whole tile-serving stack.

**Not deferred:** storing which official water body each survey belongs to. Version 1 adds that
column and leaves it empty.

**Why the split matters.** If version 1 stored only the typed name "Neckar" and two numbers, then
when the dataset arrives someone has to match thousands of typed names to official identifiers by
hand, and those names are inconsistent because of the casing bug. With the empty column in place,
the same job becomes a script.

**Version 1 does this instead:** two number boxes for the coordinates, exactly like the paper form,
plus a check that they fall inside Baden-Württemberg. That check is four number comparisons and
needs no mapping software at all. The legacy form already does it.

**Cheap addition worth considering:** show a read-only pin on a plain OpenStreetMap background for
whatever coordinates were typed. About a day of work, no official dataset needed, and it catches
typos immediately when the pin lands in Switzerland.

### One requirement we are softening

The requirements say a location that does not match the official dataset must be rejected. We are
not doing that. Consider a GPS reading 25 metres out on a narrow stream, a drainage ditch missing
from the dataset, or a stretch that legitimately spans a confluence. Under a hard rejection, a
genuine survey becomes unsubmittable and real field data is lost.

**Instead:** store both the typed and the corrected coordinates, warn the user clearly, and let
them continue with a reason. The reviewer sees the override. Only genuinely impossible values are
rejected outright, meaning coordinates outside Baden-Württemberg.

---

## 10. Who uses the application

No public sign-up. Accounts are created by an administrator.

| Role | What they do |
|---|---|
| Submitter | Fills in and submits protocols. Sees only their own. |
| Data Steward | FFS staff who correct and quality-check submitted data. |
| Reviewer | Decides whether a submission is accepted, rejected, or needs changes. |
| Super Admin | Manages accounts and roles. |
| Regierungspräsidium | Read-only, own region only, everything except drafts. |
| Integration account | Machine account for the FiaKa transfer. Cannot log in interactively. |

### Why the Regierungspräsidium role exists

The requirements never mention them, but the current form emails every protocol to two places:
FFS, and the responsible regional authority. The regional authority is the body that grants
permission to electrofish in the first place, and filing the protocol is a condition of that
permission. Their guidance says, roughly, that you only get your next permit if you filed good
protocols.

If we replaced the email with an in-app queue and gave accounts only to FFS, the regional
authorities would simply stop receiving anything, and nobody would notice until someone was refused
a permit.

They see rejected submissions too, not only accepted ones, because whether somebody files properly
is exactly what they use when deciding on the next permit.

---

## 11. How a submission moves through the system

```
Draft  ->  Submitted  ->  In Review  ->  Needs Changes  ->  (back to the submitter)
                                     ->  Rejected
                                     ->  Accepted  ->  Locked
```

Drafts are private to their author. Once submitted, only a "needs changes" sends it back for
editing. Rejections carry a reason. Change requests carry actionable comments. Every transition is
recorded with who did it and when.

### Email

Three kinds, and one deliberate omission.

- **A new submission arrives:** tell the reviewers and the relevant regional authority.
- **Status changes:** tell the person who submitted it.
- **Weekly digest:** one email per person, listing what is waiting on them.

**We never send a "nothing to do this week" email.** People learn to ignore those within a month,
and then they ignore the real ones too.

This adds two things to the system that were not there before: a mail server to send through, which
FFS will need to provide, and a background job that wakes on a schedule.

---

## 12. Language: German in the code, English in the interface

The domain terms have no clean English equivalents. `Gumpen`, `kolmatierte Sohle`, `Faschinen`,
`Vorfluter`, `Schwallbetrieb`. Translating them into type names and database columns loses
precision and turns every conversation with FFS into a translation exercise.

**Decision:** German identifiers throughout the code and database, matching the legacy field paths
exactly. English exists only in the interface translation files.

The practical payoff: because `probestrecke.gewaesser.vorfluter1` stays the canonical name, mapping
to FiaKa is a direct match rather than a lookup table somebody has to maintain and can get wrong.

The vocabulary is written down in [CONTEXT.md](../CONTEXT.md).

---

## 13. Smaller decisions

**The form is filled section by section, and you can jump anywhere.** Not a locked wizard. Field
surveyors do not have every value at once: a conductivity reading gets written down later, a
species identification gets confirmed later. Lock them out and they type a placeholder to get past
the gate and never come back. That is worse than an incomplete form. Sections are separate screens
with a progress list, not one endless scroll.

**Drafts save automatically** a couple of seconds after typing stops, showing plainly when they were
last saved. The server holds the truth. A small local copy in the browser covers a crash between
saves. If the same draft is open twice and both save, the second wins only if nothing changed
underneath it, otherwise the user is told rather than silently overwritten. Silent data loss on a
form this long would be brutal.

**Not working offline in version 1.** Surveys get typed up at a desk, not at the riverbank.
Building sync properly would roughly double the work. The draft data is kept in a shape that allows
adding it later.

**The catch table has no row limit.** The old limit of 26 existed because the paper page ran out of
space. There is no page any more.

**Young-of-year cannot exceed the species total.** The old form allowed 50 young-of-year for a
species with 30 individuals, which is impossible.

**"No detection" stays a real answer.** If the catch table is empty you must explicitly record that
nothing was found, choosing between fish, crayfish, mussels or nothing at all. This distinguishes
"we looked and found nothing" from "we forgot to fill this in", and those mean very different
things to a researcher.

**The `Bearbeiter`'s personal details live in their own record,** not inside each submission. Beyond
the data protection benefit, the same person files dozens of protocols, so their address is stored
once instead of dozens of times, and their details can be prefilled next time. A snapshot of the
name stays on the submission so historical records still read correctly.

**Login tokens are held in an httpOnly cookie,** not in browser storage, because browser storage is
readable by any script on the page and one bad dependency would leak every session. Sessions last
about eight hours so nobody is thrown out mid-protocol. The first administrator is created by a
command during deployment, reading its password from the environment.

**Photos and the map excerpt are in version 1.** The requirements marked attachments as later, but
with the map picker also deferred, version 1 would document location worse than paper. Uploading
files is simple work. Deferring all three at once was the risk.

---

## 14. Still open

| Question | Who decides |
|---|---|
| Is FastAPI genuinely required, or was it a preference? | Whoever owns the requirements document |
| How long is data kept, and what happens on a deletion request | FFS, with data protection advice |
| May this application use the state logo and wordmark | FFS |
| Which set of regional authority email addresses is correct | FFS (see defect 5) |
| Is hiding "100 m or wider" for rivers intentional | FFS (see defect 7) |
| The official water body dataset: format, and when | The GIS data owner |
| The species list, and the other dropdown option lists | Recoverable from the PDF with better tooling, then confirmed by FFS |

None of these block starting.
