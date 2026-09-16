"""
Strict parser and validator for Cyclops action plans.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

SUPPORTED_ACTIONS = {
    "click",
    "fill",
    "upload",
    "scroll",
    "navigate",
    "screenshot",
    "wait",
    "press_key",
    "select",
    "done",
}

VALID_MODES = {"single_step", "multi_step"}

_SCROLL_DIRECTIONS = {"up", "down", "left", "right"}

_SAFE_FIELDS = {
    "action",
    "target",
    "value",
    "value_source",
    "direction",
    "amount",
    "url",
    "key",
    "duration_ms",
    "selector",
}


class ActionParserError(ValueError):
    """Raised when model output is invalid."""


def parse(raw_output: str) -> dict[str, Any]:
    cleaned = _strip_markdown_fences(raw_output)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("Model returned invalid JSON: %s", exc)
        raise ActionParserError(
            f"Model response is not valid JSON: {exc}"
        ) from exc

    if not isinstance(data, dict):
        raise ActionParserError("Model response must be a JSON object.")

    mode = data.get("mode")
    if mode not in VALID_MODES:
        raise ActionParserError(
            f"'mode' must be one of {sorted(VALID_MODES)}."
        )

    actions = data.get("actions")

    if not isinstance(actions, list):
        raise ActionParserError("'actions' must be a JSON array.")

    if len(actions) != 1:
        raise ActionParserError(
            "Exactly ONE action must be returned per response."
        )

    action = _validate_action(actions[0], 0)

    if action["action"] == "done" and len(actions) != 1:
        raise ActionParserError("'done' must be the only action.")

    return {
        "mode": mode,
        "actions": [action],
    }


def _strip_markdown_fences(text: str) -> str:
    stripped = text.strip()

    match = re.match(
        r"^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$",
        stripped,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return stripped


def _validate_action(item: Any, idx: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        raise ActionParserError(
            f"Action at index {idx} must be a JSON object."
        )

    action_name = item.get("action")

    if not isinstance(action_name, str):
        raise ActionParserError(
            f"Action at index {idx} is missing a valid 'action'."
        )

    if action_name not in SUPPORTED_ACTIONS:
        raise ActionParserError(
            f"Unsupported action '{action_name}'."
        )

    if action_name == "click":
        _require(item, "target", action_name)

    elif action_name == "fill":
        _require(item, "target", action_name)

        if "value" not in item and "value_source" not in item:
            raise ActionParserError(
                "fill requires 'value' or 'value_source'."
            )

    elif action_name == "upload":
        _require(item, "target", action_name)
        _require(item, "value_source", action_name)

    elif action_name == "scroll":
        _require(item, "direction", action_name)

        if item["direction"] not in _SCROLL_DIRECTIONS:
            raise ActionParserError(
                f"Invalid scroll direction: {item['direction']}"
            )

        if "amount" in item:
            if not isinstance(item["amount"], int) or item["amount"] <= 0:
                raise ActionParserError(
                    "scroll 'amount' must be a positive integer."
                )

    elif action_name == "navigate":
        _require(item, "url", action_name)

        if not isinstance(item["url"], str):
            raise ActionParserError("navigate 'url' must be a string.")

    elif action_name == "wait":
        _require(item, "duration_ms", action_name)

        duration = item["duration_ms"]

        if not isinstance(duration, int) or duration < 0:
            raise ActionParserError(
                "wait 'duration_ms' must be a non-negative integer."
            )

    elif action_name == "press_key":
        _require(item, "key", action_name)

    elif action_name == "select":
        _require(item, "target", action_name)
        _require(item, "value", action_name)

    if action_name in {"fill", "upload"} and "value_source" in item:
        value_source = item["value_source"]

        if (
            not isinstance(value_source, str)
            or not value_source.startswith("local_profile.")
        ):
            raise ActionParserError(
                "'value_source' must start with 'local_profile.'."
            )

    return {
        key: value
        for key, value in item.items()
        if key in _SAFE_FIELDS
    }


def _require(
    item: dict[str, Any],
    field: str,
    action_name: str,
) -> None:
    if field not in item:
        raise ActionParserError(
            f"{action_name} requires '{field}'."
        )