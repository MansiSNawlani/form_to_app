# Feature: Anlagen - photo and map excerpt upload

**From build-plan:** feature 10
**Status:** built, awaiting manual verification in a browser

## Goal

A surveyor can attach the map excerpt showing where the stretch is, and photographs of it,
to a protocol. Today that happens by emailing loose files alongside the PDF, which arrive
detached from the protocol they belong to and get matched up by hand.

With the map picker deferred to feature 18, this is the only way version 1 records where a
survey actually happened beyond a pair of typed coordinates. `docs/decisions.md` pulled
attachments forward into version 1 for exactly that reason: deferring the map picker and
the attachments together would have made version 1 document location worse than paper.

## Where this sits in the build order

Out of the recorded order, by decision on 2026-09-06. `build-plan.md` says 4 to 9, then 2
and 3, then 10 onward. Features 2 (login) and 3 (server drafts) are still unbuilt, so the
backend has only its health and readiness endpoints and there is nowhere on the server to
put a file.

**This feature is therefore browser-only**, on the same terms features 4 to 9 accepted:
files live in the browser they were picked in, and feature 3 swaps the storage layer
without touching the components above it. The cost is one module, `anlagen/store.ts`, whose
body feature 3 replaces with API calls. Everything else - the contract, the rules, the
blocks, the section - is permanent.

`localStorage` is not an option here. It holds around 5 MB in total and a single phone
photo can exceed that on its own, so attachments go in IndexedDB, which is the second
storage mechanism this feature introduces and the one feature 3 retires.

## Design reference

No mockup exists for this section. `prototypes/` covers the submissions list, part 1 and the
reviewer view only, and none of them show attachments.

The section is built from the vocabulary the other six sections already use: `.card`,
`.form-section`, `.form-block` and the twelve column grid in
`frontend/src/protokoll/protokoll.css`, with MUI components themed in `muiTheme.ts`. No new
visual language. If that turns out to need a mockup once the blocks exist, ask before
inventing one.

## What the legacy form has

Five image slots, read out of `database/seed/form_version_20260609/felder.json`:

| Legacy field | What it is |
|---|---|
| `fotos.kartenausschnitt_image` | the map excerpt, one only |
| `fotos.bild1` to `fotos.bild4` | photographs, four slots |

They are PDF image buttons, not text fields, so nothing about them is stored in the
`antworten` document. That matches the data model: `Attachment` is its own entity with an
`art` of `KARTENAUSSCHNITT` or `FOTO`.

**We do not inherit the four.** Decided on 2026-09-06. Four is how many image buttons fitted
on the printed page, not a rule about how many photographs a survey may have, and a surveyor
who took eight useful pictures of a stretch should not have to pick four and email the rest.
The cap here is **twenty**, which exists only as a safety valve against a browser running out
of room, not as a judgement about the survey. One photograph and twenty are both normal.

The map excerpt stays at exactly one, because there is one stretch and one excerpt of it.
That limit is about the thing, not about the page.

## In scope

- One `Kartenausschnitt` slot: pick, preview, replace, remove.
- Up to twenty `Fotos`: pick, preview, remove, with the count shown. Several at once from
  one picker, since twenty added one at a time is twenty dialogs.
- A seventh section, `Anlagen`, reachable from the step bar like any other.
- The `Anlage` record shape, mirroring the `Attachment` model so feature 3 is plumbing.
- Browser storage for the files themselves, in IndexedDB, keyed to the draft.
- The rules on what may be attached: accepted image types, a size cap, the count caps.
- The failure paths: a rejected file, a full disk, a browser that will not open the
  database at all, and a draft opened before its attachments have loaded.

## Out of scope

- **Any server storage.** No upload endpoint, no `Attachment` table, no migration. Feature 3
  owns the move from browser to server, and feature 2 owns the authorisation on it.
- **Image processing.** No resizing, compression, rotation or EXIF reading. The file is
  stored as picked.
- **Drawing the map.** Feature 18 is the map picker; feature 20 draws the excerpt from
  stored geometry. This feature accepts an image somebody else produced.
- **Attachments in the review view.** Feature 11 builds the reviewer's screen.
- **Deleting a draft's attachments when the draft goes.** Nothing deletes a draft yet, so
  there is no orphan to clean up. Noted in `store.ts` for feature 3.
- **Submission-time requirements.** Whether a protocol may be submitted without a map
  excerpt is feature 11's gate, not this one's. A draft with no attachments is normal.

## What a refusal says

Decided on 2026-09-06. Every message this feature shows when a file will not go in must do
three things, and a message doing only the first is not finished:

1. **Name the file.** "IMG_4471.HEIC" and not "the file", because a pick can hold twenty and
   the surveyor has to know which one to go back for.
2. **Say why in ordinary words.** Not a MIME type, not a byte count, not "invalid". The
   person reading this is standing in a field office, not debugging a browser.
3. **Say what to do instead.** A concrete next action they can actually take. This is the
   part that is usually missing and it is the part that matters.

Worked out per reason. Exact German wording is settled when the strings are written; what is
fixed here is that each reason gets its own message and its own way out.

| Reason | What the message has to get across |
|---|---|
| **iPhone photo (HEIC)** | Their iPhone saved this photo in a format browsers cannot show. Two ways out, both plain: on the iPhone, Einstellungen > Kamera > Formate > "Maximale Kompatibilität" makes future photos work; for this photo now, opening it and sharing or exporting it produces a JPG that will. |
| **Some other file type** | This is not a picture. Name what is accepted in words a person uses, JPG, PNG or WEBP, rather than MIME types. |
| **Too large** | Say the file's own size and the limit in MB, then the way out: most phones and photo apps can send or export a smaller version. |
| **No room left** | Say how many are already attached and that one has to go first. Not "limit exceeded". |
| **The browser ran out of space** | This one is not the surveyor's mistake, so it must not read like one. Say the browser has no room left for this protocol, that nothing already attached was lost, and what actually helps: free space on the device, or attach fewer or smaller pictures. |
| **The browser will not store anything at all** | Private browsing or a locked-down profile. Say that attachments cannot be saved in this window, and to use a normal window or another browser. |

**HEIC is not converted.** A converter is a couple of megabytes of WebAssembly for a case iOS
already handles: a photo picked through a file input on an iPhone arrives as JPEG on its own.
The gap is the desktop route, where a HEIC file was copied off a phone first, and that is
worth a good message rather than a large dependency. If FFS reports it biting in real use,
that is a decision to revisit with them, not one to pre-empt here.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The `Anlage` contract and the browser store.** Add
      `protokoll/anlagen/typen.ts` with the record shape, and `protokoll/anlagen/store.ts`
      with `createAnlagenStore({ speicher, now, createId })` over a narrow `AnlagenSpeicher`
      interface, plus the IndexedDB implementation of that interface. Same shape as
      `entwurf/store.ts`: storage, the clock and the id generator are arguments, so the
      tests need no browser. Operations: list by draft, add, remove, read one file back.
      *Done when:* `npm test` passes new cases in `anlagen/store.test.ts` covering add, list
      ordered oldest first, remove, a write that fails on a full disk returning a failed
      result rather than throwing, and a database that will not open degrading to an empty
      list instead of breaking the page.

- [x] **Step 2 - The rules on what may be attached.** Add `protokoll/anlagen/regeln.ts`: a
      plain function taking one picked file, the kind of attachment, and how many of that
      kind are already there, returning an i18n key for what is wrong or nothing. Rules: the
      type must be one this browser can display, the file must be under the size cap, and
      there must be room. No React and no German in it, matching `regeln/regel.ts`.

      One file at a time, not a batch, even though the Fotos picker takes several at once.
      The block feeds them through in turn and raises its own running count as each is
      accepted, so picking five when eighteen are already there stores two and reports three
      by name. A batch rule would have to decide that ordering itself and would be harder to
      test for it.

      **A separate key per reason, never one shared "not allowed".** The whole point of the
      distinction is the message: each reason has a different way out, and a message that
      does not say the way out is not finished. See "What a refusal says" below.

      Record the divergence from the legacy form's four slots as question 11 in
      `docs/ffs-questions.md`.
      *Done when:* `npm test` passes new cases in `anlagen/regeln.test.ts` for an accepted
      file, a HEIC file getting its own key rather than the generic type one, another
      rejected type, a file over the size cap, a second map excerpt, and a photo arriving
      when twenty are already there; and `docs/ffs-questions.md` carries question 11.

- [x] **Step 3 - The section exists and is reachable.** Add the seventh entry to
      `ABSCHNITTE`, `abschnitte/Abschnitt7.tsx` with the two block headings and nothing in
      them yet, the `case 7` that `AbschnittInhalt`'s exhaustive switch now demands, and the
      German strings. No storage and no picking yet.
      *Done when:* `/protokolle/:id/abschnitt/7` renders the section, the step bar shows
      seven steps and reaches it by mouse and by keyboard, the previous and next buttons
      move 6 to 7 and stop there, `npm run build` is green, and no string on screen is a
      hard-coded German literal.

- [x] **Step 4 - The Kartenausschnitt block.** One slot in
      `abschnitte/teil7/KartenausschnittBlock.tsx`: a labelled file picker, and once a file
      is there, its preview, name and size with buttons to replace or remove it. Wire it to
      the store and the rules from steps 1 and 2. Build the whole refusal path here, with
      the first block that can hit it: every message in the "What a refusal says" table
      lands in this step, including the full-disk one, because a half-built error path is
      how the vague message survives to the end of the feature. Preview object URLs are
      revoked when they are replaced and on unmount.
      *Done when:* in the browser, picking an image shows it and it survives a reload;
      picking a second replaces the first; remove empties the slot; a `.txt`, a HEIC file
      and an oversized image are each refused with their own message, each naming the file
      and saying what to do instead, and nothing is stored in any of those cases; and no
      object URL is left behind (checked in the browser's memory tools).

- [x] **Step 5 - The Fotos block.** `abschnitte/teil7/FotosBlock.tsx`: up to twenty, each
      shown as a preview with its name and size and its own remove button, laid out as a
      grid that stays readable at twenty. The picker takes several files at once
      (`multiple`), since twenty added singly is twenty dialogs. A pick that partly fails
      stores what passed and names what did not, one message per refused file. The count is
      printed beside the heading. Removing asks first, in an MUI dialog, because a removed
      photo cannot be recovered.
      *Done when:* in the browser, several photos picked in one go all appear and survive a
      reload; twenty can be reached; the twenty-first is refused by name while the rest of
      that same pick is kept; a pick mixing three good files with a HEIC and a `.txt` stores
      the three and shows two messages naming the two files and what to do about each;
      removing asks and only then removes; cancelling the question changes nothing; the
      count reads correctly after every add and remove; and the grid is still readable with
      twenty in it.

- [x] **Step 6 - The states around the edges, and the accessibility pass.** The section
      while its attachments are still loading, a browser that refuses the database
      altogether, and the empty section with nothing attached. Then the pass both blocks
      need: every picker labelled, every preview with alternative text naming what it is,
      focus moved somewhere sensible after a removal rather than left on a button that is
      gone, and each block's result announced once through a live region.
      Read every message on the screen back against the "What a refusal says" table before
      calling this step done. Any that names no file, or gives no way out, gets rewritten
      here.
      *Done when:* the loading and unavailable states each render with a message rather
      than a blank area; every refusal message names its file and ends with something the
      reader can actually do; a screen reader hears each refusal once; keyboard alone can
      add, replace and remove in both blocks; focus never lands on nothing; contrast holds
      in light and dark against our tokens; and `npm run build` and `npm test` are both
      green.

- [x] **Step 7 - The section bar, found during the build.** Not in the original plan. Adding
      a seventh section pushed the step bar past the 1180px content column at every window
      size, so its horizontal scrollbar stopped being a narrow-screen fallback and became
      permanent. The bar now wraps into an even grid instead of scrolling.
      *Done when:* the bar shows all seven sections with no scrollbar at desktop width, every
      label keeps its full wording, the cells are the same size across both rows, and the
      columns reduce on narrower windows without a breakpoint of our own.

## Files / areas

**New**

- `frontend/src/protokoll/anlagen/typen.ts` - the `Anlage` record. Load-bearing.
- `frontend/src/protokoll/anlagen/store.ts` - the browser store and its IndexedDB adapter.
  The one module feature 3 replaces.
- `frontend/src/protokoll/anlagen/store.test.ts`
- `frontend/src/protokoll/anlagen/regeln.ts` - what may be attached.
- `frontend/src/protokoll/anlagen/regeln.test.ts`
- `frontend/src/protokoll/anlagen/useAnlagen.ts` - loading and mutating the list for a
  draft, so neither block reads storage directly.
- `frontend/src/protokoll/abschnitte/Abschnitt7.tsx`
- `frontend/src/protokoll/abschnitte/teil7/KartenausschnittBlock.tsx`
- `frontend/src/protokoll/abschnitte/teil7/FotosBlock.tsx`
- `frontend/src/protokoll/abschnitte/teil7/AnlagenVorschau.tsx` - one attachment as a
  preview with its details, shared by both blocks.

**Changed**

- `frontend/src/protokoll/abschnitte.ts` - the seventh entry.
- `frontend/src/protokoll/abschnitte/AbschnittInhalt.tsx` - `case 7`. Its switch is
  exhaustive on purpose, so this is currently a build error and not a blank page.
- `frontend/src/i18n/locales/de.json` - the `abschnitt7` and `anlagen` blocks. Not
  `en.json`: `i18n/index.ts` keeps that a deliberate two-key stub until feature 17, and
  sections 1 to 6 have no English either.
- `frontend/src/protokoll/protokoll.css` - only if the preview grid needs something the
  twelve column grid cannot do.
- `docs/ffs-questions.md` - question 11.

## Data / contracts

**`Anlage`** - load-bearing, mirroring the `Attachment` model in `project-overview.md` so
feature 3 sends it straight up rather than reshaping it.

```ts
export type Anlagenart = 'KARTENAUSSCHNITT' | 'FOTO'

export interface Anlage {
  id: string          // uuid
  entwurfId: string   // becomes submission_id
  art: Anlagenart
  dateiname: string
  mimeType: string
  groesse: number     // bytes
  angelegtAm: string  // ISO, becomes created_at
}
```

The file itself sits beside that record in IndexedDB as a `Blob`. Server-side it becomes
`storage_key`, so the two are deliberately kept apart: the metadata is the part that
travels, and no component should ever hold a `Blob` it did not ask for.

**Not in `Antworten`.** The answers document is text answers only, it is what feature 3
sends as one JSON body, and the legacy form has no field path for an image. Anything that
puts an attachment in there has to be sent back.

**Caps**, all in `regeln.ts` and nowhere else:

| Rule | Value | Why |
|---|---|---|
| Kartenausschnitt | exactly 1 | one stretch, one excerpt of it |
| Fotos | up to 20 | not the legacy form's four, which was a page-layout limit. Twenty is a safety valve, not a judgement. Question 11 for FFS |
| Types | `image/jpeg`, `image/png`, `image/webp` | what every target browser can display |
| Size | 10 MB per file | a phone photo is 2 to 8 MB |

Twenty photographs at 10 MB each is 200 MB for one protocol, and a surveyor may hold several
drafts at once. That is inside what IndexedDB allows on a normal machine, which is a share of
free disk rather than a fixed few megabytes, but it is no longer comfortably inside it. So the
full-disk path is a first-class case here rather than a defensive afterthought: a write that
fails must say so, name the file, and leave everything already stored untouched.

**Storage keys.** One IndexedDB database, `ffs-anlagen`, one object store keyed by the
attachment id with an index on `entwurfId`. Namespaced like `KEY_PREFIX` in the draft store.

## Testing

`npm test` (vitest, from `frontend/`) is the declared frontend test command, so the two
logic-bearing steps ship tests in their own diff:

- **Step 1, `anlagen/store.test.ts`** - add, list, remove, read back; a full disk returning
  a failed result rather than throwing; an unopenable database degrading to empty. Tested
  through a fake `AnlagenSpeicher`, exactly as `entwurf/store.test.ts` tests through a fake
  `Storage`. The IndexedDB adapter itself is verified in the browser, not unit tested, on
  the same footing as `browserStorage()`.
- **Step 2, `anlagen/regeln.test.ts`** - one case per rule, accepted and refused.

Steps 3 to 6 are components and integration, which `coding-standards.md` says to verify with
browser evidence and the build rather than unit tests. For those:

- Start the dev server from `frontend/`, open a draft, go to section 7.
- Add a map excerpt and several photos in one pick, reload, and confirm they are all there.
- Fill to twenty photos and confirm the grid is still readable and the page still responsive.
- Refuse cases: a `.txt`, a HEIC file, an image over 10 MB, a twenty-first photo, and one
  pick mixing accepted and refused files. Not a second map excerpt: the single slot replaces
  rather than adds, so that rule guards the store and feature 3's Pydantic half rather than
  the screen, and is proved in `regeln.test.ts` instead.
- Remove one of each and confirm the reload agrees.
- Tab through the whole section with no mouse.
- Both themes, checked against our tokens rather than assumed.
- `npm run build` and `npm test` green before any checkpoint.

There is no `Verify` command yet, so the build and the two test commands are the gate.

## Notes for the AI

- **Do not touch the backend.** No models, no endpoints, no migration. That is features 2
  and 3, and pulling it forward is exactly the scope creep this spec exists to prevent.
- **`store.ts` is the seam.** Feature 3 replaces its body and leaves the interface alone, so
  keep IndexedDB inside it. No component imports IndexedDB, and no component holds a
  database handle.
- **MUI first**, per `coding-standards.md` and the widening on 2026-09-05: `Button`,
  `Dialog`, `FormControl`, `FormLabel`, `Alert`. The file input itself has no MUI
  equivalent, so it is a visually hidden native `<input type="file">` behind an MUI
  `Button component="label"`, which is MUI's own documented pattern. That is the narrow "MUI
  has no equivalent" case, not a licence to hand-roll the rest.
- **`@mui/icons-material` is not installed.** Use text buttons, not icon buttons. Do not add
  the package without asking.
- Anything MUI renders in more than one place here gets themed once in `muiTheme.ts`, not
  restated per instance.
- **Every string comes from the locale files**, German and English both, and the label sits
  above the field via `FormLabel` inside a `FormControl`, never `InputLabel`.
- Rules return i18n keys, never sentences, so feature 17 can translate them.
- **Revoke every object URL.** A preview that is never revoked holds its whole file in memory
  for as long as the tab is open, and a surveyor keeps this tab open all day. At twenty
  photographs that is up to 200 MB pinned by an oversight nothing on screen would show. The
  cap was raised on 2026-09-06, which is what makes this the sharpest edge in the feature.
- **No message stops at what went wrong.** Every refusal names the file, says why without a
  MIME type or a byte count, and ends with something the reader can do about it. The table
  under "What a refusal says" is the bar, and it applies to the browser-out-of-space case as
  much as to a wrong file type: that one is not the surveyor's mistake and must not read
  like one. Decided on 2026-09-06.
- **HEIC gets its own message, not the generic one.** iPhones store photos as HEIC and no
  browser renders it in an `<img>`. iOS converts to JPEG when a photo is picked through a
  file input, so the common path already works; the gap is a HEIC file copied off a phone
  first. Do not add a converter for it, and do not fold it into the generic type message,
  because the way out is specific and is the only useful thing the message can say.
- German for the domain and for route paths, English for component and variable names, as
  everywhere else in this project.
