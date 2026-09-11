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
from app.providers.base import BaseProvider, ModelInfo

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """LLM provider backed by OpenAI's Chat Completions API."""

    @property
    def provider_id(self) -> str:
        return "openai"

    async def generate(self, prompt: BuiltPrompt, model: str, api_key: str | None = None) -> str:
        settings = get_settings()
        
        resolved_key = api_key or settings.openai_api_key

        if not resolved_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured and no key was provided."
            )

        client = openai.AsyncOpenAI(api_key=resolved_key)

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

    async def list_models(self, api_key: str | None = None) -> list[ModelInfo]:
        settings = get_settings()
        
        resolved_key = api_key or settings.openai_api_key

        if not resolved_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured and no key was provided to discover models."
            )

        client = openai.AsyncOpenAI(api_key=resolved_key)

        try:
            logger.info("Querying OpenAI for available models")
            response = await client.models.list()
        except openai.OpenAIError as exc:
            logger.error("OpenAI model discovery error: %s", exc)
            raise RuntimeError(f"OpenAI API error: {exc}") from exc

        # Filter to models likely to be chat models, though we could just return all.
        # It's safest to return models that contain 'gpt-' or 'o1-'
        models = []
        for m in response.data:
            if "gpt-" in m.id or "o1-" in m.id or "o3-" in m.id:
                models.append(ModelInfo(id=m.id, name=m.id))
                
        # Sort for predictable UI
        models.sort(key=lambda x: x.name)
        return models
