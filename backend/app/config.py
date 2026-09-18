from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import Field, PostgresDsn, SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The repository root, from backend/app/config.py. Used only to point at the form
# definition below, which is checked in beside the code rather than deployed
# separately.
REPO_WURZEL = Path(__file__).resolve().parents[2]

# The one form version there is. ADR 0004 freezes a version rather than migrating
# submissions between versions, so a second directory appears here rather than
# this one changing.
FORMULAR_SEED = REPO_WURZEL / "database" / "seed" / "form_version_20260609"

# Where attachment files go when nobody says otherwise. Right for a developer
# running uvicorn on the host; .gitignore already keeps uploads/ out of the
# repository. The container mounts a named volume and sets this to it, because a
# path inside a container layer is thrown away on the next deploy.
ANLAGEN_STANDARD = REPO_WURZEL / "uploads" / "anlagen"

# Which store holds the attachments. "datei" is a directory and is right
# wherever the service has a disk that outlives it, which is every developer
# machine and the Docker Compose stack. "s3" is an object store and is what a
# platform without a persistent disk needs, because there a directory is thrown
# away between requests and the photographs go with it.
ANLAGEN_SPEICHER_ARTEN = ("datei", "s3")

# What "s3" cannot be guessed without. The endpoint and the region have workable
# defaults; these three have none, and a deployment missing one must be told at
# startup rather than at the first upload.
S3_PFLICHT = {
    "s3_bucket": "S3_BUCKET",
    "s3_zugriffsschluessel": "S3_ZUGRIFFSSCHLUESSEL",
    "s3_geheimschluessel": "S3_GEHEIMSCHLUESSEL",
}

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
    "anlagen_verzeichnis": (
        "ANLAGEN_VERZEICHNIS must be a path to a directory the service may write"
        " to. It holds the uploaded map excerpts and photographs, so it has to"
        " survive a redeploy: use a mounted volume in a deployment. Leave it out"
        " of .env to use ./uploads/anlagen in this checkout."
    ),
    "anlagen_speicher": (
        "ANLAGEN_SPEICHER must be either datei or s3. Leave it out of .env to use"
        " datei, which keeps the attachments in the directory ANLAGEN_VERZEICHNIS"
        " names. Use s3 only where the service has no disk that survives a"
        " redeploy."
    ),
    "s3": (
        "ANLAGEN_SPEICHER is s3, but the bucket it should use is not fully"
        " described. Set S3_BUCKET, S3_ZUGRIFFSSCHLUESSEL and"
        " S3_GEHEIMSCHLUESSEL, plus S3_ENDPOINT for anything other than Amazon"
        " (Cloudflare R2 and MinIO both need it). Or leave ANLAGEN_SPEICHER out"
        " of .env to keep the attachments in a directory."
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

    # Pydantic's own prefix on a ValueError raised inside a validator. Stripped so
    # a rule that already wrote a whole sentence is not introduced by a fragment.
    WERTFEHLER = "Value error, "

    def __init__(self, fehler: ValidationError) -> None:
        self.felder = [str(einzeln["loc"][0]) for einzeln in fehler.errors() if einzeln["loc"]]
        zeilen = [
            HINWEISE.get(feld, f"{feld.upper()} is missing or invalid.") for feld in self.felder
        ]
        # A rule spanning several fields, such as the S3 one, belongs to no single
        # field and so arrives with an empty location. Without this it would be
        # dropped and the process would refuse to start while saying nothing about
        # why, which is the one thing this class exists to prevent.
        zeilen += [
            einzeln["msg"].removeprefix(self.WERTFEHLER)
            for einzeln in fehler.errors()
            if not einzeln["loc"]
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

    # Where the uploaded map excerpts and photographs are kept. Files rather than
    # a database column: twenty photographs at 10 MB is 200 MB for one protocol,
    # and every backup would carry all of it. app/anlagen/speicher.py has the
    # reasoning in full.
    #
    # This directory is survey evidence. A deployment must point it at storage
    # that outlives the container, or a redeploy silently throws away every
    # picture FFS has been sent.
    anlagen_verzeichnis: Path = ANLAGEN_STANDARD

    # Which of the two stores in app/anlagen/ actually runs. The default keeps
    # every developer, the test suite and the Compose stack on the directory
    # above, so nothing here changes unless a deployment says so.
    anlagen_speicher: Literal["datei", "s3"] = "datei"

    # The bucket, and how to reach it. All ignored while anlagen_speicher is
    # "datei", so a developer never sets any of them.
    s3_bucket: str = ""

    # Empty means Amazon's own endpoint. Anything else, Cloudflare R2 or a MinIO
    # server FFS run themselves, needs its address here; that is the whole reason
    # this store is written against S3 rather than against one provider.
    s3_endpoint: str = ""

    # "auto" is what Cloudflare R2 expects and it is harmless elsewhere as a
    # default; Amazon wants a real region such as eu-central-1.
    s3_region: str = "auto"

    # SecretStr for the same reason as jwt_secret: these two together are write
    # access to every photograph FFS has been sent, so they must not reach a log
    # because something printed the settings object.
    s3_zugriffsschluessel: SecretStr = SecretStr("")
    s3_geheimschluessel: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def _s3_ist_vollstaendig_beschrieben(self) -> "Settings":
        """Choosing s3 without a bucket must stop the process, not the first upload.

        A cross-field rule, so it cannot be a Field constraint. It fails under the
        key "s3" rather than under one field name because the useful message names
        all three variables at once: telling somebody about S3_BUCKET, and only
        then about the access key, is three restarts to learn one thing.
        """
        if self.anlagen_speicher != "s3":
            return self

        fehlend = [
            name
            for feld, name in S3_PFLICHT.items()
            if not str(_klartext(getattr(self, feld))).strip()
        ]
        if fehlend:
            raise ValueError(HINWEISE["s3"])
        return self


def _klartext(wert: object) -> object:
    """The value behind a SecretStr, so emptiness can be checked without caring
    which of the two kinds of setting it is."""
    return wert.get_secret_value() if isinstance(wert, SecretStr) else wert


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
