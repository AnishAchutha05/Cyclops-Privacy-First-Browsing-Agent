"""
OpenRouter provider for Cyclops.

Reads OPENROUTER_API_KEY from settings.
OpenRouter exposes an OpenAI-compatible API, so we reuse the openai SDK
with a custom base_url. This lets the user select any model available
on OpenRouter (e.g. 'mistralai/mistral-7b-instruct').
"""
import logging

import openai

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider, ModelInfo

logger = logging.getLogger(__name__)

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
_APP_REFERER = "https://github.com/cyclops-agent"   # OpenRouter attribution header


class OpenRouterProvider(BaseProvider):
    """LLM provider backed by OpenRouter (supports hundreds of models)."""

    @property
    def provider_id(self) -> str:
        return "openrouter"

    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        settings = get_settings()

        if not settings.openrouter_api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not configured. Set it in the server environment."
            )

        client = openai.AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=_OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": _APP_REFERER,
                "X-Title": "Cyclops",
            },
        )

        try:
            logger.info("Calling OpenRouter — model=%s", model)
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": prompt.system},
                    {"role": "user", "content": prompt.user},
                ],
                temperature=0.0,
            )
        except openai.OpenAIError as exc:
            logger.error("OpenRouter API error: %s", exc)
            raise RuntimeError(f"OpenRouter API error: {exc}") from exc

        content = response.choices[0].message.content or ""
        logger.debug("OpenRouter response length: %d chars", len(content))
        return content

    async def list_models(self) -> list[ModelInfo]:
        settings = get_settings()

        if not settings.openrouter_api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not configured. Set it in the server environment to discover models."
            )

        client = openai.AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=_OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": _APP_REFERER,
                "X-Title": "Cyclops",
            },
        )

        try:
            logger.info("Querying OpenRouter for available models")
            response = await client.models.list()
        except openai.OpenAIError as exc:
            logger.error("OpenRouter model discovery error: %s", exc)
            raise RuntimeError(f"OpenRouter API error: {exc}") from exc

        models = []
        for m in response.data:
            # OpenRouter returns the full model ID (e.g. 'anthropic/claude-3-opus')
            name = getattr(m, "name", m.id)
            models.append(ModelInfo(id=m.id, name=name))

        # OpenRouter has a huge list, just sort alphabetically
        models.sort(key=lambda x: x.name)
        return models
