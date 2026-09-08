# Feature: 2c - The login screen and the signed-in shell

**From build-plan:** feature 2c
**Status:** not started

## Goal

Give feature 2b's endpoints a face. Right now the browser has never once talked to the
backend: the whole protocol runs on `localStorage`, the header shows a made-up name, and
anybody who opens the app is straight into a form. The API can sign somebody in, sign them
out and say who they are, and nothing calls any of it.

This feature adds the `/anmeldung` page, the one place the rest of the app asks "who is
signed in", the real address and role in the header, a sign-out button, and the rule that the
protocol screens need a session. At the end of it the app has a front door.

It matters because everything after this assumes a signed-in user exists in the browser.
Feature 3 saves drafts to whoever is signed in, feature 11 shows a reviewer different buttons
from a submitter, and feature 16 lists accounts. All three read the session from the hook
this feature builds.

## Notes for someone new to this part

Four ideas, in the order they happen.

**The browser cannot see the cookie, so it has to ask.** Feature 2b put the session in an
httpOnly cookie, which JavaScript is not allowed to read. That is on purpose, and it means
the page cannot look at the cookie to find out whether it is signed in. Instead it calls
`GET /api/v1/ich`. An answer means signed in and says as whom; a 401 means not signed in.
That one call is the whole session state.

**TanStack Query is a cache for answers from the server.** Without it, every screen that
wants the current user does its own `fetch`, its own loading flag and its own error handling,
and they drift. With it, `useSitzung()` is written once. Ten components can call it and the
request still happens once. When sign-in succeeds we hand the answer straight to the cache,
so no second request is needed, and when sign-out succeeds we clear it.

**A route guard is a component that renders a redirect instead of the page.** React Router
lets a parent route wrap children. The guard sits there, reads the session, and either
renders the page or sends the visitor to `/anmeldung`. The important detail is the third
case: while the first `/ich` call is still in flight we know neither, and rendering the login
page during that moment makes a signed-in person see a login flash on every reload.

**Where you were going is carried in the address.** Somebody who follows a link to
`/protokolle/abc/abschnitt/3` while signed out should land there after signing in, not on the
home page. The guard puts the path into the address as `?weiter=...` and the login page reads
it back. That parameter comes from the address bar, so it is untrusted input: a link with
`?weiter=https://example.com` would turn our own login page into a redirect to somebody
else's site. The check that only internal paths are accepted is real logic and gets a test.

## Design reference

There is no login mockup. `prototypes/` holds `meine-protokolle.html`, `protokoll-teil-1.html`
and `pruefung-protokoll.html`, and none of them is a sign-in screen, so this is a new screen
rather than a replication.

The reference is therefore the app itself: `frontend/src/styles/theme.css` for the tokens,
the existing shell in `frontend/src/components/`, and the field components under
`frontend/src/protokoll/felder/` for what a labelled MUI input looks like on this project. A
centred card, the FFS wordmark, two fields and one button. If you would rather see it drawn
before it is built, say so and `/prototype` can do that first; that would be a change to this
spec, not a step inside it.

## Decisions taken here, and why

Conventions rather than product choices, so they are taken rather than put to you. Each one
says what it rules out, so any of them can be overturned on sight.

| Decision | Why this one |
|---|---|
| **`GET /api/v1/ich` held in a TanStack Query cache is the only session state** | The alternative is a React context holding a user object, which then has to be kept in step with the server by hand. Two copies of "who is signed in" is one copy too many. The query refetches when the window regains focus, so an account deactivated while somebody was away stops working when they come back. |
| **The whole app needs a session, not only the protocol routes** | The build-plan line says "the protocol routes", but there is no public page in this product: `/` is the user's own submissions and there is no sign-up. Guarding everything except `/anmeldung` is one rule instead of a list somebody has to remember to add to. |
| **The return path travels as `?weiter=<path>`** | German, like every other route on this project. A bookmarked or emailed link carries it, so the name is fixed here rather than later. |
| **Only same-site paths are accepted in `weiter`** | It must start with a single `/` and not `//`. Anything else falls back to `/`. Without that check, a crafted link makes our own login page bounce people to another site, which is the classic phishing setup. |
| **The browser branches on the error `code`, never on the sentence** | `backend/app/api/fehler_http.py` published `ANMELDUNG_FEHLGESCHLAGEN`, `KONTO_DEAKTIVIERT` and the rest for exactly this moment. The German wording stays the backend's and is shown as it comes, but the branch goes through the code, so feature 17 can translate without the backend changing. |
| **An unknown code falls back to the backend's own `nachricht`** | An error we have no translation for still says something useful rather than "something went wrong". Only when there is no readable body at all does the generic message appear. |
| **`retry: false` on the session query** | A 401 is a real answer, not a hiccup. Retrying it three times makes every signed-out page load three requests slower for nothing. |
| **Sign-out clears the cache and goes to `/anmeldung`** | Leaving somebody sitting on a page they may no longer read, waiting for the next request to fail, is worse than moving them. |
| **Local drafts survive sign-out** | Drafts live in `localStorage` and are not tied to an account. Deleting them on sign-out would throw away a half-typed protocol because somebody pressed the wrong button. The cost is real and named in Out of scope: on a shared computer the next person to sign in sees the previous person's drafts. Feature 3 moves drafts to the server, which is the actual fix. |
| **The signed-in account's `locale` sets the interface language** | `frontend/src/i18n/index.ts` has been promising this since feature 1b, and it is two lines. The consequence, accepted: `en.json` is still a stub, so an account set to `en` sees mostly German through the fallback until feature 17. |
| **The header shows the email address** | The `User` record has no display name. `Person.name` exists but belongs to the Bearbeiter, who is not always the account holder. The address is what we truthfully have; feature 16 can add a name to the account if FFS wants one. |
| **All six role labels are added to the locale file now** | Only `submitter` exists today. An account holding two roles shows two tags. |
| **No unit test for the login page component** | `coding-standards.md` puts components on browser and build evidence, and vitest here runs in a node environment collecting only `src/**/*.test.ts`, so a `.tsx` test would not even be picked up. The two pieces of real logic, the `weiter` check and the error mapping, are plain `.ts` and are tested. |

## In scope

- `@tanstack/react-query` installed, with its provider added once in `main.tsx`.
- A small fetch wrapper for the API: JSON in, JSON out, refusals turned into a typed error
  carrying the backend's `code` and `nachricht`.
- Frontend types mirroring `BenutzerAntwort` from `backend/app/api/schemas.py`.
- `useSitzung`, the one hook every screen uses to learn who is signed in, plus the sign-in and
  sign-out mutations.
- The `/anmeldung` page: email, password, submit, refusals shown in plain German with a way
  forward, keyboard reachable and properly labelled.
- The route guard: everything except `/anmeldung` needs a session, with no login flash while
  the first check is in flight, and the return path carried in `?weiter=`.
- The header: the signed-in address, a tag per role, and a sign-out button.
- The active locale taken from the signed-in account.
- German strings for all of it, plus the six role labels.
- Unit tests for the `weiter` path check and the error-code mapping.

## Out of scope

- **Anything in `backend/`.** Feature 2b built and tested the API and this feature consumes it
  unchanged. If a gap turns up, it is a `/fix`, not a quiet backend edit inside this feature.
- **Server-side drafts, and the real submissions list.** Feature 3. `/` keeps its placeholder
  body; it just needs a session to reach now.
- **Drafts scoped to an account.** Named above: until feature 3, drafts are per browser rather
  than per user, so a shared computer shows the previous person's drafts to the next one.
  Moving the storage key under the user id would strand every draft already saved and still
  leave the data readable in devtools, so it buys tidiness rather than privacy.
- **Password change, reset, and expiry.** Not in feature 2 at all. A Super Admin sets a
  password with the 2a command line.
- **The user administration screen.** Feature 16.
- **Showing or hiding anything by role.** The header prints the roles; nothing branches on
  them yet. `erfordert_rollen` already exists in the backend and feature 11 is the first to
  need it.
- **Filling in `en.json`.** Feature 17.
- **A language switcher.** The locale follows the account, and nothing here changes it.
- **"Remember me", and any session longer than the eight hours 2b set.**

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The API client and the error contract.** Add `frontend/src/api/client.ts`
      (a `fetch` wrapper: JSON body, `credentials: 'same-origin'`, a 2xx parsed and returned,
      anything else raised as a typed `ApiFehler` carrying `code`, `nachricht` and the status,
      and a network failure raised as the same type with a code of our own),
      `frontend/src/api/typen.ts` mirroring `BenutzerAntwort` field for field, and
      `frontend/src/api/fehler.ts` turning a code into a message with the two documented
      fallbacks. German strings for those fallbacks. Nothing renders it yet.
      *Done when:* `frontend/src/api/fehler.test.ts` covers a known code, an unknown code that
      carries a `nachricht`, an unreadable body and a network failure; `npm test` is green and
      `npm run build` passes.

- [x] **Step 2 - TanStack Query and the session hook.** Install `@tanstack/react-query`, add
      one `QueryClientProvider` in `main.tsx`, and write `frontend/src/auth/useSitzung.ts`:
      the `/ich` query with `retry: false`, exposing signed-in, signed-out and still-checking
      as three distinct states, plus `useAnmeldung` and `useAbmeldung` mutations that write the
      cache rather than causing a second request.
      *Done when:* `GET /api/v1/ich` with no cookie answers 401 with code `NICHT_ANGEMELDET`,
      which is what the hook turns into the signed-out state, and `npm run build` passes.
      The network-tab half of this, one request and no retry, cannot be seen until something
      mounts the hook, so it is checked in step 4 where the guard first does.

- [x] **Step 3 - The login page.** The `/anmeldung` route, outside the guard, built with MUI
      and React Hook Form with a Zod resolver, following the field components already in
      `frontend/src/protokoll/felder/`. Email and password, labels above the fields, a submit
      button that shows it is working, and refusals printed where they can be seen and
      announced. On success, go to `weiter` or `/`.
      *Done when:* an account made with `befischung benutzer anlegen` signs in and lands on
      `/`; the session cookie is visible in devtools; a wrong password prints the backend's
      German message and leaves the typed address in place; the form is fully usable with the
      keyboard alone and every control has a visible focus ring. Screenshots in both themes.

- [ ] **Step 4 - The route guard.** `frontend/src/auth/weiter.ts` with the same-site path
      check, and a guard layout route wrapping every route except `/anmeldung`. Signed out it
      redirects to `/anmeldung?weiter=<path>`; still checking, it renders a quiet waiting
      state, never the login page.
      *Done when:* opening `/protokolle/neu` signed out gives
      `/anmeldung?weiter=%2Fprotokolle%2Fneu`, and signing in lands on a new protocol;
      pasting a deep section link such as `/protokolle/<id>/abschnitt/4` signed out is
      refused the same way and lands on that exact section after signing in, because the
      guard wraps the layout route rather than listing paths; reloading a section while
      signed in shows no login flash;
      `/anmeldung?weiter=https://example.com` signs in to `/` and not to example.com; and
      `weiter.test.ts` covers the absolute URL, the protocol-relative `//host`, a path carrying
      its own query string, and the empty case. `npm test` green.

- [ ] **Step 5 - The header: the real user, the roles and sign-out.** Replace the placeholder
      identity in `SiteHeader.tsx` with the signed-in address and one tag per role, add the six
      role labels to `de.json`, add a sign-out button, and point the active locale at the
      account's `locale`.
      *Done when:* the header shows the address you signed in as; an account with two roles
      shows two tags; sign-out returns to `/anmeldung` and `/protokolle/neu` then redirects
      instead of opening; a draft typed before signing out is still there after signing back
      in. Screenshot of the header in both themes.

- [ ] **Step 6 - The unhappy paths.** A session that has expired or been deactivated, found
      mid-use, sends the person to the login page carrying the page they were on and says why,
      rather than appearing to have signed them out for no reason. The login page says
      something specific when the backend cannot be reached at all.
      *Done when:* deleting the cookie in devtools and navigating to another section lands on
      `/anmeldung` with the right `weiter` and a message saying the session has ended; with the
      backend stopped, submitting the login form says the service cannot be reached and to try
      again shortly, not that the password is wrong. `npm run build` and `npm test` both pass.

## Files / areas

**New**

- `frontend/src/api/client.ts`, `typen.ts`, `fehler.ts`, `fehler.test.ts`
- `frontend/src/auth/useSitzung.ts`, `weiter.ts`, `weiter.test.ts`
- `frontend/src/auth/AnmeldungSeite.tsx`, `SitzungsWaechter.tsx`, `AbmeldeKnopf.tsx`
- `frontend/src/auth/anmeldung.css`, only if the tokens and the theme cannot do it from `sx`

**Changed**

- `frontend/src/main.tsx` - the query provider
- `frontend/src/routes.tsx` - the `/anmeldung` route and the guard around the rest
- `frontend/src/components/SiteHeader.tsx` - real identity, roles, sign-out
- `frontend/src/i18n/locales/de.json` - the new strings and the six role labels
- `frontend/src/i18n/index.ts` - the locale following the account
- `frontend/src/theme/muiTheme.ts` - only if a component used here needs theming once rather
  than per use
- `frontend/package.json` - one new dependency

## Data / contracts

**Load-bearing. Features 3, 11, 12, 13 and 16 all read these.**

- `BenutzerAntwort`, mirroring `backend/app/api/schemas.py` exactly: `id`, `email`, `rollen`,
  `regierungspraesidium`, `locale`, `ist_aktiv`. The role values are the six in
  `backend/app/models/benutzer.py`.
- `FehlerAntwort`: `code` and `nachricht`. The browser branches on `code` only.
- The endpoints, unchanged from 2b: `POST /api/v1/anmeldung`, `POST /api/v1/abmeldung`,
  `GET /api/v1/ich`.
- `useSitzung()` is the only sanctioned way a component learns who is signed in. A screen that
  fetches `/ich` for itself is a screen that will one day disagree with the header.
- The `weiter` query parameter name, because a link can carry it.

No database change, no migration, no new backend route.

## Testing

`npm test` (vitest) from `frontend/`. `pytest` from `backend/` should stay green, though this
feature does not touch it.

**Gets a unit test**

- `weiter.ts` - the same-site path check, including the absolute URL and `//host` cases.
- `fehler.ts` - code to message, with each documented fallback.

**Does not get a unit test**

The login page, the guard and the header. Components and integration surfaces ride on browser
evidence and the build, per `coding-standards.md`. vitest here runs in a node environment and
collects only `src/**/*.test.ts`, so a component test would mean changing that setup, which is
not this feature's job.

**Manual path, once step 5 lands**

1. `docker compose up -d --build` from the root, then `npm run dev` from `frontend/`.
2. Make an account if there is none:
   `befischung benutzer anlegen --email you@example.org --rolle SUBMITTER`.
3. Open `/protokolle/neu` signed out, and see where you land, then where you land after
   signing in.
4. Sign out, and check the protocol route is refused again.

## Notes for the AI

- **Use MUI wherever MUI has a component**, including `TextField`, `Button` and `Alert`. Theme
  it in `muiTheme.ts` if it is used more than once. No hand-rolled native controls.
- **Labels sit above the field**: `FormLabel` inside a `FormControl`, exactly as the field
  components under `frontend/src/protokoll/felder/` already do. Follow them rather than
  inventing a second way to draw a labelled input.
- **Never hard-code a colour.** The tokens in `frontend/src/styles/theme.css` outrank MUI.
- **Every user-facing message names the thing, says why in ordinary words, and says what to do
  next.** The backend's messages already do; anything written here matches them.
- **Accessibility is an acceptance criterion, not a later pass.** The password field needs a
  real label, the error needs to be announced and tied to the form, and the focus ring must be
  visible in both themes.
- **German for routes, domain terms, and anything a person reads.** Component and variable
  names stay English where they are general programming vocabulary, which is what the rest of
  `frontend/src/` does.
- **No second copy of the session.** If a component needs the user, it calls `useSitzung()`.
- **No em dashes** anywhere, including in the German strings.
