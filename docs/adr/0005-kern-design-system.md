# KERN is the component library, with two components built in-house

The interface is built on the KERN UX Standard React kit, themed with Baden-Württemberg colours and
typography. The species picker and the catch table are built in-house on headless primitives and
styled to match.

## Why

The requirements mandate following Baden-Württemberg state design guidance. We checked whether that
guidance exists as anything a developer can install. It does not: the state design portal covers
logo, colour, typography, image style, print layout and icons, with no stylesheet, component
library, package or design kit. Read literally, the requirement means matching a PDF by hand.

KERN is an open source design system built for German public administration, licensed EUPL-1.2,
with accessibility as its primary design goal. It satisfies the intent of the requirement and
covers much of the accessibility requirement at the same time.

## Considered options

**MUI, themed to BW colours.** Faster, better documented, far more components, and already familiar
to the team. Rejected because it is structurally Material Design, an American consumer design
language, and claiming it satisfies a German state design requirement would be a stretch that
somebody would eventually challenge.

## Consequences

KERN is deliberately a thin styling layer over native HTML with minimal JavaScript, which is a
different philosophy from MUI or Ant Design rather than a smaller version of them. It has roughly
thirty components and no data grid, date picker or autocomplete. The two places this bites are
exactly the two hardest parts of this form: a species picker over hundreds of entries needing
type-ahead, and a catch table of 338 cells with live row totals. Both are built in-house.

We are not mixing in a second full design system to fill those gaps.

The KERN core is mature at version 2.7.2, but the React kit is roughly a year old. The catch table
is built first, before anything else is committed, specifically so that this risk surfaces
immediately rather than in month three.
