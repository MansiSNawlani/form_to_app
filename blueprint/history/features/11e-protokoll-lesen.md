# Feature: Das Protokoll lesen

**From build-plan:** feature 11e
**Status:** built, reviewed, and seen on screen in both themes

## Goal

Show a whole protocol on screen without a single input box on it.

Everything this application draws today is a form. A protocol that has been sent can be
read by nobody, not even by the person who filed it: `NichtMehrEntwurf` answers with a
grey notice and a button back to the list, and says in its own comment that showing the
answers is 11e's job. This is that job.

It matters twice. A reviewer cannot decide on something they cannot read, so the decision
panel in 11f has nothing to sit beside until this exists. And a surveyor who pressed
Absenden in July currently has no way of ever seeing what they wrote, which is a hole in
the application rather than a missing convenience.

## What was decided on 2026-09-15

Two things, before any of this was written down.

**The old 11e was split into 11e and 11f.** One line in the build plan covered the
read-only protocol, the decision panel and the Verlauf. The first of those is half the
work on its own, because it means giving eleven field components a second way to draw
themselves. Split, a reviewer can read after 11e and decide after 11f.

**The submitter reads their own sent protocol here too.** The same view, without a
decision panel, replaces the grey notice. It is one extra step once the view exists, and
the alternative is a known hole left open for a later fix.

## Design reference

`prototypes/pruefung-protokoll.html`, and `prototypes/mockup.css` for the styles it uses.

What the mockup fixes for this feature:

- **`.readonly-value`** - an answer is a line of text in a bordered, muted block, under
  the same small bold label the form uses. Not a disabled input. A greyed-out box still
  reads as something you failed to be allowed to type in.
- **`.summary-bar`** - the five envelope facts across the top of the card: Eingereicht
  von, Bearbeiter, Eingereicht am, Anlass, Regierungspraesidium.
- **`.review`** - the two-column page, the protocol on the left and a rail on the right.
  This feature builds the grid and fills the left column only. 11f puts its panels in the
  right one, and a CSS grid with one child simply renders one column until then, so
  nothing built here is rebuilt there.
- **The fields keep the form's own layout.** The mockup's read-only fieldset uses the same
  `.grid` and `.col-N` classes the form does, which is exactly what reusing the section
  components gives for free.

`.panel__head`, `.panel__body`, `.decision` and `.history` are in the mockup too and are
**not** ported here. They belong to 11f's rail.

## How the read-only view is built, and why

**The section components are reused, not rewritten.** Every one of the 338 fields already
knows its label, its width, its hint and where it sits among its neighbours, and all of
that lives inside 26 block components. A separate read-only page would have to restate it
all, and the copy would drift from the form the first time a label changed.

So the sections render exactly as they do in the form, and the **field** components learn
a second way to draw themselves: a `.readonly-value` block holding the answer as text
instead of a control. Eleven components get that branch. The 26 blocks above them change
nothing at all.

**A context carries the mode, not a prop.** `NurLesenContext` is read by a `useNurLesen()`
hook in each field component. Threading a boolean through 26 blocks that have no interest
in it is the thing the components were arranged to avoid. This does not contradict
`coding-standards.md`'s rule against a context here: that rule is about form *values*,
which stay in React Hook Form, and this is one boolean that never changes for the life of
the page.

**React Hook Form still holds the values.** The read-only page mounts its own `useForm`
with the answers as defaults, so the components read values the way they already do.
Three things that page deliberately does not do:

- **No resolver, and `trigger` is never called.** No rule runs, so no red message appears.
  A reviewer judging a protocol is not the same question as a surveyor filling one in, and
  the gate that decides whether it could be submitted at all already ran at Absenden.
- **`useHydrologieAbgleich` is not mounted.** It *clears answers* when the Gewaessertyp
  says the hydrology does not apply. On a sent protocol that would quietly rewrite what
  somebody filed. This is the sharpest edge in the feature.
- **No automatic save, no Absenden button, no attachment uploads.** Nothing on this page
  writes.

**Values are read with `getValues`, not `useWatch`.** Nothing changes, so 338 subscriptions
would buy nothing and cost a subscription each.

## An empty answer is still shown

An unanswered field prints a muted placeholder rather than disappearing. That is
deliberate and it is the opposite of what the mockup shows, because the mockup only prints
fields that happen to have values.

A reviewer's commonest reason to send a protocol back is that something was left out: the
Leitfaehigkeit in the mockup's own example Begruendung. A view that hides what is missing
hides exactly what the reviewer is looking for.

**The catch table is the one exception.** It shows only the rows that hold something. A row
with nothing in it is not an unanswered question, it is one of the 26 slots the printed form
happens to provide, and the project's own rule that the PDF's repeated-slot counts are not
limits applies here too. Twenty-two empty rows of dashes would bury the four real ones.

Refined while building step 7. This first said "only the rows carrying a species", which
would have hidden a row holding counts that nobody named a species for. That row is not an
empty slot, it is recorded animals with a question hanging over them, and it is very often
why a protocol goes back. It is shown, with the species cell saying nothing was given.

## In scope

**The backend**

- `ProtokollAntwort` gains the envelope facts the summary bar prints and the form never
  needed: who filed it, when it was submitted, when it was locked, the frozen
  `bearbeiter_name`, the coded `anlass`, and the `regierungspraesidium` off the matched
  Probestrecke.
- Nothing about who may read a protocol changes. 11d already settled that, and this
  feature adds no route.

**The read-only mode**

- `NurLesenContext` and `useNurLesen()`.
- `Feldwert`, the shared `.readonly-value` block, including what it prints for an
  unanswered field.
- A read-only branch on `FeldText`, `FeldProzent`, `FeldDatum`, `FeldHaken`, `FeldAuswahl`,
  `FeldRadio`, `FeldSuche`, `ZahlZelle`, `ArtZelle`, and the two attachment blocks.
- The catch table drawn as a plain table of the rows that carry a species, with its row
  totals and grand total.
- The attachments shown as pictures with their names and sizes, and no buttons.

**The page**

- The route `/protokolle/:id/pruefung`.
- The head: the protocol's name, the date and form version, the status badge.
- The summary bar.
- All seven sections, stacked, in the order the form has them.
- The `.review` grid, left column only.
- The five states the page can be in: still loading, no such protocol, not allowed to see
  it, backend unreachable, and a draft opened at this address.

**The submitter's own protocol**

- A sent protocol opened at its form address shows this view instead of the grey notice.

**The words**

- Every German string under `protokoll.*` in `de.json`. `en.json` stays for feature 17.

## Out of scope

- **Deciding anything.** In Pruefung nehmen, the three decisions, the Begruendung and the
  Verlauf are 11f. This page is read-only in the strongest sense: it has no button that
  writes.
- **The mockup's Vorheriges and Naechstes buttons.** They move through a queue, and the
  queue is feature 12. A pair of buttons with nothing to page through is not worth
  building twice.
- **The Pruefliste crumb** in the mockup's subheading, for the same reason. It links to
  feature 12's screen.
- **Printing or exporting.** PDF generation is feature 20.
- **Running the rules over a submitted protocol.** Deliberate, and explained above.
- **Downloading an attachment.** The picture is shown at the address it already has. A
  download button is not in the mockup and nobody has asked for one.
- **Regional access.** A Regierungspraesidium account still sees nothing it could not see
  before. Feature 13 widens the visibility rule, in the one place 11d put it.
- **Any change to the form itself.** The field components gain a branch; how they behave
  when somebody is typing into them does not change, and the existing tests prove it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Ordered so the page exists before the fields on it change. Steps 5 to 8 each visibly turn
one family of controls into text on a page you can open, which is what makes them
reviewable at all; the other order would have four steps in a row whose only evidence is a
unit test.

- [x] **Step 1 - The envelope on the way out** - `ProtokollAntwort` in
      `app/api/schemas.py` gains `eingereicht_von`, `submitted_at`, `locked_at`,
      `bearbeiter_name`, `anlass` and `regierungspraesidium`. The first is the owner's
      e-mail address, named for what it is meant to be rather than for what it holds, the
      way 11d's `akteur_name` already is, so feature 16 can put a real name behind it
      without this changing. The last comes off the matched Probestrecke and is null on a
      protocol that has none, which every draft is. The loader in
      `app/protokolle/dienst.py` loads the two relationships it needs rather than leaving
      them to lazy-load inside a response model. The schema's docstring currently says the
      owner is deliberately absent because every route filtered on the caller's own id;
      that stopped being true in 11d, so it is corrected rather than left to mislead.
      *Done when:* `pytest` proves, against a real database, that a submitted protocol
      comes back with the filer's address, its `submitted_at`, its `bearbeiter_name`, its
      `anlass` and the `regierungspraesidium` of its Probestrecke; that a draft comes back
      with nulls in all of those but its owner's address; that a reviewer reading somebody
      else's submitted protocol gets the same fields; and that reading one protocol issues
      no extra query per relationship. `ruff check .` and `mypy .` pass.

- [x] **Step 2 - The mode, and what one answer looks like** - `NurLesenContext`,
      `useNurLesen()`, and `Feldwert`, which draws the `.readonly-value` block. The styles
      for it, for `.summary-bar` and for `.review` ported from `prototypes/mockup.css` into
      `protokoll.css` against our own tokens, never a hard-coded colour. The `.review` grid
      takes the width it is given rather than sitting in a narrow column, which is this
      project's standing preference for layout. `Feldwert` takes the text to print, not the
      field name: what an answer looks like as text is the calling component's knowledge,
      since a dropdown has to find its label and a checkbox has to say Ja or Nein. An empty
      answer prints the muted placeholder from the section above.
      *Done when:* `npm test` covers the placeholder decision as a plain function over a
      value, including the empty string a cleared field stores and an answer that is
      genuinely the text "0"; `npm run build` and `npm run lint` pass. Nothing renders it
      yet, which is why this step is small.

- [x] **Step 3 - The page, empty** - the route `/protokolle/:id/pruefung`,
      `PruefungsSeite`, the `.review` grid with its left column, the head and the summary
      bar. The head prints the protocol's name, its date and its form version with the
      status badge beside it, reading the name out of the answers document directly rather
      than through `ProtokollTitel`, which needs a form context that does not exist until
      the next step. The body is a placeholder until step 4.
      The five states this page can be in, all of them here rather than bolted on later:
      still loading, which says so in a live region the way the form's own page does; an id
      that does not exist **or** that this account may not see, which the backend answers
      identically on purpose and which this page must not soften into "you have no
      permission"; a backend that cannot be reached, which offers the way back in rather
      than claiming the protocol is gone; and a **draft**, which redirects to the form,
      because a draft is its owner's unfinished work and this screen is for something that
      has been handed in.
      *Done when:* a reviewer signed in opens a submitted protocol at
      `/protokolle/:id/pruefung` and sees its name, date, form version, status badge and
      all five summary-bar facts; a draft id redirects to the form; an unknown id and
      another submitter's protocol both show the not-found page; stopping the backend shows
      the retry message; screenshots in both themes; `npm run lint` and `npm run build`
      pass.

- [x] **Step 4 - The protocol on it** - sections 1 to 6 stacked on that page inside one
      `FormProvider` built from the answers, each in its own card with the section title as
      its heading, and the mockup's own hint saying the fields are locked while the
      protocol is in Pruefung. Section 7 waits for step 8, because its props are all about
      uploading.
      This is where the three deliberate omissions land, and they are the reason this is
      its own step: **no resolver**, so no rule runs and no red message appears on a
      protocol that has already passed the gate at Absenden; **`trigger` never called**,
      for the same reason; and **`useHydrologieAbgleich` not mounted**, which is the
      sharpest edge in the feature, because that hook *clears answers* and a sent protocol
      is a record. The fields still draw as controls at the end of this step. That is
      expected and is what the next four steps change.
      *Done when:* all six sections render top to bottom with the filed answers in them; a
      standing-water protocol shows section 2's "does not apply" callout and its hydrology
      answers are still in the document afterwards, checked by reading it back from the
      API; nothing on the page issues a save; `npm run lint` and `npm run build` pass.

- [x] **Step 5 - The typed-in answers become text** - the read-only branch on `FeldText`,
      and with it `FeldProzent`, which is a wrapper over it. Then `FeldDatum`, which prints
      the German date and time rather than the stored ISO strings, reusing the formatting
      `liste/anzeige.ts` already owns rather than writing a third one. Then `FeldHaken`,
      which prints Ja or Nein. `FeldRahmen` keeps the label, so the label association and
      the column width are unchanged; the required asterisk is dropped, because nothing is
      being asked for.
      *Done when:* section 3 on the review page shows its percentages as text with their
      units and no input; the date and time in section 1 read as German dates; the same
      components still render as inputs inside the form, proven by the existing suite
      staying green; `npm test`, `npm run lint` and `npm run build` pass.

- [x] **Step 6 - The pickers become their labels** - the read-only branch on `FeldAuswahl`,
      `FeldRadio` and `FeldSuche`. All three store a code and show a label, so all three
      look the stored value up in `optionen.ts` and print the label. A code that is not in
      the list prints the code itself rather than nothing: a protocol filed under an older
      form version may carry a value this version's list no longer offers, and ADR 0004
      says such a protocol stays renderable forever.
      *Done when:* `npm test` covers the lookup as a plain function, including the unknown
      code and the empty answer; section 1 on the review page shows "13 - Bach" for the
      Gewaessertyp and the species label rather than the code for a search field; sections
      2 and 4 show their chosen radio labels and nothing about the ones not chosen;
      `npm run lint` and `npm run build` pass.

- [x] **Step 7 - The catch table** - `ArtenTabelle` drawn read-only: only the rows carrying
      a species, the species label with its code beneath it as the mockup prints it, the
      ten size classes, the row total and the 0+ column, and the grand total. `ZahlZelle`
      and `ArtZelle` get their read-only branches. MUI's `Table`, `TableRow` and
      `TableCell`, which `muiTheme.ts` already styles once for the whole application. The
      "no detection" case prints the code that was given rather than an empty table, since
      a protocol that caught nothing is a real and correct protocol. The table scrolls
      inside its own wrapper rather than making the page scroll sideways, which is what the
      form's own table already does.
      *Done when:* `npm test` covers which rows are shown as a plain function over the
      answers, including a protocol with no species at all and one with a row holding
      counts but no species name; a protocol with four species renders four rows with
      correct row totals and a correct grand total; the section is readable at the narrow
      width the form already supports; `npm run lint` and `npm run build` pass.

- [x] **Step 8 - The attachments** - section 7 joins the page, read-only: the
      Kartenausschnitt and the photographs as pictures with their names and sizes, no
      picker, no remove button and no Absenden block. It reads the list with a plain query
      over `listeAnlagen` rather than mounting `useAnlagen`, which is an upload machine and
      has no business on a page that cannot upload. A protocol with no attachments says so
      in a sentence.
      *Done when:* a protocol with a map excerpt and three photographs shows four pictures
      and no buttons; one with none shows the sentence; a list that is still loading or that
      failed says which, and never renders as "no attachments", because telling a reviewer a
      protocol has no photographs when the request merely failed is the one wrong answer
      this step can give; `npm test`, `npm run lint` and `npm run build` pass.

- [x] **Step 9 - The surveyor reads their own** - `ProtokollSeite` shows the same view
      instead of `NichtMehrEntwurf` for a protocol that is no longer editable. The grey
      notice does not disappear entirely: its sentence about what the status means moves to
      the top of the read-only view, since "you cannot change this, it is In Pruefung" is
      still the first thing its owner needs to know. NEEDS_CHANGES is unaffected and still
      opens in the form, which is what 11d built.
      *Done when:* a submitter opens a protocol they sent and reads it in full, attachments
      included; the status sentence is above it; a NEEDS_CHANGES protocol still opens as an
      editable form with the change request above it; a draft still opens as a form;
      screenshots in both themes.

- [x] **Step 10 - The words and the final pass** - every German string added in steps 2 to
      9 under `protokoll.*` in `de.json`, none left hard-coded in a component. A read
      through the page with a keyboard and against the tokens: the read-only blocks are not
      focusable, since there is nothing to do in them, but the page's own headings and
      links are reachable in order and the muted placeholder text meets contrast in both
      themes.
      *Done when:* `npm test`, `npm run lint` and `npm run build` pass from `frontend/`;
      `pytest`, `ruff check .` and `mypy .` pass from `backend/`; no German string added in
      this feature is hard-coded; tabbing through the page reaches the head links and
      nothing else, in document order.

## The visual check, made

Every step was seen on screen by Mansi on 2026-09-16, in both themes. That is
worth recording plainly, because feature 11d's archive had to confess the
opposite: its two done-whens said "screenshots in both themes" and no browser was
ever opened.

Playwright is still not installed and `coding-standards.md` still says not to add
it mid-feature, so the evidence is the running stack and screenshots taken by
hand. What was confirmed:

| Seen | What was checked |
|---|---|
| The reviewer's page | Head, status badge, all five summary-bar facts, section 1 read-only with its label lookups resolving |
| The catch table | Two rows rather than twenty-six, row totals 52 and 29, grand total 81, dashes for empty classes |
| The attachments | The map excerpt and three photographs, names and sizes, no buttons on any tile |
| The surveyor's own | A sent protocol read back in full, its status sentence above it, no decision panel |
| Meine Protokolle | Every row carrying an action |

**It was worth doing.** Three defects came out of it that every automated gate had
passed: the two below, and the catch table printing an unknown species code twice,
once as its name and once as its code beneath.

## What trying it on screen found

Two defects the automated gates could not see, both found on 2026-09-16 by Mansi
opening the real pages. Both are repairs within this feature's own scope rather
than new work.

**A reviewer could not see any attachment.** Reading a protocol was widened to FFS
staff in feature 11d; reading its attachments was not, so `liste_anlagen` and
`hole_anlage` still went through the owner-only loader. A reviewer opened a
protocol and was answered 404 for the list and for every picture in it, which
made step 8's whole section show its "could not be loaded" error. `hole_anlage`'s
own docstring had said since feature 3d that this would have to change "once
feature 11 lets a reviewer see a submitted protocol", and this is that feature.
Reading now follows the protocol's own visibility rule; uploading and deleting
stay with the owner, so widening who may look did not widen who may write. Three
permission tests now cover it, including that a draft's pictures stay private.

**Meine Protokolle offered no way into a filed protocol.** The row carried a link
only for a draft and for one sent back for correction; every other state was a
badge and a dead end. So step 9 built the page and left it reachable only by
typing its address, which is not reachable at all. The note asking for this was
left in the row component by feature 11d and named 11e as its owner. Every row
now carries one action, with the word chosen by status: Weiter, Ueberarbeiten, or
Ansehen.

Both are the same kind of miss. The tests proved a reviewer **cannot write**, and
nobody had asked whether a reviewer **can read**; and the feature's own steps
proved a page renders without asking how anybody arrives at it.

## What the branch review changed

Two axes were run against `main` on 2026-09-15, after all ten steps were built.

**One real defect, and it went straight at this feature's central promise.**
`abschnitte/teil3/Gruppensumme.tsx` does not go through the resolver: it calls
`bewerteAnteile` itself and reads `formState.defaultValues` to decide whether a
group arrived already wrong. On the reviewer's page those defaults **are** the
filed answers, so a percentage group not totalling 100 would have printed a red
validation message, in a live region, over a record somebody handed in months
ago. Nothing in step 4's guard could catch it, because the guard reads one file
and this is three levels down. The running total stays, since "Summe: 83 %" is a
fact about the protocol; the message and the colour are gone.

**Four duplications, all fixed.** The four dead-end guards in front of a loaded
protocol were copied across both pages, comments included, and are now
`useProtokollZustand`. The "13 - Bach" format lived twice inside `FeldAuswahl`.
The paragraph explaining why the catch table is rebuilt was in two files. A
fixture parameter no caller passed is gone, and the step 4 guard no longer
asserts the exact spelling of a `useForm` call, which would have broken on a
reformat.

**Recorded rather than changed.** Three deviations from the letter of this spec
were deliberate and are explained where they are:

- **`ZahlZelle` and `ArtZelle` never got read-only branches.** The spec named
  them; step 7 replaced the whole table instead. They are 312 controls inside a
  grid that grows and shrinks around a picker over 123 entries, and a branch
  through all of that would have left both jobs harder to read than either alone.
  The same applies to the two attachment blocks.
- **`AbschnittInhalt` was refactored**, which "Out of scope" arguably forbids and
  the Files list below arguably permits. The reviewer's page is the second thing
  to turn a section number into a section, and two switches would have been two
  places to remember an eighth section.
- **Label association in read-only.** The value block carries no
  `aria-labelledby` back to its label. It sits immediately after the label in
  document order, and with no focusable control on the page a screen reader reads
  the two together in browse mode. Adding an ARIA name to a plain `div` would not
  improve that and can make it worse.

## Files / areas

**Backend, changed**

- `backend/app/api/schemas.py` - `ProtokollAntwort` widened, docstring corrected
- `backend/app/protokolle/dienst.py` - the relationships loaded with the protocol
- `backend/app/api/protokolle_test.py` - the new fields

**Frontend, new**

- `frontend/src/protokoll/nurlesen/kontext.ts` - the context and `useNurLesen()`, one
  file rather than the two this spec first named, since neither needs JSX
- `frontend/src/protokoll/nurlesen/Feldwert.tsx`
- `frontend/src/protokoll/nurlesen/wert.ts` and `wert.test.ts` - the placeholder decision
  and the option-label lookup, as plain functions
- `frontend/src/protokoll/nurlesen/AnlagenNurLesen.tsx`
- `frontend/src/protokoll/nurlesen/ArtenNurLesen.tsx` and its test
- `frontend/src/protokoll/pruefung/PruefungsSeite.tsx`
- `frontend/src/protokoll/pruefung/Kopfzeile.tsx` and `Uebersichtsleiste.tsx`

**Frontend, changed**

- the eleven components listed in steps 5 to 8
- `frontend/src/protokoll/abschnitte/AbschnittInhalt.tsx` - section 7 takes the read-only
  path, since its props are all about uploading
- `frontend/src/protokoll/ProtokollSeite.tsx` - step 9
- `frontend/src/protokoll/entwurf/typen.ts` - the envelope fields on `Entwurf`
- `frontend/src/routes.tsx`, `frontend/src/protokoll/protokoll.css`,
  `frontend/src/i18n/locales/de.json`

## Data / contracts

**Load-bearing.** 11f hangs its rail on this page and reads the same protocol, and feature
12's queue shows the same envelope facts in a list.

`ProtokollAntwort` and the browser's `Entwurf` gain these in the same breath, keeping the
server's key names, which is the rule `pruefung/typen.ts` already states:

| Field | Type | Where it comes from |
|---|---|---|
| `eingereicht_von` | string | the owner's e-mail, until feature 16 gives it a name |
| `submitted_at` | string or null | null until the protocol is first handed in |
| `locked_at` | string or null | written by Annehmen and by nothing else |
| `bearbeiter_name` | string or null | the frozen snapshot column, not the live answer |
| `anlass` | string or null | the coded value, never its label |
| `regierungspraesidium` | 1 to 4, or null | off the matched Probestrecke; null on a draft |

No new endpoint, no new table, no migration.

## Testing

`pytest` from `backend/` and `npm test` from `frontend/` are both gates on this project.

**What gets a unit test here**, being logic where a wrong answer is possible:

- what an answer prints when it is empty, and the "0" that is not empty (step 2)
- a stored code turned into its label, and a code the current list does not know (step 6)
- which catch rows are shown, and a protocol that caught nothing (step 7)
- the widened response, against a real database, including the null cases (step 1)

**What does not**, per `coding-standards.md`: the rendering itself. Steps 3, 4 and 9 ride on
the build and on browser evidence.

**The visual check matters more than usual here.** 11d ended with two done-whens that said
"screenshots in both themes" and no browser was ever opened, and that debt is written into
its archive. Playwright is still not installed and `coding-standards.md` still says not to
add it mid-feature, so the evidence is the dev server, the running stack and screenshots
taken by hand. This feature is almost entirely visual, so a step whose look has not been
seen has not been proven.

**The manual path**, once step 4 lands and in full by step 8: sign in as a Submitter, fill and send a protocol,
sign in as a Reviewer, open `/protokolle/<id>/pruefung`, and read the whole thing in both
themes.

## Notes for the AI

- **Never run a rule on this page, and above all never mount `useHydrologieAbgleich`.**
  That hook runs on its own, without anybody typing, and it *deletes* the hydrology answers
  whenever the Gewaessertyp says they do not apply. On a draft that is right. On this page
  it would mean that opening a protocol to read it rewrites what somebody filed. The case
  where it really bites is feature 23's imports: the legacy form's own version of this check
  tests for Gewaessertyp 31 and 32, which do not exist (defect 9), so it never clears
  anything, and an imported protocol will arrive carrying a standing-water type together
  with a full set of flowing-water answers. No resolver and no `trigger` either, for the
  milder reason that a reviewer should not be shown red messages about a protocol that
  already passed the gate at Absenden.
- **The field components keep their existing behaviour exactly.** The read-only branch is
  an addition. If an existing test in the form's suite changes, something went wrong.
- **MUI wherever MUI has a component**, structural ones included. The catch table is
  `Table`, `TableRow` and `TableCell`, themed once in `muiTheme.ts`, not a bare `<table>`.
- **Style from the tokens.** `theme.css` outranks MUI's defaults and the mockup's colours
  are already tokens. No hard-coded colour, and both themes on every step that renders.
- **Attachments are part of the protocol.** A reviewer reading a protocol has not read it
  until they have seen the map excerpt and the photographs, so step 8 is not optional
  polish.
- **404 means 404.** The backend answers identically for a protocol that does not exist and
  one this account may not see, on purpose, so a stranger cannot discover which ids are
  real. Do not soften that into a permission message.
- **German stays German**: routes, field paths, stored values. `/protokolle/:id/pruefung`
  is already the address `project-overview.md` names.
- **No em dashes** anywhere, including in the German strings.
