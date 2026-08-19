# Probestrecke is a first-class entity

A `Probestrecke` (the stretch of water a survey covers) is stored as its own record with its
own stable identity. A `Submission` points at a `Probestrecke`, and a `Probestrecke` points at
a `Gewässer` by its authoritative GIS identifier. The same stretch surveyed in 2026 and 2031
is one `Probestrecke` with two `Submission` records against it.

## Why

The paper form treats the stretch as a section of the document, and the requirements document
(section 24) follows it, modelling only a `WaterBody` reference and a per-submission
`FishingLocation`. Under that model every survey is a standalone document, and asking "how has
this stretch changed over ten years?" becomes a fuzzy geometry query across free-text water body
names.

Two facts in the source material argue the other way. Monitoring surveys carry a
`Monitoringstrecke Nr.`, an officially assigned number that is stable across years. And the
entire point of the WRRL and FFH monitoring programmes is repeat visits to the same stretch, so
comparison over time is the reason the data is collected at all.

## Consequences

This is the single hardest thing to retrofit. Once several thousand flat submissions exist,
grouping them into stretches means matching inconsistently spelled water body names against
approximate coordinates, and the legacy PDF has a casing bug that already corrupts those names.
Adding the entity now costs one table and one foreign key.

Monitoring stretches use their official number as a natural key. Ad-hoc stretches get a
generated identifier and can be merged by a Data Steward later, which is the expected messy case
and needs a deliberate merge path rather than being treated as an error.
