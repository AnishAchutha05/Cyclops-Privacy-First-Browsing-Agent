"""Tests for POST /agent/plan."""
import json
import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import VALID_ACTION_PLAN_JSON, VALID_PLAN_REQUEST


# ── Helpers ───────────────────────────────────────────────────────────────────

def mock_provider_generate(raw_json: str):
    """Patch the planner's provider so it returns a fixed JSON string."""
    return patch(
        "app.agent.planner.ProviderRegistry.get",
        return_value=type("MockProvider", (), {
            "generate": AsyncMock(return_value=raw_json)
        })(),
    )


# ── Valid request ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_plan_valid_request(client):
    with mock_provider_generate(VALID_ACTION_PLAN_JSON):
        response = await client.post("/agent/plan", json=VALID_PLAN_REQUEST)

    assert response.status_code == 200
    body = response.json()
    assert "actions" in body
    assert len(body["actions"]) == 2


@pytest.mark.asyncio
async def test_plan_returns_local_profile_references_unresolved(client):
    """Backend must never resolve local_profile.* — extension does that locally."""
    with mock_provider_generate(VALID_ACTION_PLAN_JSON):
        response = await client.post("/agent/plan", json=VALID_PLAN_REQUEST)

    actions = response.json()["actions"]
    fill_action = next(a for a in actions if a["action"] == "fill")
    assert fill_action["value_source"] == "local_profile.email"
    # The backend must NOT have resolved this to an actual email address
    assert "value" not in fill_action or fill_action.get("value") is None


# ── Invalid requests ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_plan_missing_task(client):
    payload = {**VALID_PLAN_REQUEST}
    del payload["task"]
    response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_plan_missing_context(client):
    payload = {**VALID_PLAN_REQUEST}
    del payload["sanitized_context"]
    response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_plan_missing_provider(client):
    payload = {**VALID_PLAN_REQUEST}
    del payload["provider"]
    response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_plan_unsupported_provider(client):
    payload = {**VALID_PLAN_REQUEST, "provider": "nonexistent_llm"}
    response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 400
    assert "nonexistent_llm" in response.json()["detail"]


@pytest.mark.asyncio
async def test_plan_malformed_model_output(client):
    """When the model returns garbage, the endpoint should return 422."""
    with mock_provider_generate("this is not JSON at all"):
        response = await client.post("/agent/plan", json=VALID_PLAN_REQUEST)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_plan_model_returns_unsupported_action(client):
    bad_plan = json.dumps({"actions": [{"action": "hack_the_planet", "target": "root"}]})
    with mock_provider_generate(bad_plan):
        response = await client.post("/agent/plan", json=VALID_PLAN_REQUEST)
    assert response.status_code == 422


# ── Provider selection ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_plan_provider_selection_anthropic(client):
    payload = {**VALID_PLAN_REQUEST, "provider": "anthropic", "model": "claude-3-5-sonnet-20241022"}
    with mock_provider_generate(VALID_ACTION_PLAN_JSON):
        response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_plan_provider_selection_google(client):
    payload = {**VALID_PLAN_REQUEST, "provider": "google", "model": "gemini-1.5-pro"}
    with mock_provider_generate(VALID_ACTION_PLAN_JSON):
        response = await client.post("/agent/plan", json=payload)
    assert response.status_code == 200
