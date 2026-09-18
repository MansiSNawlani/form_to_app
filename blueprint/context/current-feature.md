# Feature: Die Pruefliste, der Bildschirm

**From build-plan:** feature 12b
**Status:** built on branch feature/12b-pruefliste-bildschirm, branch-reviewed on both
axes, review findings fixed. Not yet tried in a browser.

## Goal

Give FFS staff the screen they will live on: one page listing every protocol that has
been handed in, narrowed by a filter bar, paged, and one click from the reviewer's view
of any row.

Feature 12a built the question. `GET /api/v1/pruefliste` already answers it, with four
filters, four orders and a paging envelope, and nothing in the browser asks it yet. This
sub-feature is the page on top, and the moment the review workflow stops being reachable
only by knowing a protocol's id.

It is also where the application stops having one home page for everybody. Somebody whose
job is other people's protocols lands on the queue after signing in; somebody who files
protocols still lands on their own list.

## Design reference

`prototypes/meine-protokolle.html`, in two parts, both already approved:

- **The filter bar**, lines 47 to 81: the Suche box and the Status, Jahr and Anlass
  dropdowns, with `.filters` in `prototypes/mockup.css` (lines 591 to 601). 12a's spec
  already records that those four controls belong to this screen rather than to Meine
  Protokolle, and `app/api/protokolle.py` says the same in its own docstring.
- **The table**, lines 83 onward: the two-line first cell, the tabular date column, the
  status badge, the action button at the right.

Nothing new has to be drawn. `.tabelle--liste` in `frontend/src/theme/muiTheme.ts` was
written in feature 3c specifically so this screen and feature 16's user list inherit the
table rather than rebuild it, and `frontend/src/protokoll/liste/liste.css` already carries
`.cell-title`, `.cell-sub`, `.zeile-tabular` and `.zeile-aktion`.

**No mockup exists for the pager or the order control.** Neither appears anywhere in
`prototypes/`, because the mockups were drawn before paging existed. They are built from
the same tokens and the same MUI components as everything else, and they are small: two
buttons with a "Seite 2 von 4" between them, and one more dropdown in the filter bar.

## In scope

### The page

`/pruefung`, a new route, inside the app shell and behind the session guard like every
other page but `/anmeldung`.

**No role check on the route.** The same rule `routes.tsx` already states for
`/protokolle/:id/pruefung`: the server decides who may see what, in one place, and a second
opinion in the browser could only ever be the wrong one. An account with no business here
is refused by the endpoint with 403 and the page says so in words, with a way onward.

### The filter bar

Five controls, in one row, wrapping only when the window forces it.

| Control | Shape | Sends |
|---|---|---|
| **Suche** | text box | `suche`, after a pause in typing |
| **Status** | dropdown | `status`, zero, one or two values |
| **Jahr** | dropdown | `jahr` |
| **Anlass** | dropdown | `anlass` |
| **Sortierung** | dropdown | `sortierung` |

**The Status dropdown is one control offering a compound default.** The endpoint takes
`status` repeatably, and this screen's default needs two of them at once. Rather than a
multi-select, the dropdown's first entry is **Offen**, meaning `SUBMITTED` and
`IN_REVIEW` together: the protocols nobody has decided on. The rest are **Alle** and the
six states one at a time. One dropdown, as the mockup draws it, and the default is a
visible, named choice rather than a hidden narrowing that makes the queue look like a
database missing rows.

**The Jahr dropdown offers the current year and the nine before it.** The endpoint takes a
year and offers no list of which years have protocols in them, and asking for one would be
a second endpoint for a dropdown. Ten entries covers everything this application will hold
for a decade; older protocols can only arrive through feature 23's import of the paper
backlog, and are still findable by search. Widening the range later is a one-line change.

**Anlass** reads the `anlass` list out of `optionen.ts`, the same six entries the form's own
dropdown offers, so the queue and the form cannot disagree about what an occasion is called.

**Sortierung** offers exactly the four orders `Sortierung` in
`app/protokolle/pruefliste/dienst.py` declares, labelled in German, defaulting to the
longest wait first. A dropdown rather than clickable column headings, because headings imply
both directions on every column and the endpoint offers one direction on three of them;
a control that offers an order the server has not got is a sort button that silently does
nothing.

### The filters live in the address bar

**Load-bearing, and the reason this is written down rather than left to the build.**
Every filter, the order and the page number are read from and written to the URL's query
string, through React Router's `useSearchParams`. Nothing that changes which rows appear
is held in component state alone.

Three things follow from it, and the third is why 12a made it a rule:

1. Reloading the page keeps what was being looked at.
2. A filtered queue can be sent to a colleague as a link.
3. **Feature 12d can work at all.** Vorheriges and Naechstes have to rebuild the same list
   from a URL alone, which is impossible if the list depends on what the reviewer happened
   to click earlier.

A value the URL does not carry is the default; a value it carries that this screen does not
recognise is ignored rather than sent on, because the address bar is editable by anybody.
A URL with nothing but defaults in it carries no query string at all.

### The table

Six columns. `laenge_m`, `monitoringstrecke_nr` and the filer's address travel on second
lines rather than in columns of their own, the pattern the mockup's first cell already uses.

| Column | Shows |
|---|---|
| **Gewaesser und Probestrecke** | the water, then `Ortsangabe · 120 m · MST 12345` beneath |
| **Datum** | the day of the Befischung, tabular |
| **Anlass** | the label, not the stored code |
| **Bearbeiter** | who carried out the survey |
| **Status** | `Statusabzeichen`, the badge feature 11e already shares |
| (action) | **Pruefen**, to `/protokolle/:id/pruefung` |

and **Eingereicht**, the day it was handed in with the filing account's address beneath it,
between Status and the action.

**`regierungspraesidium` is deliberately not a column**, although every row carries it. It
is four long labels ("Regierungspraesidium Tuebingen"), nobody filters on it, and the
account for which it decides anything is the regional one, which is feature 13. Printing it
here would cost a column's width for a value no reader of this screen acts on.

### The four states

- **Loading.** The first load says so in a live region, the way `ProtokolleSeite` does. A
  refetch over rows already on screen does not replace them with a loading message.
- **Nothing at all.** No protocol has ever been handed in. A sentence saying so, and no
  suggestion to reset filters that are not set.
- **Nothing matching.** Rows exist but not these filters. A different sentence, and a
  **Filter zuruecksetzen** button, because the way out is to widen the filters and the
  person may not remember which one they narrowed.
- **It failed.** The same shape as `liste/Ladefehler.tsx`: what went wrong and a retry,
  and only when there are no rows to show instead.

Plus the one this screen has that no other list has:

- **This page is not for this account.** A `ROLLE_FEHLT` refusal is not an error to retry.
  It names what the page is, says it is for FFS staff, and links to Meine Protokolle. A
  message with no way out is the failure `error-messages-must-give-a-way-out` records.

### Where people land, and how they get back

- **After signing in**, an account holding any of `REVIEWER`, `DATA_STEWARD` or
  `SUPER_ADMIN` goes to `/pruefung`. Everybody else goes to `/`, as now. A sign-in that
  carried a `weiter` target still honours it: somebody who followed a link to a protocol
  arrives at that protocol.

  One consequence, and it is the right one. `auth/weiter.ts` deliberately leaves the
  parameter off for the home page, so a reviewer whose session ran out while on Meine
  Protokolle comes back to the Pruefliste rather than to Meine Protokolle. The parameter
  means "this particular page", the home page is not a particular page, and where an account
  starts is what this step is deciding.
- **The header gains navigation**, because "a reviewer's own protocols stay one click away"
  needs a link to click. Two entries, on one line beside the brand: **Meine Protokolle**
  always, and **Pruefliste** only for the three FFS roles. The current page is marked as
  such.

## Out of scope

- **Searching by species**, and the species picker in the filter bar. Feature 12c, with the
  JSONB index that keeps it fast. The filter bar is built so a sixth control is an addition
  rather than a rebuild.
- **Vorheriges, Naechstes and the Pruefliste crumb** on the reviewer's screen. Feature 12d,
  which `pruefung/Kopfzeile.tsx` already carries a note about. This feature makes them
  possible by putting the whole list state in the URL, and builds none of them.
- **Any change to the endpoint.** Nothing in `backend/` is touched. If a step appears to
  need a backend change, that is a thing to raise rather than to build.
- **Any change to Meine Protokolle, its endpoint or its components.** The two lists answer
  two questions and stay two screens. `ProtokollTabelle` is not widened to serve both; the
  shared thing is the table's look in `muiTheme.ts`, which is already shared.
- **Filtering by Bearbeiter, by the filing account or by Regierungspraesidium.** All three
  arrive on every row and none is a filter. The endpoint offers no parameter for them, and
  inventing filters is how a filter bar becomes unusable.
- **Regional scoping.** A `REGIERUNGSPRAESIDIUM` account is refused by the endpoint and sees
  the refusal state. Feature 13 gives it its own view.
- **Bulk actions**, selecting several rows, or deciding on a protocol from the list. A
  decision is made on the protocol's own screen, which feature 11f built.
- **Remembering a reviewer's last filters between sessions.** The URL carries them, which is
  enough, and storing them would mean the same link showing two people two different lists.
- **A "rows per page" control.** The endpoint takes `pro_seite` and this screen never sends
  it, so every page is the default 25. One fewer control on a bar that gains a species picker
  in 12c, and nobody has asked to see 100 protocols at once.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Step 1 has nothing to look at, and it is first because every step after it is built on its
answers. From step 2 onward every step is something to open at
http://localhost:5173/pruefung, signed in as a reviewer.

- [x] **Step 1 - What the address bar says the queue is** - one module,
      `frontend/src/protokoll/pruefliste/parameter.ts`, over plain values, with no React and
      no fetch in it. It reads a `URLSearchParams` into a typed `Prueflistenabfrage` (the
      status selection, Anlass, Jahr, Suche, the order, the page), writes one back out
      leaving every default unwritten, ignores a value it does not recognise instead of
      passing it on, and resets the page to 1 whenever a filter or the order changes.
      *Done when:* `npm test` from `frontend/` covers an empty query string meaning the
      **Offen** status pair; `status=alle` meaning no `status` parameter at all;
      `status=BANANE` and `sortierung=rueckwaerts` both ignored rather than sent on;
      `seite=0` and `seite=-3` landing on 1; changing the Anlass while on page 4 producing a
      query string with no `seite` in it; and an all-default selection serialising to the
      empty string. `npm run lint` and `npm run build` pass.

- [x] **Step 2 - The request, and a page that proves it arrives** - `pruefliste/typen.ts`
      mirroring `PruefzeileAntwort` and `PrueflisteAntwort` field for field,
      `pruefliste/api.ts` with the one call, `pruefliste/abfragen.ts` with the query options
      keyed by the whole parameter set, `PrueflisteSeite.tsx` with the heading and the total,
      and the `/pruefung` route. No filter bar and no table yet.
      The retry rule comes with the query rather than after it: a refusal for the wrong role
      is a settled answer, and retrying it twice only makes the refusal slower to appear.
      *Done when:* signed in as a Reviewer, `/pruefung` prints "Pruefliste" and a true count
      of the handed-in protocols, which is `gesamt` and not the number of rows on this page;
      the network tab shows exactly one request, carrying `status=SUBMITTED&status=IN_REVIEW`;
      a second protocol handed in and the page reloaded shows the count go up; `npm test`
      covers a `ROLLE_FEHLT` failure not being retried and a dropped request being retried;
      `npm run build` passes.

- [x] **Step 3 - The table** - `PrueflistenTabelle.tsx` and `PrueflistenZeile.tsx` on
      `.tabelle--liste`, plus the display helpers in `pruefliste/anzeige.ts` and their test:
      the first cell's second line, and the Eingereicht cell's two lines. The action links to
      `/protokolle/:id/pruefung`.
      *Done when:* `npm test` covers the sub-line joining Ortsangabe, length and
      Monitoringstrecken-Nr. with the separator appearing only between two things that are
      both there, and a row with no Monitoringstrecken-Nr. printing no empty "MST"; a
      screenshot shows the six columns in light and in dark; Tab reaches every Pruefen button
      in row order; clicking one opens that protocol's review screen.

- [x] **Step 4 - The filter bar** - `Filterleiste.tsx` with Suche, Status, Jahr and Anlass,
      reading and writing the address bar through step 1's module. Typing waits for a pause
      before it changes the address, and replaces the history entry rather than pushing one,
      so Back does not walk backwards through every keystroke.
      *Done when:* each of the four narrows the list and the address bar shows why; a reload
      comes back to the same filtered list; the Back button steps between filter changes, not
      between letters; every control has a visible label above it and is reachable and
      operable by keyboard; a search for `50%` returns what matches `50%` rather than
      everything.

- [x] **Step 5 - The order and the pager** - the Sortierung dropdown as the filter bar's
      fifth control, and `Pager.tsx` beneath the table: Zurueck, "Seite 2 von 4", Weiter, and
      the total. Both ends disabled where there is nowhere to go.
      *Done when:* each of the four orders visibly reorders the rows and the address bar names
      the order; Weiter shows the next 25 and the address bar says `seite=2`; changing a filter
      from page 3 returns to page 1 rather than to an empty page; a list of 25 or fewer shows
      "Seite 1 von 1" with both buttons disabled; `seite=99` typed into the address bar shows
      the pager with a working Zurueck rather than a dead end, which is what 12a's endpoint
      answering an empty page with the true total exists to allow; the pager is announced to a
      screen reader as navigation rather than as two unlabelled buttons.

- [x] **Step 6 - The four states, and the refused account** - first load, nothing at all,
      nothing matching these filters with a **Filter zuruecksetzen** button, a failure with a
      retry, and the `ROLLE_FEHLT` state naming the page, saying it is for FFS staff, and
      linking to Meine Protokolle.
      An empty page past the end is **not** one of these five. It has rows behind it and a
      pager that can go back, so it keeps the pager rather than being told nothing matched.
      *Done when:* each of the five is reachable and was seen: the queue with the backend
      stopped shows the failure and recovers on retry once it is back; a filter matching
      nothing offers the reset and the reset restores the full list; signing in as a plain
      Submitter and opening `/pruefung` by hand shows the refusal with a working link to
      Meine Protokolle and no retry button; a refetch while rows are on screen leaves the rows
      there; and `seite=99` shows neither an empty state nor an error.

- [x] **Step 7 - Where FFS staff land, and how to get back** - `auth/startseite.ts` with its
      test, one plain function from a list of roles to a path; `AnmeldungSeite` using it where
      it now defaults to `/`; and the header's navigation, two links on one line, the
      Pruefliste only for the three FFS roles, the current one marked.
      *Done when:* `npm test` covers a Reviewer, a Data Steward and a Super Admin each landing
      on `/pruefung`, a plain Submitter and a Regierungspraesidium account each landing on
      `/`, an account holding both a submitting and a reviewing role landing on `/pruefung`,
      and an explicit `weiter` target beating all of it; signing in as each of the two kinds
      lands where it should; the header shows one link for a Submitter and two for a Reviewer,
      on one line at a full-width window; `npm test`, `npm run lint` and `npm run build` all
      pass from `frontend/`, and `pytest`, `ruff check .` and `mypy .` still pass from
      `backend/`, which they must, since nothing there changed.

## Files / areas

**New, under `frontend/src/protokoll/pruefliste/`**

- `typen.ts` - `Pruefzeile` and `Prueflistenseite`, mirroring the backend schemas.
- `parameter.ts` and `parameter.test.ts` - the URL, read and written.
- `anzeige.ts` and `anzeige.test.ts` - what a row prints.
- `api.ts` - the one call.
- `abfragen.ts` and `abfragen.test.ts` - the query options, the cache key and the retry rule.
- `PrueflisteSeite.tsx` - the page.
- `Filterleiste.tsx` - the five controls.
- `PrueflistenTabelle.tsx`, `PrueflistenZeile.tsx` - the table.
- `Pager.tsx` - paging.
- `LeererZustand.tsx` - nothing to show, and which of the two reasons it is.
- `Ladefehler.tsx` - the fetch failed, with a retry.
- `KeineBerechtigung.tsx` - the refused-account state.
- `pruefliste.css` - only what the mockup's `.filters` and the pager need.

**New, under `frontend/src/auth/`**

- `startseite.ts` and `startseite.test.ts` - roles to a landing path.

**Changed**

- `frontend/src/routes.tsx` - the `/pruefung` route.
- `frontend/src/auth/AnmeldungSeite.tsx` - the landing path, where it now hardcodes `/`.
- `frontend/src/components/SiteHeader.tsx` and `components/shell.css` - the navigation.
- `frontend/src/api/fehler.ts` - one export, `ROLLE_FEHLT`. The backend has published it
  since feature 2b and that file's own comment already says features 11 and 16 would branch
  on it; this screen is the first that does, so it gets its constant on the rule that file
  states, the same way the attachment refusals deliberately have none.
- `frontend/src/i18n/locales/de.json` - a `pruefliste` block, and the two nav labels.

**Read, not changed**

- `frontend/src/theme/muiTheme.ts` - `.tabelle--liste` is inherited by adding the class.
- `frontend/src/protokoll/liste/liste.css` - `.cell-title`, `.cell-sub`, `.zeile-tabular`,
  `.zeile-aktion`, already the mockup's.
- `frontend/src/protokoll/Statusabzeichen.tsx` and `liste/anzeige.ts` - the badge, the date
  formatting and `anlassLabel`, imported rather than restated.
- `frontend/src/api/client.ts`, `api/fehler.ts`, `auth/useSitzung.ts`.
- `backend/` - nothing at all.

## Data / contracts

**Nothing new is invented. This is 12a's contract, in TypeScript.**

`Pruefzeile` mirrors `PruefzeileAntwort` in `backend/app/api/schemas.py` field for field and
in the same names: `id`, `status`, `form_version`, `datum`, `anlass`, `bearbeiter_name`,
`submitted_at`, `updated_at`, `eingereicht_von`, `gewaessername`, `ortsangabe`, `laenge_m`,
`monitoringstrecke_nr`, `regierungspraesidium`. Only `monitoringstrecke_nr` is nullable.
`laenge_m` is a number here, where Meine Protokolle's `Uebersicht` carries a string, because
one comes from a typed column and the other from the answers document.

`Prueflistenseite` mirrors `PrueflisteAntwort`: `zeilen`, `gesamt`, `seite`, `pro_seite`,
`seiten`.

**`Prueflistenabfrage`, this screen's own shape and the one new contract here.** What the
address bar holds, as values: the status selection (`offen`, `alle`, or one state), `anlass`,
`jahr`, `suche`, `sortierung`, `seite`. It is what step 1 reads and writes, what the query
key is built from, and what feature 12d will rebuild from a protocol's URL. Its serialised
form, the query string, is the part that is load-bearing, because a link somebody sent last
week has to still mean the same list.

**The query key is the whole selection**, so two different filter settings are two cache
entries and going back to a previous one shows it immediately rather than refetching.
Deliberately unlike `protokolleKey()`, which is one entry because that list takes no
parameters.

**No schema change, no migration, no new endpoint.**

## Testing

`npm test` from `frontend/`, which is vitest in a node environment over `src/**/*.test.ts`.
There is no DOM and no component testing, exactly as `coding-standards.md` sets it out:
components and integration surfaces are verified with browser evidence and the build.

**Gets a test** (logic where a wrong answer is possible):

- `parameter.ts` - every reading and writing of the address bar, the ignoring of values it
  does not recognise, the clamping of the page, and the reset to page 1 on a filter change.
- `anzeige.ts` - the first cell's second line and the Eingereicht cell's two lines, including
  every combination where a part is missing.
- `startseite.ts` - each role, the combination, and the explicit `weiter` target winning.
- `abfragen.ts` - which failures are worth trying again. A role refusal is settled and a
  dropped request is not, and getting it the wrong way round either makes a refusal slow to
  appear or gives up on a request that would have worked.

**Does not get a unit test:** `PrueflisteSeite`, `Filterleiste`, the table, the pager and the
header navigation. Browser evidence and `npm run build`, per step.

**Needs a real backend with real rows.** The queue lists protocols that have been handed in,
so trying this needs at least a handful in various states, filed by more than one account.
`befischung benutzer anlegen` makes the accounts; the protocols are made by filling in and
submitting the form, which is slow, and which is exactly the shortage feature 23's PDF
import exists to end. Two or three by hand is enough to see every state on this screen.

**The permission case is the endpoint's, and it is already tested.**
`backend/app/api/pruefliste_test.py` proves each of the three FFS roles admitted and a
Submitter and a Regierungspraesidium account refused. What is new here is only what the
browser shows when that refusal arrives, which is a screen and rides on browser evidence.

## Notes for the AI

- **The address bar is the state.** No `useState` holding a filter, an order or a page. The
  one exception is the search box's own text while it is being typed, which is local until
  the pause, and that is a typing convenience rather than list state.
- **A value out of the URL is untrusted input**, the same rule `auth/weiter.ts` already
  states and tests. Anything unrecognised becomes the default rather than being passed to the
  endpoint, which would answer 422 and make a hand-edited address look like a broken page.
- **Use MUI wherever MUI has a component.** `Select` in a `FormControl` with a `FormLabel`
  above it, never `InputLabel` and its notch; `Table`, `TableRow`, `TableCell`;
  `Pagination` is MUI X and is not available, so the pager is two `Button`s and a
  `Typography`, which is what its three elements need anyway.
- **Inherit the table, do not restyle it.** Add `tabelle--liste` and the look arrives.
  Anything genuinely new to this screen is themed in `muiTheme.ts` under `components` if more
  than one place will ever draw it, and only otherwise in `pruefliste.css`.
- **Do not widen `Uebersicht`, `ProtokollTabelle` or `ProtokollZeile`.** Two lists, two
  shapes, and 12a's schema docstring gives the reason.
- **Reuse `Statusabzeichen`, `datumAnzeige`, `zeitpunktAnzeige` and `anlassLabel`.** A second
  way to print a status or a date is a second way for two screens to disagree.
- **Every error state says what to do next**, naming the thing and giving a way onward. A
  refusal for the wrong role gets a link, not a retry button.
- **Accessibility is an acceptance criterion, not a pass afterwards:** a label above every
  control, the loading message in a live region, the pager in a `nav` with a name, the
  current page marked in the header, visible focus, and both themes checked.
- **The filter bar stays on one line** while the window has room, and grows in height only
  when it genuinely must.
- **German domain terms, German routes, no em dashes** anywhere, comments included.
- **Comment the why, not the what.** Three comments are genuinely owed here: why the list
  state is in the URL rather than in the component, why the Status dropdown's default is a
  compound rather than a hidden narrowing, and why the page carries no role check of its own.
