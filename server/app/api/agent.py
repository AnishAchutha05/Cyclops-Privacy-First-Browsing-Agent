"""Agent planning endpoint."""

import logging
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agent.action_parser import ActionParserError
from app.agent.planner import Planner
from app.providers.registry import UnsupportedProviderError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent"])


class PlanRequest(BaseModel):

    task: str = Field(
        ...,
        min_length=1,
        max_length=4000,
    )

    sanitized_context: str = Field(
        ...,
        min_length=1,
        max_length=100000,
    )

    available_tools: list[str] = Field(
        ...,
        min_items=1,
    )

    provider: str

    model: str

    metadata: Optional[dict[str, Any]] = None

    api_key: Optional[str] = None


class ActionItem(BaseModel):

    action: str

    target: Optional[str] = None

    value_source: Optional[str] = None

    value: Optional[str] = None

    direction: Optional[str] = None

    amount: Optional[int] = None

    key: Optional[str] = None

    url: Optional[str] = None

    selector: Optional[str] = None

    duration_ms: Optional[int] = None


class PlanResponse(BaseModel):

    mode: Literal["single_step", "multi_step"]

    actions: list[ActionItem]


@router.post(
    "/plan",
    response_model=PlanResponse,
)
async def create_plan(request: PlanRequest) -> PlanResponse:

    logger.info(
        "Plan request received — provider=%s model=%s tools=%s",
        request.provider,
        request.model,
        request.available_tools,
    )

    planner = Planner()

    try:

        result = await planner.plan(
            task=request.task,
            sanitized_context=request.sanitized_context,
            available_tools=request.available_tools,
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
        )

    except UnsupportedProviderError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except ActionParserError as exc:

        logger.error(
            "Planner response remained invalid after retry: %s",
            exc,
        )

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:

        logger.error(
            "Planner provider error: %s",
            exc,
        )

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    logger.info(
        "Plan completed — mode=%s actions=%d",
        result["mode"],
        len(result["actions"]),
    )

    return PlanResponse(
        mode=result["mode"],
        actions=[
            ActionItem(**action)
            for action in result["actions"]
        ],
    )