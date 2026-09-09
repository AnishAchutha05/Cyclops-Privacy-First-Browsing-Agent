"""Health check endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str


@router.get("/health", response_model=HealthResponse, summary="Health check")
async def health() -> HealthResponse:
    """Return 200 OK when the backend is available."""
    return HealthResponse(status="ok")
