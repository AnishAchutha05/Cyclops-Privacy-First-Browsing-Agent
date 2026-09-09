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
from app.providers.base import BaseProvider

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
