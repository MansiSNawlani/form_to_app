from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, PostgresDsn, SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# The repository root, from backend/app/config.py. Used only to point at the form
# definition below, which is checked in beside the code rather than deployed
# separately.
REPO_WURZEL = Path(__file__).resolve().parents[2]

# The one form version there is. ADR 0004 freezes a version rather than migrating
# submissions between versions, so a second directory appears here rather than
# this one changing.
FORMULAR_SEED = REPO_WURZEL / "database" / "seed" / "form_version_20260609"

# Long enough that guessing the key is hopeless. token_urlsafe(48) produces 64
# characters, so the value .env.example tells people to generate clears this with
# room to spare and a hand typed placeholder does not.
GEHEIMNIS_MINDESTLAENGE = 32

# What to do about each setting that can be missing or wrong. A configuration
# failure stops the process before it serves anything, so the message is the only
# help whoever hit it gets: it has to name the variable and say how to fix it,
# which is the standard this project set on 2026-09-06.
HINWEISE = {
    "database_url": (
        "DATABASE_URL is missing or not a usable Postgres URL."
        " Copy .env.example to .env in the repository root and keep the DATABASE_URL"
        " line as it is for local development."
    ),
    "jwt_secret": (
        "JWT_SECRET is missing or shorter than"
        f" {GEHEIMNIS_MINDESTLAENGE} characters. It signs the login sessions, so it"
        " has to be long and random. Generate one with:"
        ' python -c "import secrets; print(secrets.token_urlsafe(48))"'
        " and put it in .env as JWT_SECRET=..."
    ),
    "sitzungsdauer_stunden": (
        "SITZUNGSDAUER_STUNDEN must be a whole number of hours, at least 1."
        " Leave it out of .env to use the default of 8."
    ),
    "cookie_secure": (
        "COOKIE_SECURE must be true or false. Leave it out of .env to use the"
        " default of true, which is correct everywhere the site is served over"
        " https, and over http://localhost as well."
    ),
    "formular_seed_dir": (
        "FORMULAR_SEED_DIR must be a path to the directory holding felder.json."
        " Leave it out of .env to use the copy in this checkout."
    ),
}


class KonfigurationUngueltig(RuntimeError):
    """The environment does not describe a runnable service.

    Raised instead of letting Pydantic's own error out, which lists field names
    and validator internals rather than the environment variable to set. This is
    a deployment mistake and the person reading it may never have seen this code.
    """

    def __init__(self, fehler: ValidationError) -> None:
        self.felder = [str(einzeln["loc"][0]) for einzeln in fehler.errors() if einzeln["loc"]]
        zeilen = [
            HINWEISE.get(feld, f"{feld.upper()} is missing or invalid.") for feld in self.felder
        ]
        super().__init__(
            "The backend cannot start:\n" + "\n".join(f"  - {zeile}" for zeile in zeilen)
        )


class Settings(BaseSettings):
    """Runtime configuration, read from the environment.

    project-overview.md requires that secrets come from the deployment
    environment and never from the repository or a container image, so
    database_url and jwt_secret have no default. A missing value is a deployment
    mistake and should fail loudly at startup rather than quietly falling back to
    a developer's machine.

    That is deliberately different from an unreachable database, which is a
    runtime condition the readiness endpoint reports on instead.
    """

    model_config = SettingsConfigDict(
        # Two locations, later wins. The repository root holds the single .env
        # that Docker Compose also reads, so there is one file to maintain;
        # backend/.env is an optional per-developer override.
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgresDsn rather than str so an empty or malformed value is rejected at
    # startup. A blank environment variable is a realistic deployment mistake and
    # a plain str would accept it, surfacing later as a confusing connection
    # error. An unreachable host is still accepted here, because that is a
    # runtime condition for /api/v1/ready to report, not a configuration error.
    #
    # The +asyncpg driver is part of the URL because SQLAlchemy picks the dialect
    # from the scheme.
    database_url: PostgresDsn

    # Signs the session tokens. SecretStr rather than str so it cannot reach a
    # log by accident: printing the settings object, or any Pydantic model
    # holding it, shows ********** and the real value only comes out of an
    # explicit get_secret_value() call.
    #
    # Anybody holding this can mint a valid session for any account, so it is the
    # single most sensitive value in the deployment. Changing it signs everybody
    # out, which is also the emergency answer if it ever leaks.
    jwt_secret: SecretStr = Field(min_length=GEHEIMNIS_MINDESTLAENGE)

    # project-overview.md fixes the session at roughly eight hours: long enough
    # that nobody is thrown out part way through a protocol, which on a form this
    # long is a real risk.
    sitzungsdauer_stunden: int = Field(default=8, ge=1)

    # Whether the session cookie is marked Secure, meaning the browser only ever
    # sends it over https. On by default because off is a downgrade nobody should
    # get by forgetting a variable. Browsers treat http://localhost as
    # trustworthy and accept a Secure cookie there, so local development needs no
    # change; this exists for the case of running the stack over plain http on
    # some other host, where the cookie would otherwise vanish with no error.
    cookie_secure: bool = True

    # Where felder.json and the option lists sit. The default is the checkout's
    # own copy, which is right for every developer and for the tests.
    #
    # It is configurable at all because the container does not have the same
    # layout as the repository: the package is installed rather than run from the
    # source tree, so a path worked out from __file__ inside the image points
    # into site-packages. The Dockerfile sets this to where it copied the seed.
    formular_seed_dir: Path = FORMULAR_SEED


def lade_settings(**overrides: Any) -> Settings:
    """Read the configuration, or fail with something a person can act on.

    The overrides exist for the tests, which pass _env_file=None to read the
    environment alone rather than whatever .env the developer happens to have.
    """
    try:
        return Settings(**overrides)
    except ValidationError as fehler:
        raise KonfigurationUngueltig(fehler) from fehler


@lru_cache
def get_settings() -> Settings:
    """Cached so the environment is read once per process.

    A function rather than a module-level instance so tests can clear the cache
    and substitute their own configuration.
    """
    return lade_settings()
