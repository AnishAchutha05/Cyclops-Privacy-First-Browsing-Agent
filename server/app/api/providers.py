"""Provider discovery endpoint.

Allows the browser extension UI to enumerate available LLM providers
without hard-coding provider IDs on the frontend.
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Providers"])


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
    """Return the list of supported LLM provider options."""
    return ProvidersResponse(providers=_PROVIDERS)
