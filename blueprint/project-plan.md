# Project Plan

> Filled in from the design session recorded in [../docs/decisions.md](../docs/decisions.md).
> When this changes, re-run `/overview` rather than editing the generated overview directly.

## 1. Problem - What problem are we solving?

The Fischereiforschungsstelle Baden-Württemberg collects electrofishing survey data on a four page
PDF form, the Protokoll E-Befischung. The form only works in Adobe Acrobat with JavaScript enabled,
which its own help document warns about, and it cannot be filled in a browser at all. Completed
forms are emailed to FFS and to the responsible regional authority, and someone at FFS then loads
the data into FiaKa, the official fisheries database.

That process has no way to save a partial form and resume it, no review step, no search across past
surveys, no audit trail, and several validation bugs that have been letting incorrect data through
for years. We are replacing it with a web application.

## 2. Users - Who is this for?

Not the general public. Accounts are created by an administrator; there is no sign-up.

- **Submitters** are the people who carry out surveys. Often external consultants, engineering
  firms and angling associations, not only FFS staff.
- **Data Stewards** are FFS staff who correct and quality-check submitted data.
- **Reviewers** decide whether a submission is accepted, rejected, or needs changes.
- **Super Admins** manage accounts and roles.
- **Regierungspräsidien**, the four regional fisheries authorities, get read-only access to their
  own region. They grant the permits that these protocols are a condition of.

## 3. Features - What does the MVP need?

- Login with roles, accounts created by an administrator
- The full Protokoll E-Befischung as a web form, split into navigable sections
- Save as you type, resume on any machine
- The six percentage blocks with running totals and a sum-to-100 rule
- The catch table with a searchable species picker, size classes and row totals
- Photo and map excerpt upload
- Coordinate entry with a Baden-Württemberg bounds check
- Submit, review, request changes, reject, accept, lock
- A review queue with filters and search, including by species
- Regional read-only access for the Regierungspräsidien
- Email on submission and status change, plus a weekly digest of what is waiting
- An audit trail of every workflow action
- German and English interface, light and dark

Deferred to after the first release: the interactive map and official water body dataset, the
automated transfer into FiaKa, PDF generation, the crayfish protocol, and offline field use.

## 4. Data - What are we storing?

- **Users**, their roles, and whether they are active
- **Personen** - the contact details of the person who carried out a survey, stored once and
  reused, kept separate from the submissions themselves
- **Probestrecken** - stretches of water with stable identity, reused across years
- **Gewässer** - water bodies, referenced by official identifier once that dataset arrives
- **Submissions** - the envelope as columns, the roughly 338 form answers as one JSON document
- **Form versions** - versioned definitions, so historical submissions still display correctly
- **Attachments** - photos and the map excerpt
- **Workflow history** - every status change with who, when and why
- **Audit records** - who changed what data, and when

## 5. Tech - What stack are we using?

- **Frontend:** React with TypeScript, built by Vite. React Hook Form for the form itself, Zod for
  browser-side validation, TanStack Query for server calls.
- **UI:** KERN UX Standard, themed with Baden-Württemberg colours and typography. Two components
  built in-house: the species picker and the catch table.
- **Backend:** FastAPI with Python. Pydantic for validation, which is the authoritative gate.
- **Database:** PostgreSQL with PostGIS. Alembic for migrations.
- **Maps (later):** MapLibre GL JS.
- **Auth:** JWT held in an httpOnly cookie, roughly eight hour sessions.
- **Packaging:** Docker for every component, Docker Compose for local development.

Reasoning for each choice is in [../docs/decisions.md](../docs/decisions.md) and the ADRs under
`docs/adr/`.

## 6. Monetize - How will this make money?

It does not. This is a tool for a state authority, funded as such. There is no billing, no
subscription and no advertising, and none should be added.

## 7. UI/UX - How should this look and feel?

Plain and official rather than decorative, which is what the Baden-Württemberg guidance calls for
and what KERN is built to deliver. High contrast, large targets, obvious labels.

The form is long, so it is split into sections shown one at a time, with a progress list down the
side. Users can jump to any section in any order, because surveyors genuinely do not have every
value at once. Saving is automatic and always visible.

Accessibility is a requirement from the start, not a later pass: keyboard navigation, correct
labels, visible focus, sufficient contrast.

## 8. Deployment - Where and how will this ship?

Docker containers on an FFS-approved platform, with a reverse proxy as the only public entry point.
Separate containers for the frontend build, the FastAPI service, PostgreSQL with PostGIS, and a
background worker for email and reminders.

The database keeps persistent storage and is never ephemeral. Backups are stored away from the
database host and the restore procedure is tested, not assumed. Secrets come from the deployment
environment, never from the repository or a container image.

FiaKa is never reachable from the public application. Transfer happens later through a controlled
integration using a dedicated machine account.

Still to confirm with FFS: the container platform, the mail server for notifications, the domain,
and the data retention policy.
