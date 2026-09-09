"""Tests for GET /providers."""
import pytest


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
