"""Target configuration definitions for all supported AI agents and IDEs.

Each target can exist in two scopes:
- global: system-wide config (fixed path in ~ or Application Support)
- project: per-project config (relative path resolved against a project dir)

Target lists are derived from unified_targets.TOOLS — do not add entries here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class FormatType(str, Enum):
    """How the target stores MCP server entries."""

    STANDARD = "standard"  # { command: str, args: [], env: {} }
    OPENCODE = "opencode"  # { type: "local", command: [...], environment: {} }
    VSCODE = "vscode"  # same as standard but root key is "servers" and type field used
    YAML = "yaml"  # YAML config file (e.g. Continue config.yaml)


class Scope(str, Enum):
    GLOBAL = "global"
    PROJECT = "project"


class Category(str, Enum):
    EDITOR = "editor"  # Full IDEs / editors (VS Code, Cursor, JetBrains)
    DESKTOP = "desktop"  # Standalone desktop apps (Claude Desktop)
    CLI = "cli"  # Command-line tools (Claude Code, Gemini CLI, etc.)
    PLUGIN = "plugin"  # Editor plugins/extensions (Cline, Roo Code, Kilo Code)


@dataclass
class TargetConfig:
    """Definition of a sync target."""

    name: str  # unique id (e.g. "claude_code_global")
    display_name: str  # human label (e.g. "Claude Code")
    config_path: str  # path with ~ allowed (global) or relative (project)
    root_key: str  # JSON key containing servers (e.g. "mcpServers")
    scope: Scope = Scope.GLOBAL
    format_type: FormatType = FormatType.STANDARD
    color: str = "#888888"  # badge colour for UI
    nested: bool = False  # True if MCP config is inside a larger settings file
    base_target: str = ""  # base target name for grouping (e.g. "claude_code")
    category: Category = Category.EDITOR  # UI grouping category

    @property
    def resolved_path(self) -> str:
        return os.path.expanduser(self.config_path)

    def resolve_for_project(self, project_dir: str) -> str:
        """Resolve a project-scope config path against a project directory."""
        if self.scope == Scope.PROJECT:
            return os.path.join(project_dir, self.config_path)
        return self.resolved_path


# ---------------------------------------------------------------------------
# Derived target lists  (built from unified_targets.TOOLS)
# ---------------------------------------------------------------------------

from unified_targets import get_mcp_target_dicts  # noqa: E402


def _build_target(d: dict) -> TargetConfig:
    return TargetConfig(
        name=d["name"],
        display_name=d["display_name"],
        config_path=d["config_path"],
        root_key=d["root_key"],
        scope=Scope(d["scope"]),
        format_type=FormatType(d.get("format_type", "standard")),
        color=d.get("color", "#888888"),
        nested=d.get("nested", False),
        base_target=d.get("base_target", ""),
        category=Category(d.get("category", "editor")),
    )


GLOBAL_TARGETS: list[TargetConfig] = [
    _build_target(d) for d in get_mcp_target_dicts("global")
]
PROJECT_TARGETS: list[TargetConfig] = [
    _build_target(d) for d in get_mcp_target_dicts("project")
]
ALL_TARGETS: list[TargetConfig] = GLOBAL_TARGETS + PROJECT_TARGETS


def get_target(name: str) -> Optional[TargetConfig]:
    """Look up a target by internal name."""
    return next((t for t in ALL_TARGETS if t.name == name), None)


def get_targets_by_scope(scope: Scope) -> list[TargetConfig]:
    """Return targets filtered by scope."""
    return [t for t in ALL_TARGETS if t.scope == scope]
