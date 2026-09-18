# Anlagen im Objektspeicher

**Type:** Fix

## The problem

Uploaded map excerpts and photographs are written as files under one directory,
`ANLAGEN_VERZEICHNIS`. `app/anlagen/speicher.py` holds the whole of that: one class,
`Anlagenspeicher`, with six methods over a root `Path`.

A directory is the right answer wherever the service has a disk that outlives it, and
`docker-compose.yml` gives it one, the named `anlagen` volume. It is the wrong answer on a platform
that has no persistent disk at all. On Vercel the filesystem is read-only apart from a scratch
folder that is thrown away between requests, so every upload would appear to succeed and then be
gone. `.env.example` and `speicher.py` both already warn about exactly this, because it destroys
survey evidence quietly rather than loudly.

This blocks deploying anywhere serverless, which is what item 10 and item 3d's work needs in order
to be shown to FFS on a real URL.

## The fix

**Make the store an interface with two implementations, chosen by configuration.**

The seam is already in the right place. `app/anlagen/dienst.py`, `app/api/anlagen.py` and
`app/protokolle/dienst.py` all take an `Anlagenspeicher` and call the same six methods; none of
them touches a `Path`. So the change is to turn that class into a declared interface, keep the
present behaviour as the local-disk implementation, and add a second one that speaks the S3 HTTP
API.

**S3-compatible rather than any one provider's own storage.** Decided with the user on 2026-09-18.
`project-overview.md` says the deployment target is an FFS-approved platform running Docker
containers, so Vercel is a stop on the way rather than the destination. One S3 adapter runs against
Cloudflare R2 or Amazon now and against a MinIO server FFS host themselves later, changing settings
only. These are photographs attached to German government survey records, so where they physically
sit has to stay FFS's decision. Worth an ADR at `/complete`.

**boto3 called through worker threads, not an async S3 client.** `speicher.py` already puts every
blocking disk call behind `asyncio.to_thread`, for the reason its docstring gives: file writing
blocks, and without that one upload stalls every other request on the process. The S3 store follows
the identical pattern, so there is one concurrency story in the file rather than two, and no
dependency on a less-maintained async wrapper.

### Must not break

- **The storage key stays exactly as it is.** Two UUIDs and a separator, built from ids we
  generated and never from the request. `SCHLUESSEL_MUSTER` guards it. A key is already a valid S3
  object name, so nothing about the existing rows or files changes.
- **Refusals leave nothing behind.** `schreibe` removes a part file when the caller aborts past the
  size cap. The S3 store must be equally clean.
- **The caller still stops a huge upload early.** The size cap is enforced by the caller as it
  reads the stream. The S3 store may buffer only what it has already accepted, never read the
  request in first and check afterwards.
- **A row may outlive its file.** `existiert` and `lies` answer "no" rather than raising, so a
  missing object is a 404 and not a 500. Keep that.
- Local development and the tests keep using the directory, unchanged and with no S3 anywhere near
  them.

## Build steps

### Step 1 - the store becomes a declared interface

Split `app/anlagen/speicher.py`: a `typing.Protocol` naming the six methods
(`schreibe`, `lies`, `existiert`, `bloecke`, `loesche`, `loesche_protokoll`), and the present
class renamed to `DateiSpeicher` as the local-disk implementation. `anlagen_schluessel`,
`SCHLUESSEL_MUSTER`, `SchluesselUngueltig` and `BLOCKGROESSE` stay shared. `get_speicher()` keeps
returning the disk store.

Pure refactor, no behaviour change.

**Done when:** `pytest` passes with no test edited except for the rename, `mypy .` is clean, and
uploading and downloading a photograph through the running app still works.

### Step 2 - the S3 store

`S3Speicher`, implementing the same six methods against any S3-compatible endpoint.

| Method | How |
|---|---|
| `schreibe` | Consume the async stream block by block into a `SpooledTemporaryFile`, so the caller's cap still aborts early, then `upload_fileobj`. Delete the object if anything raises |
| `lies` | `get_object`, returning `None` on the missing-key error rather than raising |
| `existiert` | `head_object`, false on the missing-key error |
| `bloecke` | Stream the response body in `BLOCKGROESSE` chunks, never all at once |
| `loesche` | `delete_object`, quiet when it was not there |
| `loesche_protokoll` | `list_objects_v2` on the protocol's prefix, then `delete_objects`. S3 has no directories, so this is a prefix sweep rather than one removal |

Tests beside it, in `speicher_s3_test.py`. They skip with a sentence saying what to configure when
no bucket is reachable, the same arrangement `conftest.py` uses for the database and `konten.ts`
uses for the browser tests: "not run here" must never read as "passed".

**Done when:** `pytest` passes, the new tests either run green against a real bucket or skip with
their message, and `ruff check .` and `mypy .` are clean.

### Step 3 - configuration picks one

`ANLAGEN_SPEICHER`, either `datei` (the default) or `s3`, plus `S3_BUCKET`, `S3_ENDPOINT`,
`S3_REGION`, `S3_ZUGRIFFSSCHLUESSEL` and `S3_GEHEIMSCHLUESSEL`. `get_speicher()` returns whichever
is configured.

Every message goes in `HINWEISE` and has to name the variable and say what to do, the standard
config.py already holds. Choosing `s3` without a bucket must refuse to start with a sentence
saying so, not fail on the first upload.

`.env.example` gains the block, commented out, explaining that a deployment without a persistent
disk needs `s3` and why.

**Done when:** the app starts and behaves exactly as before with nothing new set;
`ANLAGEN_SPEICHER=s3` with no bucket refuses to start with an actionable message; and with a real
bucket a photograph uploads, appears in the list, downloads, and disappears when deleted.

## Verify

1. `pytest` from `backend/`, `ruff check .`, `mypy .`, and `npm run build` from `frontend/`.
2. With nothing new configured, `docker compose up -d --build`, attach a map excerpt and two
   photographs to a draft, reload the page, download one, delete one. Unchanged behaviour.
3. With `ANLAGEN_SPEICHER=s3` and a real bucket, the same walkthrough, then confirm the objects are
   in the bucket and that deleting the protocol removes them.
4. `ANLAGEN_SPEICHER=s3` with `S3_BUCKET` unset: the backend refuses to start and says which
   variable is missing.

## Not in this spec

**The Vercel deployment configuration itself.** `AGENTS.md` makes deployment a separate explicit
step under `/release`, which prepares local provider config and readiness checks and stops before
any deploy, remote service, push or publish. That runs after this fix lands, because there is no
point configuring a deployment whose uploads still vanish.

Nothing here deploys, pushes, or creates any remote service.
