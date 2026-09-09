"""Unit tests for the action parser."""
import json
import pytest

from app.agent.action_parser import ActionParserError, parse


# ── Valid parses ──────────────────────────────────────────────────────────────

def test_parse_valid_click():
    raw = json.dumps({"actions": [{"action": "click", "target": "submit_btn"}]})
    actions = parse(raw)
    assert len(actions) == 1
    assert actions[0]["action"] == "click"
    assert actions[0]["target"] == "submit_btn"


def test_parse_valid_fill_with_value_source():
    raw = json.dumps({
        "actions": [{"action": "fill", "target": "email", "value_source": "local_profile.email"}]
    })
    actions = parse(raw)
    assert actions[0]["value_source"] == "local_profile.email"


def test_parse_valid_scroll():
    raw = json.dumps({"actions": [{"action": "scroll", "direction": "down"}]})
    actions = parse(raw)
    assert actions[0]["direction"] == "down"


def test_parse_valid_navigate():
    raw = json.dumps({"actions": [{"action": "navigate", "url": "https://example.com"}]})
    actions = parse(raw)
    assert actions[0]["url"] == "https://example.com"


def test_parse_valid_wait():
    raw = json.dumps({"actions": [{"action": "wait", "duration_ms": 2000}]})
    actions = parse(raw)
    assert actions[0]["duration_ms"] == 2000


def test_parse_valid_press_key():
    raw = json.dumps({"actions": [{"action": "press_key", "key": "Tab"}]})
    actions = parse(raw)
    assert actions[0]["key"] == "Tab"


def test_parse_valid_select():
    raw = json.dumps({"actions": [{"action": "select", "target": "country", "value": "USA"}]})
    actions = parse(raw)
    assert actions[0]["value"] == "USA"


def test_parse_valid_upload():
    raw = json.dumps({
        "actions": [{"action": "upload", "target": "resume_input", "value_source": "local_profile.resume"}]
    })
    actions = parse(raw)
    assert actions[0]["value_source"] == "local_profile.resume"


def test_parse_strips_markdown_fences():
    raw = "```json\n{\"actions\": [{\"action\": \"click\", \"target\": \"btn\"}]}\n```"
    actions = parse(raw)
    assert actions[0]["action"] == "click"


def test_parse_strips_unknown_fields():
    """Parser should drop arbitrary fields to prevent injection."""
    raw = json.dumps({
        "actions": [{"action": "click", "target": "btn", "evil_field": "rm -rf /"}]
    })
    actions = parse(raw)
    assert "evil_field" not in actions[0]


def test_parse_multiple_actions():
    raw = json.dumps({
        "actions": [
            {"action": "fill", "target": "email", "value_source": "local_profile.email"},
            {"action": "click", "target": "submit"},
        ]
    })
    actions = parse(raw)
    assert len(actions) == 2


# ── Invalid parses ────────────────────────────────────────────────────────────

def test_parse_invalid_json_raises():
    with pytest.raises(ActionParserError, match="valid JSON"):
        parse("not json at all")


def test_parse_missing_actions_key_raises():
    with pytest.raises(ActionParserError, match="'actions' key"):
        parse(json.dumps({"result": []}))


def test_parse_empty_actions_raises():
    with pytest.raises(ActionParserError, match="empty"):
        parse(json.dumps({"actions": []}))


def test_parse_unknown_action_raises():
    raw = json.dumps({"actions": [{"action": "hack_browser"}]})
    with pytest.raises(ActionParserError, match="unsupported action"):
        parse(raw)


def test_parse_click_missing_target_raises():
    raw = json.dumps({"actions": [{"action": "click"}]})
    with pytest.raises(ActionParserError, match="missing required fields"):
        parse(raw)


def test_parse_scroll_invalid_direction_raises():
    raw = json.dumps({"actions": [{"action": "scroll", "direction": "sideways"}]})
    with pytest.raises(ActionParserError, match="direction"):
        parse(raw)


def test_parse_wait_negative_duration_raises():
    raw = json.dumps({"actions": [{"action": "wait", "duration_ms": -100}]})
    with pytest.raises(ActionParserError, match="duration_ms"):
        parse(raw)


def test_parse_invalid_value_source_raises():
    raw = json.dumps({
        "actions": [{"action": "fill", "target": "email", "value_source": "raw_email@example.com"}]
    })
    with pytest.raises(ActionParserError, match="local_profile"):
        parse(raw)


def test_parse_upload_missing_value_source_raises():
    raw = json.dumps({"actions": [{"action": "upload", "target": "file_input"}]})
    with pytest.raises(ActionParserError, match="missing required fields"):
        parse(raw)


def test_parse_navigate_missing_url_raises():
    raw = json.dumps({"actions": [{"action": "navigate"}]})
    with pytest.raises(ActionParserError, match="missing required fields"):
        parse(raw)
