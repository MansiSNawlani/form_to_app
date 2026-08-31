from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import database_is_reachable
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_overrides() -> Iterator[None]:
    """Dependency overrides are global to the app, so a leak would silently
    change the result of an unrelated test."""
    yield
    app.dependency_overrides.clear()


def test_ready_reports_200_when_the_database_answers() -> None:
    app.dependency_overrides[database_is_reachable] = lambda: True

    response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "up"}


def test_ready_reports_503_when_the_database_is_unreachable() -> None:
    """503 rather than 500 or 200. A platform reads this to stop sending traffic
    to an instance that cannot serve it, without restarting the process."""
    app.dependency_overrides[database_is_reachable] = lambda: False

    response = client.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "down"}


def test_health_does_not_depend_on_the_database() -> None:
    """Liveness must stay 200 while the database is down, otherwise the platform
    restarts a healthy process over a fault a restart cannot fix."""
    app.dependency_overrides[database_is_reachable] = lambda: False

    assert client.get("/api/v1/health").status_code == 200


class _ExplodingEngine:
    """Stands in for the engine. AsyncEngine.connect is read-only, so the
    failure has to be injected by replacing the engine rather than its method."""

    def __init__(self, error: Exception) -> None:
        self._error = error

    def connect(self) -> object:
        raise self._error


@pytest.mark.anyio
async def test_reachability_check_swallows_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The check reports False rather than raising, so the route can answer 503
    instead of 500."""
    error = OperationalError("SELECT 1", None, Exception("connection refused"))
    monkeypatch.setattr("app.db.engine", _ExplodingEngine(error))

    assert await database_is_reachable() is False


@pytest.mark.anyio
async def test_reachability_check_swallows_socket_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DNS and socket failures do not always arrive wrapped as SQLAlchemy
    errors, and an unwrapped one would become a 500."""
    monkeypatch.setattr("app.db.engine", _ExplodingEngine(OSError("no such host")))

    assert await database_is_reachable() is False


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
