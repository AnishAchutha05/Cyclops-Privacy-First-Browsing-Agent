"""
OpenAI provider for Cyclops.

Reads OPENAI_API_KEY from settings.
Uses the official openai Python SDK.
API key stays backend-side and is never exposed to the extension.
"""
import logging

import openai

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """LLM provider backed by OpenAI's Chat Completions API."""

    @property
    def provider_id(self) -> str:
        return "openai"

    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        settings = get_settings()

        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured. Set it in the server environment."
            )

        client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

        try:
            logger.info("Calling OpenAI — model=%s", model)
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt.system},
                    {"role": "user", "content": prompt.user},
                ],
                temperature=0.0,   # deterministic for planning tasks
                response_format={"type": "json_object"},
            )
        except openai.OpenAIError as exc:
            logger.error("OpenAI API error: %s", exc)
            raise RuntimeError(f"OpenAI API error: {exc}") from exc

        content = response.choices[0].message.content or ""
        logger.debug("OpenAI response length: %d chars", len(content))
        return content
