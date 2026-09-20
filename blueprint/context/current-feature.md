# Feature: Durch die Liste blaettern

**From build-plan:** feature 12d
**Status:** specced, not started

## Goal

Give a reviewer a way through the queue instead of a way into one protocol at a time.
Today the only route to `/protokolle/:id/pruefung` is a Pruefen button, and the only
route back is the browser's own Back. After this, the reviewer's screen carries the
crumb back to the Pruefliste and the Vorheriges and Naechstes buttons the mockup has
always drawn, and all three remember which list the reader came out of: the same
filters, the same species, the same order, the same page.

This is what makes the review workflow a workflow. A reviewer decides on a protocol and
moves to the next one without going back to the list, finding their place and hunting for
the row they have not done yet.

It is also the last piece of feature 12. 12a built the question, 12b the screen, 12c the
species filter, and 11e and 11f deliberately left this out with a note in
`pruefung/Kopfzeile.tsx` saying why.

## Design reference

`prototypes/pruefung-protokoll.html`, lines 37 to 49, already approved and already built
around. Two parts, both in the page head:

- **The crumb**, in `page__sub`: `Pruefliste > Protokoll vom 09.07.2026 - Formularversion
  20260609`. The right-hand half of that line is exactly what `Kopfzeile.tsx` prints
  today. Only the link and the separator in front of it are new.
- **Vorheriges and Naechstes**, in `page__head-actions`, beside the status badge, as two
  small outlined buttons. `.btn.btn--sm` in `prototypes/mockup.css` is the small MUI
  `Button` with `variant="outlined"` that the same head already uses for Alle Protokolle.

Nothing new has to be drawn, and no new mockup is needed.

## The decision this feature turns on

**The server answers "which protocol comes before and after this one", and the browser
does not work it out from the list it happens to be holding.**

The alternative was to reuse the page of the queue the reviewer already fetched, find the
current row in it and take its neighbours. It is tempting because that page is already in
the cache. It is rejected for three reasons:

1. **Page boundaries.** The protocol on row 25 of page 1 has its Naechstes on page 2,
   which the browser has not got, so the simple version quietly has no next protocol on
   every twenty-fifth row.
2. **Two definitions of an order.** `Sortierung` and its tie-break live in
   `app/protokolle/pruefliste/dienst.py`. Deriving "the one after this" from an array
   index is a second definition of the same thing, free to drift from the first.
3. **The rows move.** The cached page is refetched on mount, and a decision changes a
   status, so the row the arithmetic counted from can be gone by the time it is counted.

One endpoint, taking exactly the parameters the list takes, answers all three at once and
is correct wherever in the list the protocol sits.

### Frozen when the protocol is opened

**The neighbours are worked out once, on arrival, and do not move while the reviewer is on
the screen.** The query is never refetched and a decision does not invalidate it.

This is the case the whole feature exists for. The queue's default is Offen, meaning
SUBMITTED and IN_REVIEW. A reviewer opens the fourth protocol in that list, reads it,
presses Annehmen, and it becomes LOCKED, which is not Offen: the protocol has just left
the list it was in. If the neighbours were re-asked at that moment there would be no
anchor left to ask from, and Naechstes would go dead at exactly the moment it is wanted.
Frozen, it still goes where it was always going to go, which is the protocol that was
fifth when the reader arrived.

## In scope

### The endpoint

`GET /api/v1/pruefliste/nachbarn/{protokoll_id}`, on the existing Pruefliste router,
behind the same three FFS roles as the list.

**It takes the list's own parameters and no others**: `status` (repeatable), `anlass`,
`jahr`, `suche`, `art`, `sortierung` and `pro_seite`. `seite` is deliberately absent:
which page the reader is on says nothing about who stands next to this protocol. That this
is the same parameter set is the whole claim the feature rests on, so it is the same set,
read the same way, handed to the same `Prueffilter` and the same `Sortierung`.

It answers, for the protocol named in the path:

| Field | Means |
|---|---|
| `position` | Its place in the filtered, ordered list, counted from 1. `null` when it is not in that list at all |
| `seite` | Which page of the queue that position falls on. `null` for the same reason |
| `gesamt` | How many protocols the list holds, the same number the list's own `gesamt` gives |
| `vorheriges` | The protocol before it, or `null` at the front |
| `naechstes` | The protocol after it, or `null` at the end |

Each neighbour is an id, the page it sits on, and its `gewaessername`, which is there so
the button can say what it opens rather than announcing "Vorheriges" twice with no
context.

**A protocol that is not in the list is answered, not refused.** `position` is `null` and
both neighbours are `null`. That is the ordinary case of a REJECTED protocol opened from a
link whose filters say Offen, and of an id that does not exist at all. A 404 would make
the screen handle an error for something that is not one.

### The Pruefen link carries the queue

`PrueflistenZeile`'s button links to `/protokolle/<id>/pruefung?<the queue's own query
string>`, built by the same `alsSuchparameter` that writes the address bar, so the two
cannot spell the same list two ways. An unfiltered page-one queue writes no query string
at all, which is the same nothing a pasted link carries, and that is correct: the plain
queue is a real list.

### The crumb

In `page__sub`, in front of what is already there: **Pruefliste**, linking to `/pruefung`
with the carried query string, then the separator, then today's date and form version.

### Vorheriges and Naechstes

Two buttons beside the status badge.

- Each goes to the neighbour's own reviewer screen, carrying the same query string
  forward, with `seite` set to the page that neighbour sits on. Walking from row 25 to row
  26 therefore moves the carried page from 1 to 2, and the crumb keeps pointing at the
  page the reader is actually in.
- At the front of the list Vorheriges is **disabled**, and at the end Naechstes is. Both
  are drawn, as the mockup draws them, because a button that vanishes at the edges makes
  the head jump about as the reader walks.
- Ordinary navigation, pushing history, so Back steps back through the protocols read.

### When the navigation is drawn at all

**Only for an account that sees the Pruefliste link in the header**, decided by the same
`darfPruefen` in `auth/startseite.ts` that the header uses, and never a permission. A
submitter reading back their own filed protocol on this same screen keeps today's Alle
Protokolle button and gets no crumb and no neighbours: the queue is not their list, and
the endpoint would refuse them anyway. This saves a guaranteed refusal rather than
deciding anything.

**And only the buttons need the protocol to be in the list.** When `position` is `null`
there is nothing to step to, so no buttons are drawn, while the crumb stays: the list is
still a place to go back to.

## Out of scope

- **Any change to what the queue shows or how it filters.** `liste_pruefliste`, the
  filters, the orders, the species query and the index are all finished. This feature adds
  a second reader of `Prueffilter` and changes nothing it reads.
- **"Protokoll 7 von 42" anywhere on the screen.** `position` and `gesamt` are in the
  answer because the page numbers are computed from them, not because this feature prints
  a counter. The mockup has none, and inventing one is scope.
- **A decision moving the reader on by itself.** Annehmen does not jump to the next
  protocol. That is a real idea and a separate one, and a screen that navigates away from
  a decision on its own takes away the moment to see that it worked.
- **Remembering the queue anywhere but the address bar.** No storage, no context, no
  server-side "where was I". The URL carries it, which is what 12b built it to do.
- **Prev and next on Meine Protokolle.** That list has no reviewer screen to walk and no
  filters to carry. Nothing about `protokoll/liste/` changes.
- **Keyboard shortcuts** for the two buttons. Tab and Enter reach them like everything
  else; a J and a K would be a new convention with nobody asking for it.
- **Anything about feature 13's regional view.** A REGIERUNGSPRAESIDIUM account is not FFS
  staff, gets no navigation, and is refused by the endpoint, exactly as it is by the list.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Steps 1 and 2 are the backend and have nothing to look at but a test run and the API
docs. From step 3 onward every step is something to open in the browser.

- [ ] **Step 1 - Who stands before and after** - `nachbarn()` in
      `backend/app/protokolle/pruefliste/dienst.py`, beside `liste_pruefliste` and sharing
      its `_eingereichte`, `_bedingungen` and `_ORDNUNGEN` rather than restating any of
      them, plus the `Nachbar` and `Nachbarschaft` dataclasses. One statement: a CTE
      numbering the filtered, ordered rows with `ROW_NUMBER()` and counting them with
      `COUNT(*) OVER ()`, then the three rows whose number is within one of this
      protocol's. `seite_von_position()` joins `begrenze_seite` and friends in
      `parameter.py`, because which page a position falls on is paging arithmetic and that
      is where the rest of it lives.
      *Done when:* `pytest` from `backend/` covers a protocol in the middle of the list
      getting both neighbours; the first getting only a next; the last getting only a
      previous; a list of one getting neither; a protocol excluded by the filters and an id
      that does not exist both answering `position=None` with no neighbours; the filters
      and the species filter narrowing who the neighbours are; each of the four orders
      giving a different neighbour; two protocols sharing a `submitted_at` still ordering
      by the id tie-break the list uses; and the page number matching the page the same row
      appears on in `liste_pruefliste`. `ruff check .` and `mypy .` are clean.

- [ ] **Step 2 - The endpoint** - `GET /api/v1/pruefliste/nachbarn/{protokoll_id}` on the
      existing router, with `NachbarAntwort` and `NachbarschaftAntwort` in
      `app/api/schemas.py`. The query parameters are the list's, copied in the sense of
      taking the same types, the same bounds and the same descriptions, minus `seite`. The
      checked-in `openapi.json` is regenerated.
      *Done when:* `pytest` covers each of the three FFS roles admitted and a Submitter and
      a REGIERUNGSPRAESIDIUM account refused with 403; a request with no filters agreeing
      with the unfiltered list; the same filters given to both endpoints agreeing about who
      is next; `status=DRAFT` refused with 422 the way the list refuses it; and an unknown
      id answering 200 with nulls rather than 404. The endpoint is visible and callable in
      the API docs at http://localhost:8000/api/v1/docs.

- [ ] **Step 3 - The queue rides along in the link** - `pruefliste/pfad.ts`, two plain
      functions with their test: `prueflistenPfad(abfrage)` and `pruefungsPfad(id,
      abfrage)`, both built on `alsSuchparameter` so there is one spelling of a queue in a
      URL. `PrueflistenZeile` uses the second for its Pruefen button.
      *Done when:* `npm test` from `frontend/` covers an all-default selection producing a
      path with no query string at all, a filtered and ordered selection on page 3
      producing one that `abfrageAus` reads back as the same selection, and the species
      filter surviving the round trip; opening a filtered queue and pressing Pruefen lands
      on the protocol with the filters in the address bar; the address of a Pruefen button
      on an unfiltered queue is unchanged from today. `npm run lint` and `npm run build`
      pass.

- [ ] **Step 4 - The crumb** - `Kopfzeile.tsx` draws **Pruefliste** in front of the date in
      `page__sub` for an FFS account, linking back through `prueflistenPfad`, and drops the
      Alle Protokolle button for that account. A submitter's view of the same screen is
      untouched.
      *Done when:* signed in as a Reviewer, a protocol opened from a filtered queue on page
      2 shows the crumb, and the crumb returns to that same filtered page 2; signed in as a
      Submitter, the same screen on their own protocol shows Alle Protokolle and no crumb;
      the crumb reads as a link to a screen reader and is reachable by keyboard; a
      screenshot of the page head in light and in dark matches the mockup's line.

- [ ] **Step 5 - Vorheriges and Naechstes** - `pruefung/Listennavigation.tsx` with the two
      buttons, `holeNachbarn` in `pruefung/api.ts`, `nachbarnAbfrage` in
      `pruefung/abfragen.ts` pinned with `staleTime: Infinity` and reusing the queue's own
      `sollWiederholen`, the types in `pruefung/typen.ts`, and the German strings.
      *Done when:* walking a queue of at least four protocols forward and back lands on the
      right one each time and the browser's Back steps back through them; the first
      protocol's Vorheriges and the last one's Naechstes are disabled rather than missing;
      crossing from row 25 to row 26 changes the carried page to 2 and the crumb then
      returns to page 2; a protocol whose filters exclude it, reached by editing the
      address, shows the crumb and no buttons; each button announces which water it opens;
      pressing Annehmen and then Naechstes still moves to the protocol that was next on
      arrival; and a Playwright test in `frontend/e2e/pruefliste.spec.ts` walks the queue by
      role and name. `npm test`, `npm run lint`, `npm run build` and `npm run e2e` pass from
      `frontend/`, and `pytest`, `ruff check .` and `mypy .` still pass from `backend/`.

## Files / areas

**Backend, changed**

- `app/protokolle/pruefliste/dienst.py` - `nachbarn()`, `Nachbar`, `Nachbarschaft`. In this
  file rather than a module of its own precisely so it shares `_eingereichte`,
  `_bedingungen` and `_ORDNUNGEN` by reference. Splitting it out would mean either
  un-privatising three helpers across a module boundary or copying them, and a copy of a
  filter list is how "the same list" stops being true.
- `app/protokolle/pruefliste/parameter.py` - `seite_von_position()`.
- `app/protokolle/pruefliste/dienst_test.py`, `parameter_test.py` - the new cases.
- `app/api/pruefliste.py` - the route.
- `app/api/schemas.py` - `NachbarAntwort`, `NachbarschaftAntwort`.
- `app/api/pruefliste_test.py` - the role cases and the agreement with the list.
- `backend/openapi.json` - regenerated.

**Frontend, new**

- `src/protokoll/pruefliste/pfad.ts`, `pfad.test.ts` - a queue as a URL, in one place.
- `src/protokoll/pruefung/Listennavigation.tsx` - the two buttons and their query.

**Frontend, changed**

- `src/protokoll/pruefliste/PrueflistenZeile.tsx` - the Pruefen link carries the queue.
- `src/protokoll/pruefung/Kopfzeile.tsx` - the crumb, the two buttons, and Alle Protokolle
  only where there is no queue behind the reader.
- `src/protokoll/pruefung/api.ts`, `abfragen.ts`, `typen.ts` - the one new call.
- `src/i18n/locales/de.json` - `protokoll.pruefung.pruefliste`, `.vorheriges`,
  `.naechstes`, and the hidden name each button carries.
- `frontend/e2e/pruefliste.spec.ts` - walking the queue.

**Read, not changed**

- `src/protokoll/pruefliste/parameter.ts` - `abfrageAus` and `alsSuchparameter` are used as
  they are. Nothing about the selection changes.
- `src/auth/startseite.ts` - `darfPruefen`, imported rather than restated.
- `src/protokoll/pruefung/useUebergang.ts` - deliberately untouched. A decision must not
  invalidate the neighbours; see the frozen rule above.

## Data / contracts

**One new response shape, and it is load-bearing for nothing after it.** Feature 13 will
narrow the queue by region, and when it does this endpoint inherits that narrowing through
`Prueffilter` without its shape changing.

```
NachbarschaftAntwort
  position     int | null    place in the filtered list, from 1. null: not in it
  seite        int | null    which page that position falls on
  gesamt       int           protocols the filtered list holds
  vorheriges   NachbarAntwort | null
  naechstes    NachbarAntwort | null

NachbarAntwort
  id             uuid
  seite          int         the page that neighbour sits on
  gewaessername  str         so the button can say what it opens
```

**No new query-string contract.** The reviewer screen reads the queue with the same
`abfrageAus` the queue writes with `alsSuchparameter`, and an unrecognised value is already
ignored rather than passed on. A link somebody sent last week keeps meaning the same list.

**No schema change and no migration.** `ix_submissions_artcodes` and the existing columns
are all this reads.

## Testing

`pytest` from `backend/` and `npm test` from `frontend/`, both already gates.

**Gets a test** (logic where a wrong answer is possible):

- `nachbarn()` - every position in a list, absence from it, each order, the tie-break, and
  the filters narrowing who is adjacent. This is the feature; almost all of its risk is
  here.
- `seite_von_position()` - the boundaries, which is where an off-by-one sends a reader to
  the wrong page. Position 25 with 25 to a page is page 1, position 26 is page 2.
- `pfad.ts` - a selection to a URL and back, including the empty one.
- The endpoint's role refusals, and that it and the list agree about the same protocol.

**Does not get a unit test:** `Kopfzeile`, `Listennavigation` and the changed row. Browser
evidence, a screenshot of the page head in both themes, and `npm run build`, per step.

**Browser evidence, and it needs real rows.** Walking a queue needs at least four handed-in
protocols, and testing the page boundary needs twenty-six, which is more than anybody will
type by hand; the boundary is covered by the backend test and by setting `pro_seite` low by
hand in the address bar for one look. The Playwright suite already has the two accounts and
its skip message; this adds to `pruefliste.spec.ts` rather than a new file, because it is
the same queue.

## Notes for the AI

- **The list and its neighbours must be the same list.** Both go through `_eingereichte`
  and `_ORDNUNGEN`. If a step finds itself writing a second WHERE clause or a second ORDER
  BY, that is the mistake this feature is built to avoid.
- **One statement, not three.** The count, the position and the two neighbours come out of
  one CTE. Three round trips could disagree with each other about a list that changed
  between them.
- **The tie-break is part of the order.** `Submission.id.asc()` is appended to every
  ordering in the list, and a neighbour query without it would put two protocols filed in
  the same transaction in a different order from the list they came from.
- **`staleTime: Infinity` on the neighbours query, and `useUebergang.ts` is not touched.**
  The frozen rule is the feature, not an optimisation.
- **The address bar is still the state.** No `useState` holding a filter or a page on the
  reviewer screen either. It reads the URL and writes the next one.
- **A value out of the URL is untrusted input.** `abfrageAus` already handles that; do not
  add a second reading of the query string that skips it.
- **Use MUI wherever MUI has a component.** Two `Button`s with `size="small"` and
  `variant="outlined"`, the same as Alle Protokolle. The crumb is a router `Link` in the
  existing paragraph, not a `Breadcrumbs` component: the mockup's line is a link, a
  separator and text, and one MUI component drawing a one-item trail would need to be
  themed back down into the line that is already there.
- **Accessibility is an acceptance criterion:** each button names the water it opens with
  the `visually-hidden` span the Pruefen buttons already use, a disabled button stays
  announced rather than silently absent, the crumb is a link and reads as one, and both
  themes are looked at.
- **Every message says what to do next.** There is only one new failure here, the
  neighbours call failing, and the honest answer is to draw no buttons rather than an error
  banner over a protocol that is perfectly readable. The crumb still offers the way back.
- **German domain terms, German routes, no em dashes** anywhere, comments included.
- **Comment the why, not the what.** Three comments are owed: why the server answers who is
  next rather than the browser counting rows, why the neighbours are frozen on arrival, and
  why the endpoint answers a protocol outside the list with nulls instead of 404.
