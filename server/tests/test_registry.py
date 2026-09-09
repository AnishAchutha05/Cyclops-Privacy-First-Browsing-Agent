"""Unit tests for the provider registry."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.providers.registry import ProviderRegistry, UnsupportedProviderError


@pytest.fixture
def registry():
    return ProviderRegistry()


def test_registry_returns_openai(registry):
    provider = registry.get("openai")
    assert provider.provider_id == "openai"


def test_registry_returns_google(registry):
    provider = registry.get("google")
    assert provider.provider_id == "google"


def test_registry_returns_anthropic(registry):
    provider = registry.get("anthropic")
    assert provider.provider_id == "anthropic"


def test_registry_returns_openrouter(registry):
    provider = registry.get("openrouter")
    assert provider.provider_id == "openrouter"


def test_registry_returns_custom(registry):
    provider = registry.get("custom")
    assert provider.provider_id == "custom"


def test_registry_raises_for_unknown_provider(registry):
    with pytest.raises(UnsupportedProviderError, match="unknown_llm"):
        registry.get("unknown_llm")


def test_registry_list_ids_contains_all(registry):
    ids = registry.list_ids()
    assert set(ids) == {"openai", "google", "anthropic", "openrouter", "custom"}


def test_registry_caches_instances(registry):
    """Registry should return the same instance on repeated calls."""
    p1 = registry.get("openai")
    p2 = registry.get("openai")
    assert p1 is p2
