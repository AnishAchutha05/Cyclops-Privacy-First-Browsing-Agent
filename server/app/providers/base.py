"""
Base provider interface for Cyclops.

Every LLM provider must subclass BaseProvider and implement `generate`.
The planner interacts exclusively through this interface — never with
provider-specific types directly.
"""
from abc import ABC, abstractmethod

from app.agent.prompt_builder import BuiltPrompt


class BaseProvider(ABC):
    """Abstract base class for all LLM/VLM providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Unique string identifier for this provider (e.g. 'openai')."""

    @abstractmethod
    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        """
        Send the prompt to the LLM and return the raw response string.

        Args:
            prompt: BuiltPrompt containing system and user message strings.
            model:  Provider-specific model name (e.g. 'gpt-4o').

        Returns:
            Raw model output as a string. The planner passes this to
            the action parser for validation.

        Raises:
            RuntimeError: If the provider API call fails.
        """
