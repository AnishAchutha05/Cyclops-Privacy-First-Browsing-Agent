"""
Custom / self-hosted provider for Cyclops.

Connects to any OpenAI-compatible endpoint (e.g. Ollama, LM Studio,
vLLM, llama.cpp server) using CUSTOM_API_BASE_URL and CUSTOM_API_KEY.

This allows Cyclops to work with local models for fully offline, private operation.
"""
import logging

import openai

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider

logger = logging.getLogger(__name__)


class CustomProvider(BaseProvider):
    """Generic OpenAI-compatible provider for self-hosted or third-party endpoints."""

    @property
    def provider_id(self) -> str:
        return "custom"

    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        settings = get_settings()

        if not settings.custom_api_base_url:
            raise RuntimeError(
                "CUSTOM_API_BASE_URL is not configured. "
                "Set it to the base URL of your OpenAI-compatible endpoint."
            )

        client = openai.AsyncOpenAI(
            api_key=settings.custom_api_key or "none",   # some local servers don't need a real key
            base_url=settings.custom_api_base_url,
        )

        try:
            logger.info("Calling Custom endpoint — base_url=%s  model=%s",
                        settings.custom_api_base_url, model)
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt.system},
                    {"role": "user", "content": prompt.user},
                ],
                temperature=0.0,
            )
        except openai.OpenAIError as exc:
            logger.error("Custom provider error: %s", exc)
            raise RuntimeError(f"Custom provider error: {exc}") from exc

        content = response.choices[0].message.content or ""
        logger.debug("Custom provider response length: %d chars", len(content))
        return content
