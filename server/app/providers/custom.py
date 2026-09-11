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
from app.providers.base import BaseProvider, ModelInfo

logger = logging.getLogger(__name__)


class CustomProvider(BaseProvider):
    """Generic OpenAI-compatible provider for self-hosted or third-party endpoints."""

    @property
    def provider_id(self) -> str:
        return "custom"

    async def generate(self, prompt: BuiltPrompt, model: str, api_key: str | None = None) -> str:
        settings = get_settings()

        if not settings.custom_api_base_url:
            raise RuntimeError(
                "CUSTOM_API_BASE_URL is not configured. "
                "Set it to the base URL of your OpenAI-compatible endpoint."
            )
            
        resolved_key = api_key or settings.custom_api_key or "none"

        client = openai.AsyncOpenAI(
            api_key=resolved_key,
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

    async def list_models(self, api_key: str | None = None) -> list[ModelInfo]:
        settings = get_settings()

        if not settings.custom_api_base_url:
            raise RuntimeError(
                "CUSTOM_API_BASE_URL is not configured. "
                "Set it to the base URL of your OpenAI-compatible endpoint to discover models."
            )
            
        resolved_key = api_key or settings.custom_api_key or "none"

        client = openai.AsyncOpenAI(
            api_key=resolved_key,
            base_url=settings.custom_api_base_url,
        )

        try:
            logger.info("Querying Custom endpoint for available models: %s", settings.custom_api_base_url)
            response = await client.models.list()
        except openai.OpenAIError as exc:
            logger.error("Custom provider model discovery error: %s", exc)
            raise RuntimeError(f"Model discovery unsupported or failed for custom endpoint: {exc}") from exc

        models = []
        for m in response.data:
            name = getattr(m, "name", m.id)
            models.append(ModelInfo(id=m.id, name=name))

        models.sort(key=lambda x: x.name)
        return models
