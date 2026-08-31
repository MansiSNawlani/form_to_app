# Fishing Data Digitization

Digital replacement for the PDF-based survey protocols used by the Fischereiforschungsstelle
Baden-Württemberg to record electrofishing and related aquatic surveys. The domain language is
German because the source forms, the legal framework, and the receiving government database are
German; English is a presentation translation, not a second source of truth.

## Language

### The survey

**Befischung**:
One survey event: a single visit to one stretch of water on one date, using one method.
_Avoid_: fishing trip, catch event, sampling run

**Protokoll**:
The record of one Befischung, as filled in by the person who carried it out.
_Avoid_: report, sheet, document

**Probestrecke**:
The delimited stretch of water a Befischung covers, bounded by a lower (`untere`) and an upper
(`obere`) point.
_Avoid_: site, section, stretch, transect

**Monitoringstrecke**:
A Probestrecke that belongs to the state's WRRL or FFH monitoring programme and therefore carries a
stable, officially assigned number. Only monitoring surveys have one.
_Avoid_: monitoring site, station

**Anlass**:
The reason a Befischung was carried out (general stock assessment, WRRL monitoring, FFH monitoring,
and so on). It drives which fields become mandatory.
_Avoid_: purpose, reason, survey type

**Bearbeiter**:
The person who carried out the Befischung and is answerable for the Protokoll's contents. Not
necessarily the person holding the account that submits it.
_Avoid_: author, editor, user, surveyor

**Anodenführer**:
The person operating the anode during electrofishing. Recorded by name, distinct from the Bearbeiter.

### The water

**Gewässer**:
A named body of water. Identified authoritatively by an identifier from the state GIS dataset, never
by name alone.
_Avoid_: water, river, stream

**Gewässertyp**:
The classification of a Gewässer, stored as the numeric code the legacy form exports: `11` Graben,
`12` Kanal, `13` Bach, `14` Fluss, `21` See, `26` Teich, `28` angebundenes Altwasser, `29`
abgeschnittenes Altwasser. Codes below 20 plus `28` require the hydrology section; `21`, `26` and
`29` suppress it entirely.
_Avoid_: water type, category, and the codes `31` and `32`, which the legacy form's JavaScript
tests for but the field never exports (see [defect 9](docs/ffs-defect-list.md))

**Vorfluter**:
The Gewässer that a Gewässer flows into. Recorded as a chain that must terminate at the Rhein or the
Donau, which establishes where in the state's drainage network a Probestrecke sits.
_Avoid_: receiving water, downstream water, outflow

### The catch

**Art**:
A species of fish, lamprey, crayfish, or mussel, chosen from a controlled vocabulary, never free text.
_Avoid_: species name, fish type

**Größenklasse**:
One of the fixed total-length bands a caught individual is assigned to by estimate, not measurement.
_Avoid_: length class, size bucket

**0+**:
An individual hatched in the current year. Counted per species as a subset of that species' total, so
it can never exceed it.
_Avoid_: juvenile, young of year, fry

**Kein Nachweis**:
An explicit record that a survey found nothing of a given group. A Protokoll with an empty catch is
incomplete; a Protokoll asserting Kein Nachweis is complete. The two are not the same.
_Avoid_: no catch, empty, zero, null result

**Besatzmaßnahme**:
A past stocking of a species into the Gewässer, recorded as context for the observed catch, not as
something observed during this survey.
_Avoid_: stocking, restocking event

### Percentages and structure

**Prozentgruppe**:
A set of fields whose values must sum to exactly 100, describing how a Probestrecke's surroundings,
bank, or bed divide between categories. Six of them exist on the E-Befischung Protokoll.
_Avoid_: percentage block, distribution, allocation

**Semiquantitative Angabe**:
A 0 to 3 rating (none, little, common, dominant) for a natural in-water structure. Ordinal, not a
count and not a percentage.
_Avoid_: score, rating, abundance

### Organisations and systems

**FFS**:
The Fischereiforschungsstelle Baden-Württemberg. Owns the Protokoll forms and the authoritative
database, and performs final data stewardship.

**FiaKa**:
The authoritative government fisheries database that accepted Protokolle are transferred into. It is
never reachable from the public application; the application's own store is a staging database.
_Avoid_: the database, production DB, main DB

**Regierungspräsidium**:
One of the four regional authorities (Karlsruhe, Stuttgart, Freiburg, Tübingen) responsible for
fisheries in its area. Every Protokoll names the one responsible for its Probestrecke.
_Avoid_: region, district, RP office

### Working with a Protokoll

**Submission**:
One Protokoll inside the application, together with its workflow state and history. A Submission is
the application's unit of work; a Protokoll is what it contains.
_Avoid_: record, entry, form instance

**Draft**:
A Submission its owner is still filling in. Only its owner can see or change it.

**Locked**:
The terminal state of an accepted Submission. Its contents are fixed and only a transfer to FiaKa
acts on it further.
_Avoid_: finalised, closed, archived

**Data Steward**:
FFS staff who correct and quality-check submitted data. Distinct from a Reviewer, who decides whether
a Submission is accepted, and from a Super Admin, who manages accounts.
