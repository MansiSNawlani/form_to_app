# KERN is the component library, with two components built in-house

> **Superseded on 2026-08-24 by [ADR 0006](0006-mui-supersedes-kern.md).** The interface is built
> on MUI. Everything below is kept as the record of why KERN was chosen and why the reasoning no
> longer holds. Do not follow it.

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

## Amendment, 2026-08-24: KERN is preferred, not mandated

FFS have confirmed that using KERN is not a requirement they impose on us. It was our choice, made
to satisfy the state design guidance in a way a developer can actually install. That reasoning
still stands, so KERN remains the default and the first thing we reach for.

What changes is the fallback. Where KERN genuinely falls short, we may now use another component
library instead of building in-house, rather than treating "no second library" as an absolute rule.
"Falls short" means a real, demonstrated limitation: a missing component we need, a conflict with
our React version, or broken types. It does not mean an unfamiliar API or a plainer look, since
plainness is the point.

Two things this does not change. Whatever we use still has to meet the accessibility bar KERN was
chosen for, and it still has to be themeable to the Baden-Württemberg palette and typography, so a
strongly opinionated look such as Material remains a poor fit. If we do end up replacing KERN
wholesale rather than supplementing it, that is a new decision and needs its own ADR superseding
this one.
