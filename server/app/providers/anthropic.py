"""
Anthropic provider for Cyclops.

Reads ANTHROPIC_API_KEY from settings.
Uses the official anthropic Python SDK.
"""
import logging

import anthropic

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)

# Anthropic's max_tokens is required; 4096 is generous for action plans.
_MAX_TOKENS = 4096


class AnthropicProvider(BaseProvider):
    """LLM provider backed by Anthropic Claude."""

    @property
    def provider_id(self) -> str:
        return "anthropic"

    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        settings = get_settings()

        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not configured. Set it in the server environment."
            )

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

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
