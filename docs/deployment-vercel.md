# Deploying to Vercel

A working deployment of what has been built so far, for showing FFS and for
trying the application on a real address. **Not the production deployment.**
`project-overview.md` puts the real one on an FFS-approved platform running
Docker containers behind a reverse proxy, and nothing here changes that.

Everything below is free of charge at the sizes this needs.

## What runs where

| Piece | Where | Why not somewhere else |
|---|---|---|
| React frontend and FastAPI backend | One Vercel project, one address | Same origin, so the session cookie needs no CORS and no SameSite loosening |
| PostgreSQL | Neon | Vercel runs no database of its own |
| Photographs and map excerpts | Neon Object Storage | Vercel's filesystem is thrown away between requests |

The frontend and the backend deliberately share one address. The browser only
ever talks to one host, which is exactly what `frontend/src/api/client.ts` has
always assumed. `asgi.py` is what joins them, and it explains itself.

## Before you start

You need accounts for Vercel and [Neon](https://neon.tech). Both have a free
tier that covers this. Neon provides the database and the file storage together,
so there is no third account to make.

Any other S3-compatible store works just as well, because that is what the
application was written against: Cloudflare R2, Amazon, or a MinIO server FFS
run on their own machines. Only the four S3 settings in step 3 change.

You also need this repository pushed to GitHub, and the backend virtual
environment working locally, because the database migrations are run from your
machine and not by the deployment.

## 1. The database, on Neon

1. Create a project. Any name will do; `form_to_app` is fine.

   **Set the region to AWS Europe (Frankfurt) before creating it.** A project's
   region cannot be changed afterwards, these are German fisheries records, and
   object storage is offered there.

   Under **Services**, leave **Postgres database** and **Object storage** on, and
   turn **Functions**, **AI gateway** and **Neon Auth** off. Neon Auth in
   particular would be a second login competing with the accounts and six roles
   this application already has.

   Name the bucket **`befischung-anlagen`** and leave its visibility **Private**.
2. Neon shows a connection string. Copy it. It looks like:

   ```
   postgresql://nutzer:geheim@ep-etwas-123.eu-central-1.aws.neon.tech/befischung?sslmode=require&channel_binding=require
   ```

3. **Change `postgresql://` to `postgresql+asyncpg://`** and keep everything
   else exactly as it is. SQLAlchemy picks its driver from that prefix.

   **Change nothing after the `?`.** Neon's string carries `sslmode` and
   `channel_binding`, which are libpq's spellings; asyncpg understands neither
   and refuses the connection on the first one it meets. `fuer_asyncpg` in
   `backend/app/db.py` renames the first and drops the second, and every place
   that connects goes through it: the application, Alembic, and the account
   command. Deleting parts of your own connection string by hand is not
   knowledge a deployment should demand.

   Either endpoint works. Neon offers a pooled host, ending `-pooler`, and a
   direct one; both were tried against this application on 2026-09-18, including
   repeated parameterised queries, and both behaved.

4. Keep the result. It is `DATABASE_URL` below.

### Apply the migrations

Migrations are never run by the application itself, for the reason `AGENTS.md`
gives: several containers would all migrate at once, and a failure should be
visible rather than a restart loop. Run them yourself, once, from `backend/`:

```bash
DATABASE_URL="postgresql+asyncpg://...?sslmode=require" alembic upgrade head
```

On Windows PowerShell:

```powershell
$env:DATABASE_URL="postgresql+asyncpg://...?sslmode=require"; alembic upgrade head
```

Confirm it took:

```bash
alembic current
```

Re-run `alembic upgrade head` after any future deployment that adds a migration.

## 2. The photographs, in Neon's object storage

You turned this on in step 1. It speaks the S3 protocol, which is exactly why the
application was written against S3 rather than against any one provider, so the
same four settings later point at Amazon or at a MinIO server of FFS's own.

From your project, open **Object storage** and collect four values:

- the **bucket name**, `befischung-anlagen`
- the **Access Key ID**
- the **Secret Access Key**
- the **endpoint URL**, the address Neon shows for S3 access

Neon also shows a region alongside them, usually `aws-eu-central-1` for a
Frankfurt project. Use whatever it shows rather than guessing.

**The secret is shown once.** If you lose it, make a new credential; it cannot
be read back.

Two things that matter and are easy to get wrong:

- **The bucket stays private.** Every file is streamed through the application's
  own permission checks, so a submitter sees only their own protocol's
  photographs. A public bucket would hand anybody holding a URL a survey
  photograph directly, with no check at all.
- **Watch the free quota.** A protocol may carry a map excerpt and up to twenty
  photographs at 10 MB each, so a handful of realistic protocols fills a small
  allowance quickly. Check what your plan includes before inviting FFS to upload
  in earnest.

## 3. The Vercel project

Now you can press **Import** on the screen you had open.

1. Import `form_to_app` from GitHub.
2. Leave **Root Directory** as the repository root. Do not set it to `frontend`
   or `backend`: `vercel.json` at the root builds the frontend and `asgi.py`
   serves both halves.
3. Vercel should detect **FastAPI**. If it does not, set the framework preset to
   FastAPI by hand.
4. Add the environment variables below, then deploy.

### Environment variables

Set all of these for **Production**, **Preview** and **Development**.

| Name | Value |
|---|---|
| `DATABASE_URL` | The Neon string from step 1, with `postgresql+asyncpg://` |
| `JWT_SECRET` | Generate your own, see below. Never reuse the local one |
| `ANLAGEN_SPEICHER` | `s3` |
| `S3_BUCKET` | `befischung-anlagen` |
| `S3_ENDPOINT` | The endpoint Neon shows for S3 access |
| `S3_REGION` | What Neon shows, for example `eu-central-1` |
| `S3_ZUGRIFFSSCHLUESSEL` | The Access Key ID from step 2 |
| `S3_GEHEIMSCHLUESSEL` | The Secret Access Key from step 2 |
| `FORMULAR_SEED_DIR` | `database/seed/form_version_20260609` |

Generate the signing secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Anybody holding `JWT_SECRET` can mint a valid session for any account. It must
differ from the one in your `.env`, and changing it signs everybody out, which is
also the answer if it ever leaks.

`COOKIE_SECURE` is left unset on purpose. It defaults to true, which is correct
on https, and Vercel is always https.

`FORMULAR_SEED_DIR` is not optional here even though it has a default. The
default is worked out relative to the source tree, and on Vercel the backend is
installed as a package, so its own files sit somewhere that tells it nothing
about where the repository's seed data went. The Docker image sets this variable
for the same reason.

## 4. The first account

There is no sign-up page, so the first Super Admin is made from the command
line. There is no shell on Vercel, so run it from your machine against the Neon
database, from `backend/`:

```bash
DATABASE_URL="postgresql+asyncpg://...?sslmode=require" \
  befischung benutzer anlegen --email you@example.org --rolle SUPER_ADMIN --rolle REVIEWER
```

The password is prompted for, twice. Make yourself a submitter account too, so
you can walk both sides:

```bash
DATABASE_URL="..." befischung benutzer anlegen --email einreicher@example.org --rolle SUBMITTER
```

## 5. Check it actually works

In order, because each step depends on the one before:

1. `https://<your-app>.vercel.app/api/v1/health` returns `{"status":"ok"}`.
   The function is running.
2. `https://<your-app>.vercel.app/api/v1/ready` returns `"database":"up"`.
   Neon is reachable and the URL is right. If this says `down`, the
   `DATABASE_URL` is wrong or the migrations were never applied.
3. The front page loads and redirects to `/anmeldung`.
4. Sign in. If sign-in fails but `/ready` is fine, the account was created
   against a different database.
5. Start a protocol, type into part 1, reload the page. What you typed is still
   there, which means the draft reached Neon.
6. **Upload a photograph in section 7, then reload.** This is the one that
   matters: it proves the object storage is wired up. If the upload fails, check
   the four S3 values. If it succeeds but the picture is gone after a redeploy, the store is
   still on `datei` and `ANLAGEN_SPEICHER` did not take effect.
7. Fill in a protocol, submit it, then sign in as the reviewer and decide on it.

## What this deployment is not

- **Not a production deployment.** No backups, no monitoring, no custom domain,
  and no agreement with FFS about where German survey data may be stored. A
  Frankfurt project keeps it in Germany, on a US company's infrastructure, which
  is a question for FFS rather than one this guide can settle.
- **No background worker.** Feature 14, the email notifications and the weekly
  digest, needs a process that runs on a schedule. Vercel has cron jobs, but that
  feature is not built yet.
- **No PostGIS.** Nothing uses it until feature 18. Neon can enable it when that
  time comes.
- **Cold starts.** The first request after a quiet period takes a few seconds
  while the function wakes up. That is the platform, not the application.

## If something goes wrong

| Symptom | Almost always |
|---|---|
| Build fails on `npm ci` | `frontend/package-lock.json` out of step with `package.json`. Run `npm install` locally and commit the lock file |
| `The backend cannot start:` in the function logs | A missing or wrong environment variable. The message names it |
| `/api/v1/ready` says `database: down` | `DATABASE_URL` wrong, or `postgresql://` not changed to `postgresql+asyncpg://` |
| `connect() got an unexpected keyword argument` | A connection string parameter asyncpg does not know. Add it to `UMBENANNT` or `VERWORFEN` in `backend/app/db.py`, where `sslmode` and `channel_binding` already are |
| Uploads fail with a 500 | One of the four S3 values, or the credential not scoped to this bucket |
| Everything 404s | Root Directory was set to `frontend` or `backend` instead of the repository root |
