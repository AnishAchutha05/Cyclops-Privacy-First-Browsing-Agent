"""
Prompt builder for the Cyclops planning layer.

Constructs the system + user prompt sent to the selected LLM provider.
The model receives only sanitized context — never raw PII.
"""
from typing import Any


# ── Public type alias ─────────────────────────────────────────────────────────

class BuiltPrompt:
    """Container for the system prompt and user message."""

    __slots__ = ("system", "user")

    def __init__(self, system: str, user: str) -> None:
        self.system = system
        self.user = user


# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are the planning model for Cyclops, a privacy-preserving browser automation agent.

## Your Role
You analyse the user's task and the current sanitized page context, then return a \
machine-readable action plan for the browser extension to execute locally.

## Privacy Rules — CRITICAL
1. You will NEVER receive raw PII (emails, names, passwords, phone numbers, etc.).
2. Sensitive values on the page are shown as [REDACTED].
3. Local files (resumes, documents) are shown as [LOCAL_FILE].
4. When an action requires a private value, reference it as:
     local_profile.<field>
   Examples:  local_profile.email  |  local_profile.phone  |  local_profile.full_name
5. When an action requires uploading a file, use:
     local_profile.resume   (or the appropriate field name)
6. NEVER invent values. NEVER assume you know the user's private data.
7. The extension resolves all local_profile references on the user's device. \
You only produce the reference string.

## Tool Rules
1. Only use tools listed in the AVAILABLE TOOLS section.
2. NEVER invent new tool names.
3. NEVER issue browser commands not in the tool list.
4. NEVER fabricate page elements that do not appear in the SANITIZED PAGE CONTEXT.
5. Prefer the single most appropriate next step when the goal can be broken into steps.

## Output Format — CRITICAL
Return ONLY valid JSON. No markdown. No explanation. No prose.
The JSON must match this exact structure:

{
  "actions": [
    {
      "action": "<tool_name>",
      "target": "<element_id_or_label>",   // optional — depends on action
      "value_source": "local_profile.<field>",  // use for private values
      "value": "<literal_value>",           // use ONLY for non-sensitive values
      "direction": "up|down|left|right",    // scroll only
      "url": "<url>",                       // navigate only
      "key": "<key>",                       // press_key only
      "duration_ms": 1000                   // wait only
    }
  ]
}

Omit fields that are not relevant to a given action.
"""


# ── Builder ───────────────────────────────────────────────────────────────────

def build_prompt(
    task: str,
    sanitized_context: str,
    available_tools: list[str],
) -> BuiltPrompt:
    """
    Build the system + user prompt for the LLM.

    Args:
        task:               The user's stated goal.
        sanitized_context:  Sanitized page representation from the extension.
        available_tools:    Tool names the extension can execute.

    Returns:
        BuiltPrompt with .system and .user strings.
    """
    tools_block = "\n".join(f"  - {t}" for t in available_tools)

    user_message = f"""\
## USER TASK
{task}

## SANITIZED PAGE CONTEXT
{sanitized_context}

## AVAILABLE TOOLS
{tools_block}

## INSTRUCTION
Based on the task and page context above, produce the next action plan as valid JSON only.
Remember: use local_profile.<field> for any private data. Do not resolve values yourself.
"""
    return BuiltPrompt(system=_SYSTEM_PROMPT, user=user_message)
