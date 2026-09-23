# Feature: PDF einlesen auf dem Bildschirm

**From build-plan:** feature 23c
**Status:** built, all six steps done, verified in the browser against the three real protocols

## Goal

The button that makes the import real. A surveyor who filled the Acrobat form in on
a laptop picks their file on Meine Protokolle, waits a moment, and lands inside a
new draft that already holds their answers, with everything still to put right
already in front of them.

23b built the endpoint and gave it no door. Today an import is only possible through
the API docs, which nobody outside this repository will ever open. This is the door.

**The report is the other half of the job, and the harder half.** An import is never
trusted: the legacy form has known validation bugs, so a file arrives with problems,
with answers this application could not take over, and with photographs that did not
come with it. All three have to be told to the person in a way they can act on, or
the import quietly loses data and looks like it worked.

## Design reference

- [../../prototypes/meine-protokolle.html](../../prototypes/meine-protokolle.html) -
  the page the control is added to. The import button sits beside "Neues Protokoll"
  in the existing `page__head-actions` block; nothing else on that page moves.
- The problem panel is not mocked up anywhere and is not being redesigned. It is
  `protokoll/absenden/AbsendeProbleme.tsx` as it stands, which feature 11c built and
  2026-09-12 reshaped. This feature feeds it; it does not restyle it.

No new screen is designed here, so no new reference image is needed.

## In scope

- **The control on Meine Protokolle**: an outlined button beside "Neues Protokoll"
  that opens the file dialog, filtered to PDF.
- **Its three states**: busy while the file goes up and is read, refused when the
  server says this is not a protocol it can read, failed when the request itself
  broke.
- **Landing in the draft**: on success, straight to section 1 of the new protocol,
  with the report already in place and surviving a reload.
- **The rules' violations** written into the existing `pruefungsStore`, so the panel
  this project already has draws them with no new panel built.
- **What could not be taken over** (`unbrauchbar`): named per field, in the section
  that field lives in, beside the rules' own entries.
- **The photographs the file carries** (`bilder`): reported on section 7, where the
  attachments are, because an attachment is part of the protocol and a count
  mentioned once on arrival is a count nobody sees again.
- **A banner on first arrival** saying the protocol came out of a PDF, what was and
  was not carried over, and that it is a draft nobody has submitted.
- **German for all of it** in `de.json`, including the keys 23b emits and asserts
  but deliberately never worded.

## Out of scope

- **Reading the pictures out of the file.** 23d does that. Here the count is
  reported and the person is told to attach them again.
- **The download.** 23e.
- **Any backend change.** 23b is finished and merged. If this feature finds the
  endpoint wanting, that is a finding to raise, not a change to make here.
- **A drag-and-drop target.** The file dialog is the path every other upload on this
  application uses and there is no evidence anybody wants a second one.
- **More than one file at a time.** The endpoint takes one per request and the build
  plan says nothing asks for more.
- **Importing into an existing protocol.** Every import is a new survey. There is
  deliberately no way to pour a file into a draft that already exists.
- **Changing how the panel looks or groups.** It is fed, not redesigned.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Steps 1 and 2 are provable by `npm test` alone. From step 3 there is a button on the
screen and a real PDF can be dropped through it end to end.

- [x] **Step 1 - The call, and the types it answers with** - `EingelesenesProtokoll`
      and `EinleseAntwort` mirrored into `frontend/src/api/typen.ts` beside the
      shapes already there, and `leseProtokollEin(datei)` in
      `protokoll/entwurf/api.ts` posting a `FormData` to
      `POST /api/v1/protokolle/einlesen`. The client already sends a `FormData`
      untouched, added in 3d for the attachment upload, so nothing in
      `api/client.ts` changes.
      The new refusal codes added to `api/fehler.ts` as named constants beside the
      ones there: `PDF_NICHT_LESBAR`, `PDF_GESPERRT`, `PDF_OHNE_FORMULAR`, the
      not-this-form code, the missing-version code, and the too-large code. Read
      them off `backend/app/api/fehler_http.py` rather than retyping them from
      memory; a code that does not match is a refusal the browser cannot tell apart
      from a crash.
      *Done when:* `npm test` proves `leseProtokollEin` posts multipart to the right
      path with the file under the field name the endpoint expects, returns the
      parsed `EingelesenesProtokoll` on 201, and rejects with an `ApiFehler`
      carrying the code on a 422 and on a 413. `npm run lint` and `npm run build`
      pass.

- [x] **Step 2 - What an import leaves behind for the draft to find** -
      `protokoll/einlesen/bericht.ts`: a per-protocol store for the two things the
      submit panel has no home for, `unbrauchbar` and `bilder`, built exactly the
      way `absenden/gemerkt.ts` is built, taking its storage and its clock as
      arguments so it tests without a browser.
      **Why a second store rather than one.** 23b deliberately kept the three apart,
      because the person does something different about each: a rule's complaint is
      theirs to fix, an answer that could not be read is theirs to retype, and a
      photograph is theirs to attach again. The rules' violations go into the
      existing `pruefungsStore` unchanged, so the existing panel draws them with
      nothing new built and they survive a reload the way they already do. These two
      do not fit that shape and get their own key.
      Every read wrapped, every write swallowed, a shape that does not check read as
      absent: `gemerkt.ts` explains why, and the same reasons hold here.
      **Dismissing the banner does not clear the report.** It records that the
      banner has been read, nothing more. The unreadable fields and the missing
      photographs are still unreadable and still missing, and section 7 and the
      section panels go on saying so. A protocol imported an hour ago whose
      photographs never arrived has not stopped being a protocol without its
      photographs, and a list of problems that a single click destroys is the exact
      failure `AbsendeProbleme.tsx` was reshaped on 2026-09-12 to stop.
      So the stored shape carries `bannerGelesen` beside the rest, and nothing in
      this feature deletes the report at all.
      *Done when:* `npm test` proves a written report reads back, that a report
      naming no unusable field and no picture is stored as nothing rather than as an
      empty banner, that a half-written or older-shaped value reads as absent rather
      than throwing, that a storage which throws on read and on write breaks
      nothing, that marking the banner read leaves the unusable fields and the
      picture count untouched, and that one protocol's report is independent of
      another's. `npm run lint` and `npm run build` pass.

- [x] **Step 3 - The button, and the three things that can happen** - the control on
      `liste/ProtokolleSeite.tsx`, beside "Neues Protokoll". `AnlagenPicker` is
      reused rather than copied, gaining an `accept` prop with the image list as its
      default so section 7 is untouched: it already solved the hidden input, the
      single tab stop and the focus ring, and a second file input on this
      application would drift from it by the first bug fix.
      A `useEinlesen` hook beside the page holding the sequencing, the way
      `useAbsenden` does: post, write both reports, invalidate the protocol list,
      navigate to section 1 of the new draft.
      The three states, each said in words rather than left to a spinner: busy, with
      the button disabled and a live region so a screen reader is told the file is
      being read; refused, as an `Alert` naming the file and carrying the backend's
      own sentence, which already says what to do instead; failed, as the same
      `Alert` with the network wording `useFehlertext` already produces.
      **Nothing is checked in the browser before sending.**
      `accept="application/pdf"` is a hint to the file dialog, never a gate, exactly
      as `anlagen/regeln.ts` says of its own. The server is the only thing that knows
      whether a PDF is this form, and a second opinion here could only be the wrong
      one.
      *Done when:* the button appears beside "Neues Protokoll" and opens a file
      dialog offering PDFs; uploading one of the three real protocols from
      `Resources/echte-protokolle/` lands on section 1 of a new draft holding its
      answers; uploading the Protokoll Krebs shows the refusal naming what it is and
      leaves the page where it was; the button is disabled and says so while a file
      is going up. A screenshot of the page, the busy state and the refusal.
      `npm run lint` and `npm run build` pass.

- [x] **Step 4 - The answers that could not be read, in the section they live in** -
      the rules' violations need no work at all: step 3 wrote them into
      `pruefungsStore` and `AbsendeProbleme` already reads that on the way in. This
      step proves that, and adds the one thing the panel has no shape for.
      `unbrauchbar` holds our own field paths (`datum`,
      `bemerkungen.sonstige_bemerkungen`), so `verortung.verorte` places them with no
      change: it already resolves both, already knows their labels, and already has
      an `UNBEKANNT` fallback for a path it does not recognise. The work is in
      `gruppierung.ts`, which grows a second list beside `probleme` per section, and
      in `AbsendeProbleme.tsx`, which prints it under its own heading. **Never mixed
      into the rules' list**: a rule's complaint means the answer is wrong, and this
      means the answer is there and could not be understood, and merging them would
      tell the person the wrong thing about both.
      The wording says the plain truth: the value is in the protocol exactly as the
      file wrote it, this application could not read it, and it needs looking at.
      `useErledigtePfade` covers these the same way it covers a violation, so
      retyping the date ticks it off as dealt with, never as correct. Only a fresh
      Absenden replaces the list with the server's answer, which is the rule the
      panel already lives by.
      The step bar's count comes from `offeneJeAbschnitt(verstoesse, erledigt)`, so
      `AbschnittNav.tsx` changes too: a section owing nothing but an unreadable date
      must not read as finished.
      *Done when:* `npm test` proves `gruppierung` files an `unbrauchbar` path under
      the right section, keeps it apart from the violations, counts it in that
      section's total, and lists an unplaceable path rather than dropping it.
      Importing a protocol whose date could not be read shows that field in section
      1's panel under its own heading with a link that scrolls to it; the step bar
      shows the count; a reload keeps both; typing a date ticks it off. `npm run lint`
      and `npm run build` pass, plus a screenshot of a panel showing both groups.

- [x] **Step 5 - The photographs that did not come with the file** - `bilder`
      reported on section 7, beside the attachments: how many pictures the file
      carries, and that they have to be attached again by hand until 23d reads them
      out.
      **On section 7 rather than only on the banner**, because an attachment is part
      of the protocol. A count printed once on a banner somebody dismisses is a count
      nobody sees at the moment they are actually looking at their attachments, and
      the protocol then reaches a reviewer with its photographs silently missing.
      Its own component beside the attachment block rather than a line inside it, so
      it is plainly about the import and not about the files already uploaded.
      *Done when:* importing a file carrying a Kartenausschnitt shows "1 Bild" on
      section 7 with a sentence saying what to do about it; importing one carrying
      none shows nothing at all; a reload keeps it; the message survives dismissing
      the banner. `npm test`, `npm run lint` and `npm run build` pass, plus a
      screenshot of section 7.

- [x] **Step 6 - The banner, the German, and the pass over the whole thing** - the
      arrival banner on the protocol: this came out of a PDF, it is a draft nobody
      has submitted, here is what came over and what did not, and it is dismissable
      because it is an explanation rather than a problem. Dismissing it sets
      `bannerGelesen` and touches nothing else.
      **A clean import still gets the banner.** A file with no violations, no
      unreadable answers and no pictures is a real outcome, and the person still
      needs to be told their protocol came out of a PDF, is a draft, and has not been
      submitted. The banner then says exactly that and the panels stay empty, which
      is the difference between an import that worked and one that quietly did
      nothing.
      Then every string this feature emits written into `de.json`, including the keys
      23b asserts and never worded, and a test pinning each to the locale file the
      way `verortung.test.ts` already pins its own, so a key that exists only in code
      is a failing test rather than a panel printing `protokoll.einlesen.foo` at a
      surveyor.
      Then the pass: read every sentence as somebody whose import went wrong. Each
      names the thing, says why in plain words, and says what to do. Tab the whole
      path with no mouse. Look at it in both themes.
      *Done when:* every new string is in `de.json` and a test proves no key is
      missing; a file with nothing wrong with it imports, shows the banner and shows
      no panel; the whole path works from the keyboard alone, the file dialog
      reachable by tab and the banner dismissable by keyboard; the busy and refused
      states are announced to a screen reader; both themes screenshotted; `npm test`,
      `npm run lint` and `npm run build` pass from `frontend/`, and `pytest`,
      `ruff check .` and `mypy .` still pass from `backend/`, which they must, since
      nothing there changed.

## Files / areas

**New**

- `frontend/src/protokoll/einlesen/bericht.ts` - the per-protocol store for what
  could not be carried over, plus `bericht.test.ts`.
- `frontend/src/protokoll/einlesen/useEinlesen.ts` - post, store, navigate.
- `frontend/src/protokoll/einlesen/EinleseFehler.tsx` - the refusal on the list page.
- `frontend/src/protokoll/einlesen/EinleseBanner.tsx` - the arrival banner.
- `frontend/src/protokoll/einlesen/UnbrauchbareFelder.tsx` - the second group in the
  section panel.
- `frontend/src/protokoll/einlesen/FehlendeBilder.tsx` - the picture count on
  section 7.

**Changed**

- `frontend/src/api/typen.ts` - `EingelesenesProtokoll` and `EinleseAntwort`.
- `frontend/src/api/fehler.ts` - the six new refusal codes.
- `frontend/src/protokoll/entwurf/api.ts` - `leseProtokollEin`.
- `frontend/src/protokoll/liste/ProtokolleSeite.tsx` - the control and its states.
- `frontend/src/protokoll/abschnitte/teil7/AnlagenPicker.tsx` - an `accept` prop,
  defaulting to today's image list.
- `frontend/src/protokoll/absenden/gruppierung.ts` - the unusable answers filed
  per section beside the violations, and counted. **The logic-bearing change in this
  feature**, and `gruppierung.test.ts` grows with it.
- `frontend/src/protokoll/absenden/AbsendeProbleme.tsx` - the second group printed.
- `frontend/src/protokoll/AbschnittNav.tsx` - the step bar's per-section count,
  which today reads `offeneJeAbschnitt(verstoesse, erledigt)` and must include the
  unusable answers or a section owing one reads as finished.
- `frontend/src/protokoll/ProtokollSeite.tsx` - the banner, and passing the report
  down to the nav and the panel.
- `frontend/src/protokoll/abschnitte/teil7/` - the picture count beside the
  attachment block.
- `frontend/src/i18n/locales/de.json` - every string.

## Data / contracts

**Given, not decided here.** 23b fixed the response and this feature renders it.

```
201 { "protokoll": ProtokollAntwort, "bericht": EinleseAntwort }

EinleseAntwort {
  quellversion: string      // the version the FILE declared, never the protocol's
  unbrauchbar:  string[]    // field paths whose value could not be taken over
  bilder:       number      // pictures in the file, which did NOT come with it
  verstoesse:   Verstoss[]  // exactly what a refused Absenden returns
}
```

`protokoll` is `ProtokollAntwort`, the same shape create and read already answer
with, so the form opens on a document it already knows how to hold.

**What this feature decides**, and 23d inherits:

```ts
// frontend/src/protokoll/einlesen/bericht.ts
export const KEY_PREFIX = 'ffs-einlesebericht:'

export interface GemerkterBericht {
  id: string
  zeitpunkt: string
  quellversion: string
  unbrauchbar: string[]
  bilder: number
  /* The banner has been read. Only the banner: nothing here is ever deleted,
     because an unreadable answer stays unreadable and a missing photograph stays
     missing however many times the explanation has been dismissed. */
  bannerGelesen: boolean
}
```

**Load-bearing.** 23d reads the pictures out into real Anlagen, so `bilder` stays in
the shape even once 23d makes it usually zero.

**Every path in `unbrauchbar` is one `verortung.verorte` already resolves.** The
backend emits our own field paths, proven by its tests: `datum` and
`bemerkungen.sonstige_bemerkungen`. Both are in `verortung.ts` today, and a path it
does not know falls to `UNBEKANNT` and is listed without a link rather than dropped,
which is the behaviour violations already get and for the same reason.

**`verstoesse` is deliberately not in it.** Those go into the existing
`pruefungsStore` under its existing key, which is what lets the panel, its
per-section grouping, its fold state and its survival across reloads all work with
nothing new written. Two stores holding violations would be two things to keep in
step, and the panel would have to ask both.

## Testing

`npm test` from `frontend/`, and a real PDF through the real screen for everything a
unit test cannot see.

**In-scope logic, each shipping its test in the same diff:**

| Step | Logic under test |
|---|---|
| 1 | `leseProtokollEin`: the multipart body, the 201, the typed refusals |
| 2 | the report store: round trip, absent, corrupt, throwing storage, banner-read leaving the rest alone, per-protocol isolation |
| 4 | `gruppierung`: an `unbrauchbar` path filed under the right section, kept apart from the violations, counted, and an unplaceable one listed rather than dropped |
| 6 | every new key present in `de.json` |

Step 4 is the one where a wrong answer is genuinely possible, which is why
`gruppierung.ts` carries the change rather than the component: a field filed under
the wrong section sends somebody to the wrong screen, and one dropped for being
unrecognised goes missing in silence. That is exactly the reasoning
`gruppierung.ts`'s own comment already gives for existing.

**Not unit tested**, per `coding-standards.md`: the picker, the banner, the panel
group, the picture count, the page states. Those ride on browser evidence, a
screenshot and the build.

**Steps 3 onward need the stack and a real protocol.** `docker compose up -d`, a dev
server, and a file from `Resources/echte-protokolle/`, which is not in the
repository. Three real ones were supplied on 2026-09-22; the blank form filled in by
hand also works and is the likeliest mistaken upload besides.

**An end-to-end test is deliberately not added here.** `npm run e2e` needs the two
accounts and a password nobody commits, and it would additionally need a protocol
PDF, which is untracked by decision. A browser test that skips on every fresh
checkout is worth less than the screenshots this spec already asks for. Raise it
again when 23e can generate the file the test would upload.

## What changed while it was built

Five things the spec got wrong, each found by building or by looking at the screen.

1. **No new refusal codes.** Step 1 asked for six constants in `api/fehler.ts`. That file
   argues against them itself, in the comment explaining why the attachment refusals have
   none: nothing branches on them, and `fehlertext` already falls through to the backend's
   own German. Six exports nothing imports. Dropped.
2. **The types went to `protokoll/entwurf/typen.ts`, not `api/typen.ts`.** `api/typen.ts`
   says outright that the protocol endpoints' shapes live beside `Antworten`, because each
   of them carries or describes that document.
3. **`AnlagenPicker` was moved, not given a prop.** It is now `components/DateiPicker.tsx`,
   with its focus-ring rule moved from `protokoll.css` to `shell.css`. The list page never
   loads the protocol stylesheet, so leaving the rule where it was would have shipped a
   picker with no visible focus on the new screen. `accept` became a required prop rather
   than one defaulting to images, because a picker silently offering the wrong kind of file
   is worse than one that will not compile.
4. **An unusable answer never ticks off.** The spec said typing a date would tick it off,
   the way a violation does. It cannot: the backend stores the unreadable value in its
   field exactly as the PDF wrote it, so the box is full on arrival and the "no longer
   empty" test would clear the entry before anybody had looked at it. The one thing the
   surveyor has to do is precisely what that test cannot see. They now stay listed until a
   fresh Absenden, which is the rule the block-level violations already live by.
5. **Every import is stored, including a clean one.** Step 2 said an empty report stores
   nothing; step 6 said a clean import still gets the banner. Both could not be true. The
   banner won: an import that worked must not look identical to one that quietly did
   nothing. `bannerGelesen` is what stops it repeating.

And one found only by looking at the screen: the refusal named the file twice, once in the
title and once at the front of the backend's sentence. The title is generic now.

## Notes for the AI

- **The backend is finished and merged. Do not change it.** Every refusal already has
  German wording in `app/api/fehler_http.py`, written to name the file, say what is
  wrong and say what to do. Show those sentences; do not write second ones in
  `de.json` that will drift from them.
- **Reuse `AnlagenPicker`.** It already solved the hidden input, the single tab stop
  and the focus ring, and the reasoning is written in its own comment. Give it an
  `accept` prop with today's image list as the default rather than copying it.
- **Violations go into `pruefungsStore`, untouched.** The panel already reads it on
  mount. Do not build a second panel, and do not teach the existing one a second
  source for the same thing.
- **`quellversion` is the file's version, never the protocol's.** The protocol is
  stamped with this application's. Showing the file's is fine and saying it is the
  protocol's is wrong. An old template is not an old survey: all three real files
  record surveys from 2026 on templates from 2023 and 2024, so nothing about the
  import may treat an old stamp as an old record.
- **Never check the file in the browser.** No size check, no type check, no peek at
  the bytes. `accept` is a hint to the dialog. The server decides.
- **Say what did not come over.** A silent import that drops a date and four
  photographs is worse than a refusal, because nobody finds out until a reviewer
  does. An attachment is part of the protocol.
- **Nothing dismisses the problem list.** The banner is dismissable because it is an
  explanation. The list of what is wrong is not, for the reason
  `AbsendeProbleme.tsx` already gives: closing it would destroy the one thing saying
  what is left.
- **Every message names the thing, says why, and says what to do.** That is the
  project's rule for user-facing errors and it applies to the two new ones here as
  much as to the backend's.
- **The list page must survive a refusal.** A rejected import leaves the page, the
  table and the scroll position exactly where they were. Nothing navigates until the
  server has answered with a protocol.
- **A session that expires mid-upload is not an import failure.** The endpoint
  answers 401 and `SitzungsWaechter` already owns what happens next. Do not write a
  sentence about the PDF for it; let it fall through to the handling every other
  call on this application already gets.
- **Two stores, one protocol, written together.** Step 3 writes `pruefungsStore` and
  the new report in the same place, before navigating. If one write is added later
  without the other, a protocol arrives showing half its report, so keep them in the
  one function that already knows both.
