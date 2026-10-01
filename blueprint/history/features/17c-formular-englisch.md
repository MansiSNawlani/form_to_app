# Feature: 17c - Das Formular in English

**From build-plan:** feature 17c
**Status:** complete (2026-10-01)
**Branch:** `feature/17c-formular-englisch`, from `main` after 17b was merged

## Goal

When English is chosen, the protocol form itself reads in English: the page around it, the seven
section names, every block heading, field label and hint, and every rule message that appears
under a field. 17a made the switch work, 17b translated the screens around the form and fixed
the English names of the official terms; this feature applies those names to the form.

## Worked example

Tom, the consultant from Basel, has his account set to English. He opens a draft. The section
list on the left reads **1 Occasion and sampling stretch**, **2 Measurements and hydrology**, and
so on down to **7 Map and photos**.

In section 1 the block heading reads **Occasion of the survey**, and the first field is
**Occasion (Anlass)**. He picks "WRRL-Monitoring" from the dropdown. That entry stays German,
because the dropdown contents are 17d's job. He leaves the monitoring number empty, and the
message under it reads: *"For fish monitoring under the WFD (WRRL) or the Habitats Directive
(FFH), the monitoring stretch number is required."*

He types a lower-boundary easting of 123. The message reads: *"The easting lies outside
Baden-Württemberg. Expected: [min] to [max]."* The two numbers are the real bounds the code already fills in; only the
words around them change.

In section 6 he adds a row and enters 5 fish in the "up to 5 cm" class and 8 under "of which
young of the year (0+)". The message reads: *"There cannot be more young-of-the-year (0+) fish
than the row counts in total."*

Then he downloads the PDF. It is still entirely German, as decided on 2026-09-30.

## In scope

About 350 texts under `protokoll` in `de.json`, given English in `en.json`:

| Keys | Texts | What it is |
|---|---|---|
| `kopf`, `laedt`, `nichtGefunden`, `ladefehler`, `navigation`, `ausgabe` | 15 | The protocol page around the form: header, loading and error states, back / next, the PDF button |
| `abschnitte` | 9 | The seven section names and the section list |
| `felder` | 11 | Shared field texts: "Please choose", "Clear selection", units |
| `abschnitt1` to `abschnitt7` | 281 | Block headings, field labels, hints, callouts |
| `regeln` | 34 | The rule messages under fields |

Plus:

- A vitest guard that these keys are completely translated, the same shape as 17b's
- A browser test that opens a protocol in English and walks the sections
- Screenshots of each section in English, checking that longer English text does not break the
  layout. The section list and the catch table are the two places most at risk

## Out of scope

- **The dropdown and radio contents** (rain, turbidity, current and the like). They come from
  `optionslisten.json`, not from `de.json`, and are 17d's job. Until then they stay German
  inside English labels. This includes the "kein Nachweis" entries in the species picker
- Saving, the safety copy, discarding, submitting and its problem list, the change request
  banner, review decisions, the Verlauf, the read-only view, the reviewer header, the PDF import
  banner, attachment upload messages: 17d. These are `protokoll.speichern`, `sicherung`,
  `verwerfen`, `absenden`, `abgesendet`, `aenderung`, `entscheidung`, `verlauf`, `nurlesen`,
  `pruefung`, `einlesen` and `anlagen`
- Backend refusals that arrive as a German sentence: 17e
- The downloaded PDF: stays German. `npm run beschriftungen` reads `de.json` only, so it is
  unaffected; step 8 confirms that
- Species names, equipment models, place names: stay German everywhere

## How the official terms read

This feature follows the table in `CONTEXT.md` that 17b wrote, and 17b's placement rule: the
German goes in brackets where the term **is** a label, not in running sentences.

Two defaults for the form, set here. **Neither is a question**; both are easy to change in review.

1. **Section names in the section list stay plain English, without brackets.**
   "Occasion and sampling stretch", not "Occasion (Anlass) and sampling stretch
   (Probestrecke)". The section list must stay on one line at desktop width, and the brackets
   would roughly double its length. The brackets appear one click later, on the field labels.
2. **A field label gets the brackets only when the label is the term itself.** "Water body
   (Gewässer)", "Water body type (Gewässertyp)", "Receiving water 1 (Vorfluter)". A label that
   only contains a term does not: "Lower boundary, easting", not "Lower boundary (untere
   Grenze), easting (Rechtswert)".

Words not in the `CONTEXT.md` list are plain English. The few that come up often, fixed here so
the steps agree:

| German | English |
|---|---|
| Rechtswert / Hochwert | Easting / Northing |
| Schätzwert | Estimate |
| Bandbreite | Range |
| Messdaten | Measurements |
| Umland / Ufer / Sohle | Surrounding land / Bank / Bed |
| Fang, Fänge | Catch |
| Altersklasse 0+ | Young of the year (0+) |
| WRRL / FFH | WFD (WRRL) / Habitats Directive (FFH), see the exceptions below |

**Three deliberate exceptions to "no brackets in a sentence"**, all for the same reason: the
sentence names something the screen still shows in German, so the German must be there for the
reader to find it.

- WRRL and FFH: the Anlass dropdown shows "WRRL-Monitoring" until 17d, so the rule message
  and its hint read "the WFD (WRRL) or the Habitats Directive (FFH)".
- Rhein and Donau: place names stay German, and the surveyor types "Rhein" into the chain.
  The first mention reads "the Rhein (Rhine) or the Donau (Danube)"; the follow-up message
  says only "Rhein" and "Donau".
- Kein Nachweis: the species picker shows "kein Nachweis" as an entry, so the rule messages
  quote it German first, '"kein Nachweis" (no detection)', the reverse of the label order in
  `CONTEXT.md`, because here it is the on-screen entry being quoted.

## Build steps

Each step translates one section **and the rule messages that section shows**, so a step can be
checked on screen in full. Each step shows Mansi the German and the English side by side.

- [x] **Step 1 - The page around the form, shared field texts and section 1** - English for
  `kopf`, `laedt`, `nichtGefunden`, `ladefehler`, `navigation`, `ausgabe`, `abschnitte`,
  `felder` and `abschnitt1` (about 80 texts), plus the section 1 rule messages:
  `monitoringnummerPflicht`, the three `vorfluter*`, the three `koordinate*`, and `fehlt` (the
  generic "needed to submit" message every section uses).
  *Done when:* in English, the protocol header, the section list, back / next buttons and all
  of section 1 read in English (screenshot); the section list stays on one line at 1280px wide;
  leaving the monitoring number empty with a WRRL occasion, leaving a gap in the Vorfluter chain
  and typing an easting of 123 each show the English message; opening `/protokolle/<unknown id>`
  shows the English "not found" page; `npm test` passes.

- [x] **Step 2 - Section 2, measurements and hydrology** - English for `abschnitt2` (28 texts),
  plus `hydrologieBeiStillgewaesser`, `hydrologieNichtZutreffendBeiFliessgewaesser`, the three
  `schaetzwert*` and `zahlNegativ`.
  *Done when:* in English, section 2 reads in English with a river type (screenshot); with a
  lake type the "not relevant for standing water" notice reads in English; an estimate outside
  its range shows the English message, whose example uses a decimal point ("1.5"), which the
  field accepts.

- [x] **Step 3 - Section 3, surrounding land, bank and bed** - English for `abschnitt3` (68
  texts), plus `prozentKeineGanzeZahl`, `prozentsummeNichtHundert` and `fehltProzentgruppe`.
  *Done when:* in English, all six percentage groups read in English with their running totals
  (screenshot); a group adding up to 90 shows the English sum message.

- [x] **Step 4 - Section 4, structures, influences and fishery management** - English for
  `abschnitt4` (44 texts), plus the three `einfluesse*`, `fehltEinfluss` and
  `fehltBewirtschaftung`. The `einfluesse*` messages quote the checkbox labels "keine
  (erkennbar)" and "unbekannt"; in English they quote the English labels from the same step.
  *Done when:* in English, section 4 reads in English (screenshot); ticking "none (visible)"
  and Hydropower together shows the English message, and the label it quotes matches the
  checkbox on screen exactly.

- [x] **Step 5 - Section 5, equipment and fished areas** - English for `abschnitt5` (35 texts),
  plus `anodenKeine`, the two `befischte*Null`, `fehltRichtung` and `fehltMethode`.
  *Done when:* in English, section 5 reads in English (screenshot); no anodes, and a fished
  length without a direction, each show the English message.

- [x] **Step 6 - Section 6, the catch table** - English for `abschnitt6` (42 texts), plus
  `anzahlKeineGanzeZahl`, `nullPlusUeberSumme`, `artDoppelt`, the two `keinNachweis*`,
  `fangOhneNachweisCode` and `fehltArt`. The size-class headings ("≤ 5", ">5 - 10") need no
  change; their spoken names ("up to 5 cm", "over 5 to 10 cm") do. The no-detection messages
  name the German entry the picker shows: 'a "kein Nachweis" (no detection) entry'.
  *Done when:* in English, the table reads in English with its headers still on one line each
  (screenshot, 1280px); the worked example above (5 fish, 8 young of the year) shows the English
  message; a screen reader name for a cell reads like "Species 3, over 10 to 15 cm" (checked in
  the accessibility tree).

- [x] **Step 7 - Section 7, map and photos** - English for `abschnitt7` (20 texts). Keep the
  `{{formate, list(type: disjunction)}}` and `{{mb, number}}` formatters exactly; in English they
  produce "PNG, JPEG or WebP" and "1.5 MB" on their own.
  *Done when:* in English, section 7 reads in English with no attachments and with one photo
  (screenshot); the remove dialog reads in English.

- [x] **Step 8 - The guard and a browser walk in English** - extend `locales.test.ts` so the
  "completely translated" test also covers the 17c keys listed under In scope, by dotted path.
  Extend `e2e/sprache.spec.ts` with one test: a throwaway Submitter account made in English (the
  switch itself is 17a's test) creates a protocol, and moves through all seven sections with Next, finding each section by
  its English heading and one field per section by its English label.
  *Done when:* `npm test` passes, and deleting one English key under `protokoll.regeln` makes the
  guard fail and name that key (then restored); `npm run e2e`, `npm run lint` and
  `npm run build` pass; `npm run beschriftungen` leaves `beschriftungen.json` unchanged (the PDF
  stays German).

## Files / areas

- `frontend/src/i18n/locales/en.json` (almost all of the diff)
- `frontend/src/i18n/locales/locales.test.ts`
- `frontend/e2e/sprache.spec.ts`
- Possibly `protokoll/protokoll.css` or the section list's stylesheet, only if a screenshot
  shows a longer English text breaking the layout

No component code should need to change: every text in the form already comes from the locale
file (checked while writing this spec; no German string literal is rendered from
`protokoll/abschnitte/`, `felder/` or `regeln/`).

## Data / contracts

**Load-bearing: the key structure of `de.json` does not change.** English goes in under the same
keys. `beschriftungen.ts` and the 17a placeholder guard both read those keys.

**Load-bearing: the English field labels.** 17d's submit problem list names the field each
problem concerns, and it should read the same label the field shows. That comes for free as long
as 17d reads the same keys, which it does today.

No backend change, no database change, no new route. Stored answers never change.

## Testing

- **vitest (step 8):** the 17c keys are completely translated. The 17a guard keeps checking that
  every English key exists in German and every placeholder matches. The rule logic itself is
  unchanged, so its existing tests are the check that nothing moved.
- **Playwright (step 8):** the form opens and walks in English for an account set to English.
- **Browser evidence (steps 1 to 7):** a screenshot per section in English, and each step's rule
  messages triggered on screen.
- Final gate: `npm test`, `npm run lint`, `npm run build`, `npm run e2e`. `pytest` is not
  affected but runs at `/complete` as usual.

## Notes for the AI

- **Same English as 17b:** British spelling, plain short sentences, the same polite tone as the
  German, always saying what to do next.
- **Keep every `{{placeholder}}` and formatter exactly.** The 17a guard fails otherwise.
- **Typographic quotes.** The German uses German low-and-high quotes around quoted labels. English uses plain double quotes.
- **Rule messages quote other labels.** Where a message quotes a checkbox or field label, the
  English quotes the English label, so the person can find it on screen. Check each one against
  the screen, not against the JSON.
- **Hints that describe the legacy form** (for example the coordinates callout: "as in the
  previous form") are translated as they are, not rewritten.
- **The read-only view borrows the form's labels.** A reviewer opening a submitted protocol sees
  the same field labels, so they turn English here too, while the read-only view's own texts
  (`nurlesen`, `pruefung`) wait for 17d. That half-English state is expected between the two.
- **Shared e2e accounts stay German.** The other browser specs find form controls by their German
  names. Only throwaway accounts are switched to English.
- **Flow diagrams.** No folder, route, save path or session check changes, so the three diagrams
  need no edit. Confirm that at `/complete`.
- Commit freely on the branch when asked; never merge or push.
- **What the build turned up.** (1) The guard's prefix match could not see a single text such
  as `protokoll.laedt`, so it would have passed on nothing; it now matches the key itself too,
  and fails if a listed name holds no German text at all. (2) German capitalises by grammar, so
  a straight translation mixed "Dead wood" with "submerged macrophytes" in one list. Every
  English field and checkbox label now starts with a capital, and the rule messages quote
  "None (visible)" and "Unknown" exactly as the checkboxes show them.
- **Built in one pass rather than step by step**, with the English written for all seven
  sections at once and checked on screen per section afterwards (screenshots at 1280px of
  sections 1 to 7 and the not-found page). The rule messages for the easting, the Vorfluter
  gap and chain end, the percentage sum, "None (visible)" with Hydropower, and the 0+ count
  were each triggered on screen in English.
- **The browser runs used throwaway accounts** `e2e17c-admin`, `e2e17c-einreicher` and
  `e2e17c-pruefer` on the development database, because the shared E2E password was not in
  this session's environment. Full suite: 64 passed, 2 skipped (both conditional on data or
  demo mode).
- **Still German on the form screen, as planned:** the save indicator, radio and dropdown
  contents (including the 0 to 3 Strukturen scale in `teil4/stufen.ts`), and everything else
  listed for 17d.
- **What the code review changed.** The four "which" labels now read "please specify"
  ("Other use, please specify"); Wasserführung reads "Water flow", since its choices are low,
  normal, high and dried up; the browser test now also finds one control per section by its
  role and English name, not only the block heading. Judged not to need a change: the quoted
  "not applicable" in the hydrology message is a stored marker with no on-screen choice to
  match; the legend "Stocking (Besatzmaßnahmen)" is plural because the form's own heading is.
