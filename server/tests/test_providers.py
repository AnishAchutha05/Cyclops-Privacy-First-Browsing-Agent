"""Tests for GET /providers and GET /providers/{provider}/models."""
import pytest
from unittest.mock import AsyncMock, patch

from app.providers.base import ModelInfo


EXPECTED_PROVIDER_IDS = {"openai", "google", "anthropic", "openrouter", "custom"}


@pytest.mark.asyncio
async def test_providers_returns_list(client):
    response = await client.get("/providers")
    assert response.status_code == 200
    body = response.json()
    assert "providers" in body
    assert isinstance(body["providers"], list)


@pytest.mark.asyncio
async def test_providers_has_all_five(client):
    response = await client.get("/providers")
    providers = response.json()["providers"]
    ids = {p["id"] for p in providers}
    assert ids == EXPECTED_PROVIDER_IDS


@pytest.mark.asyncio
async def test_providers_each_has_id_and_name(client):
    response = await client.get("/providers")
    for provider in response.json()["providers"]:
        assert "id" in provider
        assert "name" in provider
        assert isinstance(provider["id"], str)
        assert isinstance(provider["name"], str)


# ── Model Discovery Tests ─────────────────────────────────────────────────────

def mock_provider_list_models(models: list[ModelInfo]):
    """Patch the registry to return a mock provider with a fixed list_models response."""
    return patch(
        "app.api.providers._registry.get",
        return_value=type("MockProvider", (), {
            "list_models": AsyncMock(return_value=models)
        })(),
    )


def mock_provider_list_models_error(error_msg: str):
    return patch(
        "app.api.providers._registry.get",
        return_value=type("MockProvider", (), {
            "list_models": AsyncMock(side_effect=RuntimeError(error_msg))
        })(),
    )


@pytest.mark.asyncio
async def test_list_models_success(client):
    mock_models = [
        ModelInfo(id="model-1", name="Model One"),
        ModelInfo(id="model-2", name="Model Two"),
    ]
    with mock_provider_list_models(mock_models):
        response = await client.get("/providers/openai/models")
        
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai"
    assert len(body["models"]) == 2
    assert body["models"][0]["id"] == "model-1"
    assert body["models"][0]["name"] == "Model One"


@pytest.mark.asyncio
async def test_list_models_invalid_provider(client):
    response = await client.get("/providers/unknown_provider/models")
    assert response.status_code == 400
    assert "Unknown provider" in response.json()["detail"]


@pytest.mark.asyncio
async def test_list_models_provider_error(client):
    with mock_provider_list_models_error("API key missing"):
        response = await client.get("/providers/anthropic/models")
        
    assert response.status_code == 502
    assert "API key missing" in response.json()["detail"]
