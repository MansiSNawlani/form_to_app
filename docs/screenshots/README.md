# Screenshots

The images the [main README](../../README.md) uses.

These are the real application, driven through Chromium with Playwright against the real backend
and a real PostgreSQL database. They are not mockups, and they are not the prototypes in
`prototypes/`. Coding standards on this project ask for browser evidence over reading the code and
assuming, and the same rule applies to what the README claims the app looks like.

**The survey data in them is invented.** The water, the location, the Bearbeiter, the equipment
and the fish counts were written for these screenshots. No real person's name, address, telephone
number or email address appears in any of them, and no real survey does either. The Prüfliste
screenshot is filtered to one Anlass deliberately, so that early development records do not appear
in it.

The protocol shown is a fictional WRRL survey of the Starzel at Rangendingen. The
Monitoringstrecken-Nr. `4005221003` is a real entry from the extracted option list, chosen because
its label matches the invented location; nothing else about the record is real.

## Regenerating them

There is no committed script. They were captured by hand from a running stack, at 1440 by 900 with
a device pixel ratio of 2, in both the light and the dark theme. To redo them, start the stack and
the dev server as the main README describes, create a submitter account and a reviewer account,
fill in a protocol, and capture the same twelve views.

Leave one percentage block deliberately adding up to 120 and attempt to submit before capturing
section 3 and section 7. That refusal is what puts the problem badge on the step bar, and both
screenshots are meant to show it.
