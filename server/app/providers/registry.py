"""
Provider registry for Cyclops.

Maps string provider IDs to BaseProvider implementations.
The planner calls `registry.get(provider_id)` — no if/elif chains anywhere else.
"""
import logging
from typing import TYPE_CHECKING

from app.providers.base import BaseProvider

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class UnsupportedProviderError(ValueError):
    """Raised when a requested provider ID is not registered."""


class ProviderRegistry:
    """Lazy-initialising registry of available LLM providers."""

    def __init__(self) -> None:
        self._providers: dict[str, BaseProvider] | None = None

    def _build(self) -> dict[str, BaseProvider]:
        """Instantiate all providers. Import here to avoid circular imports."""
        # Imported inside _build so provider modules can import settings freely.
        from app.providers.anthropic import AnthropicProvider
        from app.providers.custom import CustomProvider
        from app.providers.google import GoogleProvider
        from app.providers.openai import OpenAIProvider
        from app.providers.openrouter import OpenRouterProvider

        instances: list[BaseProvider] = [
            OpenAIProvider(),
            GoogleProvider(),
            AnthropicProvider(),
            OpenRouterProvider(),
            CustomProvider(),
        ]
        return {p.provider_id: p for p in instances}

    def get(self, provider_id: str) -> BaseProvider:
        """
        Return the provider for the given ID.

        Args:
            provider_id: One of 'openai', 'google', 'anthropic', 'openrouter', 'custom'.

        Raises:
            UnsupportedProviderError: If the ID is not registered.
        """
        if self._providers is None:
            self._providers = self._build()

        provider = self._providers.get(provider_id)
        if provider is None:
            available = sorted(self._providers.keys())
            raise UnsupportedProviderError(
                f"Unknown provider '{provider_id}'. Available providers: {available}"
            )

        logger.debug("Resolved provider: %s", provider_id)
        return provider

    def list_ids(self) -> list[str]:
        """Return sorted list of registered provider IDs."""
        if self._providers is None:
            self._providers = self._build()
        return sorted(self._providers.keys())
