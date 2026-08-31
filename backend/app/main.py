from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Response, status
from pydantic import BaseModel

from app.db import database_is_reachable

app = FastAPI(
    title="Protokoll E-Befischung",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)


class Health(BaseModel):
    status: str


class Readiness(BaseModel):
    status: Literal["ready", "unavailable"]
    database: Literal["up", "down"]


@app.get("/api/v1/health")
def health() -> Health:
    """Liveness. Says only that the process is running and can answer.

    Deliberately does not touch the database. A platform restarts a container
    that fails liveness, and restarting will not fix a database that is down.
    """
    return Health(status="ok")


@app.get(
    "/api/v1/ready",
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"model": Readiness}},
)
async def ready(
    response: Response,
    reachable: Annotated[bool, Depends(database_is_reachable)],
) -> Readiness:
    """Readiness. Says whether the service can do useful work.

    Returns 503 when the database is unreachable, which is what takes the
    instance out of rotation without restarting it. Returning 200 here while the
    database is down would route users to a service that cannot serve them.
    """
    if not reachable:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="unavailable", database="down")
    return Readiness(status="ready", database="up")
