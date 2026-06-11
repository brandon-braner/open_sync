"""Golden tests for every format handler: read → canonical, plan_write
round-trips, and preservation of unrelated content."""

import json

import tomlkit

from engine.handlers import HANDLERS
from models import CommandEntity, McpServer, SkillEntity, SubagentEntity


def apply_changes(changes):
    for change in changes:
        if change.after is None:
            change.path.unlink(missing_ok=True)
        else:
            change.path.parent.mkdir(parents=True, exist_ok=True)
            change.path.write_text(change.after, encoding="utf-8")


# ---------------------------------------------------------------------------
# json_mcp
# ---------------------------------------------------------------------------


def test_json_mcp_standard_roundtrip(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "config.json"
    opts = {"root_key": "mcpServers", "style": "standard"}
    server = McpServer(name="ctx", command="npx", args=["-y", "ctx"], env={"K": "v"})

    apply_changes(handler.plan_write(cfg, [server], opts))
    assert handler.read(cfg, opts)["ctx"] == server


def test_json_mcp_preserves_unrelated_keys(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "claude.json"
    cfg.write_text(json.dumps({"sessionState": {"x": 1}, "mcpServers": {}}))
    opts = {"root_key": "mcpServers", "style": "standard"}

    apply_changes(handler.plan_write(cfg, [McpServer(name="a", command="a")], opts))
    data = json.loads(cfg.read_text())
    assert data["sessionState"] == {"x": 1}
    assert "a" in data["mcpServers"]


def test_json_mcp_vscode_remote(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "mcp.json"
    opts = {"root_key": "servers", "style": "vscode"}
    server = McpServer(name="remote", url="https://x.example/mcp", type="http")

    apply_changes(handler.plan_write(cfg, [server], opts))
    entry = json.loads(cfg.read_text())["servers"]["remote"]
    assert entry == {"type": "http", "url": "https://x.example/mcp"}
    assert handler.read(cfg, opts)["remote"].url == "https://x.example/mcp"


def test_json_mcp_opencode_style(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "opencode.json"
    opts = {"root_key": "mcp", "style": "opencode"}
    server = McpServer(name="local", command="bun", args=["x", "srv"], env={"A": "1"})

    apply_changes(handler.plan_write(cfg, [server], opts))
    entry = json.loads(cfg.read_text())["mcp"]["local"]
    assert entry["type"] == "local"
    assert entry["command"] == ["bun", "x", "srv"]
    assert entry["environment"] == {"A": "1"}
    back = handler.read(cfg, opts)["local"]
    assert back.command == "bun" and back.args == ["x", "srv"]


def test_json_mcp_bridge_remote(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "claude_desktop_config.json"
    opts = {"root_key": "mcpServers", "style": "standard", "bridge_remote": True}
    server = McpServer(
        name="r", url="https://x.example/mcp", headers={"Auth": "Bearer t"}
    )

    apply_changes(handler.plan_write(cfg, [server], opts))
    entry = json.loads(cfg.read_text())["mcpServers"]["r"]
    assert entry["command"] == "npx"
    assert entry["args"][:2] == ["mcp-remote", "https://x.example/mcp"]
    assert "--header" in entry["args"]


def test_json_mcp_remove(tmp_path):
    handler = HANDLERS["json_mcp"]
    cfg = tmp_path / "c.json"
    opts = {"root_key": "mcpServers", "style": "standard"}
    apply_changes(
        handler.plan_write(
            cfg, [McpServer(name="a", command="a"), McpServer(name="b", command="b")],
            opts,
        )
    )
    apply_changes(handler.plan_remove(cfg, ["a"], opts))
    assert list(handler.read(cfg, opts)) == ["b"]


# ---------------------------------------------------------------------------
# toml_mcp (Codex)
# ---------------------------------------------------------------------------


def test_toml_mcp_roundtrip_and_comment_preservation(tmp_path):
    handler = HANDLERS["toml_mcp"]
    cfg = tmp_path / "config.toml"
    cfg.write_text(
        "# my codex config\n"
        'model = "gpt-5.2-codex"  # keep me\n'
        "\n"
        "[mcp_servers.existing]\n"
        'command = "uvx"\n'
        'args = ["existing-mcp"]\n'
    )
    opts = {"table": "mcp_servers"}

    server = McpServer(name="ctx", command="npx", args=["-y", "ctx"], env={"K": "v"})
    apply_changes(handler.plan_write(cfg, [server], opts))

    text = cfg.read_text()
    assert "# my codex config" in text
    assert "# keep me" in text
    doc = tomlkit.parse(text)
    assert doc["model"] == "gpt-5.2-codex"

    servers = handler.read(cfg, opts)
    assert servers["existing"].command == "uvx"
    assert servers["ctx"] == server


def test_toml_mcp_remote_server(tmp_path):
    handler = HANDLERS["toml_mcp"]
    cfg = tmp_path / "config.toml"
    opts = {"table": "mcp_servers"}
    server = McpServer(name="r", url="https://x.example/mcp")
    apply_changes(handler.plan_write(cfg, [server], opts))
    assert handler.read(cfg, opts)["r"].url == "https://x.example/mcp"


def test_toml_mcp_remove(tmp_path):
    handler = HANDLERS["toml_mcp"]
    cfg = tmp_path / "config.toml"
    opts = {"table": "mcp_servers"}
    apply_changes(handler.plan_write(cfg, [McpServer(name="a", command="x")], opts))
    apply_changes(handler.plan_remove(cfg, ["a"], opts))
    assert handler.read(cfg, opts) == {}


# ---------------------------------------------------------------------------
# markdown_dir (commands + subagents)
# ---------------------------------------------------------------------------


def test_markdown_dir_claude_command(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".md", "frontmatter": "claude_command"}
    cmd = CommandEntity(
        name="review", description="Review a PR", content="Do the review.",
        argument_hint="[pr-number]",
    )
    apply_changes(handler.plan_write(tmp_path, [cmd], opts))

    text = (tmp_path / "review.md").read_text()
    assert text.startswith("---\n")
    assert "argument-hint: '[pr-number]'" in text or "argument-hint: \"[pr-number]\"" in text or "argument-hint: [pr-number]" in text
    assert handler.read(tmp_path, opts)["review"] == cmd


def test_markdown_dir_copilot_prompt_suffix(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".prompt.md", "frontmatter": "copilot_prompt"}
    cmd = CommandEntity(name="fix", description="Fix bug", content="Fix it.")
    apply_changes(handler.plan_write(tmp_path, [cmd], opts))
    assert (tmp_path / "fix.prompt.md").is_file()
    assert handler.read(tmp_path, opts)["fix"] == cmd


def test_markdown_dir_plain(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".md", "frontmatter": "plain"}
    cmd = CommandEntity(name="deploy", content="1. build\n2. ship")
    apply_changes(handler.plan_write(tmp_path, [cmd], opts))
    assert handler.read(tmp_path, opts)["deploy"] == cmd


def test_markdown_dir_claude_agent(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".md", "frontmatter": "claude_agent"}
    agent = SubagentEntity(
        name="reviewer", description="Reviews code", content="You review code.",
        model="sonnet", tools="Read, Grep",
    )
    apply_changes(handler.plan_write(tmp_path, [agent], opts))
    back = handler.read(tmp_path, opts)["reviewer"]
    assert back.model == "sonnet" and back.tools == "Read, Grep"
    assert back.content == "You review code."


def test_markdown_dir_ignores_other_files(tmp_path):
    handler = HANDLERS["markdown_dir"]
    (tmp_path / "notes.txt").write_text("not markdown")
    assert handler.read(tmp_path, {"suffix": ".md", "frontmatter": "plain"}) == {}


# ---------------------------------------------------------------------------
# skill_dir
# ---------------------------------------------------------------------------


def test_skill_dir_roundtrip(tmp_path):
    handler = HANDLERS["skill_dir"]
    skill = SkillEntity(
        name="pdf-tools", description="Work with PDFs", content="# PDF skill\nUse it."
    )
    apply_changes(handler.plan_write(tmp_path, [skill], {}))

    text = (tmp_path / "pdf-tools" / "SKILL.md").read_text()
    assert "name: pdf-tools" in text
    assert handler.read(tmp_path, {})["pdf-tools"] == skill


def test_skill_dir_leaves_supporting_files(tmp_path):
    handler = HANDLERS["skill_dir"]
    skill_dir = tmp_path / "helper"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text("---\nname: helper\n---\n\nbody\n")
    (skill_dir / "script.py").write_text("print('hi')")

    updated = SkillEntity(name="helper", description="d", content="new body")
    apply_changes(handler.plan_write(tmp_path, [updated], {}))
    assert (skill_dir / "script.py").read_text() == "print('hi')"
    assert handler.read(tmp_path, {})["helper"].content == "new body"


# ---------------------------------------------------------------------------
# toml_command (Gemini CLI)
# ---------------------------------------------------------------------------


def test_toml_command_roundtrip(tmp_path):
    handler = HANDLERS["toml_command"]
    cmd = CommandEntity(name="plan", description="Make a plan", content="Plan: {{args}}")
    apply_changes(handler.plan_write(tmp_path, [cmd], {}))
    back = handler.read(tmp_path, {})["plan"]
    assert back.description == "Make a plan"
    assert back.content == "Plan: {{args}}"


# ---------------------------------------------------------------------------
# yaml_workflow (Warp)
# ---------------------------------------------------------------------------


def test_yaml_workflow_roundtrip(tmp_path):
    handler = HANDLERS["yaml_workflow"]
    cmd = CommandEntity(name="logs", description="Tail logs", content="kubectl logs -f {{pod}}")
    apply_changes(handler.plan_write(tmp_path, [cmd], {}))
    back = handler.read(tmp_path, {})["logs"]
    assert back.content == "kubectl logs -f {{pod}}"


# ---------------------------------------------------------------------------
# llm_json (read-only)
# ---------------------------------------------------------------------------


def test_llm_json_reads_opencode_providers(tmp_path):
    handler = HANDLERS["llm_json"]
    cfg = tmp_path / "opencode.json"
    cfg.write_text(json.dumps({
        "provider": {
            "anthropic": {
                "options": {"apiKey": "sk-test", "baseURL": "https://api.x"},
                "models": {"claude-fable-5": {}},
            }
        }
    }))
    providers = handler.read(cfg, {"root_key": "provider"})
    assert providers["anthropic"].api_key == "sk-test"
    assert providers["anthropic"].default_model == "claude-fable-5"


def test_llm_json_is_read_only(tmp_path):
    handler = HANDLERS["llm_json"]
    import pytest
    with pytest.raises(NotImplementedError):
        handler.plan_write(tmp_path / "x.json", [], {})


# ---------------------------------------------------------------------------
# markdown_blocks (rules in shared instruction files)
# ---------------------------------------------------------------------------

from models import RuleEntity


def test_markdown_blocks_roundtrip_preserves_user_content(tmp_path):
    handler = HANDLERS["markdown_blocks"]
    f = tmp_path / "CLAUDE.md"
    f.write_text("# My own notes\n\nHand-written instructions stay.\n")

    rule = RuleEntity(name="style", description="Code style", content="- Use strict mode")
    apply_changes(handler.plan_write(f, [rule], {}))

    text = f.read_text()
    assert "Hand-written instructions stay." in text
    assert "<!-- opensync:rule:style | Code style -->" in text
    assert handler.read(f, {})["style"] == rule


def test_markdown_blocks_update_in_place(tmp_path):
    handler = HANDLERS["markdown_blocks"]
    f = tmp_path / "AGENTS.md"
    rule = RuleEntity(name="style", content="v1")
    apply_changes(handler.plan_write(f, [rule], {}))
    apply_changes(handler.plan_write(f, [RuleEntity(name="style", content="v2")], {}))

    text = f.read_text()
    assert text.count("opensync:rule:style") == 2  # one open + one close marker
    assert handler.read(f, {})["style"].content == "v2"


def test_markdown_blocks_multiple_rules_and_remove(tmp_path):
    handler = HANDLERS["markdown_blocks"]
    f = tmp_path / "AGENTS.md"
    apply_changes(handler.plan_write(f, [
        RuleEntity(name="a", content="aaa"),
        RuleEntity(name="b", content="bbb"),
    ], {}))
    assert set(handler.read(f, {})) == {"a", "b"}

    apply_changes(handler.plan_remove(f, ["a"], {}))
    assert set(handler.read(f, {})) == {"b"}
    assert "aaa" not in f.read_text()


def test_markdown_dir_cursor_mdc_rule(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".mdc", "frontmatter": "cursor_mdc"}
    rule = RuleEntity(name="api-style", description="API conventions", content="REST only.")
    apply_changes(handler.plan_write(tmp_path, [rule], opts))
    text = (tmp_path / "api-style.mdc").read_text()
    assert "alwaysApply: true" in text
    assert handler.read(tmp_path, opts)["api-style"] == rule


def test_markdown_dir_copilot_instructions_rule(tmp_path):
    handler = HANDLERS["markdown_dir"]
    opts = {"suffix": ".instructions.md", "frontmatter": "copilot_instructions"}
    rule = RuleEntity(name="security", description="Sec rules", content="No secrets in code.")
    apply_changes(handler.plan_write(tmp_path, [rule], opts))
    text = (tmp_path / "security.instructions.md").read_text()
    assert "applyTo: '**'" in text or 'applyTo: "**"' in text
    assert handler.read(tmp_path, opts)["security"] == rule
