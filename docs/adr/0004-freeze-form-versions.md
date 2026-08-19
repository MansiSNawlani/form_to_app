# Submissions are frozen to the form version they were filled in on

Every submission records which version of the form definition it was created against, and is never
migrated to a later one. When FFS publishes a new version, existing submissions keep displaying
exactly the questions that were asked at the time, read-only.

## Why

FFS revises the form regularly. The published version history shows changes in 2021, 2022, 2023,
2024 and 2026, so this will happen repeatedly while the application is live.

These are official records supporting permit decisions and state monitoring programmes. A record
has to show what was actually asked and what was actually answered. Migrating a 2026 submission
onto a 2029 form would show it answering questions that did not exist when it was filled in, and
silently dropping answers to questions that were later removed.

## Consequences

The application must be able to render historical form versions read-only, which means form
definitions are versioned artifacts kept in the repository rather than a single current definition.
That is a real ongoing cost and it is the point of the decision, not an oversight.

A draft started on one version finishes on that version, with a notice to the user, rather than
shifting underneath them mid-edit.
