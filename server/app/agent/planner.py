"""
Central planning orchestration for Cyclops.
"""

import logging
from typing import Any

from app.agent import action_parser, prompt_builder
from app.providers.registry import ProviderRegistry

logger = logging.getLogger(__name__)

_registry = ProviderRegistry()


class Planner:

    async def plan(
        self,
        task: str,
        sanitized_context: str,
        available_tools: list[str],
        provider: str,
        model: str,
        api_key: str | None = None,
    ) -> dict[str, Any]:

        logger.info(
            "Planning started — provider=%s model=%s",
            provider,
            model,
        )

        llm = _registry.get(provider)

        prompt = prompt_builder.build_prompt(
            task=task,
            sanitized_context=sanitized_context,
            available_tools=available_tools,
        )

        raw_output = await llm.generate(
            prompt=prompt,
            model=model,
            api_key=api_key,
        )

        try:
            result = action_parser.parse(raw_output)

        except action_parser.ActionParserError as first_error:

            logger.warning(
                "First planner response was invalid: %s",
                first_error,
            )

            retry_prompt = prompt_builder.build_prompt(
                task=task,
                sanitized_context=sanitized_context,
                available_tools=available_tools,
                correction=(
                    "The previous response could not be parsed. "
                    f"Parser error: {first_error}"
                ),
            )

            raw_output = await llm.generate(
                prompt=retry_prompt,
                model=model,
                api_key=api_key,
            )

            result = action_parser.parse(raw_output)

        logger.info(
            "Planning completed — mode=%s actions=%d",
            result["mode"],
            len(result["actions"]),
        )

        return result