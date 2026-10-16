# Screenshots

The images the [main README](../../README.md) uses.

These are the real application, driven through Chromium with Playwright against the real backend
and a real PostgreSQL database. They are not mockups, and they are not the prototypes in
`prototypes/`. Coding standards on this project ask for browser evidence over reading the code and
assuming, and the same rule applies to what the README claims the app looks like.

**Everything in them is invented.** They were taken against a separate, empty database holding
only sample data written for them, so no development record and no real account appears.

- **Accounts** all use `example.org`, a domain reserved for documentation.
- **People** are the usual German placeholders: Erika Mustermann, Max Mustermann, Jana Beispiel,
  at Musterstraße 1, 12345 Musterstadt, telephone 0123 456789.
- **Waters and places** are made up: Musterbach, Beispielbach, Mustergraben, Musterweiher,
  Musterdorf, Beispielhausen.
- **No monitoring number appears.** The protocols use the Anlass "allgemeine Bestandserhebung",
  which does not ask for one; every entry in that list is a real FFS monitoring site.
- **Every number is made up:** fish counts, percentages, measurements, lengths and equipment
  settings. None is taken from a real survey or from the test fixtures, which are modelled on
  one.

Some things in them are real, but they are not data:

- **Fixed values from the form itself:** the four Regierungspräsidien, the species names and
  the occasion names.
- **The Rhein and the Donau** at the end of each Vorfluter chain. The form refuses a chain that
  ends anywhere else.
- **The coordinates** are round invented numbers. They still have to fall inside
  Baden-Württemberg for the form to accept them, and no shot shows them.

## Regenerating them

There is no committed script. They were captured with Playwright from a running stack, at 1440 by
900 with a device pixel ratio of 2, in both the light and the dark theme. To redo them, give the
stack a fresh empty database, create the sample accounts and protocols described above, and
capture the same sixteen views. Use a fresh database rather than the development one, so no
development account or record ends up in a picture.

Leave one percentage block deliberately adding up to 120 and attempt to submit before capturing
section 3 and section 7. That refusal is what puts the problem badge on the step bar, and both
screenshots are meant to show it.
