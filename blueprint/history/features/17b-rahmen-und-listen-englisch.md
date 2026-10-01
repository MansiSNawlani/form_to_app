# Feature: 17b - Rahmen, Anmeldung, Listen und Verwaltung in English

**From build-plan:** feature 17b
**Status:** complete (2026-10-01)
**Branch:** `feature/17b-rahmen-und-listen-englisch`

## Goal

Everything around the form reads in English when English is chosen: the header and footer, the
sign-in page, the session messages, Meine Protokolle, the Prüfliste and user administration.
17a made the language switch work; this feature supplies the English text for these screens.

It also fixes, once, how the official German terms appear in English. The form (17c) and
everything around it (17d) then follow the same list rather than each inventing their own.

## Worked example

Tom, the consultant from Basel, has his account set to English. He signs in on a page that says
**Sign in** and **Email address**. The header reads **My protocols**. His list has the columns
**Water body (Gewässer) and sampling stretch (Probestrecke)**, **Date**, **Occasion (Anlass)**,
**Status** and **Last edited**. One row shows the status **Draft** and was edited "today, 14:05".

He opens a protocol. The form is still German, which is expected until 17c. The value in the
Anlass column, say "WRRL-Monitoring", also stays German until 17d, which translates the short
dropdown entries.

Anna, a reviewer at FFS, switches to English. The Prüfliste reads **Review queue**, its filters
read **Status**, **Year**, **Occasion (Anlass)** and **Species (Art)**, and a row's button reads
**Review**. The species names in the filter stay German, as decided on 2026-09-30.

## In scope

- English for every key under these namespaces of `de.json`, about 245 texts:
  `shell`, `common`, `anmeldung`, `sitzung`, `fehler`, `protokolle` (the list and its PDF
  import button and failure dialog), `pruefliste`, `benutzerverwaltung`
- The English names of the official terms, written into `CONTEXT.md` beside each term, so
  17c to 17e use the same ones
- A vitest test that these eight namespaces are completely translated
- A browser test that walks the screens in English
- Screenshots of each screen in English, checking that longer English words do not break the
  layout (the header must stay on one line at desktop width)

## Out of scope

- The form itself, its section names, field names and rule messages: 17c
- Saving, the safety copy, submitting, review decisions, the Verlauf, the PDF import screen
  (the banner on an imported protocol, `protokoll.einlesen`), attachments: 17d
- The short dropdown entries, including the Anlass values shown in the lists: 17d
- Backend refusals that reach the screen as a German sentence, such as "wrong email or
  password": 17e. Until then they stay German in an English interface
- The test that every German key has an English one: 17e
- Species names, equipment models, place names, and the organisation name
  "Fischereiforschungsstelle Baden-Württemberg": these stay German everywhere
- The downloaded PDF: stays German

## How the official terms read in English

Decided on 2026-09-30: an official term listed in `CONTEXT.md` reads as English with the German
in brackets, "Sampling stretch (Probestrecke)". Applying that literally to every occurrence
would make sentences hard to read ("Your protocols (Protokolle) could not be loaded"), so this
spec sets one placement rule. **This is a default, not a question.** It is easy to change in
review.

**The German goes in brackets where the term is a label:** a column header, a field label, a
filter name, a role name. **It does not** in running sentences, on buttons, or in status chips,
where the plain English word is enough because the reader has already seen the label. Where the
English word is the same word as the German (Protokoll / protocol), no brackets are added.

The English names, locked here because 17c and 17d depend on them:

| German (CONTEXT.md) | English label | In a sentence |
|---|---|---|
| Befischung | Electrofishing survey (Befischung) | survey |
| Protokoll | Protocol | protocol |
| Probestrecke | Sampling stretch (Probestrecke) | sampling stretch |
| Monitoringstrecke | Monitoring stretch (Monitoringstrecke) | monitoring stretch |
| Anlass | Occasion (Anlass) | occasion |
| Bearbeiter | Surveyor (Bearbeiter) | surveyor |
| Anodenführer | Anode operator (Anodenführer) | anode operator |
| Gewässer | Water body (Gewässer) | water body |
| Gewässertyp | Water body type (Gewässertyp) | water body type |
| Vorfluter | Receiving water (Vorfluter) | receiving water |
| Art | Species (Art) | species |
| Größenklasse | Size class (Größenklasse) | size class |
| 0+ | Young of the year (0+) | young of the year |
| Kein Nachweis | No detection (Kein Nachweis) | no detection |
| Besatzmaßnahme | Stocking (Besatzmaßnahme) | stocking |
| Prozentgruppe | Percentage group (Prozentgruppe) | percentage group |
| Semiquantitative Angabe | Semi-quantitative rating (Semiquantitative Angabe) | rating |
| Regierungspräsidium | Regional council (Regierungspräsidium) | regional council |
| Verlauf | History (Verlauf) | history |
| Einlesen | Import PDF | import |
| FFS, FiaKa | unchanged | unchanged |
| Protokoll E-Befischung | unchanged, it is the form's name | unchanged |

**Statuses and roles are the application's own words**, not FFS vocabulary, so they are plain
English: Draft, Submitted, In review, Changes needed, Rejected, Accepted, Locked; Submitter,
Data steward, Reviewer, Administrator, Integration. The one exception is the role
Regierungspräsidium, which names an official body and follows the table.

## Build steps

- [x] **Step 1 - The term list, the frame and sign-in** - add an `_English_:` line to each term
  in `CONTEXT.md` from the table above, plus a short paragraph under "Language" with the
  bracket placement rule. English in `en.json` for `shell`, `common`, `anmeldung`, `sitzung`
  and `fehler` (44 texts, 37 of them new; the 7 that 17a already wrote stay as they are).
  *Done when:* with English chosen, the header, footer, not-found page, sign-in page, the
  "session expired" message and the "server not reachable" message all read in English
  (screenshots, light theme, signed in and signed out); the header stays on one line at 1280px
  wide as a Super Admin, who has the most nav links; `npm test` passes.

- [x] **Step 2 - Meine Protokolle** - English for `protokolle` (48 texts): the list, its
  empty, loading and error states, the delete dialog, the status chips and the PDF import
  button and its failure dialog. Plural forms (`_one` / `_other`) get both English forms.
  *Done when:* in English, a list with drafts reads "3 protocols, 2 of them drafts"; an
  account with no protocols shows the English empty state; the delete dialog reads in English;
  with the backend stopped, the load error reads in English. Screenshots of the list and the
  delete dialog.

- [x] **Step 3 - The Prüfliste** - English for `pruefliste` (46 texts): title, filters, sort
  orders, table, pager, and the empty, no-match, error and no-permission states.
  *Done when:* in English as a reviewer, every filter label and sort order reads in English,
  the pager reads "Page 1 of 3"; a submitter opening `/pruefung` sees the English
  no-permission message. Screenshot of the queue with filters showing.

- [x] **Step 4 - User administration: the list and creating an account** - English for
  `benutzerverwaltung` except `aendern` (about 65 texts): the list, search and status filter,
  the field labels and hints shared by both forms, the create form and its "account created"
  page.
  *Done when:* in English as a Super Admin, the user list, the search, the create form with
  its validation messages (submit it empty) and the "account created" page read in English.
  Screenshots of the list and the filled-in create form.

- [x] **Step 5 - User administration: changing an account** - English for
  `benutzerverwaltung.aendern` (41 texts): details, access, lock dialog, new password and its
  "password changed" page.
  *Done when:* in English, the change page, the lock dialog and the "password changed" page
  read in English, including the bold "active" / "locked" words inside the access sentence.
  Screenshot of the change page.

- [x] **Step 6 - The guard, and a browser walk in English** - extend `locales.test.ts` with a
  test listing the eight 17b namespaces and failing on any key under them that `en.json`
  lacks. Extend `e2e/sprache.spec.ts` with one test: a throwaway account with the roles Submitter, Reviewer
  and Super Admin (made the way the spec's other tests make throwaway accounts), so all three
  nav links show, switches to English, then visits Meine
  Protokolle, the Prüfliste and the user list, finding each by its English heading and the
  nav links by their English names. (Built without locking the account afterwards: 17a's notes settle that throwaway accounts stay, locked or not.)
  *Done when:* `npm test` passes, and deleting one English key under `pruefliste` makes the new
  test fail and name that key (then restored); `npm run e2e` passes; `npm run lint` and
  `npm run build` pass.

## Files / areas

- `frontend/src/i18n/locales/en.json` (most of the diff)
- `frontend/src/i18n/locales/locales.test.ts`
- `frontend/e2e/sprache.spec.ts`
- `CONTEXT.md`
- Possibly `components/shell.css` or a list stylesheet, only if a longer English text breaks a
  layout the screenshots show

No component code should need to change: every text on these screens already comes from the
locale file.

## Data / contracts

**Load-bearing: the English term list in `CONTEXT.md`.** 17c and 17d translate the form and its
surroundings against it, so the same German term reads the same in English on every screen.

**Load-bearing: the key structure of `de.json` is not changed.** English goes in under the same
keys. Renaming a German key here would also break the placeholders guard from 17a.

No backend change, no database change, no new route.

## Testing

- **vitest (step 6):** the eight namespaces are completely translated. This is a partial form of
  17e's final test, and 17e can widen the namespace list to "all" rather than write a new one.
  The existing 17a guard keeps checking that no English key is unknown and every placeholder
  matches.
- **Playwright (step 6):** the screens open in English for an account set to English.
- **Browser evidence (steps 1 to 5):** a screenshot per screen in English, looked at for cut-off
  or wrapping text, since English and German differ in length.
- Final gate: `npm test`, `npm run lint`, `npm run build`, `npm run e2e`. `pytest` is not
  affected but runs at `/complete` as usual.

## Notes for the AI

- **Write English for a reader in or around Baden-Württemberg.** British spelling
  ("organisation", "colour") to match the `en-GB` dates chosen in 17a. Plain, short sentences,
  same tone as the German: polite, specific, and saying what to do next.
- **Keep every `{{placeholder}}` exactly** as the German has it; the 17a guard fails otherwise.
  Keep `<strong>` tags in `zugang.istAktiv` / `istGesperrt` where the German has them.
- **Plurals.** i18next picks `_one` / `_other` for English the same way as German, so each pair
  gets both forms. `protokolle.list.anzahlMitEntwuerfen` nests `entwuerfe`; check the English
  reads naturally for 1 and for several.
- **`benutzerverwaltung.felder.sprachen`** names the two languages inside an English sentence,
  so they are "German" and "English" here. The switch in the header keeps each language's own
  name; that is a different place with a different job (17a).
- **Shared e2e accounts stay German.** The other browser specs find controls by their German
  names. Only throwaway accounts are switched to English.
- **Statusabzeichen** reads `protokolle.list.status`, so translating it in step 2 also turns
  the status chip on the protocol screen English. That is wanted.
- **Flow diagrams.** No folder, route, save path or session check changes, so the three
  diagrams need no edit. Confirm that at `/complete`.
- Mansi reviews the English: show the German and English side by side for each step's texts
  rather than only the JSON diff, so a phrasing they dislike is easy to spot.
- Commit freely on the branch when asked; never merge or push.
- **What the build turned up, fixed on this branch.** (1) The Prüfliste and the user list were
  wider than a 1280px window in German too, so the Prüfen buttons sat off-screen. Every table had
  `width: max-content`, written for the catch table, which should keep its shape and scroll. The
  list tables (`.tabelle--liste` in `muiTheme.ts`) now fill the page and let text wrap. (2) With
  that, the user list's "Created" date broke over two lines; its cell now carries `zeile-tabular`
  like the other two lists' date cells.
- **"Gesperrt" is "Blocked" in English**, not "Locked", because Locked is already the name of a
  protocol status and the two would read as the same thing in an administrator's head.
- **The browser runs used throwaway accounts** `e2e17b-admin`, `e2e17b-pruefer` and
  `e2e17b-einreicher` on the development database, because the shared E2E password was not in
  this session's environment. Full suite: 63 passed, 2 skipped (both skips are conditional on the
  data or demo mode, not on missing accounts).
