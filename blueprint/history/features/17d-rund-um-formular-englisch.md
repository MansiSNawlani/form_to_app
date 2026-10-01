# Feature: 17d - Rund um das Formular in English

**From build-plan:** feature 17d
**Status:** complete (2026-10-01)
**Branch:** `feature/17d-rund-um-formular-englisch`, from `main` after 17c was merged

## Goal

When English is chosen, everything around the form reads in English too: the save indicator,
the safety copy, submitting and its problem list, the change request banner, the reviewer's
decision panel, the Verlauf, the read-only view, the banner on an imported protocol, and the
attachment messages. And the short descriptive dropdown entries (rain, turbidity, current and
the like) read in English, while what is stored never changes.

After this, the only German left on an English screen is what was decided to stay German
(species names, equipment models, place names, the downloaded PDF) and the backend's own
refusals, which are 17e.

## Worked example

Tom, the consultant from Basel, has his account set to English. He opens a draft and goes to
section 2. Under **Rainfall** he can now pick **None**, **Before the survey** or **During the
survey**, where 17c still showed "keine", "vor der Untersuchung" and "während der
Untersuchung". He picks "Before the survey". The answer stored in the protocol is still `2`,
exactly as before. Mansi, with her account in German, opens the same protocol and reads "vor
der Untersuchung".

In the top corner the save indicator reads **Saved automatically at 14:32**.

In section 6 he wants to record that no crayfish were found. The species picker now offers
**No detection, crayfish** (code KNKR). The fish names around it stay German: "Bachforelle",
"Groppe / Mühlkoppe".

He presses **Submit protocol**. The confirmation asks **Submit protocol?**, and the problem
list underneath names the fields in English, because 17c gave the fields English labels.

Later, Anna at FFS (account in English) opens the protocol to review it. Her decision panel
reads **Decision**, with **Accept**, **Request changes** and **Reject**. The Verlauf underneath
reads **Submitted, by Tom Weber**. Her summary bar shows **Occasion (Anlass): General stock
survey**.

## In scope

**Part A - about 130 texts in `de.json`, given English in `en.json`:**

| Keys under `protokoll.` | Texts | What it is |
|---|---|---|
| `speichern`, `sicherung`, `verwerfen` | 19 | Save indicator, save problem banner, safety copy dialog, the "this protocol is still empty" dialog |
| `aenderung`, `abgesendet` | 5 | Change request banner, the "already submitted" notice |
| `anlagen` | 9 | Attachment upload messages (wrong type, too large, HEIC) |
| `einlesen` | 8 | Banners on a protocol read in from a PDF |
| `absenden` | 34 | Submitting: button, confirmation, the problem list |
| `entscheidung` | 26 | The reviewer's decision panel |
| `verlauf` | 12 | The Verlauf (history of status changes) |
| `nurlesen`, `pruefung` | 15 | The read-only view and the reviewer's header and summary bar |

**Part B - the short descriptive dropdown entries, about 110:**

| List | Entries | Example |
|---|---|---|
| `anlass` | 6 | Fischmonitoring gemäß WRRL -> Fish monitoring under the WFD (WRRL) |
| `gewaessertyp` | 8 | Bach -> Stream, abgeschnittenes Altwasser -> Cut-off oxbow |
| `messdaten.regenfaelle`, `truebung`, `schaumbildung` | 9 | schwach -> Slight |
| `hydrologie.*` (all nine) | 45 | träge fließend -> Sluggish; "< 0,1" -> "< 0.1" |
| `ufer.randstreifen` | 3 | einseitig oder unvollständig -> One side or incomplete |
| `ausruestung.bauweise`, `ausruestung.kathode` | 11 | Schleppkathode -> Trailing cathode |
| `z.quelle` | 13 | FB - Fangblätter RP Tübingen -> FB - Catch sheets RP Tübingen (code kept) |
| The 0 to 3 Strukturen scale (`teil4/stufen.ts`) | 4 | 2 - verbreitet -> 2 - Widespread |
| A few entries inside the long lists | 7 | The four "kein Nachweis" species entries, "Sonstige Art", and "keine Angabe" in the e-fishing device list |

Plus:

- The three 17c rule messages that quote "kein Nachweis" now quote the English entry the picker
  shows, "No detection" (the spec first said four; a fourth, `keinNachweisMitFang`, never quoted it)
- Guards in vitest: the Part A keys are completely translated; every Part B list is complete;
  the English lists name no entry the seed file lacks
- A browser test that walks submitting and a review decision in English
- Screenshots of the screens that change, checking that longer English text does not break the
  layout

## Out of scope

- **What stays German, decided on 2026-09-30:** species names, e-fishing device models
  ("Efko / FEG 1500"), place names, the 722 monitoring stretch names, the downloaded PDF.
- **The Regierungspräsidium dropdown** (`z.rp`, "Regierungspräsidium Karlsruhe" and three
  more). A default, not a question: these are the official names of four authorities, which
  is closer to a place name than to a description, so they stay German. Easy to change in
  review.
- **Backend refusals that arrive as a German sentence:** 17e. An attachment the server rejects,
  or a PDF that is not this form, still shows the server's German sentence after this feature.
- **The final "every German text has an English one" test:** 17e.
- **Searching dropdowns in both languages.** The species picker and the other searchable lists
  match what they show, so an English user finds "No detection" by typing "no", not "kein".
- No backend change, no database change, no new route, no change to stored answers.

## How the dropdown entries get their English

**The problem.** The dropdown entries do not live in `de.json`. They live in
`database/seed/form_version_20260609/optionslisten.json`, a file generated from the legacy PDF
and read by the backend too. Each entry has a `wert` (what is stored, and what FiaKa receives)
and a `label` (what is shown).

**The approach, decided here (a default, easy to change in review):**

- A new file, `frontend/src/i18n/locales/optionen.en.json`, holds the English labels only,
  shaped `{ "<list name>": { "<wert>": "English label" } }`. For example
  `{ "messdaten.regenfaelle": { "1": "None", "2": "Before the survey", ... } }`.
- **German is not copied anywhere.** It stays in the seed file, which is its one source. A
  copy in `de.json` would drift the next time the lists are regenerated.
- **Why not inside `en.json`:** the 17a guard refuses any English key that German lacks, and
  i18next reads a dot in a key as nesting, which breaks on a `wert` like "Sonst." or a list
  name like "messdaten.truebung". A separate file avoids both.
- `optionen()` and `optionLabel()` in `protokoll/optionen.ts` take the language as an argument,
  German by default. Components get it from a small hook so they follow the switch. The two
  pure display modules (`liste/anzeige.ts`, `verwaltung/benutzer/anzeige.ts`) take it as an
  argument, so they stay testable without i18next.
- **An English label that is missing falls back to the German label**, the same way a missing
  `en.json` key does. That is how "Bachforelle" stays German: the species list simply has no
  English entry for it.
- The lists are still built once when the module loads, one copy per language, so the
  722-entry list keeps a stable reference (the reason is in the comment in `optionen.ts`).

## Build steps

Each step shows Mansi the German and the English side by side.

- [x] **Step 1 - Saving, the safety copy, leaving an empty protocol, the change request** -
  English for `speichern`, `sicherung`, `verwerfen`, `aenderung` and `abgesendet` (24 texts).
  *Done when:* in English, the save indicator reads in English while typing and after saving;
  stopping the backend while typing shows the English save problem banner; reloading with an
  unsaved local copy shows the English safety copy dialog; leaving a brand new empty protocol
  shows the English "still empty" dialog; a protocol with a change request shows the English
  banner (screenshots of each). `npm test` passes.

- [x] **Step 2 - Attachments and the import banners** - English for `anlagen` and `einlesen`
  (17 texts). Keep `{{formate, list(type: disjunction)}}` and the `number` formatters exactly.
  *Done when:* in English, choosing a text file as a photo shows the English "is not an image"
  message naming "PNG, JPEG or WebP"; a file over the limit shows the English size message;
  importing one of the demo PDFs shows the English banners (screenshots).

- [x] **Step 3 - Submitting** - English for `absenden` (34 texts).
  *Done when:* in English, pressing Submit on an incomplete protocol shows the English problem
  list, each entry naming the field by the same English label the field shows; the
  confirmation dialog reads in English; submitting a complete protocol shows the English
  "submitted" notice (screenshots).

- [x] **Step 4 - The reviewer's side** - English for `entscheidung`, `verlauf`, `nurlesen` and
  `pruefung` (53 texts).
  *Done when:* a reviewer account in English opens a submitted protocol: the header, summary
  bar, decision panel with its three choices and their reason field, and the Verlauf all read
  in English (screenshot); requesting a change on a throwaway protocol adds an English Verlauf
  line. The summary bar's Occasion still shows German until step 6.

- [x] **Step 5 - Dropdown entries can have English** - the mechanism only, proven on one list.
  Add `optionen.en.json` with the six `anlass` entries; give `optionen()`, `optionLabel()` and
  `optionLabelMitWert()` a language argument, German by default; add the hook; pass the
  language through every call site listed under Files.
  *Done when:* in English, the Occasion dropdown in section 1, the Occasion column and filter
  in Meine Protokolle and the Pruefliste, and the reviewer's summary bar all read in English;
  switching to German turns them all back without a reload; the stored value is unchanged (the
  same protocol reads German for a German account); new vitest cases cover English found,
  German fallback when English is missing, an unknown code still printed as itself, and the
  one-copy-per-language reference staying stable; `npm test` passes.

- [x] **Step 6 - All the short descriptive lists** - English for every list in Part B, the
  0 to 3 Strukturen scale, and the seven entries inside the long lists. Update the four 17c
  messages that quote "kein Nachweis" so they quote "No detection".
  *Done when:* in English, every dropdown and radio group in sections 1 to 5 shows English
  except the device models (screenshots of sections 2, 3, 4 and 5); the species picker offers
  "No detection, crayfish" and still shows "Bachforelle"; an empty catch shows the English
  message quoting "No detection" exactly as the picker shows it; the number ranges use a
  decimal point ("< 0.1"); the read-only view a reviewer sees shows the same English entries.

- [x] **Step 7 - The guards and a browser walk** - extend `locales.test.ts` so the
  "completely translated" test covers the Part A keys. Add a guard for `optionen.en.json`:
  every list it names exists in the seed file, every `wert` it names exists in that list, and
  each Part B list has an English label for every one of its entries. Extend
  `e2e/sprache.spec.ts`: a throwaway Submitter in English fills in and submits a protocol (or
  opens the submit problem list), and a throwaway Reviewer in English opens it and finds the
  decision panel and one Verlauf line by their English names.
  *Done when:* `npm test` passes, and deleting one English entry from `optionen.en.json` makes
  the guard fail and name it (then restored); `npm run e2e`, `npm run lint` and
  `npm run build` pass; `npm run beschriftungen` leaves `beschriftungen.json` unchanged (the
  PDF stays German).

## Files / areas

- `frontend/src/i18n/locales/en.json` (Part A and the four kein-Nachweis messages)
- `frontend/src/i18n/locales/optionen.en.json` (new)
- `frontend/src/i18n/locales/locales.test.ts`
- `frontend/src/protokoll/optionen.ts` and `optionen.test.ts`
- `frontend/src/protokoll/abschnitte/teil4/stufen.ts` (the 0 to 3 scale)
- Call sites that pass the language through: `felder/FeldAuswahl.tsx`, `felder/FeldRadio.tsx`,
  `felder/FeldSuche.tsx`, `felder/Optionssuche.tsx`, `absenden/AbsendeProbleme.tsx`,
  `nurlesen/ArtenNurLesen.tsx`, `liste/anzeige.ts` (`anlassLabel`) and its three callers
  `liste/ProtokollZeile.tsx`, `pruefliste/PrueflistenZeile.tsx` and
  `pruefung/Uebersichtsleiste.tsx`, `pruefliste/Filterleiste.tsx`,
  `verwaltung/benutzer/anzeige.ts` and its caller, `verwaltung/benutzer/Regionsfeld.tsx`
  (the last two only pass the language through, since `z.rp` stays German)
- `frontend/e2e/sprache.spec.ts`
- Possibly a stylesheet, only if a screenshot shows longer English text breaking a layout

## Data / contracts

**Load-bearing: what is stored never changes.** Only the `label` shown is translated; every
`wert` stays exactly as the seed file has it. The backend, the database, FiaKa and the PDF
never see the English.

**Load-bearing: the shape of `optionen.en.json`.** `{ [list name]: { [wert]: label } }`, with
list names exactly as `ListenName` spells them. A later form version (ADR 0004) gets its English
the same way.

**The key structure of `de.json` does not change.** English goes in under the same keys.

## Testing

- **vitest (steps 5 and 7):** the label lookup in each language, the German fallback, the
  unknown-code fallback, stable references; the Part A keys completely translated; the English
  option file complete for its lists and naming nothing the seed lacks. The existing 17a guard
  keeps checking placeholders.
- **Playwright (step 7):** submitting and reviewing in English.
- **Browser evidence (steps 1 to 6):** screenshots of each changed screen in English, at 1280px.
- Final gate: `npm test`, `npm run lint`, `npm run build`, `npm run e2e`. `pytest` is not
  affected but runs at `/complete` as usual.

## Notes for the AI

- **Same English as 17b and 17c:** British spelling, plain short sentences, the same polite
  tone as the German, always saying what to do next. Official terms follow the table in
  `CONTEXT.md` and 17b's placement rule (German in brackets on a label, not in a sentence).
- **Quotes.** Where the German uses guillemets («name»), English uses curly double quotes
  (“name”), as 17b's delete dialog already does. The 17c rule messages quote labels with
  straight double quotes, and the three rewritten here keep that file's style.
- **Keep every `{{placeholder}}`, plural suffix (`_one`, `_other`) and formatter exactly.**
- **Dropdown entries start with a capital** in English, as 17c's labels do ("Slight", not
  "slight"), except where the entry is a number range.
- **Messages that quote an on-screen label quote the English one.** Check each against the
  screen, not the JSON.
- **Every dropdown entry keeps its German code where the German shows one:** "13 - Bach" becomes
  "13 - Stream", "FB - Fangblätter..." keeps "FB".
- **Shared e2e accounts stay German.** Only throwaway accounts are switched to English. The
  shared password may not be in the environment; 17c used throwaway accounts
  (`e2e17c-*`) on the development database for the same reason.
- **Flow diagrams.** No new folder, route, save path or session check. The folder map lists
  every file in `i18n/`, so it gained `useLocale.ts` and `locales/optionen.en.json`, with a
  line saying what the second one holds. The other two diagrams name neither and are unchanged.
- **Searching.** MUI's Autocomplete filters on `getOptionLabel`, so the searchable lists match
  the English label once it is shown. That is the behaviour Out of scope describes; nothing to
  build.
- Commit freely on the branch when asked; never merge or push.
- **What the build changed from the plan.**
  1. The region call sites (`verwaltung/benutzer/anzeige.ts`, `Regionsfeld.tsx` and the
     region in `Uebersichtsleiste.tsx`) were left alone. The four region entries stay German,
     so passing them a language would change nothing on screen.
  2. The 0 to 3 Strukturen scale moved its four words into the locale files, under
     `protokoll.abschnitt4.strukturen.stufe`, rather than into `optionen.en.json`. It is
     declared in code with no seed entry, so the locale files are its natural home, and the
     17a guard then covers it. `stufen.ts` now holds only the four stored numbers.
     `de.json` gains these four keys; no existing key changed.
  3. The width and still-water ranges ("< 1", "10 - 25") have no English entry. Their German
     labels hold no word and no decimal comma, so English would be an exact copy.
  4. `useLocale()` lives in `i18n/useLocale.ts`, so any screen can use it, not only the form.
- **Evidence.** Screenshots at 1280px in English: sections 2 and 4 (every list in English,
  "2 - Widespread", "< 0.1"), the species picker offering the four "No detection" entries,
  the submit dialog and problem banner, the reviewer header, summary bar and decision panel,
  the import banner with "Fish rescue" and "FBF - Catch sheets RP Freiburg". The attachment
  message read: “notiz.txt” is not an image. Please choose a file in JPG, PNG, or WEBP format.
  Not triggered on screen: the save problem and conflict banners, the safety copy dialog and
  the change request banner. Their English is checked by the guard and was read against the
  German.
- **Browser runs used throwaway accounts** `e2e17d-admin`, `e2e17d-pruefer` and
  `e2e17d-einreicher` on the development database, as 17c did. Two drafts made by hand while
  taking screenshots were deleted afterwards, one of them imported from a real protocol.
- **What the code review changed.** "Cannot be saved" became "cannot be fixed" in the two
  Reject texts, since "saved" already means storing data in this app; "Protocol of" became
  "Protocol dated"; the scale's "1 - Few" became "1 - Sparse", since it rates how much of a
  structure there is, not a count; `Optionssuche.tsx` reads the language into a variable like
  every other call site; the browser test's history check is scoped to the history panel, so
  the status badge in the header cannot satisfy it. Judged not to need a change: "keine
  Angabe" in the device list stays "Not stated", because that is the label the German screen
  shows (when two entries store the same code the first label is kept, and a test pins it).
  The reviewer browser test still skips when no protocol is waiting for review; an empty
  protocol cannot be submitted, so the test cannot make one of its own.
