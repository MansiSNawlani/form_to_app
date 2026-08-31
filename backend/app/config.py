from functools import lru_cache

from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from the environment.

    project-overview.md requires that secrets come from the deployment
    environment and never from the repository or a container image, so
    database_url has no default. A missing value is a deployment mistake and
    should fail loudly at startup rather than quietly falling back to a
    developer's machine.

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


@lru_cache
def get_settings() -> Settings:
    """Cached so the environment is read once per process.

    A function rather than a module-level instance so tests can clear the cache
    and substitute their own configuration.
    """
    return Settings()  # type: ignore[call-arg]
