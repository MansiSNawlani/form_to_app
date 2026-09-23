# Feature: Der Einlese-Endpunkt

**From build-plan:** feature 23b
**Status:** built, all four steps done

## Goal

One uploaded PDF becomes one draft, owned by whoever uploaded it, with everything
already wrong with it listed beside it.

23a built the reader and gave it no way in. This is the way in: an endpoint that takes
the file, makes a protocol out of it, and answers with both the protocol and its
problems. After this a surveyor could import through the API docs; 23c gives them a
button.

Nothing here judges whether the protocol is good enough. `pruefe_protokoll` already
says what is wrong with an answers document, and this calls it and passes the answer
on. The import never refuses a protocol for its contents, only for not being a
readable protocol at all.

## Design reference

None. There is no screen in this sub-feature; the API docs at
http://localhost:8000/api/v1/docs are where it is tried.

## What was decided before this was specced

Both on 2026-09-22, and both written up under item 23 in `blueprint/build-plan.md`.

**Every import is a new survey.** The old premise, that the first job was the backlog
of protocols FFS already holds, was wrong: those surveys are already in FiaKa. The real
job is a surveyor who would rather fill in the Acrobat form in the field and should not
have to type it all again because the reviewers now work in the application. So an
import is an ordinary draft, stamped with the version this application serves, held to
today's rules. Nothing imported is a historical record being preserved.

**Any form version whose field names match ours is accepted.** 23a's gate takes one
version and refuses every other, which refused all three real protocols supplied that
day. The reason it is safe to widen was measured rather than assumed: see step 1.

**An old template is not an old survey.** All three real files record surveys carried
out in August and September 2026 on templates from 2023 and 2024, because people keep
filling in whatever copy of the PDF they downloaded years ago.

## In scope

- **Widening the version gate** to any version whose field names match ours, with the
  refusal reworded from "wrong version" to "not this form".
- **The import service**: one function from bytes and a user to a new draft plus its
  report, holding no HTTP.
- **The endpoint**: `POST /api/v1/protokolle/einlesen`, multipart, with a size cap and
  the refusals mapped to HTTP responses in the one place that does that.
- **The report**: the form rules' violations, the answers that could not be taken over,
  and how many pictures the file carries that did not come with them.
- German wording for the new refusals, in `app/api/fehler_http.py`, where the other
  HTTP refusals already keep theirs.

## Out of scope

- **Any screen.** 23c builds the control, its states, and the German for the report's
  own keys in `de.json`. This sub-feature emits keys and asserts keys.
- **The pictures themselves.** 23d reads them out into Anlagen. Here the count travels
  in the report so the person can be told their photographs did not come with their
  answers, which they must be: an attachment is part of the protocol.
- **Submitting.** The draft lands as a draft. Absenden is unchanged and still runs the
  same gate it always did.
- **Holding more than one form version's definition.** ADR 0004 envisages it and nothing
  here needs it: an imported protocol is a new protocol under the current definition, so
  one definition is still enough. Step 1 explains why that is sound rather than
  convenient.
- **A bulk or folder import.** One file per request. Nothing asks for more, and the
  backlog that would have wanted it is not a job.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Steps 1 and 2 are provable by `pytest` alone. From step 3 the endpoint is in the API
docs and can be tried by uploading a file.

- [x] **Step 1 - The gate accepts any form, not any one version** - `lies_version`
      becomes `pruefe_formular`: read the declared version, then compare the file's own
      field names against `formular().pfade`. Matching names mean this is the Protokoll
      E-Befischung and the declared version comes back as a fact about the file rather
      than as a condition. A file whose names do not match is refused, and
      `FormularversionPasstNicht` is reworded and renamed to say that: it is not a
      different version of our form, it is a different form.
      **Why a name match is enough, and it is measured.** The January 2024 form differs
      from ours in nothing: same 540 fields, same buttons, same option lists, same number
      formats. The February 2023 form differs in one respect in nine places, each
      hydrology group lacking the unlabelled `0` button meaning "hydrology does not apply
      here", which FFS added later. A button a file does not have is a button nobody
      could have ticked, so it cannot produce a value the reader chokes on. A 2023
      protocol for a standing water instead arrives carrying hydrology answers, which the
      rules then flag, which is what the report is for.
      *Done when:* `pytest` from `backend/` proves the real blank form is accepted and
      reports `20260609`; that a copy whose version stamp says `Version 2023-02-25` is
      accepted and reports `20230225`, since its field names are ours; that the committed
      Protokoll Krebs is refused, naming what it is; that a file with no version field is
      still refused; and that a form with our version stamp but a field missing is
      refused, because the names are what is being trusted. `ruff check .` and `mypy .`
      pass.

- [x] **Step 2 - The import, as a service** - `app/protokolle/einlesen/dienst.py` with
      `importiere(session, daten, besitzer)`: read the file, create a draft the way
      `lege_entwurf_an` already does, save the answers through
      `speichere_antworten` rather than writing the column directly, then run
      `pruefe_protokoll` over the result and return the draft with its report. The
      `Einlesebericht` the Data section fixes.
      Through the ordinary save path deliberately, not around it. That path is what
      checks the document's shape, bumps the version and owns the rule that a draft is
      what may be written to; an import that set `antworten` itself would be a second
      way to write a protocol, and the first one to drift.
      Nothing is written when the file cannot be read, and the draft is written even when
      the rules have plenty to say: a protocol with problems is exactly what this
      produces.
      **One transaction, not two.** `lege_entwurf_an` and `speichere_antworten` each
      commit on their own, so calling them in sequence would leave an empty protocol
      behind whenever the second half failed. That is precisely the litter feature 3c went
      and removed when it made a protocol come into existence on the first thing typed
      into it, and an import must not put it back.
      *Done when:* `pytest` proves, against a real database, that importing a filled
      protocol creates one DRAFT owned by the caller, stamped with the application's own
      form version and not the file's; that its answers are the ones 23a read; that the
      report lists the rules' violations for a protocol that breaks one; that a protocol
      that breaks nothing reports no violations; that an unreadable file creates no
      protocol at all **and leaves no empty draft behind**, proved by counting rows before
      and after; that importing the blank form, which is the likeliest mistaken upload,
      creates a draft whose report lists everything still missing rather than being
      refused; and that a second import by the same account creates a second protocol
      rather than touching the first. `ruff check .` and `mypy .` pass.

- [x] **Step 3 - The route, and who may call it** -
      `POST /api/v1/protokolle/einlesen` in `app/api/protokolle.py`, taking one
      `UploadFile`, guarded by a session like every other route there, answering 201 with
      `EinleseAntwort`. The size cap enforced while reading, as
      `app/anlagen/regeln.py` already does for a photograph, and the same note that what
      bounds the request body itself is the reverse proxy. `MAX_PDF_BYTES` at 25 MB: a
      real protocol with its map runs 1 to 2 MB, so this is a safety valve rather than a
      judgement about anybody's file.
      Every refusal from `app/formular/fehler.py` and
      `app/protokolle/einlesen/fehler.py` given German wording and a status in
      `PROTOKOLL_UEBERSETZUNG`'s manner: not readable, locked with a password, no form in
      it, not this form, too big. Each names the file, says what is wrong in plain words,
      and says what to do instead.
      *Done when:* the endpoint appears in the API docs and imports a file uploaded
      through them; `pytest` proves a signed-in account gets 201 with the new protocol's
      id, a caller with no session gets 401, a file that is not a PDF gets 422 with a
      message naming what to try instead, a password-locked PDF gets 422 with different
      wording, a Krebs protocol gets 422 naming what it is, and a 30 MB upload gets 413.
      `ruff check .` and `mypy .` pass.

- [x] **Step 4 - What the person is told, and the final pass** - the report filled in:
      the rules' violations as they already travel to the browser, the answers that could
      not be taken over, and the pictures the file carries. One thing this step decides
      rather than plumbs: `unbekannt`, a field the file holds that this application has
      no home for, is **logged and not shown**. It means our definition and the file
      disagree, which is our problem and not something the person uploading can act on,
      and the project's rule is that a message a person sees must tell them what to do.
      Then the pass over the whole sub-feature: read the generated docs as somebody
      meeting the endpoint for the first time, and check every refusal reads as help
      rather than as a complaint.
      *Done when:* `pytest` proves the report names a field whose date could not be read
      and still imports the protocol; that it reports 1 picture for a file carrying a
      Kartenausschnitt and says so separately from the violations, since 23d has not read
      it yet; that `unbekannt` is absent from the response and present in the log; and
      that a protocol with nothing wrong reports an empty list rather than being refused.
      `pytest`, `ruff check .` and `mypy .` all pass from `backend/`. `npm test`,
      `npm run lint` and `npm run build` still pass from `frontend/`, which they must,
      since nothing there changed.

## Files / areas

**New**

- `backend/app/protokolle/einlesen/dienst.py` - the import, from bytes to a draft.
- `backend/app/protokolle/einlesen/dienst_test.py` - against a real database.

**Changed**

- `backend/app/protokolle/einlesen/version.py` - the gate widens; `lies_version` becomes
  `pruefe_formular`.
- `backend/app/protokolle/einlesen/fehler.py` - the refusal reworded and renamed.
- `backend/app/protokolle/einlesen/__init__.py` - what the package publishes.
- `backend/app/api/protokolle.py` - the route.
- `backend/app/api/schemas.py` - `EinleseAntwort` beside the other response models.
- `backend/app/api/fehler_http.py` - German and a status for each refusal.
- The matching `*_test.py` beside each.

## Data / contracts

**Load-bearing.** 23c renders this and 23d fills in its last field.

```python
@dataclass(frozen=True, slots=True)
class Einlesebericht(Einleseergebnis):
    """What an import produced, beyond the protocol itself.

    23a's Einleseergebnis with one thing added. Written as an extension rather
    than as a second dataclass because three of its four fields would otherwise
    be the reader's own, declared and commented twice; the review of 23a caught
    exactly that duplication once already. `version` here is the version the
    **file** declared, which is deliberately not the version the protocol
    carries.
    """

    #: Everything the rules say is wrong or missing, exactly as Absenden reports
    #: it: a path and an i18n key the browser already knows how to translate.
    #: Empty is a real answer and means the protocol is ready to submit.
    verstoesse: tuple[Formverstoss, ...] = ()
```

The endpoint answers with the draft and this beside it:

```
201 { "protokoll": ProtokollAntwort, "bericht": EinleseAntwort }
```

`ProtokollAntwort` is the shape the create and read routes already answer with, so the
browser can go straight to the form with a document it already knows how to hold.

**The protocol's own `form_version` is this application's, not the file's.** That is the
"every import is a new survey" decision made concrete, and it is why one stored
definition is still enough: nothing imported needs an old definition kept renderable,
because nothing imported is an old record.

## Testing

`pytest` from `backend/`, and the API docs by hand for the route.

**Step 2 onward needs the database**, so those tests skip with the usual message when
nothing is reachable. Step 1's do not.

**Every test that reads a form PDF also needs the forms**, which are not in the
repository: they skip with the message `app/formular/beispiele.py` carries. `AGENTS.md`
says which two files to fetch and where they go. A full run needs Docker and the forms;
without either it reports skips rather than failures.

Fixtures are 23a's: the blank form, the Krebs form as a real wrong file, and a filled
protocol built from the blank one. Step 1 adds one more, a copy of the blank form whose
version stamp has been rewritten, which is how an old template is tested without a real
protocol in the repository.

## Notes for the AI

- **Save through `speichere_antworten`.** Do not write `antworten` directly. One way to
  write a protocol.
- **The draft is created even when the rules complain.** That is the whole design: an
  import lands as a draft with its problems listed, never as a submission and never as a
  refusal.
- **`form_version` is ours, `quellversion` is the file's.** Keep them apart and never
  stamp the file's onto the protocol.
- **Refusals must give a way out**, and they live in `app/api/fehler_http.py` in German,
  like the protocol refusals already there. Name the file, say what is wrong, say what to
  do. "This is the Protokoll Krebs, not the Protokoll E-Befischung" beats "invalid form".
- **Never quote the upload back.** `app/protokolle/fehler.py` explains why no error
  carries an answer somebody typed. A filename is the person's own and may be echoed; a
  field's contents may not.
- **Ownership is the session's account.** A draft belongs to whoever uploaded the file,
  which is what `lege_entwurf_an` already does. The account that files a protocol is not
  always the person who carried out the survey, and the Bearbeiter block in the answers
  is where the surveyor's name lives.
- **Do not touch the frontend.** 23c is where the report becomes words.
