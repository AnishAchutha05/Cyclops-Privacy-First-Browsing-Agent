"""
Action parser for the Cyclops planning layer.

Converts raw model output (a string) into a validated, typed action plan.
Raises ActionParserError for any malformed or unsafe response.
The parser NEVER executes actions — it only validates and returns data.
"""
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ── Supported actions & their required fields ─────────────────────────────────

SUPPORTED_ACTIONS: set[str] = {
    "click",
    "fill",
    "upload",
    "scroll",
    "navigate",
    "screenshot",
    "wait",
    "press_key",
    "select",
}

# Each action maps to a set of fields that MUST be present.
_REQUIRED_FIELDS: dict[str, set[str]] = {
    "click":      {"target"},
    "fill":       {"target"},        # value or value_source checked separately
    "upload":     {"target", "value_source"},
    "scroll":     {"direction"},
    "navigate":   {"url"},
    "screenshot": set(),             # no required fields
    "wait":       {"duration_ms"},
    "press_key":  {"key"},
    "select":     {"target", "value"},
}

# Valid values for direction in scroll actions
_SCROLL_DIRECTIONS: set[str] = {"up", "down", "left", "right"}


# ── Exceptions ────────────────────────────────────────────────────────────────

class ActionParserError(ValueError):
    """Raised when model output cannot be parsed into a valid action plan."""


# ── Public API ────────────────────────────────────────────────────────────────

def parse(raw_output: str) -> list[dict[str, Any]]:
    """
    Parse and validate raw model output into a list of action dicts.

    Args:
        raw_output:  Raw string returned by the LLM provider.

    Returns:
        List of validated action dicts ready to be returned to the extension.

    Raises:
        ActionParserError: If the output is malformed, uses unsupported actions,
                           or is missing required fields.
    """
    cleaned = _strip_markdown_fences(raw_output)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("Model returned invalid JSON: %s", exc)
        raise ActionParserError(f"Model response is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise ActionParserError("Model response must be a JSON object, got a different type.")

    if "actions" not in data:
        raise ActionParserError("Model response missing required 'actions' key.")

    actions = data["actions"]
    if not isinstance(actions, list):
        raise ActionParserError("'actions' must be a JSON array.")

    if len(actions) == 0:
        raise ActionParserError("'actions' array is empty — model returned no actions.")

    validated: list[dict[str, Any]] = []
    for idx, item in enumerate(actions):
        validated.append(_validate_action(item, idx))

    return validated


# ── Internals ─────────────────────────────────────────────────────────────────

def _strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` fences that some models wrap output in."""
    stripped = text.strip()
    # Match optional language tag after opening fence
    match = re.match(r"^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$", stripped, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return stripped


def _validate_action(item: Any, idx: int) -> dict[str, Any]:
    """Validate a single action dict. Raises ActionParserError on failure."""
    if not isinstance(item, dict):
        raise ActionParserError(f"Action at index {idx} is not a JSON object.")

    action_name = item.get("action")
    if not action_name:
        raise ActionParserError(f"Action at index {idx} is missing the 'action' field.")

    if not isinstance(action_name, str):
        raise ActionParserError(f"Action at index {idx}: 'action' must be a string.")

    if action_name not in SUPPORTED_ACTIONS:
        raise ActionParserError(
            f"Action at index {idx}: unsupported action '{action_name}'. "
            f"Supported actions: {sorted(SUPPORTED_ACTIONS)}"
        )

    required = _REQUIRED_FIELDS[action_name]
    missing = required - set(item.keys())
    if missing:
        raise ActionParserError(
            f"Action at index {idx} ('{action_name}') is missing required fields: {sorted(missing)}"
        )

    # Extra semantic validations per action type
    if action_name == "scroll":
        direction = item.get("direction")
        if direction not in _SCROLL_DIRECTIONS:
            raise ActionParserError(
                f"Action at index {idx} ('scroll'): 'direction' must be one of "
                f"{sorted(_SCROLL_DIRECTIONS)}, got '{direction}'."
            )

    if action_name == "wait":
        duration = item.get("duration_ms")
        if not isinstance(duration, int) or duration < 0:
            raise ActionParserError(
                f"Action at index {idx} ('wait'): 'duration_ms' must be a non-negative integer."
            )

    if action_name == "fill":
        # fill needs at least one of value or value_source
        if "value" not in item and "value_source" not in item:
            logger.warning(
                "Action %d ('fill') has neither 'value' nor 'value_source' — "
                "extension may not know what to fill.",
                idx,
            )

    if action_name in ("fill", "upload") and "value_source" in item:
        vs = item["value_source"]
        if not isinstance(vs, str) or not vs.startswith("local_profile."):
            raise ActionParserError(
                f"Action at index {idx} ('{action_name}'): 'value_source' must start with "
                f"'local_profile.' Got '{vs}'."
            )

    # Return only known safe fields — strip unexpected keys
    return _extract_safe_fields(item)


_SAFE_FIELDS: frozenset[str] = frozenset({
    "action", "target", "value", "value_source",
    "direction", "url", "key", "duration_ms", "selector",
})


def _extract_safe_fields(item: dict[str, Any]) -> dict[str, Any]:
    """Return only the known safe fields from an action dict."""
    return {k: v for k, v in item.items() if k in _SAFE_FIELDS}
