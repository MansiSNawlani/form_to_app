# Form answers are stored as JSON, the submission envelope as columns

A submission is split in two. The envelope is stored as ordinary database columns: id, owner,
status, form version, timestamps, Probestrecke link, water body, coordinates, survey date,
Regierungspräsidium, `Anlass`, monitoring number. Every one of the roughly 338 form answers goes
into a single JSON document.

## Why

A column per field is unworkable at this width, and it would turn every form version change into a
schema migration on a table nobody wants to migrate. A pure JSON document is flexible but makes the
application's own machinery slow: the review queue filters on status and date, and every permission
check reads owner and status. Those cannot live inside a document that has to be parsed first.

So the rule is: if the application queries, sorts, or authorises on it, it is a column. If it is
only ever displayed back to a human, it is JSON.

## Consequences

Searching for submissions containing a given species still works, because Postgres can index inside
a JSON document. What is genuinely worse is aggregate analysis across the catch, such as tracking
one species' size distribution over ten years, which requires unpacking JSON on every row.

This is reversible. If that analysis becomes a requirement, read the JSON once and build a
normalised catch table alongside it, kept in sync on write. The cost is a backfill script rather
than a redesign, which is why this was an acceptable call to make early rather than agonise over.

The JSON document is schema-validated on write. Nothing reaches the database unvalidated just
because the column is loosely typed.
