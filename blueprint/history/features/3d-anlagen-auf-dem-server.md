# Feature: 3d. Attachments on the server

**From build-plan:** feature 3d, the last of four sub-features under item 3
**Status:** complete

## Goal

Give a protocol's map excerpt and photographs the server that feature 10
promised them.

Feature 10 built the whole attachments section, but there was no login and no
server-side draft, so the files went into the browser's own database. That means
a photograph taken on a laptop is on that laptop: a different machine shows
nothing, clearing site data destroys it, and FFS never receives it. The
protocol's answers stopped being browser-only in 3b. Its pictures are the last
thing still stuck there, and without them a submitted protocol arrives without
the one thing that says where the survey actually happened.

This sub-feature builds the `attachments` table, the file storage behind it, the
four endpoints, and the swap of `anlagen/store.ts` from IndexedDB to those
endpoints. It also closes the "written twice" gap for attachments: the rules
feature 10 wrote in TypeScript gain their Python half here, which is what makes
them real, because a browser rule is a convenience and never a gate.

With this done, item 3 is complete and nothing in the application is
browser-only any more.

## Design reference

None, and none is needed. Nothing new appears on screen: the section, the two
blocks, the previews and every message were built in feature 10 and stay exactly
as they are. What changes is where the bytes go.

The one visible change is a consequence rather than a design: a preview's
picture now comes from a URL on our own server instead of from a blob in the
browser, so the picture may take a moment to appear where before it was
instant.

## In scope

- An `attachments` table with its Alembic migration, and a place on disk for the
  files themselves.
- Four routes under `/api/v1/protokolle/{id}/anlagen`: upload, list, download,
  delete. Ownership enforced on every one, with the permission tests
  `coding-standards.md` makes non-optional.
- The Python half of `anlagen/regeln.ts`: the accepted types, the size cap and
  the two count caps, plus the one check a browser cannot do, which is whether
  the bytes really are the picture the request claims.
- Deleting a protocol deleting its attachments and their files, which
  `protokolle/dienst.py` already carries a note asking for.
- `anlagen/store.ts` swapped from IndexedDB to those routes, behind the same
  interface, which is the seam feature 10 built it around.
- Attaching a file to a protocol that has not been created yet creating it
  first, the same way typing into one does since 2026-09-10.
- The failure paths a server has and a browser database does not: the session
  ran out, the backend is unreachable, the protocol is gone.
- Retiring the `ffs-anlagen` IndexedDB database, so files from feature 10's
  testing do not sit in browsers forever with nothing pointing at them.

## Out of scope

- **Anything about how the section looks.** Feature 10 built it and it is
  approved. No new blocks, no new layout, no new copy except for the failures
  that are genuinely new.
- **Attachments in the review view.** Feature 11 builds the reviewer's screen.
- **Requiring an attachment to submit.** Whether a protocol may be submitted
  with no map excerpt is feature 11's gate. A draft with no attachments stays
  normal.
- **Image processing.** No resizing, compression, rotation, EXIF reading or
  thumbnailing. The file is stored exactly as picked, as feature 10 decided.
  Twenty full size photographs on one screen is a performance question worth
  measuring once real ones exist, not worth pre-empting with a thumbnail
  pipeline nobody has asked for.
- **HEIC conversion.** Feature 10 decided against it and nothing here changes
  the reasoning.
- **Object storage.** See Data and contracts for why the files go on a volume in
  version 1 and what would make that worth revisiting.
- **Importing what is already in somebody's browser.** There are no real users,
  and feature 10's files are keyed by draft ids that stopped existing when 3b
  moved drafts to the server. There is nothing to import, only something to
  clear away.
- **Virus scanning.** Worth raising with FFS as a deployment question, since
  external consultants upload here. It is a piece of infrastructure and a policy
  decision, not application code, and pretending to it with a half measure would
  be worse than being explicit that it is not done. Recorded as a question for
  FFS in this feature, not built.
- **Anything about `probestrecke_id`, `person_id` or the rest of the envelope.**
  Still feature 11's, exactly as 3a left it.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Somewhere to put a file.** `app/anlagen/speicher.py`: write,
      read and delete one file, under a directory named by a new
      `ANLAGEN_VERZEICHNIS` setting in `config.py`. A named Docker volume behind
      it in `docker-compose.yml`, the variable in `.env.example`, and the
      default pointing somewhere sensible for a developer running uvicorn on the
      host.

      **The storage key is built from ids we generated, never from anything in
      the request.** `<submission_id>/<attachment_id>`, both UUIDs. A key built
      from a filename is how a path like `../../etc/passwd` gets written, and
      that whole class of problem disappears if the filename never reaches the
      path at all. The original filename is stored in a column, where it is data
      rather than a path.

      *Done when:* `pytest` passes new cases in `app/anlagen/speicher_test.py`
      covering a write and read back, a delete, a delete of something that is
      not there being quiet rather than an error, a key that a filename cannot
      influence (a file called `../../boom.jpg` still lands under its own id),
      and reading a key whose file is missing coming back as nothing rather than
      raising; and `docker compose up -d --build` leaves `/api/v1/ready`
      answering 200 with the volume mounted.

- [x] **Step 2 - The rules, in Python this time.** `app/anlagen/regeln.py`
      mirroring `frontend/src/protokoll/anlagen/regeln.ts` value for value: the
      three accepted types, the 10 MB cap, one Kartenausschnitt, twenty Fotos.
      Plain functions taking values and returning values, no HTTP and no
      database, in the shape `app/protokolle/regeln.py` already uses. Typed
      errors in `app/anlagen/fehler.py` and their line in
      `app/api/fehler_http.py`.

      Plus the one check the browser cannot make: **the bytes have to be the
      picture the request says they are.** A browser reports the type it guessed
      from the file's extension and a request can simply claim any type it
      likes, so an HTML file named `karte.jpg` would otherwise be stored and,
      worse, served back from our own origin later. The first bytes of a JPEG, a
      PNG and a WEBP each say what they are, and that signature is the only
      trustworthy evidence in the request.

      *Done when:* `pytest` passes new cases in `app/anlagen/regeln_test.py` for
      an accepted file of each of the three types, a claimed type that is not on
      the list, a real JPEG claiming to be a PNG, an HTML file claiming to be a
      JPEG, a file over the cap, a second Kartenausschnitt and a twenty-first
      Foto; and the refusals name the file and carry no bytes from it.

- [x] **Step 3 - The attachments table.** `app/models/anlage.py` with the
      `Attachment` model exactly as `project-overview.md` shapes it, its Alembic
      migration, the foreign key to `submissions` with `ON DELETE CASCADE`, a
      check constraint over the two `art` values written out of the enum the way
      `status_bekannt` is, and a partial unique index giving a submission at
      most one `KARTENAUSSCHNITT`.

      The index is the point of doing it here rather than only in the rule. A
      cap that lives only in application code is a cap two requests arriving
      together can walk straight past, and the single map excerpt is the one cap
      where a duplicate would be silently wrong rather than merely untidy.

      The generated migration is read before it is kept, as `AGENTS.md`
      requires: autogenerate does not see check constraints and will not draft
      the partial index on its own.

      *Done when:* `alembic upgrade head`, `alembic downgrade -1` and
      `alembic upgrade head` all run cleanly; `alembic check` reports no drift;
      `pytest` passes, including a case proving a second Kartenausschnitt is
      refused by the database itself and one proving deleting a submission takes
      its attachment rows with it.

- [x] **Step 4 - Uploading and listing.** `POST .../anlagen` and
      `GET .../anlagen`, with `app/anlagen/dienst.py` under them. Ownership
      comes from `hole_protokoll`, so a stranger gets the same 404 the protocol
      itself gives, and `pruefe_aenderbar` applies: a protocol that has been
      submitted takes no new attachments.

      **The size cap is enforced while the file is read, not after.** Reading it
      all in and then checking means a client can send two gigabytes and have us
      hold every byte of it first. Read in chunks, stop the moment the count
      passes the cap, and keep nothing.

      The file lands on disk first and the row second, and if the row fails the
      file is removed. That order is deliberate: a row pointing at a file that
      is not there shows a surveyor a broken picture and has no way back, while
      a file with no row is invisible and costs only disk.

      *Done when:* `pytest` proves an upload stores the row and the file and
      answers 201 with the record; the list holds that protocol's attachments,
      oldest first, with no bytes in it; every refusal from step 2 comes back
      with its own code and nothing is stored; a file past the cap is refused
      without being read to the end; **a submitter can neither upload to nor
      list another submitter's protocol, and gets 404**; and uploading to a
      protocol that is not a draft is refused with 409.

- [x] **Step 5 - Downloading and deleting.** `GET .../anlagen/{id}/datei`
      answering with the bytes, and `DELETE .../anlagen/{id}`. Then the note
      `protokolle/dienst.py` already carries: deleting a protocol deletes its
      attachments' files, not only their rows, or the pictures stay on the
      volume forever with nothing pointing at them.

      **How the file is served is a security decision, not a detail.** It comes
      back with the type stored in the database rather than anything from the
      request, with `X-Content-Type-Options: nosniff` so a browser cannot decide
      for itself that it is HTML, and with `Content-Disposition: attachment` so
      opening the address directly downloads rather than renders. Together they
      mean that even if something got past step 2, it cannot execute against our
      own origin and read the session cookie of whoever opened it. A preview
      still works: an `<img>` ignores `Content-Disposition` entirely.

      Delete takes the row first and the file second, which is the same
      reasoning as step 4 in reverse.

      *Done when:* `pytest` proves the download returns the stored bytes with
      the stored type, `nosniff` and `Content-Disposition` set; **a submitter
      cannot download or delete another submitter's attachment, and gets 404**;
      an attachment id belonging to a different protocol also gets 404 rather
      than being served; delete removes the row and the file; and deleting a
      protocol leaves neither rows nor files behind.

- [x] **Step 6 - The browser talks to the server.** `anlagen/api.ts` with the
      four calls, and the body of `anlagen/store.ts` replaced with them behind
      the interface it already has. `AnlagenVorschau` points its `<img>` at the
      download address instead of building an object URL, which retires the
      revoke-every-URL rule feature 10 called its sharpest edge. The
      `ffs-anlagen` IndexedDB database is deleted on load, once, so feature 10's
      test files do not sit in browsers forever.

      Upload is `multipart/form-data`, which `api/client.ts` does not do today:
      it sets a JSON content type and stringifies every body. It gains a way to
      send a `FormData` unchanged, letting the browser set the boundary itself,
      which is the one case where setting `Content-Type` by hand breaks the
      request.

      *Done when:* `npm test` passes new cases in `anlagen/api.test.ts` covering
      the method, path and body of each of the four calls, and in
      `api/client.test.ts` covering a `FormData` body going out with no
      `Content-Type` header set by us; in the browser, a picked photograph
      appears, survives a reload, survives a different browser signed in as the
      same account, and is gone from every one of them after a delete; and
      `npm run build` is green.

- [x] **Step 7 - Attaching creates the protocol, and the new failures say
      something useful.** Since 2026-09-10 a protocol is created by the first
      thing typed into it, so a surveyor who opens `/protokolle/neu` and goes
      straight to section 7 is looking at a protocol with no server id at all.
      Attaching a file is putting something into it, so it creates the record
      first, exactly as the first keystroke does, and `useAutoSave` already has
      the shape to copy.

      Then the failures a server has and a browser database never did. Feature
      10's refusal table is the bar and it applies to these too: name the file,
      say why in ordinary words, say what to do. The session running out is the
      important one, because the surveyor's answer is to sign in again and their
      typing is still safe, and a message that does not say so reads like lost
      work.

      *Done when:* in the browser, attaching a photograph to a protocol nobody
      has typed into creates it, moves the address to the real id and keeps the
      photograph; the "Meine Protokolle" list still gains nothing from a
      protocol that was opened and abandoned; every new failure has its own
      message naming the file and a way out; `npm test`, `npm run build` and
      `pytest` are all green; and `docs/ffs-questions.md` carries the virus
      scanning question.

- [x] **Step 8 - An attached photograph counts as working on the protocol.**
      Found on 2026-09-11 by trying the built feature: adding a photograph left
      "Zuletzt bearbeitet" in Meine Protokolle showing the last time an *answer*
      was saved. The list is sorted by that column, so a protocol somebody had
      just spent ten minutes adding twenty photographs to sank below ones they
      had not touched in days.

      The cause is not a mistake in the code so much as a gap in the spec: the
      timestamp is maintained by `onupdate` on the `submissions` row, and an
      attachment is a row in a different table. Adding one never touches the
      protocol, so nothing re-stamps it. Removing one has the same gap.

      A helper in `app/protokolle/dienst.py` stamps the protocol, used by both
      `lege_anlage_an` and `loesche_anlage`, so there is one place that decides
      what counts as working on a protocol and feature 11 inherits it.

      **It must not raise `version`.** That number exists so two open tabs cannot
      overwrite each other's answers. A photograph changes no answer, so bumping
      it would make the form in another tab fail its next save with a conflict
      that is not real.

      *Done when:* `pytest` proves that attaching moves `updated_at`, that
      removing an attachment moves it, that neither changes `version`, and that
      a protocol whose only recent activity was a photograph sorts to the top of
      the list; and in the running app, attaching a photograph and going back to
      Meine Protokolle shows the protocol freshly edited and at the top.


- [x] **Step 9 - The save indicator covers attachments too.** Found on
      2026-09-11, the same way step 8 was: uploading a photograph drove nothing
      in the header, which only ever tracked the answers document.
      `project-overview.md` requires that saving is automatic and **its state is
      always visible**, and an upload is saving, so that requirement was half
      kept. There was no in-flight feedback of any kind either: the picker stayed
      enabled, so a slow upload looked exactly like a click that did nothing and
      invited a second pick of the same files.

      One indicator, not two. The header speaks for the whole protocol, so a
      photograph that has landed makes it read "gespeichert um 09:14" exactly as
      a typed answer does. Decided with Mansi on 2026-09-11. The cost, accepted:
      the time no longer refers only to the answers. Two indicators side by side
      would be worse, because the question a surveyor is asking is "is my work
      safe", not "which half of my work is safe".

      A plain function decides what the header shows when the form and the
      attachments each have something to say, so the precedence is testable
      without React:

      1. Anything still in flight wins. Either one saving means "wird
         gespeichert".
      2. A problem with the answers outranks a success with a picture, so a
         conflict or a failed save is never hidden by a photograph that landed.
      3. Otherwise whichever was saved most recently.
      4. Otherwise the form's own state.

      **An attachment never reports a failure to the header.** The block already
      shows one message per refused file, naming the file and what to do about
      it, and the header could only say something vaguer about work that is in
      fact safe. Two messages for one event is how the useful one gets missed.

      No per-file progress bars. Twenty of them is a lot of moving parts for a
      wait that is usually short, and a preview appearing already says which file
      landed. Worth revisiting if FFS reports real waits on field connections.

      *Done when:* `npm test` passes new cases for the precedence function,
      including an upload in flight outranking a saved form, a conflict
      outranking a landed photograph, and a photograph landing on a protocol
      whose answers were never saved; in the running app, picking a photograph
      makes the header read "wird gespeichert" and then "gespeichert um" with the
      time, removing one does the same, the picker cannot be used while a pick is
      in flight, and a refused file leaves the header alone while the block names
      it; and `npm run build` and `npm run lint` are green.

## What changed during the build

Four departures from the spec above, each decided and explained when it happened.

**`anlagen/store.ts` was deleted rather than gutted.** The spec kept its interface
and swapped the body. In the event, "store" is the wrong word for something that
stores nothing, and the project already had the precedent: feature 3b deleted
`entwurf/store.ts` and created `entwurf/api.ts` in its place. The seam still held,
which was the point: no block changed, only `useAnlagen` and one image source.

**`Anlage`'s field names became the server's own**, `submission_id` and
`mime_type` and `created_at` rather than `entwurfId`, `mimeType` and `angelegtAm`.
`entwurf/typen.ts` already matches the server this way. A translation layer is a
place for two spellings of one field to drift apart.

**`liste/aufraeumen.ts` was retired.** It existed to delete a draft's browser
attachments after a protocol was deleted. The server does that now, so it
collapsed to one line, which is inlined in `useLoeschen.ts` rather than left as an
indirection doing almost nothing.

**Replacing the Kartenausschnitt reversed its ordering.** Feature 10 stored the
new file before removing the old one, precisely so a refused replacement could not
destroy the picture already there. The database's partial unique index makes that
impossible on a server: "new first" is refused every time there is something to
replace. The old one goes first now, and the cost is that a replacement which then
fails leaves the slot empty. Three things keep it from being a trap: the browser
rules run first so the common refusals never get that far, the refusal says
plainly that nothing is attached now, and unlike a browser database the removed
file is still on the surveyor's own machine.

Steps 8 and 9 were not in the plan at all. Both were found by Mansi trying the
built feature after every automated check had passed, and both had the same root
cause: the attachments were built through their own path and the surfaces that
report on a protocol were only wired to the answers path. Each looked correct in
isolation. That is worth carrying into features 11, 12, 15 and 20, every one of
which reports on a protocol and could quietly describe only its typed answers.

## How this was verified

There is no `Verify` command yet, so the gate was `pytest` from `backend/`, and
`npm test`, `npm run build` and `npm run lint` from `frontend/`, plus `ruff` and
`mypy`. At completion: **425 backend tests** and **889 frontend tests**, with the
backend suite run twice to confirm it was stable.

The migration was run up, down and up again, and `alembic check` reported no drift.

The API was proved against the real stack rather than only through the test
client: signing in, creating a protocol, uploading a genuine PNG, having an HTML
file named `karte.jpg` refused, having a second Kartenausschnitt refused, reading
the download's headers, deleting an attachment and then a whole protocol, and
confirming the volume was empty each time by listing it inside the container. The
upload was also proved through the Vite dev proxy, since multipart through a proxy
is a real thing that can break.

Two defects were caught by running things rather than reading them. The list's
ordering was wrong because `now()` in Postgres is transaction-start time, so rows
written together shared a timestamp and the tie-break fell to a random uuid; that
is why `attachments.created_at` and `beruehre()` both use `clock_timestamp()`. And
a test written in step 8 asserted an order that was a coin toss for the same
reason, which the final full run caught and which is now documented in the test
itself.

The browser done-whens of steps 6, 7 and 9 were verified by Mansi rather than by
an automated check. No browser automation exists on this project and
`coding-standards.md` rules out adding Playwright mid-feature, so the agent side
proved the API, the rules, the headers and the strings, and the manual pass
covered picking, previews, the header indicator and survival across a reload.

## Files / areas

**New, backend**

- `backend/app/anlagen/__init__.py`
- `backend/app/anlagen/speicher.py` - where a file lives, and nothing else.
- `backend/app/anlagen/speicher_test.py`
- `backend/app/anlagen/regeln.py` - the Python half of `regeln.ts`.
- `backend/app/anlagen/regeln_test.py`
- `backend/app/anlagen/fehler.py` - the typed refusals.
- `backend/app/anlagen/dienst.py` - upload, list, read, delete, each scoped to
  an owner through `hole_protokoll`.
- `backend/app/anlagen/dienst_test.py`
- `backend/app/models/anlage.py` - the `Attachment` model.
- `backend/app/api/anlagen.py` - the four routes, thin.
- `backend/app/api/anlagen_test.py`
- `database/migrations/versions/<new>_attachments.py`

**New, frontend**

- `frontend/src/protokoll/anlagen/api.ts` - the four calls.
- `frontend/src/protokoll/anlagen/api.test.ts`

**Changed, backend**

- `backend/app/config.py` - `anlagen_verzeichnis`, with its entry in `HINWEISE`.
- `backend/app/models/__init__.py` - the new model imported, or autogenerate
  drafts a migration dropping its table.
- `backend/app/api/schemas.py` - the attachment response shapes.
- `backend/app/api/fehler_http.py` - the new refusals and their status codes.
- `backend/app/main.py` - the router included.
- `backend/app/protokolle/dienst.py` - deleting a protocol deletes its files.
- `backend/pyproject.toml` - `python-multipart`, which FastAPI needs before it
  can accept an uploaded file at all.
- `docker-compose.yml` - the named volume and the variable.
- `.env.example` - the variable, documented.
- `AGENTS.md` - the new variable under Commands.

**Changed, frontend**

- `frontend/src/api/client.ts` - a `FormData` body sent unchanged.
- `frontend/src/api/fehler.ts` - the new codes.
- `frontend/src/protokoll/anlagen/store.ts` - its body replaced. The interface
  stays, which is what feature 10 built it for.
- `frontend/src/protokoll/anlagen/store.test.ts` - rewritten against a fake
  fetch rather than a fake IndexedDB.
- `frontend/src/protokoll/anlagen/useAnlagen.ts` - creating the protocol on a
  first attach, and the new failures.
- `frontend/src/protokoll/abschnitte/teil7/AnlagenVorschau.tsx` - a URL instead
  of an object URL.
- `frontend/src/i18n/locales/de.json` - the new failure messages only.
- `docs/ffs-questions.md` - the virus scanning question.

## Data / contracts

### The `attachments` table

Load-bearing. Feature 11's review screen reads it, feature 20 draws the map
excerpt from it.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, primary key | Generated in Python, as `Submission.id` is |
| `submission_id` | uuid, FK to `submissions.id`, not null, `ON DELETE CASCADE` | Indexed. Every query filters through it |
| `art` | text, not null | Check constraint over `KARTENAUSSCHNITT` and `FOTO` |
| `dateiname` | text, not null | Exactly as picked. Data, never a path |
| `mime_type` | text, not null | What the bytes proved to be, not what the request claimed |
| `groesse` | integer, not null | Bytes, as counted while reading |
| `storage_key` | text, not null, unique | `<submission_id>/<attachment_id>` |
| `created_at` | timestamptz, not null | |

`ON DELETE CASCADE` here, unlike `submissions.owner_user_id`, which has no
cascade on purpose. The reasoning is opposite in the two cases: a survey record
has to outlive the person who filed it, but a photograph of a stretch means
nothing without the protocol it belongs to. The Python delete still removes the
rows explicitly, because it has to remove the files in the same breath, and the
cascade is the guarantee that a row can never be orphaned by some other path.

The partial unique index, over `submission_id` where `art` is
`KARTENAUSSCHNITT`, is what makes the single map excerpt a fact about the data
rather than a hope about the order requests arrive in.

### Where the bytes go, and why not in the database

**On a volume, as files, named by ids we generated.** `storage_key` in
`project-overview.md` already assumes this and it is the conventional answer,
but the alternative is real and worth stating so the trade is a decision rather
than a default.

Twenty photographs at 10 MB is 200 MB for one protocol. Putting that in a
Postgres column would make every backup carry every photograph, would pull a
whole file through the ORM into memory to serve it, and would grow the one thing
in this deployment that most needs to stay quick to restore. Files on a volume
keep the database small and let the download stream.

The cost, accepted knowingly, is two things to back up instead of one, and the
fact that a file and its row can drift apart if a process dies between them.
Steps 4 and 5 order the writes so that the drift is always the harmless
direction, a file nobody points at rather than a row pointing at nothing.

Object storage would remove the volume and the drift both, and is what this
becomes if FFS deploys somewhere that offers it. It is not built now because
`project-overview.md`'s deployment table has no object store in it, and adding a
dependency on one before FFS has named a platform would be guessing.

### The routes

Nested under the protocol, so ownership is one lookup and the address reads the
way the data is shaped.

| Method and path | Does | Answers |
|---|---|---|
| `POST /api/v1/protokolle/{id}/anlagen` | Attaches one file. `multipart/form-data`, fields `art` and `datei` | 201 with the record, or 404, 409, 413, 422 |
| `GET /api/v1/protokolle/{id}/anlagen` | That protocol's attachments, oldest first, metadata only | 200, or 404 |
| `GET /api/v1/protokolle/{id}/anlagen/{anlage_id}/datei` | The bytes | 200, or 404 |
| `DELETE /api/v1/protokolle/{id}/anlagen/{anlage_id}` | Removes one | 204, or 404, 409 |

One file per request rather than a batch, even though the Fotos picker takes
several at once. Feature 10 already made that choice in `regeln.ts` and gave the
reason: files are fed through in turn so a pick of five against eighteen stores
two and names the three that did not fit. A batch endpoint would have to decide
that ordering all over again, and would have to answer half-success in a shape
nobody has designed.

`413` for a file past the cap rather than `422`, because that is the status the
condition means and a proxy in front of us may produce it on its own for the
same reason. The browser must therefore treat the two as one message.

**Oldest first**, matching what `store.ts` already does, so photographs stay in
the order they were added instead of shuffling every time the section is
reopened.

### The `Anlage` record on the wire

`typen.ts` already mirrors the model, so the swap is plumbing. Two field names
change meaning rather than shape:

- `entwurfId` becomes the server's `submission_id`. It was always going to; the
  comment in `typen.ts` says so.
- `angelegtAm` is now the server's `created_at`, so all clients agree on when a
  file was attached rather than each browser deciding for itself.

`storage_key` never leaves the server. It is a path, the client has no use for
it, and a path a client knows is a path a client will eventually try to bend.

### The rules, and where each half lives

`coding-standards.md` requires every rule twice, once in the browser for instant
feedback and once on the server as the gate. Attachments have had only the first
half since feature 10. This is the table after this feature:

| Rule | Value | Browser | Server |
|---|---|---|---|
| Kartenausschnitt | exactly 1 | `regeln.ts` | `regeln.py` and a unique index |
| Fotos | up to 20 | `regeln.ts` | `regeln.py` |
| Accepted types | JPG, PNG, WEBP | `regeln.ts`, from the reported type | `regeln.py`, from the bytes |
| Size | 10 MB | `regeln.ts`, from `File.size` | `regeln.py`, counted while reading |
| HEIC gets its own message | | `regeln.ts` | not repeated. See below |

**HEIC stays a browser-side message only, deliberately.** It exists to tell an
iPhone owner how to get a usable photograph, which is help rather than a gate,
and a HEIC file that somehow reached the server is refused by the type rule like
anything else. Repeating the advice in a Python message nobody in a field office
will ever see would be a second copy of a sentence to keep in step for no gain.

### Known limits, accepted

- **No total cap per protocol or per account.** Twenty photographs at 10 MB
  each, times a handful of drafts, is the realistic ceiling and a volume handles
  it. A quota is worth adding when there are real accounts to size it against,
  not before.
- **Nothing sweeps up orphaned files.** A file whose row went missing costs
  disk and nothing else. A command to find and remove them is worth having once
  there is a deployment to run it on, and is not worth guessing at now.
- **No virus scanning.** External consultants upload here, so this is a fair
  question, and it belongs to the platform rather than to this code. Raised with
  FFS as a question in step 7.
- **The request body is bounded by the reverse proxy, not by the application.**
  Found during step 4. The size cap is enforced while the upload is read, which
  bounds what is stored and what is held in memory, but the multipart body has
  already been parsed and spooled by the time any route handler runs. Refusing a
  two gigabyte body before it is spooled is a job for the proxy in front of the
  service, and `project-overview.md` already puts one there as the only public
  entry point. It belongs in the deployment configuration that `/release` writes,
  not here.

## Testing

Both gates apply, because this feature has real logic on both sides.

`pytest`, from `backend/`. Every backend step is logic-bearing, so each ships
passing tests in its own diff:

| Step | Tests |
|---|---|
| 1 | Write and read back; delete; deleting what is not there; a filename that cannot influence the key; a missing file reading as nothing |
| 2 | Each accepted type; a type not on the list; bytes that do not match the claimed type; an HTML file claiming to be a JPEG; over the size cap; a second Kartenausschnitt; a twenty-first Foto |
| 3 | The migration, exercised by the suite building its own database; `alembic check` clean; the unique index refusing a second Kartenausschnitt; the cascade taking rows with a deleted submission |
| 4 | Upload stores row and file; the list is metadata only and oldest first; each refusal stores nothing; an oversized file is stopped while reading; **a submitter cannot upload to or list another's protocol**; a non-draft refuses an upload |
| 5 | The download returns the stored bytes, type, `nosniff` and `Content-Disposition`; **a submitter cannot download or delete another's attachment**; an attachment id from a different protocol gets 404; delete removes row and file; deleting a protocol leaves neither |

`npm test`, from `frontend/`:

| Step | Tests |
|---|---|
| 6 | `anlagen/api.test.ts` on the method, path and body of all four calls, against a fake fetch as `entwurf/api.test.ts` does; `api/client.test.ts` on a `FormData` body going out with no `Content-Type` set by us; `store.test.ts` rewritten so its failure cases are refused requests rather than a full disk |
| 7 | The decision to create a protocol before attaching, as a plain function, testable without React |

The bold rows are the permission tests `coding-standards.md` calls non-optional.

**Manual, once step 7 is in.** No browser automation exists on this project and
`coding-standards.md` rules out adding Playwright mid-feature, so the parts that
need a real browser are checked by hand:

- Start the stack, sign in, open a draft, go to section 7.
- Attach a map excerpt and several photographs. Reload. All there.
- Sign in as the same account **in a different browser**. The same pictures.
  This is the whole point of the feature and it is the one check that proves it.
- Sign in as a second account and confirm none of it is visible.
- Delete a photograph. Gone from both browsers.
- Delete the whole protocol, then confirm the files are gone from the volume.
- Open `/protokolle/neu`, go straight to section 7, attach one photograph, and
  confirm a protocol appears in the list with that photograph in it.
- Open `/protokolle/neu`, go to section 7, attach nothing, leave. The list gains
  nothing.
- Refuse cases again, since the messages now come from two places: a `.txt`, a
  HEIC file, an image over 10 MB, a twenty-first photograph.
- Stop the backend and try to attach. The message says the service is
  unreachable and what to do, and nothing on screen claims the file was stored.
- Both themes, keyboard only, as feature 10 required.

There is no `Verify` command yet, so `pytest`, `npm test` and `npm run build`
are the gate.

## Notes for the AI

- **`store.ts` is the seam and its interface does not change.** Feature 10 built
  it around exactly this moment. `listAnlagen`, `addAnlage`, `removeAnlage` and
  `readDatei` keep their signatures; only the bodies become API calls. If a
  block or a preview needs changing beyond `AnlagenVorschau`'s image source,
  stop and say so, because that means the seam did not hold and it is worth
  knowing rather than working around.
- **Every query is filtered by the owner, through `hole_protokoll`.** Never load
  an attachment by its id and check afterwards whose it is.
  `protokolle/dienst.py` explains why at length and the same reasoning applies
  here without change.
- **An attachment id alone is not an address.** Every route names the protocol
  as well, and the attachment must belong to that protocol or the answer is 404.
  Otherwise the protocol in the path is decoration and the ownership check is
  guarding nothing.
- **The storage key never contains anything from the request.** Not the
  filename, not the type, not a header. Two UUIDs we generated.
- **Trust the bytes, not the claim.** `UploadFile.content_type` is whatever the
  client wrote in the request. It is a hint for a message, never a decision.
- **Read the upload in chunks and stop at the cap.** Reading an unbounded body
  into memory in one call is how a service is knocked over by one request.
- **A generated migration is a draft.** Read it before keeping it, as
  `AGENTS.md` says. Autogenerate will not draft the check constraint or the
  partial index; both are written by hand.
- **Routers stay thin.** Parse, authorise, delegate, return. The rules are in
  `app/anlagen/regeln.py`, the database and disk work in `app/anlagen/dienst.py`
  and `app/anlagen/speicher.py`, so all three test without an HTTP request.
- **Refusals carry no bytes and no values back.** They name the file, because
  feature 10's standard requires it and the filename came from the person
  themselves, and nothing else from the request.
- **Every message names the thing, says why in ordinary words, and says what to
  do.** The standard set on 2026-09-06 and the bar feature 10 held itself to.
  The new failures here are the server ones, and the session running out is the
  one that most needs its way out spelled out.
- **MUI first** where anything is added, per `coding-standards.md`, and
  `@mui/icons-material` is still not installed.
- **Every string comes from the locale files.** German only; `en.json` stays a
  deliberate stub until feature 17.
- German for the domain, for database columns and for route paths. English for
  component and variable names, as everywhere else.
- **No em dashes anywhere**, per the Writing section of `coding-standards.md`.
