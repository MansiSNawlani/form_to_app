# Feature: 17a - Die Sprache gilt überall

**From build-plan:** feature 17a
**Status:** complete (2026-09-30)
**Branch:** `feature/17a-sprache-ueberall`

## Goal

Anyone can switch the interface between German and English from the header, and a signed-in
person's choice is saved to their account so it follows them to another computer. Once English
is chosen, everything the app does not write itself follows too: MUI's built-in texts, the date
and time pickers, and every date and time printed on screen.

After this feature the language *works* everywhere. The English *texts* themselves arrive in
17b to 17e; until then, anything not yet in `en.json` shows German through the existing
fallback, which is correct.

## Worked example

Tom, a consultant from Basel, opens the login page. It is German. He clicks **EN** in the
header, and the login page turns English (the two strings that exist in English today, the rest
falls back until 17b). He signs in. His account still says `de`, so the app switches back to
German, because the account is the authority. He clicks **EN** again, now signed in: the app
switches at once, and his account is saved as `en`. Next week he signs in on a different laptop
and the app is English from the start.

If saving fails (say the network drops), the app stays English for now, and a short message
says it could not be saved to his account and to try again. After a reload the account wins
again, so until the save succeeds the next reload brings back German.

## In scope

- `PATCH /api/v1/ich`, which lets a signed-in person change **their own language and nothing
  else**
- A DE / EN switch in the header, beside the theme toggle, visible signed in and signed out
- MUI's own texts (`deDE` / `enUS`) following the active language
- The date and time pickers following the active language
- The three `Intl.DateTimeFormat` calls reading one formatting locale per language
- A vitest test guarding `en.json`: no key German lacks, and the same `{{placeholders}}` as the
  German text for every key it does have
- The German and English strings this feature itself adds
- The frontend folder-map diagram

## Out of scope

- Translating the existing 716 German texts: 17b to 17e
- The "every key is translated" assertion: 17e, once there is something to assert
- Backend refusal sentences: 17e
- The downloaded PDF: stays German, decided 2026-09-30
- Carrying a login-page choice into the account at sign-in. The account wins, as it does today
  (see the worked example). Revisit only if it proves confusing in use

## Build steps

- [x] **Step 1 - The backend: change your own language** - `IchAendernAnfrage` in
  `app/api/schemas.py` with one field, `locale: Locale`, required, `extra="forbid"`. A small
  service function `setze_sprache(session, benutzer, locale)` in `app/benutzer/dienst.py`. The
  route `PATCH /api/v1/ich` in `app/api/anmeldung.py` beside `GET /ich`, behind
  `AngemeldeterBenutzer`, answering `BenutzerAntwort`. Tests in `sitzung_test.py`, beside the other `/ich` tests.
  *Done when:* `pytest` is green with tests proving: a signed-in account changes its own
  `locale` and `GET /ich` then returns it; a body carrying `rollen`, `email`, `ist_aktiv` or
  `regierungspraesidium` is refused with 422 and the account is unchanged; an unknown locale
  (`"fr"`) is refused with 422; no session gives 401; a deactivated account gives 401, because
  the session check treats it as signed out. `ruff`
  and `mypy` are clean.

- [x] **Step 2 - One place that says how each language formats** - extend
  `frontend/src/i18n/sprachen.ts` with, per locale: the formatting locale (`de-DE`, `en-GB`),
  the MUI core locale object, the date-picker `localeText`, and the dayjs locale name
  (`de`, `en-gb`). Also the two language names in their own language (`Deutsch`, `English`),
  which are the same in every locale and so are constants, not locale-file keys. Point the
  three `Intl.DateTimeFormat(i18n.language, ...)` calls (`SicherungAngebot.tsx`,
  `ProtokollKopf.tsx`, `SpeicherAnzeige.tsx`) at the formatting locale.
  *Done when:* a vitest test pins `de` to `de-DE` and `en` to `en-GB` and proves every entry
  in `SUPPORTED_LOCALES` has a complete set; with the stored locale set to `en` by hand in
  devtools, the "last saved" time reads `30/09/2026, 14:05` style rather than US
  `9/30/2026, 2:05 PM`. `npm test`, `npm run build` and `npm run lint` pass.

- [x] **Step 3 - MUI and the date pickers follow the language** - `muiTheme.ts` exports a
  function of the locale instead of a fixed theme; `main.tsx` rebuilds it (memoised) when
  i18next's language changes. `DatumsProvider.tsx` reads `adapterLocale` and `localeText` from
  step 2 and re-renders on a language change. Its header comment, and the `en.json is a stub`
  comments in `i18n/index.ts` and `auth/useKontoSprache.ts`, are brought up to date.
  *Done when:* with the stored locale switched to `en` and the page reloaded, the date picker's
  calendar shows English month and weekday names and starts the week on Monday, and a MUI
  text such as the Autocomplete's "No options" reads in English; switched back to `de`, both
  are German again. Screenshots of both. Build and lint pass.

- [x] **Step 4 - The switch in the header** - `components/SprachUmschalter.tsx`: a MUI
  `ToggleButtonGroup` (exclusive) with two `ToggleButton`s, **DE** and **EN**. Each carries
  `lang` and an `aria-label` of the language's own name, so a screen reader says "English" in
  English. The group is named by a new key `shell.header.sprache` ("Sprache" / "Language").
  Signed out, a click calls `setLocale` only. Signed in, it calls `setLocale` at once and then
  `PATCH /api/v1/ich`; on success the session cache (`SITZUNGS_KEY`) is updated with the
  returned account, so `useKontoSprache` does not flip it back. On failure the language stays
  as chosen on this device and a `Snackbar` (the pattern `HerunterladenKnopf.tsx` uses) says it
  was not saved to the account and to try again. `ToggleButton` is themed once in
  `muiTheme.ts` to match the header: flat, 4px radius, the accent for the selected button,
  visible focus. The header stays on one line.
  *Done when:* in the browser, signed out, **EN** turns the login page's two English strings
  English and `<html lang>` becomes `en`; signed in, **EN** switches at once and a reload keeps
  English (the account now says `en`, confirmed by `GET /api/v1/ich`); with the backend
  stopped, a click switches the language and the Snackbar appears; the switch is reachable and
  operable by keyboard, with visible focus, in light and dark. Screenshots of the header in
  both themes and both languages.

- [x] **Step 5 - The guard on en.json, and a browser test** - a vitest test beside the locale
  files: every key in `en.json` exists in `de.json`, and every English text uses exactly the
  same `{{placeholders}}` as its German one. A Playwright spec, `e2e/sprache.spec.ts`, that
  signs in as the submitter, switches to English by the button named "English", reloads, and
  finds the page still English; then switches back so the shared test account is left German.
  The folder map in `FRONTEND_ARCHITECTURE_DIAGRAM.puml` gains `SprachUmschalter.tsx` under
  `components/`, and its `i18n/` note no longer calls `en.json` a stub.
  *Done when:* `npm test` is green and a deliberately misspelt placeholder in `en.json` makes
  it fail (then reverted); `npm run e2e` is green; the diagram names only files that exist.

## Files / areas

- `backend/app/api/anmeldung.py`, `schemas.py`, `sitzung_test.py`
- `backend/app/benutzer/dienst.py` (and its test if the function carries logic worth one)
- `frontend/src/i18n/sprachen.ts`, `index.ts`, `DatumsProvider.tsx`, `locales/de.json`,
  `locales/en.json`, a new test beside the locale files
- `frontend/src/theme/muiTheme.ts`, `frontend/src/main.tsx`
- `frontend/src/components/SiteHeader.tsx`, new `SprachUmschalter.tsx`, `shell.css` if needed
- `frontend/src/auth/useKontoSprache.ts` (comment), `auth/useSitzung.ts` (cache update only)
- `frontend/src/protokoll/entwurf/SicherungAngebot.tsx`, `protokoll/ProtokollKopf.tsx`,
  `protokoll/SpeicherAnzeige.tsx`
- `frontend/e2e/sprache.spec.ts`
- `blueprint/history/flow_diagrams/FRONTEND_ARCHITECTURE_DIAGRAM.puml`

## Data / contracts

**Load-bearing: `PATCH /api/v1/ich`.**

```
PATCH /api/v1/ich
{ "locale": "de" | "en" }          -> 200 BenutzerAntwort
anything else in the body           -> 422 (extra="forbid"), nothing changed
no session                          -> 401 NICHT_ANGEMELDET
deactivated account                 -> 401 NICHT_ANGEMELDET (the session check treats it as signed out)
```

It changes the caller's own account and only its language. It is deliberately a separate,
narrow route rather than a reuse of the Super Admin's `PATCH /api/v1/benutzer/{id}`, so no
change to that route's permissions is ever needed for a person to set their own language.

**Load-bearing: the per-locale table in `sprachen.ts`.** 17b to 17e and every later screen read
dates and MUI texts through it. A third language later means one new row there.

No database change. `User.locale` has existed since 2a.

## Testing

- **pytest (step 1):** the permission and refusal cases listed in step 1. The rule "a person
  may change only their own language" is a permission check, so its test is not optional.
- **vitest (steps 2 and 5):** the per-locale table is complete and maps correctly; `en.json`
  holds no key German lacks and no mismatched placeholder.
- **Playwright (step 5):** switching sticks across a reload because it was saved to the account.
- **Browser evidence (steps 3 and 4):** screenshots of the pickers and header in both languages
  and both themes; keyboard operation of the switch.
- Final gate: `pytest`, `ruff check .`, `mypy .`, `npm test`, `npm run lint`, `npm run build`.

## Notes for the AI

- **English lives only in `en.json`** (decisions.md section 12). No English in the backend.
  Identifiers stay German: `SprachUmschalter`, `setze_sprache`, `IchAendernAnfrage`.
- **`en-GB`, not `en-US`, for dates and times.** Every reader is in or around
  Baden-Württemberg: day before month and a 24-hour clock are what they expect, and a US date
  on a German government form would be misread (03/04 as 4 March). This is a default chosen,
  not a question for Mansi.
- **Numeric dates stay `30.09.2026` in both languages**, decided during step 2. The lists, the
  Pruefliste and the date field write them with fixed `DD.MM.YYYY` formats, which is how the
  official form writes a date, and day-first is unambiguous to an English reader. Only dates
  spelt out in words (the three `Intl.DateTimeFormat` calls) and the picker's month and weekday
  names follow the language. MUI's own `enUS` locale object is empty on purpose: MUI is English
  by default.
- **What step 4 turned up, fixed on this branch.** (1) The login page has its own corner
  controls rather than the shared header, so the switch sits there too. (2) MUI 9's toggle
  group is one Tab stop and the arrow keys move between DE and EN, the standard pattern for a
  group of this kind. (3) No MUI button anywhere in the app showed a keyboard focus ring,
  because ButtonBase's own `outline: 0` beat the global `:focus-visible` rule; `MuiButtonBase`
  now carries the ring in `muiTheme.ts`. This was already broken on `main`. (4) The download
  button's Snackbar and the new one used MUI's unthemed `filled` alert, dark red on red; both now
  use the themed alert. (5) The header's right-hand block could shrink below its own buttons,
  so on a Super Admin's header below about 1180px the switch pushed Abmelden off the screen. It
  no longer shrinks below its controls; the address goes first, then the brand wraps taller.
- **Code review, 2026-09-30.** Both review axes found the same bug: EN then DE clicked before the
  EN save answered sent no DE save (the cached account already said `de`), so the EN answer
  landed in the cache and `useKontoSprache` switched the screen back to English. Fixed by
  saving whenever a save is running or has failed, and by giving the mutation a `scope` so the
  saves reach the server in click order. `e2e/sprache.spec.ts` now has a test for it, which
  fails on the old code. The backend tests sit in `sitzung_test.py` beside the other `/ich`
  tests rather than in `anmeldung_test.py`. Throwaway accounts from the browser spec stay on the
  development database, locked or not, as the 16d suite's do; accounts are never deleted.
- **The browser spec makes its own accounts.** `e2e/sprache.spec.ts` signs in as
  `E2E_EMAIL_ADMIN`, creates a throwaway submitter per test through `POST /api/v1/benutzer`
  and switches that one, so a run that stops halfway can never leave a shared test account in
  English. It needs only the admin variable and `E2E_PASSWORT`; it skips without them.
- The two language names are literal constants for the same reason the organisation name in
  `SiteHeader.tsx` is: they must read identically in every locale.
- `useKontoSprache` already makes the account win at sign-in; do not change that.
- **Strings added from here on go into both locale files.** That is the build plan's own rule
  from 17 onward, and step 4's `shell.header.sprache` and the Snackbar text are the first.
- The header must stay on one line at desktop widths (Mansi's layout preference); the switch
  is two short buttons for that reason, not a labelled dropdown.
- Mansi is new to backend work: in step 1's review, explain in plain words what the route, the
  request model and each test do.
- Commit freely on the branch when asked; never merge or push.
