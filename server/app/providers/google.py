"""
Google Generative AI provider for Cyclops.

Reads GOOGLE_API_KEY from settings.
Uses the google-generativeai Python SDK.
"""
import logging

import google.generativeai as genai
from google.generativeai.types import GenerationConfig

from app.agent.prompt_builder import BuiltPrompt
from app.config.settings import get_settings
from app.providers.base import BaseProvider, ModelInfo

logger = logging.getLogger(__name__)


class GoogleProvider(BaseProvider):
    """LLM provider backed by Google Generative AI (Gemini)."""

    @property
    def provider_id(self) -> str:
        return "google"

    async def generate(self, prompt: BuiltPrompt, model: str) -> str:
        settings = get_settings()

        if not settings.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not configured. Set it in the server environment."
            )

        genai.configure(api_key=settings.google_api_key)

        # Combine system + user into a single user turn (Gemini approach).
        full_prompt = f"{prompt.system}\n\n{prompt.user}"

        generation_config = GenerationConfig(
            temperature=0.0,
            response_mime_type="application/json",
        )

        try:
            logger.info("Calling Google Generative AI — model=%s", model)
            gemini_model = genai.GenerativeModel(
                model_name=model,
                generation_config=generation_config,
            )
            response = await gemini_model.generate_content_async(full_prompt)
        except Exception as exc:
            logger.error("Google Generative AI error: %s", exc)
            raise RuntimeError(f"Google Generative AI error: {exc}") from exc

        content = response.text or ""
        logger.debug("Google response length: %d chars", len(content))
        return content

    async def list_models(self) -> list[ModelInfo]:
        settings = get_settings()

        if not settings.google_api_key:
            raise RuntimeError(
                "GOOGLE_API_KEY is not configured. Set it in the server environment to discover models."
            )

        genai.configure(api_key=settings.google_api_key)

        try:
            logger.info("Querying Google for available models")
            # Google's list_models is synchronous in the SDK, so we can just call it
            # list_models returns an iterator of Model objects
            models_iter = genai.list_models()
        except Exception as exc:
            logger.error("Google model discovery error: %s", exc)
            raise RuntimeError(f"Google Generative AI error: {exc}") from exc

        models = []
        for m in models_iter:
            # We only want models that support text generation (generateContent)
            if "generateContent" in m.supported_generation_methods:
                # model.name often looks like "models/gemini-1.5-pro"
                # The ID we use in generate() usually drops "models/"
                id_clean = m.name.replace("models/", "") if m.name.startswith("models/") else m.name
                # Use display_name if available, fallback to id
                name = m.display_name if m.display_name else id_clean
                models.append(ModelInfo(id=id_clean, name=name))
                
        models.sort(key=lambda x: x.name)
        return models
