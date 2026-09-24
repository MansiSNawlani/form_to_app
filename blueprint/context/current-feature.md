# Feature: Die Benutzerliste

**From build-plan:** feature 16b
**Status:** built. Unit tests, browser tests and screenshots in both themes all pass.

## Goal

Give a Super Admin a screen that answers "who has an account here, and what can they do".

Feature 16a built the endpoints. Nothing reads them yet, so today the only way to see the
account list is `befischung benutzer liste` in a terminal on the machine the database runs
on. This sub-feature is the first half of removing that: the list, the search box, and the
way into it from the header. Creating an account is 16c and changing one is 16d, so nothing
here writes anything.

It is also the screen the next two hang off. 16c's "Neues Konto" button and 16d's row
action both land on this page, so the table, the states and the refusal built here are what
those two extend rather than rebuild.

## Design reference

[`prototypes/meine-protokolle.html`](../../prototypes/meine-protokolle.html), the approved
list mockup. There is no mockup for this screen specifically, and it does not need one: it
is the third list in the application and the look is already built. `tabelle--liste` in
`frontend/src/theme/muiTheme.ts` was themed from that mockup in feature 3c, and
`page__head`, `card` and `empty` carry the page around it.

`PrueflisteSeite` is the working model to follow, not a thing to import from.

## Who may see it

`SUPER_ADMIN`, and nobody else, because that is who 16a's endpoints admit.

**The route carries no role check**, the same rule `routes.tsx` already states for the
reviewer's page and the queue: the server decides, in one place, and a second opinion in the
browser could only ever be the wrong one. An account that types the address is refused by
the endpoint and the page turns that refusal into words with a way onward.

**The header link is drawn for Super Admins only.** That is a courtesy and not a permission,
exactly as `darfPruefen` already is: hiding a link is not security, and showing everybody a
link to a page that turns them away would simply be a worse header.

## What a row shows

Six columns, in this order:

| Column | Where it comes from | Notes |
|---|---|---|
| E-Mail | `email` | The account's only name. There is no display name; `Person` has one, but that is the Bearbeiter |
| Rollen | `rollen` | Every role the account holds, as tags, walked in the order `ROLLEN` declares so two accounts with the same roles always read the same way round |
| Regierungspräsidium | `regierungspraesidium` | Through `optionLabel('z.rp', ...)`, the same way `Uebersichtsleiste` already prints it. Empty on the accounts that have none, which is most of them |
| Status | `ist_aktiv` | "Aktiv" or "Gesperrt" |
| Angelegt | `created_at` | Through `liste/anzeige.ts`'s existing date formatting, not a second one |
| (the reader's own row) | compared against the session | Marked, see below |

**The reader's own row is marked.** A small "Sie" tag beside the address. It costs one
comparison and it is what makes 16d's refusals make sense in advance: a Super Admin cannot
lock their own account or take `SUPER_ADMIN` off it, so knowing which row is theirs before
they click is worth more than it costs.

**`updated_at` is not a column**, because the backend does not send one and `typen.ts`
already records why: it moves whenever a sign-in upgrades a stored password hash, so it is
not a "last edited" date and a screen must not offer it as one.

## The search box

**It filters in the browser, over rows already fetched.** 16a decided the endpoint takes no
search parameter and returns every account, on the grounds that accounts are tens and low
hundreds rather than unbounded. This is the other half of that decision. It means the box
responds on the keystroke with no request, no debounce and no loading state.

**It matches the email address, and says so.** Case-insensitive, trimmed, substring. The
label names the field rather than saying "Suche", so nobody types a role into it and
concludes the list is broken.

**It lives in component state, not in the address bar.** Deliberately unlike the Pruefliste,
where the filters are in the URL because a request depends on them, a filtered queue is
worth sharing as a link, and feature 12d has to rebuild the list from a URL alone. None of
those three hold here: nothing is fetched per keystroke, and a link to "the account list,
filtered to anna" is not a thing anybody sends anybody.

**The count is announced, and it is the only count on the screen.** A live region beside the
box: the plain total while nothing is being searched for, "2 von 34" once something is. One
element rather than a heading subtitle as well, so no number appears twice, and it is never
emptied: clearing the box has to announce that the list came back, not fall silent.

## The four states

Each is a thing that can happen, and each says something different:

| State | When | What it says |
|---|---|---|
| Loading | The first fetch only | A live region, so a screen reader is told the page is working |
| Refused | `ROLLE_FEHLT` | Replaces the page. Not an error, not retryable, and it names who the page is for and links somewhere this account can go |
| Error | Anything else failed and there are no rows | The message from the API where there is one, and a retry button |
| Empty | The fetch succeeded and matched nothing | Two different sentences: "no accounts match what you typed" with a way to clear it, and the one that can only happen in theory, see below |

**The truly empty list cannot happen, and the code still handles it.** Somebody is reading
this page, so there is at least one account: their own. The state exists because the
alternative is a table with a head and no body, which reads as a fault. It says the list is
empty rather than inventing a reason.

**A failed refetch over good rows does not replace them.** The same rule `pruefliste` states:
saying the list could not be loaded above a table of it is both alarming and untrue.

## In scope

- `darfVerwalten` beside `darfPruefen` in `src/auth/startseite.ts`, with a test.
- The route `/verwaltung/benutzer` and the header link.
- The fetch: `api.ts`, and query options with a retry rule that does not retry a refusal.
- The table, its six columns, and the display helpers behind them as plain functions.
- The search box, the filter function behind it, and the announced count.
- The four states above.
- Browser evidence: a Playwright spec and a screenshot in both themes.
- German strings in `de.json`. **`en.json` is not touched**, which is what every screen since
  the shell has done: that file still holds only the `shell` section, and feature 17 is where
  the whole locale is filled in at once. `resources.d.ts` makes German the authority on what
  a valid key is, so a missing German key is a build error and a missing English one is not.

## Out of scope

- **Creating an account.** 16c. This screen grows a "Neues Konto" button then, not now.
- **Changing, locking, unlocking or resetting a password.** 16d. Nothing on this page writes.
- **Filtering by role, by region or by status.** A dropdown is a filter, not a search box,
  and the build plan asks for the search box. The list is tens of rows on one page with no
  pager, so a role is findable by eye, and the browser's own find works on it. If the list
  ever grows past what fits on a screen this is the first thing to add, and it is a control
  beside the existing one rather than a rewrite.
- **Sorting by a column.** The endpoint orders by email and that is a sensible reading order.
  Same reasoning as above.
- **Paging.** The endpoint returns every account by design; 16a records when that is worth
  revisiting.
- **Showing anything about what an account has done.** How many protocols it filed, when it
  last signed in. Neither exists as data and both are their own features.
- **Any backend change.** 16a shipped the endpoint, the shape and the refusals. If this
  screen needs something the API does not send, that is a finding to raise, not a field to
  add quietly.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big,
so split it.

## Build steps

- [x] **Step 1 - The way in** - `darfVerwalten` and a `BENUTZERVERWALTUNG` path constant in
      `src/auth/startseite.ts`, the route in `routes.tsx`, the header link beside the
      Pruefliste one, and a page that is a heading and an empty card and nothing else.
      *Done when:* `npm test` covers `darfVerwalten` saying yes to `SUPER_ADMIN`, no to the
      other five and no to an empty list. Signed in as a Super Admin the header shows
      Benutzerverwaltung and the link reaches `/verwaltung/benutzer` with the link marked
      current; signed in as a Reviewer the link is absent and typing the address still
      reaches the page, because hiding a link is not a permission.

- [x] **Step 2 - Fetching the accounts** - `api.ts` calling `GET /api/v1/benutzer`,
      `abfragen.ts` with the query options and a `sollWiederholen` that gives up on
      `ROLLE_FEHLT` and `NICHT_ANGEMELDET`, and the page printing one address per row in a
      plain unstyled list.
      *Done when:* `npm test` covers `sollWiederholen` for both settled refusals and for an
      ordinary failure. The page as a Super Admin lists the real accounts from the running
      backend, ordered by email, and the network tab shows exactly one request for them.

- [x] **Step 3 - The table** - the six columns, the row component, the role tags, the "Sie"
      marker, and the display helpers as plain functions in `anzeige.ts`: the
      Regierungspräsidium label and the status word.
      **The role ordering already exists**, inline in `SiteHeader.tsx` as
      `ROLLEN.filter(...)`. Lift it into one exported function and have the header call it,
      rather than writing a second copy: two places deciding the order of the same six roles
      is exactly the drift `coding-standards.md` asks to avoid, and the header is three lines
      away from being the caller. The tags themselves reuse the existing `.role-tag` class,
      which is already generic rather than header-specific.
      *Done when:* `npm test` covers each helper, including a region number the option list
      does not know, an account with no region, and an account holding several roles coming
      back in `ROLLEN` order whatever order the server sent. On screen every account shows
      its roles, region, status and creation date, the table has an accessible name, the
      reader's own row is marked, and the header still prints its own role tags unchanged.

- [x] **Step 4 - The search box** - a `gefilterteKonten` function, the `TextField` above the
      table, and the live region announcing how many accounts are shown.
      *Done when:* `npm test` covers the filter for an empty search, leading and trailing
      spaces, mixed case, a substring in the middle of an address, and a term matching
      nothing. Typing narrows the table with no network request, clearing it restores every
      row, and the count beside the box follows.

- [x] **Step 5 - The four states** - `KeineBerechtigung`, `Ladefehler` and `LeererZustand`
      for this screen, and the loading live region, wired into the page in the order the
      table above sets out.
      *Done when:* signed in as a Reviewer the page says who it is for and offers a link
      onward, with no retry button and no second request. With the backend stopped the page
      shows the error and its retry button, and the button works once the backend is back.
      A search term matching nothing shows the "nothing matches" wording with a button that
      clears it, and clearing it brings the rows back.

- [x] **Step 6 - Browser evidence** - `e2e/benutzerliste.spec.ts` alongside the existing
      specs, using `e2e/konten.ts` and its skip-with-a-sentence arrangement, plus screenshots
      in light and dark.
      *Done when:* `npm run e2e` passes with the accounts configured and skips with the usual
      sentence without them. It covers a Super Admin reaching the page from the header link,
      a Reviewer seeing no link and being refused at the address, the search narrowing the
      table, and every control found by its accessible role and name rather than a class or a
      test id. Screenshots show both themes with nothing cut off.

## Files / areas

**New**, all under `frontend/src/verwaltung/benutzer/`:

- `BenutzerlisteSeite.tsx` - the page and its states
- `BenutzerTabelle.tsx`, `BenutzerZeile.tsx` - the table
- `Suchfeld.tsx` - the search box and its count
- `KeineBerechtigung.tsx`, `Ladefehler.tsx`, `LeererZustand.tsx` - the states
- `api.ts`, `abfragen.ts` - the one call and its caching
- `anzeige.ts`, `suche.ts` and their `.test.ts` files - the plain functions
- `benutzerliste.css` - only what the shared table styles do not already give

**New, outside that folder**, because both have a second caller:

- `frontend/src/auth/rollen.ts` and `rollen.test.ts` - the role order, lifted out of
  `SiteHeader.tsx`
- `frontend/src/api/wiederholen.ts` and `wiederholen.test.ts` - the retry policy, lifted out
  of `pruefliste/abfragen.ts` on the branch review's finding, when this feature made it the
  second copy

**Changed:**

- `frontend/src/routes.tsx` - the route
- `frontend/src/protokoll/pruefliste/abfragen.ts` and its test - calling the lifted retry
  policy instead of holding a copy
- `README.md` and `docs/screenshots/` - the account list added to the screen-by-screen tour,
  as every other shipped screen already is
- `frontend/src/auth/startseite.ts` and `startseite.test.ts` - `darfVerwalten`, the path
- `frontend/src/components/SiteHeader.tsx` - the link, and calling the lifted role-order
  function instead of filtering inline
- `frontend/src/i18n/locales/de.json` - a `benutzerverwaltung` section, plus the header's
  nav string. `en.json` is left alone; feature 17 fills it
- `frontend/e2e/benutzerliste.spec.ts` - new

**Not changed:** anything under `backend/`. 16a is done.

## Data / contracts

Nothing new. `BenutzerAntwort` in `frontend/src/api/typen.ts` already mirrors the backend
field for field, `created_at` included, put there by 16a step 4 for this screen.

`GET /api/v1/benutzer` answers `BenutzerAntwort[]`, ordered by email, with no paging and no
parameters. `ROLLE_FEHLT` with 403 for every account that is not a Super Admin,
`NICHT_ANGEMELDET` with 401 for no session.

**Load-bearing for 16c and 16d:** the query key this step defines is what those two
invalidate after they write, so it is defined once in `abfragen.ts` and exported, the way
`prueflisteKey` is.

## Testing

The test gate is on. `npm test` from `frontend/`, vitest, node environment.

Logic that needs a test in the step that adds it:

| Function | Step | The wrong answers it prevents |
|---|---|---|
| `darfVerwalten` | 1 | Drawing the link for an account the page refuses, or hiding it from one it admits |
| `sollWiederholen` | 2 | Retrying a settled refusal three times, or giving up on a dropped request |
| `regierungspraesidiumLabel`, `statusWort` | 3 | A region printed as a bare number, a locked account reading as active |
| `sortierteRollen`, lifted out of the header | 3 | Two rows, or a row and the header, disagreeing about the order of the same roles |
| `gefilterteKonten` | 4 | A search that misses a match on case or on spaces |

Components and the states ride on browser evidence and the build, as
`coding-standards.md` says. Step 6 writes that evidence down as Playwright specs rather than
clicking through once.

Run `npm run lint`, `npm run build` and `npm test` from `frontend/` before each step is
approved. There is still no project-wide `Verify` command.

## Notes for the AI

- **MUI wherever MUI has a component.** `Table`, `TableRow`, `TableCell`, `TextField`,
  `Button`, `Alert`, `Typography`. Not a bare `<table>` and not a native `<input>`. A
  `<caption>` is the one native element here, because MUI has no equivalent, which is the
  exception `coding-standards.md` already names.
- **Theme once, not per use.** The list table is already themed as `tabelle--liste` for
  exactly this moment. Add the class; do not restate the styles, and do not import
  Pruefliste's components.
- **The label goes above the field**, so `FormLabel` inside a `FormControl`, never
  `InputLabel` and its notch.
- **Route paths are German.** `/verwaltung/benutzer`, as `project-overview.md` lists it.
- **Domain terms stay German in identifiers.** `ist_aktiv` keeps its name coming in from the
  API; nothing is camel-cased on the way through.
- **No colour hard-coded.** Tokens from `theme.css` through the MUI theme. Light and dark
  both checked.
- **Accessibility is an acceptance criterion, not a later pass.** The table has an accessible
  name, the search box has a real label, the count is a live region, focus is visible, and
  every e2e selector is a role and a name.
- **Strings live in `de.json`.** Nothing user-facing is written inline, and `en.json` stays
  as it is: German defines the key set, English is feature 17's whole job.
- **Nothing on this screen writes.** If a step starts wanting a `PATCH`, it has wandered into
  16d.
