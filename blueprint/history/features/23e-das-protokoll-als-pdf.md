# Feature: 23e - Das Protokoll als PDF

**From build-plan:** feature 23, sub-feature 23e
**Status:** complete, 2026-09-23

## Goal

A person who has filled in a protocol can download it as a PDF and keep it. The file lands in
their Downloads folder under a name that says what it is, it reads like the protocol they
filled in, and it carries their photographs. They can print it, file it, or send it to
somebody who will never have an account in this application.

It is **a document of our own**, not a copy of the official Acrobat form. That was decided on
2026-09-23, reversing the decision taken a day earlier, and the reasoning sits in
`blueprint/build-plan.md` under item 23. Nothing of the legacy file is reused, so the blank
form is not needed at run time and the deployment question that came with it disappears.

The backend builds the document rather than the browser printing the screen. Three reasons:
every copy then looks the same wherever it was saved from, the file arrives under a name we
chose rather than one a browser guessed, and a reviewer can pull a copy of somebody else's
protocol.

## In scope

- One endpoint answering with the finished PDF for any protocol the account may read, in any
  status, draft included.
- The document itself: a title block, the seven sections in the order the application shows
  them, every answered field with its label and its value, the six percentage blocks, and the
  catch table.
- The Kartenausschnitt and the photographs, embedded.
- A download control on the protocol page, in German, with the English key present but empty
  the way feature 17 expects.
- The labels the document needs, generated out of the frontend rather than transcribed, so the
  wording in the PDF cannot drift away from the wording on the screen.

## Out of scope

- **The Verlauf**, the record of who did what and when. The document is a copy of the
  protocol, not an audit record. The current status is printed in the title block, which is
  what somebody holding a printout needs to know. Feature 15 is where a record of changes
  belongs.
- **English.** The document is German, like the protocol. Feature 17 decides whether a second
  language is worth a second layout.
- **Attaching the PDF to an email.** Feature 14's decision to make, not ours. This feature
  leaves behind a function that returns bytes, which is all feature 14 would need.
- **23d.** The pictures the legacy Acrobat form holds as button icons are a separate feature in
  the other direction, and nothing here waits on it.
- Any change to how answers are stored, validated, or shown on screen.

## Design reference

None, deliberately. The legacy PDF is not the target any more, and the rule that it never
dictates how a screen looks applies here in reverse: the document follows the application's own
section order and the application's own labels. The read-only view in
`frontend/src/protokoll/nurlesen/ProtokollNurLesen.tsx` is what to match in **content and
order**, not in pixels. Plain and official: one column, a heading per section, label on the
left, value on the right.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so
split it.

## Build steps

- [x] **Step 1 - Die Beschriftungen aus der Oberflaeche holen.** `frontend/scripts/beschriftungen.ts`
      writes every answer path together with its German label to
      `database/seed/form_version_20260609/beschriftungen.json`, and the backend reads that
      file. The script parses the components with the TypeScript compiler, which is already a
      dependency, rather than importing them: rendering React would need a DOM environment this
      project deliberately does not have.
      Three shapes of declaration, all three deliberate in the form: written out in a component
      (`name="hydrologie.breite"` beside its `labelKey`), declared as data
      (`{ pfad, labelKey }` in `teil3/gruppen.ts` and its siblings), and a row mapped over a
      table, where the path and the label meet only through the destructured property name.
      Option labels are left alone: `optionslisten.json` already holds them.
      **The catch table is deliberately not labelled.** Its 312 `arten.artN.klasse_M` fields
      have no individual labels on screen either; the table names its columns once across the
      top, and step 3 prints it the same way.
      *Done when:* `npm run beschriftungen` produces the file, a vitest test beside the script
      fails when the committed copy is stale, and a pytest test proves every one of the 173
      answer paths outside the catch table has a label. **Done:** 174 labels, the extra being
      `bearbeiter.ort`, which the app has and the printed form does not.

- [x] **Step 2 - Das Dokument, als Text.** A new `backend/app/protokolle/ausgabe/` package with
      one function taking a protocol, its answers and the labels, and returning PDF bytes.
      ReportLab, added as a runtime dependency. Title block, then the sections in screen order,
      then each answered field as label and value. A field nobody answered is left out rather
      than printed empty, the way the read-only view leaves it out. Values are printed the way
      the application writes them, not the way the legacy form did: `12.5`, never `12,5`.
      Option values are resolved to their labels through `optionslisten.json`. No pictures, no
      tables yet.
      *Done when:* a pytest test builds a document from a made-up protocol, reads the text back
      out with pypdf, and finds the Gewaesser name, a section heading, a label and its value;
      and a field left blank does not appear anywhere in it.

- [x] **Step 3 - Die Prozentbloecke und die Fangtabelle.** The two parts needing real table
      layout. Each percentage block prints as a short table with its total. The catch table
      prints as species down the side and the ten size classes across, with row totals, the way
      the screen shows it. A protocol with no species prints the "no detection" code rather
      than an empty table.
      *Done when:* a pytest test finds a species code, a size class count and a row total in
      the extracted text, and a percentage block prints its eight shares and the total 100.

- [x] **Step 4 - Die Bilder.** The Kartenausschnitt and the photographs, read out of the
      existing `Anlagenspeicher` and placed in the document, scaled to the page width and
      captioned with the file name. The section prints the count first, so a document is honest
      about pictures it could not read. A picture whose row has outlived its file is skipped
      with a line saying so rather than failing the whole download.
      *Done when:* a pytest test with a real small PNG in a temporary store produces a document
      whose page count grows, and a document for a protocol with no attachments still builds.

- [x] **Step 5 - Der Endpunkt.** `GET /api/v1/protokolle/{protokoll_id}/pdf`, reaching the
      protocol through `hole_sichtbares_protokoll` so reviewers and Datenpfleger get the same
      answer they get everywhere else and a stranger gets the same refusal as always.
      `Content-Disposition: attachment` with a name built from the Gewaesser and the date,
      reusing the existing `_dateiname_header` helper so the escaping rules are not written
      twice.
      *Done when:* an owner gets a PDF under a sensible file name, a reviewer gets one for
      somebody else's protocol, another Einreicher gets the same 404 as for any protocol that
      is not theirs, and a test proves each of the three.

- [x] **Step 6 - Der Knopf.** A download control on the protocol page, German strings in
      `de.json` with the English keys present and empty, and a Playwright test that presses it
      and catches the file.
      *Done when:* pressing it saves a PDF, the control is reachable by keyboard and announced
      by its accessible name, and `npm run e2e` proves it.

## What building it changed

Written down because the spec was drafted before the code was read, and five things
turned out differently.

- **The generated file carries the whole outline, not only the labels.** A flat map of
  path to label cannot say which heading a field prints under or in what order, and that
  knowledge lives in the screens as much as the wording does. So
  `beschriftungen.json` also holds the sections, their blocks, the six percentage runs,
  the German status words, and the two fields the title block prints. One source for all
  of it rather than a second table hand-written on the backend.
- **The script is TypeScript run by node**, not a `.ts` compiled by something new. Node 24
  runs TypeScript directly, so the script is typed, importable by its test, and needs no
  script runner added to the project.
- **`en.json` was left alone.** The spec said to add empty English keys; the file in this
  project holds only what has actually been translated, and feature 17 fills it. Following
  the codebase rather than the spec line.
- **Pictures are shrunk before they are embedded.** An attachment may be 10 MB and a
  protocol may carry 21, so the untouched originals would mean 200 MB of memory per
  download and a file nobody could email. They are reduced to about 150 dpi across the
  page first.
- **Each percentage total prints under its own run**, not at the foot of the block. Seen on
  a screenshot: section 3's Ufer block holds three runs, and three totals stacked
  underneath all of them leaves a reader counting rows upwards.

Two more the branch review surfaced, both agreed after it:

- **An empty catch table says "Keine Arten eingetragen." rather than printing a "no
  detection" code.** Step 3 asked for the code, and the code cannot be there: the four
  no-detection codes (`OFAN`, `OFAF`, `KNKR`, `KNMU`) are stored as a species row's own
  name, so a protocol with no rows at all has no code to print. A protocol that did file
  one prints it like any other species.
- **The control sits on both heads**, the form and the filed-protocol view, rather than on
  the protocol page alone. A reviewer pulling a copy of somebody else's protocol is one of
  the three reasons the Goal gives for building this on the backend at all, so leaving it
  off the view they actually read from would have missed the point.

Two things worth knowing for the next run:

- **The browser tests need the backend container rebuilt.** The dev server proxies to the
  container, not to the working tree, so a new endpoint is a 404 until
  `docker compose up -d --build backend`. That cost the first browser run.
- **Two throwaway accounts were added** for the browser tests, `ausgabe23e@test.de` and
  `ausgabe23e-pruefer@test.de`, because the password of the documented pair is not in this
  environment. Development accounts on a throwaway database, like the ones features 11 and
  12 left behind.

## Files / areas

**New**

- `frontend/scripts/beschriftungen.ts` - the extraction script
- `database/seed/form_version_20260609/beschriftungen.json` - what it produces, committed
- `backend/app/protokolle/ausgabe/__init__.py`
- `backend/app/protokolle/ausgabe/dokument.py` - the builder
- `backend/app/protokolle/ausgabe/dokument_test.py`
- `backend/app/protokolle/ausgabe/beschriftungen.py` - loading the file above
- `frontend/src/protokoll/ausgabe/HerunterladenKnopf.tsx`
- `frontend/e2e/herunterladen.spec.ts`

**Changed**

- `backend/app/api/protokolle.py` - the new route
- `backend/pyproject.toml` - reportlab, and pillow for the pictures
- `frontend/src/i18n/locales/de.json` and `en.json`
- `frontend/src/protokoll/nurlesen/ProtokollNurLesen.tsx` or the page around it, wherever the
  control sits best

## Data / contracts

- **`beschriftungen.json` is load-bearing.** Shape: `{ "version": "20260609", "beschriftungen":
  { "<antwortpfad>": "<deutsche Beschriftung>" } }`, matching how `felder.json` and
  `optionslisten.json` are already shaped, and living beside them because a label belongs to a
  form version rather than to a screen. The Protokoll Krebs, item 21, will want the same file
  for its own version.
- **No database change.** Nothing about this feature is stored.
- **The endpoint answers with `application/pdf`** and never JSON, including when it refuses,
  which the existing error handler already arranges.

## Testing

Both gates are on: `pytest` from `backend/`, `npm test` from `frontend/`.

Logic needing a test in the same diff:

| Step | What is tested |
|---|---|
| 1 | Every answer path has a label, and the committed file matches what the script produces |
| 2 | Text, labels, option resolution, blank fields left out |
| 3 | The percentage blocks and the catch table, including the empty case |
| 4 | Pictures present, pictures absent, and a picture whose file has gone |
| 5 | Owner, reviewer and stranger each get the right answer |

Step 6 rides on the Playwright test and the build, the way `coding-standards.md` says UI steps
do. Take a screenshot of the finished document as well: a browser test will happily prove a
valid PDF that is laid out wrongly.

Manual path: open a protocol that has answers and at least one photograph, press the download
control, open the file.

## Notes for the AI

- **ReportLab, not WeasyPrint.** WeasyPrint lays out from HTML and CSS, which sounds like the
  better fit, but it needs Pango and Cairo installed as system libraries. The container could
  have them; the Windows machine this project is developed on would fight it, and the backend
  tests run on that machine. ReportLab is a pure Python wheel that behaves the same in both
  places, under a BSD licence, and its `platypus` tables are a good match for a form dump.
- **Do not transcribe the labels into the backend by hand.** The read-only view is built the
  way it is precisely because a second copy of the labels drifts the first time one changes,
  and its own comment says so. Step 1 generates them for the same reason. If the extraction
  turns out to be fragile, stop and say so rather than quietly falling back to a hand-written
  table.
- **The document prints what is there, not what should be there.** No rule runs during a
  download. A draft with half its answers missing produces a half-empty document, which is
  correct: the person asked for a copy of what they have.
- Answers come out of the `antworten` JSON document, whose shape is in
  `blueprint/context/project-overview.md`.
- Section order and which blocks appear come from the application, not the legacy form.
  Hydrology is absent for a standing water, and the document leaves the whole block out rather
  than printing empty labels.
- Reach the protocol with `hole_sichtbares_protokoll`, never `hole_protokoll`. The second is
  the writing rule and is narrower on purpose.
- Read attachment bytes through the `Anlagenspeicher` interface so the S3 store works too.
  `lies` answers `None` when the file has gone; handle that rather than assuming.
- No em dashes anywhere, the generated document included.
