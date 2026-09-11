"""
Anthropic provider for Cyclops.

Reads ANTHROPIC_API_KEY from settings.
Uses the official anthropic Python SDK.
"""
import logging

import anthropic

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider, ModelInfo

logger = logging.getLogger(__name__)

# Anthropic's max_tokens is required; 4096 is generous for action plans.
_MAX_TOKENS = 4096


class AnthropicProvider(BaseProvider):
    """LLM provider backed by Anthropic Claude."""

    @property
    def provider_id(self) -> str:
        return "anthropic"

    async def generate(self, prompt: BuiltPrompt, model: str, api_key: str | None = None) -> str:
        settings = get_settings()

        resolved_key = api_key or settings.anthropic_api_key

        if not resolved_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not configured and no key was provided."
            )

        client = anthropic.AsyncAnthropic(api_key=resolved_key)

        try:
            logger.info("Calling Anthropic — model=%s", model)
            message = await client.messages.create(
                model=model,
                max_tokens=_MAX_TOKENS,
                system=prompt.system,
                messages=[{"role": "user", "content": prompt.user}],
                temperature=0.0,
            )
        except anthropic.AnthropicError as exc:
            logger.error("Anthropic API error: %s", exc)
            raise RuntimeError(f"Anthropic API error: {exc}") from exc

        # Claude returns a list of content blocks; extract text.
        content = ""
        for block in message.content:
            if hasattr(block, "text"):
                content += block.text

        logger.debug("Anthropic response length: %d chars", len(content))
        return content

    async def list_models(self, api_key: str | None = None) -> list[ModelInfo]:
        settings = get_settings()

        resolved_key = api_key or settings.anthropic_api_key

        if not resolved_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not configured and no key was provided."
            )

        client = anthropic.AsyncAnthropic(api_key=resolved_key)

        try:
            logger.info("Querying Anthropic for available models")
            response = await client.models.list()
        except anthropic.AnthropicError as exc:
            logger.error("Anthropic model discovery error: %s", exc)
            raise RuntimeError(f"Anthropic API error: {exc}") from exc

        models = []
        for m in response.data:
            # The Anthropic SDK Model object has 'id' and 'display_name'
            # Anthropic models usually start with 'claude-'
            if m.id.startswith("claude-"):
                name = getattr(m, "display_name", m.id)
                models.append(ModelInfo(id=m.id, name=name))

        models.sort(key=lambda x: x.name)
        return models
