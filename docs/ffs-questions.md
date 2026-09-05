# Questions for FFS about the Protokoll E-Befischung

Questions that came up while building the replacement web application, form part by form part.

**This is not the defect list.** [`ffs-defect-list.md`](ffs-defect-list.md) records things the
existing PDF form does wrong, several of which mean data already in FiaKa is wrong. Nothing here is
a defect: these are places where the legacy form is silent, ambiguous, or looser than we suspect it
should be, and where guessing an answer would put a rule or a field in the new application that
nobody asked for.

Every item says what we are building in the meantime, so an answer that agrees with our assumption
costs nothing and only a disagreement means work. None of these block the build.

Send this to FFS alongside the defect list.

---

## 1. The Bearbeiter has no town

**Where:** Part 1, the recorder's contact details.

The printed form asks for a street (`bearbeiter.strasse`) and a postcode (`bearbeiter.plz`) but
never for a town. Both the approved mockup and the `Person` record in our data model have one, and
an address without a town is awkward to use for anything.

**What we assume meanwhile:** there should be one. The new form shows a `bearbeiter.ort` field. It
is the only field in the whole application that does not exist in the legacy PDF.

**If the answer is no:** we remove one field. Nothing else depends on it.

## 2. Is the `z.` group something surveyors fill in?

**Where:** Part 1.

The form carries a small group of fields under `z.` - `z.rp`, `z.quelle` and `z.ps_nummer` - that
read like FiaKa bookkeeping rather than survey observations. None of them appears in the data model
we agreed. We could not tell from the form itself whether a surveyor is expected to answer them or
whether FFS fills them in on receipt.

**What we assume meanwhile:** surveyors fill them in, so they are shown. Decided on 2026-09-01.

**If the answer is no:** they move out of the form and become something the review step sets, which
is a change to feature 11 rather than to the form.

## 3. May a water be marked as having no influences and also have influences ticked?

**Where:** Part 4, the Nutzungseinflüsse block.

Fifteen tick boxes, two of which are "keine (erkennbar)" and "unbekannt". The legacy form checks
nothing here, so all three of "no influences", "unknown" and "hydropower" can be ticked at once,
which cannot all be true.

**What we assume meanwhile:** the contradiction is worth pointing out but not worth refusing. The
new form shows a message and still saves the answer.

**If they should be exclusive:** we need to know what happens to the other twelve ticks when
somebody chooses "keine". Clearing answers a surveyor gave is not something we will do on a guess.

## 4. Does a Besatzmaßnahme row need to be complete?

**Where:** Part 4, the four stocking rows.

Each row is a species, a size class and a year. The legacy form accepts a year with no species and a
species with no year, and checks nothing.

**What we assume meanwhile:** the same. Nothing checks a row for completeness.

**If a row must be whole:** it becomes a rule, and we need to know whether it applies at submit or
while typing.

## 5. Does a befischter Bereich need both a length and a width?

**Where:** Part 5, the two fished areas.

The legacy form pairs the two **lengths** with each other and the two **widths** with each other,
never a row with itself. So a length entered against "Über die gesamte Gewässerbreite" and a width
entered against "entlang der Ufer" satisfies it, leaving two half-described areas and neither one
actually measured.

**What we assume meanwhile:** we mirror the legacy pairing exactly, including that looseness.

**If a row needs both:** it becomes a row completeness rule, which is a small change.

## 6. What do the two Bauweise options mean?

**Where:** Part 5, the E-Gerät.

This one is also [defect 11](ffs-defect-list.md), because the form refuses to submit without an
answer to a question it never prints. It is repeated here because it is the one item on that list we
cannot fix ourselves: the question needs an answer, not a correction.

The field exports `alte` and `neue` and no text is printed beside either button.

**What we assume meanwhile:** the labels read "alte Bauweise" and "neue Bauweise", which is the
literal reading of the form's own error message and claims nothing the form does not already say.

**If they mean something else:** it is two strings.

## 7. Is there a plausible upper limit on any of the measured quantities?

**Where:** Parts 5 and 6.

The legacy form accepts negative numbers everywhere: a fished length of -50 m, -12 Bachforellen, a
negative count of anodes. The new application refuses negatives, which needs nothing from FFS
because no survey reports a negative count.

A ceiling is different. We have deliberately set none, because what counts as too high a voltage, too
long a stretch or too many fish of one species in one size class is a question about the domain, and
a limit invented here would sit in the interface with no rule behind it.

**What we assume meanwhile:** no upper limits at all.

**If there are sensible ceilings:** tell us the numbers and they become rules.

## 8. Is the species code `NEUN` correct for "Zwergstichling"?

**Where:** Part 6, the species list.

The 123 entry list is extracted from the PDF itself, so it is faithful to the form. One entry looks
wrong all the same: `NEUN` is labelled "Zwergstichling". Every other code in the list is a plausible
abbreviation of its label, and `NEUN` reads as a Neunauge rather than a Stichling. The neighbouring
`STIC` is "Dreistachliger Stichling" and `ANEU` is "Neunauge, Querder (unbestimmt)". It may be an old
code that was reused for a different species.

We cannot check this without FiaKa's own species table.

**What we assume meanwhile:** the list is used exactly as extracted. Nothing is corrected.

**If the code is wrong:** it matters more than a label, because the code is what is stored and what
FiaKa receives. Historical records may be affected, in which case this moves to the defect list.

## 9. Is the trailing space in "Flussmuschel, Große " meaningful?

**Where:** Part 6, the species list.

The label for `MBLA` ends in a space. The export value is unaffected, so nothing is stored wrongly;
it is only ever displayed.

**What we assume meanwhile:** it is a typing slip and harmless, so it is left exactly as extracted.

**If it is just a slip:** we trim it for display, the same way other obvious label typos in the
legacy form are corrected without touching the stored value.

---

## What happens to the answers

Anything that comes back as a requirement becomes a small change to the new application, logged the
same way as any other. Anything that turns out to mean historical FiaKa data is wrong moves to
[`ffs-defect-list.md`](ffs-defect-list.md), which is the list that carries that weight.
