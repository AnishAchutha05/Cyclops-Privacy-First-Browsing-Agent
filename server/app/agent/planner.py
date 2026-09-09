"""
Planner — central orchestration layer for Cyclops.

Responsibilities:
  1. Accept task + sanitized context + tools + provider/model selection.
  2. Look up the provider via the registry.
  3. Build the prompt via prompt_builder.
  4. Call the provider.
  5. Parse + validate the response via action_parser.
  6. Return the validated action plan.

The planner is intentionally provider-agnostic. No if/elif chains for providers.
"""
import logging
from typing import Any

from app.agent import action_parser, prompt_builder
from app.providers.registry import ProviderRegistry

logger = logging.getLogger(__name__)

_registry = ProviderRegistry()


class Planner:
    """Orchestrates the full planning pipeline for a single request."""

    async def plan(
        self,
        task: str,
        sanitized_context: str,
        available_tools: list[str],
        provider: str,
        model: str,
    ) -> list[dict[str, Any]]:
        """
        Generate a validated action plan.

        Args:
            task:               User's stated goal.
            sanitized_context:  Sanitized page representation (PII already redacted).
            available_tools:    Tool names the extension supports.
            provider:           Provider ID (e.g. 'openai', 'google').
            model:              Model name within the provider.

        Returns:
            List of validated action dicts.

        Raises:
            UnsupportedProviderError: Provider ID not recognised.
            ActionParserError:        Model returned invalid/unsupported output.
            RuntimeError:             Provider API call failed.
        """
        logger.info("Planning started — provider=%s  model=%s", provider, model)

        # 1. Resolve provider
        llm = _registry.get(provider)

        # 2. Build prompt
        built = prompt_builder.build_prompt(
            task=task,
            sanitized_context=sanitized_context,
            available_tools=available_tools,
        )
        logger.debug("Prompt built — system=%d chars  user=%d chars",
                     len(built.system), len(built.user))

        # 3. Call provider
        raw_output = await llm.generate(prompt=built, model=model)
        logger.debug("Raw model output received (%d chars)", len(raw_output))

        # 4. Parse + validate
        actions = action_parser.parse(raw_output)
        logger.info("Planning completed — %d action(s)", len(actions))

        return actions
