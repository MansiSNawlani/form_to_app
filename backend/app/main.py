from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Protokoll E-Befischung",
    version="0.1.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)


class Health(BaseModel):
    status: str


@app.get("/api/v1/health")
def health() -> Health:
    """Liveness only. Feature 1 extends this with a database readiness check."""
    return Health(status="ok")
