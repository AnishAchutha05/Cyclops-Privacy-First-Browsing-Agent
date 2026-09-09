"""
Cyclops backend configuration.

All settings are read from environment variables. Never hard-code secrets.
Copy .env.example to .env and fill in your values.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────────
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    # ── Provider API Keys ─────────────────────────────────────
    openai_api_key: Optional[str] = None
    google_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None

    # ── Custom / self-hosted provider ─────────────────────────
    custom_api_base_url: Optional[str] = None
    custom_api_key: Optional[str] = None

    # ── Defaults ──────────────────────────────────────────────
    default_provider: str = "openai"
    default_model: str = "gpt-4o"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance. Safe for use as a FastAPI dependency."""
    return Settings()
