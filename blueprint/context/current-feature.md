# Feature: 17e - Meldungen des Servers in English

**From build-plan:** feature 17e
**Status:** in progress
**Branch:** `feature/17e-meldungen-englisch`, from `main` after 17d was merged

## Goal

When English is chosen, a refusal from the server reads in English too: a wrong password, a
photo in the wrong format, a PDF that is the crayfish form, two reviewers deciding at once. The
last sub-feature of 17 also closes the guard: every German text has an English one, and every
refusal the backend can send has wording in both locale files.

**The backend learns no second language.** It goes on answering with a `code`, its German
`nachricht`, and (new) the values that sentence names. The browser picks the wording for the
code from the locale file in the chosen language. That is decisions.md section 12 (English only
in the interface translation files) and the "Why 17e exists" paragraph in `build-plan.md`.

## Nothing that is stored is translated, in either direction

Written down here because it was asked when this feature was started, and the answer is a
boundary of this feature as much as of 17 as a whole:

- **What the form sends is the same in both languages.** A dropdown answer is a code (`13`,
  `OFAN`, `2`); English only changes the label drawn next to it. The request body of a save is
  identical whether the screen is German or English, so there is nothing to translate before
  the API is called, and nothing is.
- **Free text is stored exactly as typed.** A surveyor writing the Bemerkungen in English gets
  English Bemerkungen in the record. There is no machine translation anywhere in the
  application, on the way in or out.
- **The only thing translated is what the screen draws**, at the moment it draws it, from the
  locale files. 17e moves the server's refusals into that same place.

## Worked example

Tom, the consultant from Basel, has his account set to English. He picks a photo for section 7
that turns out to be a renamed text file. Today the block reads:

> Foto_3.jpg: Der Name dieser Datei sagt Bild, ihr Inhalt ist aber keines. ...

After 17e it reads:

> Foto_3.jpg: The name of this file says image, but its content is not one. ...

What crossed the wire is the same in both cases:

```json
{ "code": "ANLAGE_INHALT_KEIN_BILD",
  "nachricht": "Foto_3.jpg: Der Name dieser Datei sagt Bild, ...",
  "werte": { "dateiname": "Foto_3.jpg" } }
```

Mansi, with the account in German, gets the German sentence, now from `de.json` and word for
word what the backend says.

## In scope

**About 43 codes**, all in `backend/app/api/fehler_http.py`, the one place a refusal becomes a
response (a search found no other `HTTPException` or `JSONResponse` in `app/`):

| Family | Codes | Values the sentence names |
|---|---|---|
| Accounts and sign-in (`UEBERSETZUNG`) | 19, including the 3 demo ones | password `mindestens` / `hoechstens`; the list of `regierungspraesidien` |
| General | `UNBEKANNTER_FEHLER`, `ANFRAGE_UNGUELTIG` | none: the second names API field names, which mean nothing to a reader, so the translated sentence leaves them out |
| Protocols (`PROTOKOLL_UEBERSETZUNG`) | 11 | `zeichen` / `hoechstens` (too large); `anzahl` / `felder` (answers unusable) |
| Attachments (`ANLAGE_UEBERSETZUNG`) | 5 | `dateiname`; `hoechstens_mb`; `art` / `vorhanden` / `hoechstens` (full) |
| PDF import (`EINLESE_UEBERSETZUNG`) | 6 | `dateiname`; `hoechstens_mb` |

- **A new optional `werte` field on `FehlerAntwort`**: the numbers, names and field paths the
  sentence names, never wording. Left out when a refusal names nothing, so the two-field body
  of today is unchanged for most codes.
- **One way through in the browser.** `fehlertext` (and so `useFehlertext`), `Uebergangsfehler`
  and the attachment `fehlerMeldung` look up `fehler.server.<CODE>` with `werte` and fall back
  to the backend's `nachricht` only for a code the locale file does not know.
- **German wording in `de.json` copied from the backend**, so a German screen reads exactly as
  it does today. English wording in `en.json`, following the 2026-09-30 rule: official terms as
  "Sampling stretch (Probestrecke)", everything else plain English.
- **The closing guards**: every German key has an English one (replacing the namespace list in
  `locales.test.ts`), and every code the backend can send has wording in both files.

## Out of scope

- **The backend's German `nachricht` stays**, unchanged. It is the fallback for a code added
  after the locale files were last written, it is what the API documentation shows, and the
  command line and logs read German.
- The `befischung` command line, which stays German.
- The downloaded PDF, which stays German (decided 2026-09-30).
- Translating free text, or anything stored. See the section above.
- E-mail wording, which arrives with feature 14.
- The `verstoesse` of a refused submit and an import report: they are already keys
  (`VerstossAntwort.schluessel`) and 17c translated them.

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

- [x] **Step 1 - `werte` on every refusal that names something (backend)** - add
  `werte: dict[str, str | int | float | list[str]] | None` to `FehlerAntwort` and fill it in the
  four handlers: the same values the German sentence already prints, taken from the same
  exception fields. `nachricht` is not touched. `art` travels for `ANLAGENART_VOLL` so the
  browser can pick the photo or the map excerpt sentence. Test in
  `backend/app/api/fehler_http_test.py` (or the existing handler tests): one refusal per family
  with values, one without. *Done when:* `pytest` and `mypy .` are green, and a too-large
  attachment answers with `werte.dateiname` and `werte.hoechstens_mb` beside an unchanged
  `nachricht`.

- [ ] **Step 2 - the browser reads code and `werte` (frontend, no wording yet)** - `ApiFehler`
  carries `werte`; `api/client.ts` reads it (and ignores a malformed one rather than failing the
  whole error). `fehlertext` returns a third shape, `{ art: 'server', code, werte, nachricht }`,
  and `useFehlertext`, `Uebergangsfehler` and the attachment `fehlerMeldung` turn it into text:
  `fehler.server.<CODE>` (with `_<ART>` appended when `werte.art` is set) if `i18n.exists`,
  else `nachricht`. A `dateiname` in `werte` leads the text the way the backend puts it.
  Vitest beside `fehler.ts`. *Done when:* `npm test`, `npm run lint` and `npm run build` are
  green, and every screen still shows the backend's German sentence, since no key exists yet.

- [ ] **Step 3 - wording for accounts, sign-in and the general codes** - `fehler.server.*` in
  `de.json` and `en.json` for the 19 account codes, `UNBEKANNTER_FEHLER` and
  `ANFRAGE_UNGUELTIG`. *Done when:* signed out with the language on English, a wrong password
  on the sign-in page reads in English; the German page reads word for word as before; tests
  green.

- [ ] **Step 4 - wording for the protocol codes** - the 11 `PROTOKOLL_UEBERSETZUNG` codes.
  *Done when:* trying to delete a submitted protocol (or deciding on one's own protocol) on an
  English screen reads in English; tests green.

- [ ] **Step 5 - wording for attachments and the PDF import** - the 5 attachment and 6 import
  codes, with the photo and map excerpt sentences of `ANLAGENART_VOLL` as two keys. *Done
  when:* importing the Krebs form, or a text file renamed to `.pdf`, on an English screen reads
  in English with the file name in front; an oversize attachment on an English screen
  names the limit in megabytes from `werte.hoechstens_mb`, formatted by the browser; tests
  green.

- [ ] **Step 6 - the closing guards** - in `locales.test.ts`, replace the per-namespace list
  with one test: every key in `de.json` has one in `en.json`. In the backend, a test that every
  code in the four tables plus `UNBEKANNT` and `ANFRAGE_UNGUELTIG` has a `fehler.server` key in
  both locale files, and that every `{{placeholder}}` in those texts is a key that handler can
  put in `werte` (the backend reads the locale files the way it already reads
  `beschriftungen.json`, and skips with a message naming the file when the frontend is not
  checked out). Update the comments in `api/fehler.ts`, `useAnlagen.ts`, `entwurf/api.ts` and
  `fehler_http.py` that say the browser shows the backend's sentence as it stands. *Done when:*
  both test runs are green, and removing one English key or one backend code's wording makes
  the matching test fail (shown, then put back).

- [ ] **Step 7 - browser evidence** - a Playwright spec in `frontend/e2e/`: switch to English,
  sign in with a wrong password, see the English refusal; switch to German, see the German one.
  Screenshots of three refusals in English (sign-in, attachment, import). *Done when:*
  `npm run e2e` passes the new spec and the screenshots show no German sentence on an English
  screen apart from a file name.

## Files / areas

- `backend/app/api/schemas.py` - `werte` on `FehlerAntwort`
- `backend/app/api/fehler_http.py` - fill `werte`; comments on where wording now lives
- `backend/app/api/*_test.py` - `werte` tests and the coverage test
- `frontend/src/api/fehler.ts`, `client.ts`, `typen.ts`, `useFehlertext.ts` - read and use `werte`
- `frontend/src/protokoll/anlagen/useAnlagen.ts`, `protokoll/pruefung/Uebergangsfehler.tsx`
- `frontend/src/i18n/locales/de.json`, `en.json` - about 43 keys under `fehler.server`
- `frontend/src/i18n/locales/locales.test.ts` - the whole-file guard
- `frontend/e2e/` - one new spec
- No checked-in OpenAPI file exists (`git ls-files` finds none), so the new field shows up on
  `/api/v1/docs` by itself

## Data / contracts

- **`FehlerAntwort.werte` (load-bearing, additive):** an optional object of language-neutral
  values. Keys are fixed per code and are the locale placeholders: `dateiname`, `hoechstens`,
  `hoechstens_mb`, `mindestens`, `vorhanden`, `art`, `zeichen`, `anzahl`, `felder`,
  `regierungspraesidien`. Numbers travel as numbers, so the browser formats them in its own
  language (`10` vs `0,5` / `0.5`). Field paths travel as a list. Never anything the caller sent,
  except the file name, which already appears in `nachricht` today for the reasons
  `fehler_http.py` gives.
- **`fehler.server.<CODE>` in the locale files (load-bearing):** a new backend code without a
  key here fails the step 6 test, which is how a later feature is told to write it.
- `code` and `nachricht` unchanged.

## Testing

- **pytest:** `werte` per family (step 1); the coverage and placeholder test (step 6).
- **vitest:** `fehlertext` on a known code, an unknown code (falls back to `nachricht`), a code
  with `dateiname`, `ANLAGENART_VOLL` per `art`, a non-`ApiFehler`; the whole-file locale guard.
- **Browser:** the Playwright spec and screenshots in step 7. Wording itself is checked by
  reading the diff, not by a test.

## Notes for the AI

- German wording in `de.json` is copied from `fehler_http.py` exactly, so a German user sees no
  change. Placeholders replace what the f-strings fill in.
- `ANTWORTEN_UNGUELTIG`: the German sentence also names a reason per group of fields ("zu lang",
  "kein Text"). The locale text lists the field paths without the reasons; it is a
  "report this bug" message, the reasons stay in the backend's `nachricht` and in the logs.
  Raise it at step 4 if that loses something the user wants.
- Region names (`1 Stuttgart`, ...) are names of authorities and stay German in English
  (17d's rule), so they travel in `werte` rather than being written twice.
- No em dashes, en dashes or ellipsis characters in any wording.
- The e2e accounts and `E2E_*` variables from `AGENTS.md` are needed for step 7.
