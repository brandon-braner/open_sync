"""Manifest invariants — parametrised over every integration so adding or
removing a tool can never leave stale assertions behind."""

import pytest

from engine import paths
from engine.handlers import HANDLERS
from integrations import ALL_INTEGRATIONS

ALL_TARGETS = [
    pytest.param(integration, kind, scope, target,
                 id=f"{integration.id}-{kind}-{scope}")
    for integration in ALL_INTEGRATIONS
    for kind, scopes in integration.targets.items()
    for scope, target in scopes.items()
]


@pytest.mark.parametrize("integration,kind,scope,target", ALL_TARGETS)
def test_handler_exists_and_supports_kind(integration, kind, scope, target):
    assert target.handler in HANDLERS, f"unknown handler {target.handler}"
    assert kind in HANDLERS[target.handler].kinds


@pytest.mark.parametrize("integration,kind,scope,target", ALL_TARGETS)
def test_path_shape(integration, kind, scope, target):
    if scope == "global":
        assert target.path.startswith("~"), "global paths must start with ~"
    else:
        assert not target.path.startswith(("~", "/")), (
            "project paths must be relative"
        )


@pytest.mark.parametrize("integration,kind,scope,target", ALL_TARGETS)
def test_path_resolves(integration, kind, scope, target, monkeypatch, tmp_path):
    monkeypatch.setenv("OPENSYNC_HOME", str(tmp_path))
    resolved = paths.resolve(target, project_dir="/some/project")
    assert resolved.is_absolute()


def test_required_integrations_present():
    ids = {i.id for i in ALL_INTEGRATIONS}
    required = {
        "claude_code", "claude_desktop", "codex", "vscode_github_copilot",
        "copilot_cli", "cursor", "devin", "gemini_cli", "opencode",
        "antigravity", "warp",
    }
    assert required <= ids


def test_first_class_agents_cover_required_kinds():
    """The seven first-class agents support MCP + skills where applicable."""
    by_id = {i.id: i for i in ALL_INTEGRATIONS}
    # MCP both scopes
    for tool in ("claude_code", "codex", "vscode_github_copilot", "cursor"):
        assert by_id[tool].supports("mcp", "global"), tool
        assert by_id[tool].supports("mcp", "project"), tool
    # Claude Desktop and Devin Desktop are global-only for MCP
    assert by_id["claude_desktop"].supports("mcp", "global")
    assert not by_id["claude_desktop"].supports("mcp", "project")
    assert by_id["devin"].supports("mcp", "global")
    # Skills everywhere except Claude Desktop (UI-only)
    for tool in ("claude_code", "codex", "vscode_github_copilot", "cursor", "devin"):
        assert by_id[tool].supports("skill", "project"), tool
    assert not by_id["claude_desktop"].supports("skill")


def test_no_conflicting_write_paths():
    """No two integrations may write different formats to the same file.

    Sharing a path is allowed only when handler + options match (e.g.
    Claude Code and Copilot CLI both writing .mcp.json).
    """
    seen: dict[tuple, tuple] = {}
    for integration in ALL_INTEGRATIONS:
        for kind, scopes in integration.targets.items():
            for scope, target in scopes.items():
                if target.capability == "read_only":
                    continue
                key = (kind, scope, target.path)
                fmt = (target.handler, tuple(sorted(target.options.items())))
                if key in seen:
                    assert seen[key] == fmt, (
                        f"{key} written with conflicting formats"
                    )
                seen[key] = fmt
