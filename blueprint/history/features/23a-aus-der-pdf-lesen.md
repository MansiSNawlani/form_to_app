# Feature: Aus der PDF lesen

**From build-plan:** feature 23a
**Status:** built, all six steps done

## Goal

Turn the bytes of a filled-in Protokoll E-Befischung, as Acrobat saved it, into an
answers document this application can hold: one function in, one result out, with no
database, no HTTP and no screen anywhere near it.

This is the half of the import where a wrong answer is possible, and it is the only
half where a mistake is silent. A field read under the wrong name, a radio value kept
with its slash on the front, or a species row shifted by one would all produce a
protocol that looks filled in and is wrong. So it is built first, alone, and proved
against the real file before anything can upload one.

Nothing a user can see changes. 23b gives it an endpoint and 23c a button.

## Design reference

None. There is no screen in this sub-feature.

## What the file actually holds

Probed against `Resources/Fiaka_Resources/Formular_Protokoll_E-Befischung_V20260609.pdf`
on 2026-09-22, with the backend's own pypdf. These are facts, not assumptions, and every
one of them is something a build step depends on.

| Question | Answer |
|---|---|
| Is it encrypted? | Yes, and `decrypt("")` opens it. No password is needed or known. |
| Do the field names match ours? | All 540, exactly. `probestrecke.gewaesser.vorfluter1` is `probestrecke.gewaesser.vorfluter1`. |
| How does a text answer come out? | `/V` as a PDF string, needing the same byte-level decode `extract_form_definition.py` already does, or every umlaut turns into a replacement character. |
| How does a radio answer come out? | `/V` as a name: `/13` for Bach, so the slash has to come off to leave the `13` our answers document stores. |
| How does a ticked box come out? | `/V` is `/Ja`, which is already the string `FeldHaken.tsx` stores. Unticked is `/Off`. |
| How does a dropdown come out? | `/V` as the export value, which is what we store. |
| Can we tell which form it is? | Yes. A read-only `version` field carries `Version 2026-06-09`, and the committed Krebs form carries `Version 2023-05-10`, so a wrong form is recognisable rather than guessed at. |
| Can we tell whether it carries photos? | Yes. An image sits in the button's `/MK` dictionary under `/I`, and the blank form has no `/I` at all, so the presence of one means a real picture. |
| How is a date written? | German. The `datum` field carries `AFDate_FormatEx("dd.mm.yyyy")`, so the file says `04.05.2026` where we store `2026-05-04`. |
| How is a number written? | German, and this is the dangerous one. 383 fields carry `AFNumber_Format`, and 373 of them use separator style 2: a dot groups the thousands and a comma is the decimal point. So a catch of 1234 fish is written `1.234`, and `alsZahl` in `frontend/src/protokoll/regeln/arten.ts` reads that as 1.2. That file's own comment already calls it "the one place a shared number parser could quietly lose 999 fish". |
| Is the time the same? | Yes. `AFTime_Format(0)` gives `HH:MM`, which is what `FeldDatum.tsx` stores. Nothing to convert. |

## In scope

- **`app/formular/pdf.py`**, holding the two functions that already exist once in
  `backend/scripts/extract_form_definition.py`: the byte-level `decode` and the `walk`
  that assembles the dotted legacy paths. Moved rather than copied, and the script
  imports them from here afterwards. Two copies of the walk is two chances for the
  import and the field list to disagree about what a field is called.
- **pypdf and cryptography promoted from dev to runtime dependencies.** They are dev
  dependencies today because only that one script used them. The build plan's note from
  2026-09-15 said otherwise and is corrected there.
- **Which of the 540 fields are answers**, as an explicit list with a reason per entry,
  checked against `felder.json` so a field can never be silently ignored.
- **The version gate**: this form version, or a refusal naming what was found.
- **Turning German values into the ones we store**: the date, and above all the numbers.
  Each field's own format is recorded into `felder.json` by the extraction script and
  read from there, rather than a table of 383 field names written out by hand.
- **The reader itself**: bytes to a nested answers document of strings, plus what it
  could not use and whether the file carries pictures.
- Typed domain errors for every way the file can be unusable.
- Tests against the real committed forms, and against a filled fixture.

## Out of scope

- **Any endpoint, and any draft.** Nothing calls this until 23b. It writes nothing
  anywhere.
- **How big a file may be.** This reads whatever bytes it is handed. A cap belongs where
  the bytes arrive from outside, which is 23b's upload.
- **Running the form rules.** `pruefe_protokoll` already exists and already says what is
  wrong with an answers document. Calling it belongs where the result is handed to a
  person, which is 23b, so this sub-feature does not import it. What it does produce is a
  document `pruefe_antworten` accepts, because 23b saves through the normal save path and
  a document that fails the shape check could never be stored at all.
- **The pictures themselves.** 23a counts them and says they are there. 23d turns them
  into Anlagen. This split is deliberate: image extraction is the one part of the import
  that might not work, and the rest must not wait on it.
- **The export.** 23e writes into these same boxes. Nothing here is built for it, though
  `app/formular/pdf.py` is where its own helpers will land.
- The frontend, including locale files. No German is produced here.

## What "not an answer" means

Of the 540 fields, 485 are answers and 55 are not. The 55 are excluded by name with a
reason, not by a clever rule, because a clever rule is what would quietly drop a real
field in the next form version.

| Group | Count | Why it is not an answer |
|---|---|---|
| Push buttons | 12 | `drucken`, `export`, `saveas`, `hilfe`, `Button2`, `button_server` and `button_versenden` are actions. The five `fotos.*` are picture slots, and they are 23d's. |
| `check_*` | 13 | The red stars and green ticks the legacy form draws beside its percentage blocks. Our own totals are worked out on screen. |
| `*.summe` and `arten.gesamtsumme` | 27 | Computed by the form and marked read-only. `entwurf/typen.ts` already refuses to store a total, so that a hand-edited draft cannot carry one that disagrees with its own cells. |
| `version` | 1 | The form's own version stamp. It identifies the file; it is not survey data. |
| `hydrologie_box` | 1 | The sentence "Angaben zur Hydrologie sind bei stehenden Gewaessern nicht relevant", which the legacy form shows and hides. |
| `bemerkungen.default` | 1 | A box that is ticked in the blank form and belongs to the legacy form's own workings. Nothing in our answers document has ever held it. |

`bearbeiter.ort` is the mirror image: our application has it and the paper form does
not, so an import never produces it and the field is simply empty afterwards.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Steps 1 to 5 each end with something `pytest` can prove. There is nothing to click until
23c, so every done-when here is a test, the two linters, and the existing suite staying
green.

- [x] **Step 1 - Opening the file, and one copy of the walk** - `app/formular/pdf.py`
      with `decode` and `walk` moved out of `backend/scripts/extract_form_definition.py`
      unchanged, plus `oeffne(daten: bytes)` which reads from memory, decrypts with the
      empty password, and hands back the AcroForm's fields. `app/formular/fehler.py` with
      the typed refusals: not a readable PDF, locked with a password we do not have, and
      no form in it at all. `extract_form_definition.py` imports the two moved functions
      instead of defining them. pypdf and cryptography move out of the `dev` extra in
      `pyproject.toml`, with the comment that sent them there rewritten rather than left
      describing a script.
      *Done when:* `pytest` from `backend/` proves the committed E-Befischung form opens
      and reports 540 terminal fields with `probestrecke.gewaesser.vorfluter1` among
      them; that a few bytes of ordinary text raise the "not a readable PDF" error; that a
      PDF encrypted with a real user password, written in the test with pypdf, raises the
      "locked" error rather than the "not readable" one; that a PDF with no AcroForm
      raises the "no form in it" error; and that `decode` returns real umlauts rather than
      replacement characters for a string out of this form. `decode` and `walk`
      themselves are byte-identical to what the script held.
      **Corrected during the build:** this step said the existing
      `scripts/extract_form_definition_test.py` would pass unchanged. It needed one
      line: it imported `walk` from the script, which after the move is a re-export
      that mypy is right to refuse, so it now imports it from
      `app.formular.pdf`. The assertions are untouched. `ruff check .` and `mypy .`
      pass.

- [x] **Step 2 - Which fields are answers** - `app/protokolle/einlesen/felder.py` with
      the 55 excluded names as named, commented groups, and `ist_antwort(name)`.
      **Five groups rather than the table's six.** The 12 push buttons are split in
      two, because the five picture slots are 23d's work and the seven action buttons
      are nobody's, and the three the form keeps for itself are one group rather than
      three of one name each. A guard in the spirit of `RADIO_LABELS` in the
      extraction script: a test reading `felder.json` and asserting every one of its 540
      names is either an answer or explicitly excluded, so a future form version cannot
      add a field the import drops in silence.
      *Done when:* `pytest` proves exactly 485 of the 540 names are answers; that each
      excluded group is excluded and its count is what the table says; that
      `z.rp`, `z.quelle` and `z.ps_nummer` are answers, since they look like bookkeeping
      but the form asks for them and `entwurf/typen.ts` stores them; that
      `arten.art7.klasse_3` and `arten.art7.0plus` are answers while `arten.art7.summe`
      is not; and that no name is both. `ruff check .` and `mypy .` pass.

- [x] **Step 3 - Which form is this** - `lies_version` in `app/protokolle/einlesen/`,
      reading the `version` field and turning `Version 2026-06-09` into the `20260609`
      the rest of the application uses, with a typed refusal naming what was found when
      it is anything else. Compared against the version the running deployment serves,
      from `app.formular.felder.formular()`, rather than against a constant, so a future
      second form version needs no change here.
      *Done when:* `pytest` proves the committed E-Befischung form reports `20260609`;
      that the committed `Formular_Protokoll_Krebs_V20230622.pdf`, which carries
      `Version 2023-05-10`, is refused with both versions named in the error; that a PDF
      with no `version` field is refused rather than assumed to be the right form; and
      that a `version` field holding something unparseable is refused. `ruff check .` and
      `mypy .` pass.

- [x] **Step 4 - The German numbers and the German date** - the one place in this
      feature where the file's values and ours genuinely differ, and therefore the one
      place a correct-looking wrong number can get in. This step did not exist in the
      first draft of this spec, which is the gap the red-team pass on 2026-09-22 found.
      `extract_form_definition.py` learns to record each field's own format, which the
      PDF carries as a formatting script on the field itself: `AFDate_FormatEx` on
      `datum`, `AFTime_Format` on `messdaten.uhrzeit`, and
      `AFNumber_Format(decimals, style, ...)` on 383 fields, where style 2 means a dot
      groups the thousands and a comma is the decimal point, style 3 a comma decimal
      point and no grouping, and styles 0 and 1 a dot decimal point. `felder.json` is
      regenerated so each field's format sits beside it, read rather than retyped,
      exactly as the option lists already are. All four styles and both decimal counts
      are covered by three strict expressions; anything they do not recognise stops the
      extraction rather than producing a plausible file, the same way a mislabelled
      radio group already does.
      Then `app/protokolle/einlesen/werte.py` converts one value using its field's
      format: `04.05.2026` becomes `2026-05-04`, `12,5` becomes `12.5`, and `1.234` on a
      field declaring no decimal places becomes `1234`. A value already in our own form
      is left exactly as it is, so it does not matter whether Acrobat stores what it
      displays or what it parsed. A value that is not a number at all, or a date that is
      not a real date, is kept as it stands and reported, never rewritten into something
      plausible.
      *Done when:* `pytest` proves regenerating the seed changes nothing but the new
      format entries, which `scripts/extract_form_definition_test.py` holds it to; that
      `datum` records a date format, `messdaten.uhrzeit` a time format,
      `probestrecke.laenge` no decimals with grouping, `messdaten.temperatur` one
      decimal with grouping, `hydrologie.breite_schaetzwert` one decimal without,
      `bewirschaftung.besatz1_jahr` a dot decimal point, and
      `probestrecke.gewaesser.gewaessername` no format at all. And that the conversion
      turns `04.05.2026` into `2026-05-04`; leaves `2026-05-04` alone; leaves `14:30`
      alone; turns `12,5` into `12.5` on a one-decimal field; leaves `12.5` alone there;
      turns `1.234` into `1234` on `arten.art1.klasse_1`, which is the 999 fish;
      leaves `1.234` alone on `hydrologie.breite_schaetzwert`, where the format declares
      no grouping so the dot can only be a decimal point; leaves `zwoelf` on a numeric
      field untouched and reports it; and leaves `31.02.2026` untouched and reports it.
      `ruff check .` and `mypy .` pass.

- [x] **Step 5 - The values, as an answers document** - `lies_antworten`, walking the
      answer fields and building the nested document: a text value decoded and put
      through step 4, a radio or checkbox value with its leading slash removed, `/Off`
      and the empty string left out entirely, and every value a string. A value too long
      for the answers document to hold, which `app/protokolle/regeln.py` caps at 4000
      characters, is left out and reported rather than carried in, because one absurd
      field would otherwise make the whole save fail with a message about the document
      instead of about the field. Leaving a blank out
      rather than storing `""` matters and is the rule `entwurf/typen.ts` already sets:
      absent means never touched, `""` means touched and cleared, and a surveyor never
      touched a box they did not fill in.
      *Done when:* `pytest` proves the blank committed form yields exactly the answers
      the blank form itself carries, which is **not** an empty document: this step
      predicted one, and the form turned out to ship seventeen answers, fifteen of them
      a zero, plus the Anlass at "best" and the cathode at "Kupferlitze". A shipped zero
      cannot be told apart from a zero a surveyor meant, so all seventeen are imported
      and the form rules refuse the implausible ones, such as a Probestrecke of no
      length. The blank form also parks a single space in each of 32 unchosen dropdowns,
      the 26 species pickers among them, and that counts as unanswered. And that
      a filled fixture yields the exact nested document expected, water name, Vorfluter,
      date, Anlass, a Gewaessertyp of `13` with no slash, a ticked `einfluesse.wasserkraft`
      of `Ja`, an untouched `einfluesse.badebetrieb` absent rather than empty, a species
      code, one size class count, and a two-line remark with its line break intact; that an
      umlaut survives the whole way through; that a radio value the option list does not
      contain is kept rather than dropped, since the rules are what judge a value and a
      reader that quietly discards one hides a real problem; that a 5000 character value is
      left out and named; and that the result passes the existing `pruefe_antworten` shape
      check with no violations, since 23b will save it through the normal path.
      `ruff check .` and `mypy .` pass.

- [x] **Step 6 - One function, and what it could not use** - `lies_protokoll(daten)`
      returning the `Einleseergebnis` the Data section fixes: the version, the answers, the
      fields the file held that this application has no home for, and how many of the five
      picture slots carry an image. Then the pass over the whole sub-feature: two entries
      added to `CONTEXT.md` for the vocabulary this feature introduces, Einlesen and
      Protokoll-PDF, so 23b to 23e name the same things the same way.
      *Done when:* `pytest` proves `lies_protokoll` on the filled fixture returns the
      version, the document from step 5 and no pictures; that the same call on a fixture
      carrying an image in `fotos.bild1` reports one picture and still imports every
      answer, so 23d's absence costs nothing but the pictures; that a field present in the
      file and unknown to this application is reported rather than dropped or stored; and
      that a Krebs protocol is refused before any answer is read. `pytest`, `ruff check .`
      and `mypy .` all pass from `backend/`. `npm test`, `npm run lint` and `npm run build`
      still pass from `frontend/`, which they must, since nothing there changed.

## Files / areas

**New**

- `backend/app/formular/pdf.py` - opening a form PDF, decoding its strings, walking its
  fields. Shared with the extraction script now and with 23e later.
- `backend/app/formular/fehler.py` - why a file could not be read.
- `backend/app/protokolle/einlesen/__init__.py` - what the package publishes.
- `backend/app/protokolle/einlesen/felder.py` - which of the 540 are answers.
- `backend/app/protokolle/einlesen/werte.py` - one value, from the file's German form
  into the one the answers document stores.
- `backend/app/protokolle/einlesen/version.py` - which form version the file is.
- `backend/app/protokolle/einlesen/antworten.py` - the walk, and `Einleseergebnis`.
- `backend/app/protokolle/einlesen/protokoll.py` - the three of them in one order, and
  the picture count.
- `backend/app/protokolle/einlesen/fehler.py` - why a file is not an importable protocol.
- `backend/app/formular/beispiele.py` and
  `backend/app/protokolle/einlesen/beispiele.py` - the test material: the real form
  files, the three fixtures built from them, and one blank form's own contents. Named
  modules rather than fixtures inside a test file, because three test modules need the
  same ones, which is why `app/protokolle/formregeln/beispiele.py` already exists.
- Test files beside each, following the project's `*_test.py` convention.

  **This was one module, `leser.py`, until the review pass.** Split three ways because
  it had grown to hold the version gate, the walk, the value unwrapping and the picture
  count, which is four reasons for one file to change, and because its tests had already
  split themselves three ways along exactly those lines.

**Changed**

- `backend/scripts/extract_form_definition.py` - imports `decode` and `walk` instead of
  defining them, and records each field's number, date or time format.
- `database/seed/form_version_20260609/felder.json` - regenerated, gaining the format
  beside each field. A generated file: re-run the script, never hand-edit it.
- `backend/pyproject.toml` - pypdf and cryptography become runtime dependencies.
- `CONTEXT.md` - two vocabulary entries, in step 6.

## Data / contracts

**Load-bearing.** 23b, 23c and 23d all read this shape, so it is fixed here.

```python
@dataclass(frozen=True, slots=True)
class Einleseergebnis:
    #: The form version the file declares, as the application writes it: "20260609".
    #: Empty until lies_protokoll stamps it, since the walk that fills the rest
    #: must not depend on a version the gate ahead of it has already settled.
    version: str = ""

    #: The answers, nested exactly as the answers document is: strings only, blanks
    #: left out. Ready for speichere_antworten without reshaping.
    antworten: dict[str, Any]

    #: Fields the file carried that this application has no home for. Named rather
    #: than dropped, because in a later form version this is how a new question makes
    #: itself known instead of vanishing.
    unbekannt: tuple[str, ...]

    #: Answers worth a second look: a date that is not a date, a number that is not a
    #: number, a value past the 4000 character cap. The first two are still in
    #: antworten, exactly as the file wrote them, because rewriting one into something
    #: plausible is the one thing a reader must never do and because the form rules
    #: will name them again beside their own fields. Only the over-long value is left
    #: out, since the document cannot hold it. Either way the field is named, so 23c
    #: can say which one to go and look at.
    unbrauchbar: tuple[str, ...]

    #: How many of the five picture slots carry an image. 23d imports them; until then
    #: 23b can still say they are there, which it must: an attachment is part of the
    #: protocol, not a decoration on it.
    bilder: int
```

The answers document itself is unchanged: `frontend/src/protokoll/entwurf/typen.ts` and
`backend/app/protokolle/regeln.py` between them already define it, and this feature
produces one rather than inventing a shape.

## Testing

`pytest` from `backend/` is the gate, and every step above names what it must prove.
This sub-feature is pure logic over values, which is exactly what `coding-standards.md`
says gets a unit test, so there is no browser evidence to take and nothing to
screenshot.

**None of these tests need a database**, so unlike most of the backend suite they run
with Docker switched off. If one of them skips, something is wrong with the test rather
than with the machine.

**Fixtures.** Three, all deterministic:

1. The committed `Formular_Protokoll_E-Befischung_V20260609.pdf`, unfilled. It proves
   the reader opens the real thing and that an empty form yields an empty document.
2. The committed `Formular_Protokoll_Krebs_V20230622.pdf`, which is a real, different,
   encrypted protocol form and therefore a better "wrong file" than anything we could
   build.
3. A filled protocol, built in a test helper by writing values into fixture 1 with
   pypdf. Deterministic, carries no real person's data, and readable by whoever reads
   the test.

**The known weakness of fixture 3, stated rather than hidden.** It is written by us and
read by us, so it cannot prove that a file *Acrobat* saved reads the same way. The
values live in `/V` either way and that is what pypdf reports, so most of the reader is
safe. One thing is not: whether Acrobat stores `12,5` or `12.5` in a field it displays
as `12,5`. Step 4 is deliberately written to be correct either way, by leaving a value
that is already in our own form alone, which is why this is a weakness rather than a
blocker. A real filled protocol would settle it outright. See the question below.

## What the real protocols answered, and one note

**The question, and its answer.** This section asked for one real filled-in protocol,
saved out of Acrobat, because a file we wrote cannot prove how a file Acrobat wrote is
stored. Three arrived on 2026-09-22 and are kept, git-ignored, in
`Resources/echte-protokolle/`; that directory's README says why they are not committed.
Four things they settled, and only the first was the expected answer:

1. **Acrobat stores the parsed number, with a dot.** A temperature the form displays as
   `14,4` sits in the file as `14.4`, and an output of `1,7 kW` as `1.7`. So the comma
   case does not arise in a real protocol. The conversion is written to be right either
   way, which is why this is confirmation rather than rework.
2. **A date is stored German**, `09.09.2026`, so that conversion is load-bearing after
   all.
3. **All three carry their Kartenausschnitt as an embedded image**, and `zaehle_bilder`
   counts exactly one in each. The four photo slots are empty in all three.
4. **All three are older form versions than this application serves**, and that is the
   one that matters. Two say `Version 2023-02-25` and one `Version 2024-01-10`. The
   version gate therefore refuses all three. Their 540 field names are identical to
   ours, so nothing else about them is strange. This is 23b's problem rather than 23a's,
   and it is written up under item 23 in `blueprint/build-plan.md` because it is a
   decision about what the import is for, not a bug in the reader.

**A note, nothing needed.** An imported protocol can contradict itself, because the
legacy form's hydrology check is broken: defect 9 in `docs/ffs-defect-list.md` means a
file can say "See", a standing water, and still carry a full set of flowing-water
hydrology answers. This sub-feature keeps whatever the file says and changes nothing,
which is the right thing for a reader to do. Where it has to be handled is 23b and 23c,
because our draft form clears hydrology for a standing water on its own, so the person
has to be told before they open the draft. `ProtokollNurLesen.tsx` has carried a comment
about exactly this since feature 11e.

## Notes for the AI

- **Read the file, do not retype it.** Every name comes from `felder.json`, which is
  generated. No dotted path is written out by hand anywhere in this feature except in
  the 55 exclusions and in test expectations.
- **German for the domain, English for the craft**, as `coding-standards.md` has it.
  `lies_protokoll`, `Einleseergebnis`, `unbekannt`. Read `CONTEXT.md` before naming
  anything new, and update it in step 5.
- **Plain functions over values.** No database, no HTTP, no German sentences: the
  contract `app/protokolle/formregeln/regel.py` sets out, and the reason it gives, that a
  rule needing a running app cannot be tested against one value at a time.
- **Typed domain errors, translated to HTTP in one place.** That place is
  `app/api/fehler_http.py` and it is 23b's job, so raise here and map there.
- **Refusals must give a way out**: name the file, say what was found instead in plain
  words, and say what to do. "Version 2023-05-10 is the Protokoll Krebs, not the
  Protokoll E-Befischung" beats "invalid form".
- **A value is a string, always.** Not an int, not a bool, not `None`. A half-typed
  number is not a number, and the answers document has held only strings since feature
  4a for that reason. Step 4 converts the *writing* of a number, never its type: `12,5`
  becomes the string `12.5` and stays a string.
- **Never invent, never quietly drop.** Where the file holds something this application
  cannot use, name it in the result. Both of the reader's real failure modes are silent
  ones: a value rewritten into something plausible, and a value that disappears.
- **The state lives in `/V`.** If the real filled protocol from FFS turns out to record
  a ticked box only on the widget's `/AS` and not on the field's `/V`, the fallback goes
  in step 5 and nowhere else. Not built now, because nothing yet shows it is needed and
  a fallback nothing exercises is a second code path nobody has read.
- **Do not touch the frontend.** Nothing there changes in this sub-feature, and the final
  step proves it by running its suite.
