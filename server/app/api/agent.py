"""Agent planning endpoint.

POST /agent/plan
  - Receives sanitized page context from the browser extension.
  - Delegates reasoning to the Planner.
  - Returns a structured action plan.

The endpoint never touches raw PII, local profile values, or raw screenshots.
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agent.planner import Planner
from app.providers.registry import UnsupportedProviderError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["Agent"])

# ── Request / Response Models ─────────────────────────────────────────────────


class PlanRequest(BaseModel):
    """Sanitized planning request from the browser extension."""

    task: str = Field(
        ...,
        description="The user's stated goal (e.g. 'Fill in the job application form').",
        min_length=1,
        max_length=4000,
    )
    sanitized_context: str = Field(
        ...,
        description=(
            "Sanitized representation of the current page. "
            "PII must already be replaced with placeholders like [REDACTED]. "
            "Local files must be represented as [LOCAL_FILE]."
        ),
        min_length=1,
        max_length=32000,
    )
    available_tools: list[str] = Field(
        ...,
        description="Tool names the extension can execute (e.g. ['click', 'fill', 'scroll']).",
        min_items=1,
    )
    provider: str = Field(
        ...,
        description="LLM provider ID (e.g. 'openai', 'google', 'anthropic', 'openrouter', 'custom').",
    )
    model: str = Field(
        ...,
        description="Model name within the selected provider (e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022').",
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional non-PII metadata (page URL without query params, page title, etc.).",
    )


class ActionItem(BaseModel):
    """A single browser action the extension should execute."""

    action: str
    target: Optional[str] = None
    value_source: Optional[str] = None
    value: Optional[str] = None
    direction: Optional[str] = None
    key: Optional[str] = None
    url: Optional[str] = None
    selector: Optional[str] = None
    duration_ms: Optional[int] = None


class PlanResponse(BaseModel):
    """Structured action plan returned to the browser extension."""

    actions: list[ActionItem]


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post("/plan", response_model=PlanResponse, summary="Generate an action plan")
async def create_plan(request: PlanRequest) -> PlanResponse:
    """
    Generate a structured action plan from sanitized browser context.

    The backend never receives raw PII. Sensitive values must be pre-replaced
    by the extension before this endpoint is called.
    """
    logger.info(
        "Plan request received — provider=%s model=%s tools=%s",
        request.provider,
        request.model,
        request.available_tools,
    )

    planner = Planner()
    try:
        actions = await planner.plan(
            task=request.task,
            sanitized_context=request.sanitized_context,
            available_tools=request.available_tools,
            provider=request.provider,
            model=request.model,
        )
    except UnsupportedProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Planner error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Provider error: {exc}") from exc

    logger.info("Plan completed — %d action(s) returned", len(actions))
    return PlanResponse(actions=[ActionItem(**a) for a in actions])
