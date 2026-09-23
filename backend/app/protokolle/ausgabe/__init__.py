"""A filed protocol as a document somebody can keep.

Feature 23e. The other direction from app/protokolle/einlesen: that package
reads a protocol out of the legacy Acrobat form, this one writes one out as a
PDF of our own.

Of our own, and not a copy of the official form. That was settled on 2026-09-23
and build-plan.md item 23 carries the reasoning. What follows from it here is
that nothing in this package opens, reads or fills the legacy file, and the
blank form is therefore not needed at run time.
"""
