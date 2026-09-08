# Feature: 2b - Login, sessions and role enforcement

**From build-plan:** feature 2b
**Status:** complete

## Goal

Turn the accounts built in 2a into a way to actually be signed in. Right now the `users`
table has rows and a command line that makes them, and nothing in the application has ever
compared a password against a hash. This feature adds the three endpoints that sign somebody
in, sign them out and say who they are, the cookie that carries the session, and the two
reusable pieces every later feature needs: "who is making this request" and "does this
account have the right role".

It matters because it is the missing half of every rule written so far. Features 4 to 10 put
the whole protocol in the browser with no server behind it. Feature 3 cannot save a draft
until it knows whose draft it is, and feature 11's review workflow cannot tell a reviewer
from a submitter. Both start here.

**There is still no screen at the end of this feature.** The login page is 2c. This one's
evidence is `pytest`, `curl` against the running stack, and the browser's own cookie
inspector.

## Notes for someone new to backend authentication

Four ideas, in the order they happen. Read this before the first diff.

**Signing in does not mean the server remembers you.** The server checks the password once,
then hands the browser a small piece of paper that says "this is user 4f2a, and it stops
being valid at 18:40". The browser shows that paper on every later request. The server never
stores a list of who is signed in, which is what lets it run as several containers behind a
load balancer without them having to agree with each other.

**A JWT is that piece of paper.** It is three chunks of text joined by dots: who it is
about, when it expires, and a signature. The signature is made with a secret only the server
knows. Anyone can read a JWT, so nothing private goes in it, but nobody can change one
without the secret, because then the signature stops matching. If somebody edits the user id
inside it, the server notices and refuses it.

**An httpOnly cookie is where we keep it.** A cookie is a small value the browser stores for
one site and attaches to every request to that site automatically. `httpOnly` means
JavaScript on the page cannot read it. That is the whole point: if one bad npm package ever
gets loaded into the app, it can still make requests, but it cannot copy the token out and
send it somewhere else. `docs/decisions.md` already fixed this choice.

**A dependency is FastAPI's word for "run this before the route".** We write one function
that reads the cookie, checks the signature, looks the account up and hands the route a
`User`. Every protected route then just asks for a `User` and gets one, or the request is
refused before the route ever runs. The alternative is every route remembering to check for
itself, and the one that forgets is the security hole.

## Design reference

None. This feature renders nothing. The login page in `prototypes/` belongs to 2c.

## Decisions taken here, and why

Framework conventions rather than product choices, so they are taken rather than put to the
user. Each one says what it rules out, so any of them can be overturned on sight.

| Decision | Why this one |
|---|---|
| **`PyJWT` for the tokens** | The maintained, minimal choice, and the one the JWT specification's own site lists first for Python. `python-jose` appears in older FastAPI tutorials and has had long gaps between releases. This is the one new dependency in the feature. |
| **HS256, one shared secret** | The service that signs the token is the service that checks it, so there is nothing an asymmetric key pair would buy. RS256 becomes right the day a second service has to verify our tokens without being able to mint them, which is feature 19 at the earliest. |
| **The secret is a required setting with no default** | Same rule as `database_url`: secrets come from the deployment environment. A default would ship a signing key in the repository, and anybody holding it could mint a valid token for any account. Minimum 32 characters, refused at startup, because a short secret is guessable and the failure is silent. |
| **The token carries the user id, the issue time and the expiry, and nothing else** | Not the roles. A token holding roles goes stale: deactivate an account or take a role away and the old token keeps working for eight hours. Since every request loads the account anyway, the roles come from the row, which is always current. |
| **Every request loads the account from the database** | The obvious alternative is trusting the token and saving a query. That would mean a deactivated account keeps working until its token expires, and "deactivate this person now" is exactly the thing an administrator needs to be true immediately. One indexed lookup by primary key is a cheap price. |
| **Eight hours, from `project-overview.md`** | Long enough that nobody is thrown out mid-protocol, which on this form is a real risk. No refresh token and no sliding expiry: both are machinery for keeping short-lived sessions alive, and this session is not short-lived. |
| **`SameSite=Lax`, `httpOnly`, `Secure`, `Path=/`** | `Lax` means the cookie is not sent on a request another site triggers, which is what stops a form on someone else's page submitting to us as the signed-in user. Not `Strict`, because feature 14 emails people links into the application and `Strict` would drop the cookie on that first click, showing them a login page they do not need. |
| **`SameSite=Lax` is the whole cross-site defence for now** | It stops the cross-site writes, because every state-changing route is a POST, PUT or DELETE. A separate CSRF token would add a second mechanism against the same attack. This holds only while no GET route changes anything, which is a rule worth keeping anyway. |
| **`Secure` is on by default, with a setting to turn it off** | Browsers treat `http://localhost` as trustworthy and accept a `Secure` cookie there, so local development works with the safe default. The setting exists for the case somebody runs the stack on a plain-http host on their network and spends an afternoon wondering why the cookie never appears. |
| **Wrong password and unknown email give one identical answer** | Two different messages turn the login page into a way to find out who has an account. And when no account is found we still hash a throwaway password, so both answers take the same time. Without that, a fast refusal says "no such account" just as loudly as a message would. |
| **A deactivated account is told it is deactivated** | The one carve-out from the rule above, and it only happens after the correct password, so it tells an attacker nothing they did not already have. The alternative is a person retrying their correct password twenty times and then filing a bug. `error-messages-must-give-a-way-out` requires a way forward, and here that is "ask an administrator to reactivate it". |
| **An `INTEGRATION` account is refused at sign in** | `project-overview.md` says that role is machine only with no interactive login. 2a deliberately let the command create one and left the refusal here. |
| **Routes are `POST /api/v1/anmeldung`, `POST /api/v1/abmeldung`, `GET /api/v1/ich`** | German, following the same rule as the page routes. `anmeldung` matches the page 2c builds, so the two read alike. Cheap to change: it is three strings and no stored data. |
| **The password arrives as JSON, not as a form** | FastAPI's `OAuth2PasswordRequestForm` is the tutorial path and it exists to satisfy the OAuth2 password grant, which we are not implementing. JSON matches every other endpoint this project will have, and Pydantic validates it the same way. |
| **Domain errors become HTTP responses in one registered handler** | `coding-standards.md` asks for exactly this. 2a's `app/benutzer/fehler.py` was written with no wording in it for this moment. The handler is the one place that decides a status code, so a later feature cannot quietly answer 500 for a refusal. |
| **The password is rehashed on a successful sign in when the settings have moved on** | 2a wrote `braucht_neuen_hash` and nothing has ever called it. Sign in is the only moment the plain password exists, so it is the only moment a stronger hash can be made. Without this, raising the Argon2 settings later would only apply to accounts created after the change. |

### Amended during the build, agreed on 2026-09-08

Six things were built differently from the spec above. All six were kept after review;
this section is the record, because a spec that no longer describes what was built is worse
than no spec. Three of them came out of the code review at the end of the build.

| Change | Was | Is | Why |
|---|---|---|---|
| **A second error handler, for unreadable requests** | Not in the spec at all | `behandle_anfragefehler`, registered beside the domain one | FastAPI's own response for a request Pydantic cannot read quotes the rejected value back. On this route that put a submitted password in the response body, and from there into any log that records one. Found by the code review, confirmed by hand, and now covered by a test that posts a 5000 character password and asserts it does not come back. |
| **The error code is a written-out string** | Undecided; the first build used the exception's class name | `ANMELDUNG_FEHLGESCHLAGEN` and the rest, written in the translation table | The code is what feature 2c branches on, so it is a published contract. A Python class name is not one: renaming an exception would have silently broken the browser. |
| **The translation table covers five errors, not every one** | Read as "every `BenutzerFehler`", and the first build mapped twelve | Only what a route in this feature can raise. Everything else falls to 500 | A status code invented before any route can produce it is a contract nobody reviewed. One of them mattered: mapping `BenutzerNichtGefunden` to 404 would have let an unauthenticated caller learn that an address has no account here, which is exactly what `melde_an` goes to some trouble to keep unknowable. |
| **The cookie has its own module** | Files / areas put the cookie in `anmeldung.py` | `app/api/sitzung.py`, with one dict of attributes both setting and clearing use | A browser deletes a cookie by matching its attributes, so a sign-out that drifts from the sign-in does nothing and still answers 204. One module and one dict make that structural rather than a promise in a comment. |
| **`config.py` gained `KonfigurationUngueltig`** | Step 1 said only to add the three settings | A missing or invalid setting now fails with a message naming the environment variable and how to fix it, `DATABASE_URL` included | The step required that the message name the variable, and Pydantic's own does not. It changes the failure for a setting that already existed, which is why it is recorded here. |
| **The short-secret test uses 31 characters** | The step named 20 | `GEHEIMNIS_MINDESTLAENGE - 1` | One below the limit is the case worth testing, and it stays correct if the minimum ever moves. |

### Evidence from the running stack, 2026-09-08

Recorded here because the done-when clauses in steps 3 and 4 ask for it and nothing else in
the branch would show it happened.

- `POST /api/v1/anmeldung` against the Compose stack returns 200 with the account, and
  `set-cookie: befischung_sitzung=...; HttpOnly; Max-Age=28800; Path=/; SameSite=lax; Secure`.
- `GET /api/v1/ich` with that cookie returns the account; without it, and with a cookie one
  character longer, 401 `NICHT_ANGEMELDET`.
- A wrong password and an unknown address return byte-identical 401 bodies.
- `POST /api/v1/abmeldung` returns 204 and clears the cookie with the same attributes.
- `/api/v1/openapi.json` lists exactly `anmeldung`, `abmeldung`, `ich`, `health`, `ready`.

## In scope

- The signing secret as a required setting, in `.env.example` and `docker-compose.yml`.
- Making and reading a token: sign, verify, expiry, and the refusals.
- The sign-in rule as a plain function: password checked, deactivated refused, `INTEGRATION`
  refused, timing equalised, hash upgraded when due.
- `POST /api/v1/anmeldung`, `POST /api/v1/abmeldung`, `GET /api/v1/ich`.
- The session cookie, set and cleared with matching attributes.
- The `aktueller_benutzer` dependency, and the `erfordert_rollen` dependency factory.
- One registered handler translating `BenutzerFehler` into HTTP responses.
- The user response shape, which 2c and feature 16 both read.
- A test client fixture, so this and every later HTTP feature can test routes against the
  real test database.

## Out of scope

- **The login page, and anything in `frontend/`.** That is 2c: the `/anmeldung` screen,
  TanStack Query, the user in the header, and the protocol routes requiring a session. This
  feature ends at the API, and 2c is a separate branch.
- **Protecting any existing route.** There is nothing to protect: the only routes are health
  and readiness, which must stay open or the platform cannot check them. `erfordert_rollen`
  is built and tested here and first used by feature 3.
- **Rate limiting and account lockout.** Argon2 is slow enough that guessing is not cheap,
  but that is not a defence. A real limiter needs state shared across containers, and an
  in-process counter would give false comfort while a second container answers freely. This
  belongs at the reverse proxy, which is a deployment concern for `/release`. Named here so
  it is a decision rather than an oversight.
- **Changing a password, resetting a forgotten one, and expiring one.** Not in the build
  plan for feature 2. A Super Admin sets a password with the 2a command.
- **Two-factor authentication, and single sign-on against an FFS identity provider.** Neither
  is in the plan. If FFS ever has a central login, it replaces the sign-in endpoint and
  leaves the cookie, the dependencies and every permission check untouched.
- **A refresh token, a sliding session, or a "remember me" box.**
- **Recording sign-ins.** Feature 15 is the audit trail, and it covers data changes.
- **Any new table.** This feature adds no migration.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - The signing secret and the token functions.** Add `pyjwt` to
      `pyproject.toml`. Add `jwt_secret`, `cookie_secure` and `sitzungsdauer_stunden` to
      `app/config.py`, the secret required with a minimum length of 32 and no default. Then
      `app/security/token.py` with `erstelle_token(benutzer_id)` and `lies_token(token)`,
      plain functions over strings that touch no database and no request. `lies_token`
      returns the user id or raises a typed error saying which of the three things went
      wrong: expired, signature invalid, or malformed.

      Then `.env.example` gains the variable with the command that generates one
      (`python -c "import secrets; print(secrets.token_urlsafe(48))"`), `docker-compose.yml`
      passes it to the backend, and `README.md` says what happens if it is missing. That part
      matters more than it looks: anybody with an existing `.env` hits a startup failure on
      their next pull, and the message has to name the variable and say how to make one.

      *Done when:* `pytest` passes new cases in `app/security/token_test.py` covering a token
      that round trips back to the same id, a token that has expired refused, a token whose
      payload was edited refused, a token signed with a different secret refused, a token
      with no user id inside refused, and complete nonsense refused; a `Settings` test shows
      a missing secret and a 20 character secret both refused at startup with a message
      naming the variable; and `ruff check .` and `mypy .` are green.

- [x] **Step 2 - The sign-in rule.** `melde_an(session, email, passwort)` in
      `app/benutzer/dienst.py`, returning the `User` or raising. Three new errors in
      `app/benutzer/fehler.py`: `AnmeldungFehlgeschlagen` for a wrong password or an unknown
      address, `KontoDeaktiviert`, and `KontoNichtInteraktiv` for an `INTEGRATION` account.

      Three things happen here that are easy to leave out and hard to add later. When no
      account is found, hash a throwaway password anyway, so a wrong address and a wrong
      password take the same time. Check `ist_aktiv` and the role only after the password is
      correct, so a refusal never confirms an address to somebody who does not have the
      password. And when `braucht_neuen_hash` says so, rehash and save, since this is the
      only moment the plain password exists.

      Still no HTTP in this step. The rule is a plain function against a session, exactly
      like the other four in this module, which is what lets it be tested without a request.

      *Done when:* `pytest` passes new cases in `app/benutzer/dienst_test.py` covering the
      right password returning the account, a wrong password refused, an unknown address
      refused with the same error type as a wrong password, an address in different capitals
      signing in, a deactivated account refused with its own error even with the right
      password, an `INTEGRATION` account refused with its own error, and an account whose
      hash used weaker settings coming back with a new hash stored and the old one gone.

- [x] **Step 3 - Signing in over HTTP.** `app/api/anmeldung.py` with
      `POST /api/v1/anmeldung`, mounted on `app/main.py` as a router. The request is JSON
      with `email` and `passwort`. On success the cookie is set with all four attributes and
      the account comes back in the response body as `BenutzerAntwort` (id, email, rollen,
      regierungspraesidium, locale, ist_aktiv). No hash, ever, in any shape this feature
      defines.

      Also in this step, because the endpoint cannot answer properly without it:
      `app/api/fehler_http.py`, one exception handler registered on the app that turns a
      `BenutzerFehler` into a status code and a body. And in `conftest.py`, an httpx client
      fixture with `get_session` overridden to the rolled-back test session, so route tests
      hit the real test database and leave nothing behind.

      *Done when:* `pytest` passes route tests covering a correct sign in returning 200 with
      the account and no `password_hash` anywhere in the body, the response carrying a
      `Set-Cookie` with `HttpOnly`, `Secure`, `SameSite=Lax` and `Path=/`, a wrong password
      and an unknown address both returning 401 with identical bodies, a deactivated account
      returning 403 with its own message, an `INTEGRATION` account returning 403, malformed
      JSON returning 422, and none of the failures setting a cookie; and against the running
      stack, `curl -i` on a real account shows the cookie and the browser's storage
      inspector shows `HttpOnly` ticked.

- [x] **Step 4 - Who am I, and signing out.** `app/api/abhaengigkeiten.py` with
      `aktueller_benutzer`: read the cookie, refuse if absent, read the token, refuse if it
      does not verify, load the account, refuse if it has gone or is no longer active. Then
      `GET /api/v1/ich` returning the same `BenutzerAntwort`, and `POST /api/v1/abmeldung`
      clearing the cookie with attributes matching the ones it was set with, because a
      browser will not delete a cookie it cannot match.

      Signing out is deliberately just the cookie. Nothing server side is invalidated,
      because nothing server side is stored, and a stolen token would stay valid until it
      expires. That is the accepted cost of stateless sessions, and the answer to a genuinely
      stolen token is to deactivate the account, which this step makes take effect
      immediately.

      *Done when:* `pytest` passes route tests covering `/ich` with a valid cookie returning
      the account, with no cookie returning 401, with an edited cookie returning 401, with an
      expired token returning 401, and with a valid token for an account deactivated since
      sign in returning 401 rather than succeeding; `/abmeldung` clearing the cookie so a
      following `/ich` returns 401; `/abmeldung` without a cookie succeeding rather than
      failing, since being signed out is what the caller asked for; and in a browser against
      the running stack, signing in and then opening `/api/v1/ich` in the address bar returns
      the account.

- [x] **Step 5 - Requiring a role.** `erfordert_rollen(*rollen)` in the same module: a
      dependency factory that takes the roles that would satisfy it and returns a dependency
      allowing an account holding any one of them. Any-of rather than all-of, because the
      real cases read "a reviewer or a super admin may accept this", and an account holding
      both roles must not be locked out by an all-of check.

      Nothing in the application uses it yet, so it is proved against a small route defined
      inside the test file. That is honest: the dependency is built now because features 3,
      11, 12, 13 and 16 all need the same one, and building it five times is how five
      slightly different permission checks appear.

      Then `AGENTS.md` gains the new environment variable, and `README.md` the one line about
      generating a secret before the first run.

      *Done when:* `pytest` passes tests over a throwaway protected route covering no cookie
      returning 401, a signed-in account without the role returning 403, an account with the
      role returning 200, an account holding one of two accepted roles returning 200, and a
      deactivated account returning 401 rather than 403; and `pytest`, `mypy .` and
      `ruff check .` are all green from `backend/`.

## Files / areas

**New**

- `backend/app/security/token.py` + `_test.py` - making and reading a JWT
- `backend/app/api/__init__.py` - the routers package
- `backend/app/api/anmeldung.py` + `_test.py` - the three endpoints
- `backend/app/api/sitzung.py` + `_test.py` - the cookie, and the /ich and /abmeldung tests
- `backend/app/api/abhaengigkeiten.py` + `_test.py` - `aktueller_benutzer`, `erfordert_rollen`
- `backend/app/api/schemas.py` - `AnmeldungAnfrage`, `BenutzerAntwort`, `FehlerAntwort`
- `backend/app/api/fehler_http.py` - refusals to HTTP, in one place
- `backend/app/config_test.py` - the settings that must be present and long enough

**Changed**

- `backend/pyproject.toml` - `pyjwt`
- `backend/app/config.py` - `jwt_secret`, `cookie_secure`, `sitzungsdauer_stunden`
- `backend/app/benutzer/dienst.py` - `melde_an`
- `backend/app/benutzer/fehler.py` - the three sign-in errors
- `backend/app/main.py` - the router and the exception handler
- `backend/conftest.py` - the HTTP client fixture, and the shared account fixtures
- `.env.example`, `docker-compose.yml` - the signing secret
- `AGENTS.md`, `README.md` - the new variable, and how to make one

**Untouched**

- Everything under `frontend/`, and every migration. This feature adds no table and no screen.

## Data / contracts

**Load-bearing.** Features 2c, 3, 11, 12, 13 and 16 all build on these.

- **`BenutzerAntwort`** - `id`, `email`, `rollen`, `regierungspraesidium`, `locale`,
  `ist_aktiv`. Returned by both `/anmeldung` and `/ich`, so 2c has one shape to model and
  feature 16's user list can reuse it. `password_hash` is not on it and never will be.
- **The cookie name**, defined once as a constant. Changing it later signs everybody out.
- **The token payload** - `sub` (the user id as a string), `iat`, `exp`. Adding a claim later
  is safe; relying on one that is not there is not.
- **`aktueller_benutzer`** as the only way a route learns who is calling. A route that reads
  the cookie itself is a route that will forget the deactivation check.
- **`erfordert_rollen`** as the only way a route requires a role. Any-of semantics.
- **The status codes**: 401 means "not signed in, or no longer valid", 403 means "signed in
  and not allowed". Later features depend on the difference, because 2c sends a 401 to the
  login page and must not do that for a 403.

## Testing

The test gate is on for the backend: `AGENTS.md` declares `pytest`, from `backend/`. Every
step adds logic where a wrong answer is possible, so every step ships tests in the same diff.

| Step | Tested how |
|---|---|
| 1 | `pytest`, no database needed. Expiry tested by minting a token that is already past |
| 2 | `pytest` against real Postgres, through the rolled-back session |
| 3 | `pytest` route tests through the httpx client, plus `curl -i` and the browser's cookie inspector against the running stack |
| 4 | `pytest` route tests, plus signing in and calling `/ich` in a browser |
| 5 | `pytest` over a throwaway route defined in the test file. `mypy` and `ruff` green |

There is no `Verify` command on this project yet, so the gate is `pytest`, `mypy .` and
`ruff check .`, all run from `backend/`. The frontend is untouched, so `npm test` and
`npm run build` are not part of this feature's evidence.

**The permission tests `coding-standards.md` asks for are still not all possible here.** It
requires a test that one submitter cannot read another's submission and one that a
Regierungspräsidium account cannot see another region. There are no submissions yet, so both
belong to features 3 and 13. What this feature owes them is the dependency they will use and
a test proving it refuses the wrong role, which step 5 delivers.

## Notes for the AI

- **Never log, print or return a token, a password or a hash.** Not in a debug line, not in
  an error, not in a test failure message. A token in a log is a working session for anybody
  who reads the log.
- **The refusal for a wrong password and for an unknown address must be identical**, in
  status code, body and time taken. If a step makes them differ in any of the three, it has
  opened the account enumeration this feature is meant to close.
- **Set and clear the cookie with the same attributes.** A browser matches a deletion against
  name, path and domain. A mismatch means sign-out silently does nothing, which is the sort
  of defect that reaches production because the response still says 200.
- **German for domain terms, English for programming vocabulary**, as `coding-standards.md`
  sets out. `anmeldung`, `abmeldung`, `rollen`, `benutzer` are domain. `token`, `cookie`,
  `session`, `router`, `schema` are not.
- **Routers stay thin**: parse, authorise, delegate, return. The sign-in rule lives in
  `dienst.py` and the route calls it. A password comparison inside a route handler is the
  wrong shape.
- **The error handler decides status codes, not the routes.** If a route raises
  `HTTPException` for a domain refusal, that is drift.
- **No em dashes anywhere**, including commit messages.
- **`mypy` is in strict mode.** Dependencies need real annotations, and
  `Annotated[User, Depends(aktueller_benutzer)]` rather than a bare default value.
- **Do not touch `frontend/`.** If a step wants a page, it has drifted into 2c.
- **Ask before adding a dependency** other than `pyjwt`.
