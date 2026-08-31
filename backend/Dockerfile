# Pinned to 3.12 to match the ruff and mypy targets in pyproject.toml.
#
# Known and accepted: development on this machine runs 3.14, because no 3.12 is
# installed there. A version-specific bug can therefore only appear inside the
# container. Decided on 2026-08-31 in favour of the more conservative base over
# dev/production parity.
FROM python:3.12-slim

# Fail fast and log immediately: without PYTHONUNBUFFERED, container logs arrive
# in chunks and a crash can lose the message that explains it.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Dependency metadata first, so a source-only change does not reinstall
# everything on rebuild.
COPY pyproject.toml README.md* ./
COPY app ./app

# No dev extras: pytest, ruff and mypy have no business in a shipped image.
RUN pip install --no-cache-dir .

# Runs as a non-root user. A container process that does not need root should
# not have it, so a compromise in the application is not a compromise of the
# container.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /srv
USER appuser

EXPOSE 8000

# No secrets and no DATABASE_URL baked in. Configuration arrives from the
# environment at run time, which is what project-overview.md requires.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
