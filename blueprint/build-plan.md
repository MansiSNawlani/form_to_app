# Build Plan

> The features that make up this project, in rough build order. Run `/feature` with no number to
> spec the next unchecked item, or `/feature 5` to pick a specific one. Completed items get checked
> off here, so this doubles as the progress tracker.

## Before the build starts

These are not features and are not tracked here. They happen first.

- ~~Remove the Next.js scaffold and restructure as a monorepo~~ - done.
- ~~Throwaway prototype of the look: header, form, footer, the submissions list and the reviewer
  view. `prototypes/`, via `/prototype`.~~ - done.
- Throwaway prototype of the catch table in KERN, to decide whether the KERN React kit holds up.
  **Deferred by decision on 2026-08-22: this now happens after the form screens are built, not
  before the build starts.** The risk it was meant to retire early therefore stays open through
  features 1 to 8, and lands in full on feature 9.
- Extract the remaining dropdown option lists from the PDF with a proper PDF toolchain: the species
  list, `Anlass` values, monitoring stretch numbers, cathode types.
- Send [../docs/ffs-defect-list.md](../docs/ffs-defect-list.md) to FFS.

## MVP

- [ ] 1. Project skeleton: Docker Compose, PostgreSQL with PostGIS, FastAPI with a health check,
      React and Vite shell, KERN themed with BW colours, translation wiring with German only, light
      and dark tokens, and the Verify command
  - [ ] 1a. App shell and theme: clear the Vite scaffold, port the `prototypes/theme.css` tokens,
        install KERN, and build the header, main and footer shell with a light and dark toggle
  - [ ] 1b. Translation wiring: an i18n library with a German locale file, every shell string read
        from it, ready for the English locale in feature 17
  - [ ] 1c. Backend and database: Docker Compose, PostgreSQL with PostGIS, FastAPI health and
        readiness endpoints, and the frontend reaching the backend through the proxy

  The Verify command is deliberately not a sub-item. `AGENTS.md` makes CI a separate explicit
  setup, so it belongs to `/ci` after 1c, not to the feature loop.
- [ ] 2. Accounts and login: JWT in an httpOnly cookie, the six roles, a first-admin command,
      activate and deactivate
- [ ] 3. Draft lifecycle: create a submission, save automatically, local safety copy, "my
      submissions" list
- [ ] 4. Form part 1: occasion, recorder details, and the Probestrecke, including the Vorfluter
      chain and coordinate entry with the Baden-Württemberg bounds check
- [ ] 5. Form part 2: measurements and hydrology, including hydrology disappearing entirely for
      standing waters
- [ ] 6. Form part 3: the six percentage blocks, with running totals and the sum-to-100 rule
- [ ] 7. Form part 4: in-water structures, usage influences, fishery management, stocking history
- [ ] 8. Form part 5: equipment and fished areas
- [ ] 9. Form part 6: the catch table, with the species picker, size classes, row totals, the
      young-of-year rule and the "no detection" rule
- [ ] 10. Photo and map excerpt upload
- [ ] 11. Submit and review workflow: the state machine, rejection reasons, change requests, locking
- [ ] 12. Review queue: list, filter and search, including by species
- [ ] 13. Regierungspräsidium access: regional read-only role
- [ ] 14. Email notifications and the weekly digest, with the background worker
- [ ] 15. Audit trail
- [ ] 16. User administration
- [ ] 17. English translation

## After MVP

- [ ] 18. Map picker: MapLibre, the official water body dataset, snapping with override, water body
      search, and backfilling identifiers onto existing submissions
- [ ] 19. Transfer to FiaKa: JSON payload, machine account, safe to retry, transfer log
- [ ] 20. PDF generation, with the map excerpt drawn from stored geometry
- [ ] 21. Protokoll Krebs, reusing the Probestrecke characterisation sections
- [ ] 22. Offline field use
