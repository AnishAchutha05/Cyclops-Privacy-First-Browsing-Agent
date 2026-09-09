"""
Shared pytest fixtures for Cyclops backend tests.

All tests use mocked providers — no live API calls required.
"""
import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.config.settings import Settings, get_settings


# ── Settings override ─────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_settings():
    """Replace real settings with a test configuration for every test."""
    test_settings = Settings(
        openai_api_key="test-openai-key",
        google_api_key="test-google-key",
        anthropic_api_key="test-anthropic-key",
        openrouter_api_key="test-openrouter-key",
        custom_api_base_url="http://localhost:11434/v1",
        custom_api_key="none",
        default_provider="openai",
        default_model="gpt-4o",
    )
    app.dependency_overrides[get_settings] = lambda: test_settings
    get_settings.cache_clear()
    with patch("app.config.settings.get_settings", return_value=test_settings):
        yield test_settings
    app.dependency_overrides.clear()
    get_settings.cache_clear()


# ── HTTP client ───────────────────────────────────────────────────────────────

@pytest.fixture
async def client():
    """Async test client for the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ── Canonical valid action plan ───────────────────────────────────────────────

VALID_ACTION_PLAN_JSON = """{
  "actions": [
    {"action": "fill", "target": "email_field", "value_source": "local_profile.email"},
    {"action": "click", "target": "submit_button"}
  ]
}"""

VALID_PLAN_REQUEST = {
    "task": "Fill in the job application form",
    "sanitized_context": "Email field: [REDACTED]\nName field: [REDACTED]\nSubmit button: visible",
    "available_tools": ["click", "fill", "scroll"],
    "provider": "openai",
    "model": "gpt-4o",
}
