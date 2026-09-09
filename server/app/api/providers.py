"""Provider discovery endpoint.

Allows the browser extension UI to enumerate available LLM providers
without hard-coding provider IDs on the frontend.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.providers.base import ModelInfo
from app.providers.registry import ProviderRegistry, UnsupportedProviderError

logger = __import__("logging").getLogger(__name__)

router = APIRouter(tags=["Providers"])
_registry = ProviderRegistry()


class ProviderInfo(BaseModel):
    id: str
    name: str


class ProvidersResponse(BaseModel):
    providers: list[ProviderInfo]


_PROVIDERS: list[ProviderInfo] = [
    ProviderInfo(id="openai", name="OpenAI"),
    ProviderInfo(id="google", name="Google"),
    ProviderInfo(id="anthropic", name="Anthropic"),
    ProviderInfo(id="openrouter", name="OpenRouter"),
    ProviderInfo(id="custom", name="Custom"),
]


@router.get("/providers", response_model=ProvidersResponse, summary="List available providers")
async def list_providers() -> ProvidersResponse:
    return ProvidersResponse(providers=_PROVIDERS)


class ModelsResponse(BaseModel):
    provider: str
    models: list[ModelInfo]


@router.get("/providers/{provider}/models", response_model=ModelsResponse, summary="List available models for a provider")
async def list_models(provider: str) -> ModelsResponse:
    """
    Query the given provider's API for available models using configured credentials.
    """
    try:
        provider_instance = _registry.get(provider)
    except UnsupportedProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        logger.info("Discovering models for provider=%s", provider)
        models = await provider_instance.list_models()
        return ModelsResponse(provider=provider, models=models)
    except RuntimeError as exc:
        logger.error("Model discovery failed for %s: %s", provider, exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

