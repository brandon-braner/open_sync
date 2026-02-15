"""Target configuration definitions for all supported AI agents and IDEs.

Each target can exist in two scopes:
- global: system-wide config (fixed path in ~ or Application Support)
- project: per-project config (relative path resolved against a project dir)
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
# Global targets
# ---------------------------------------------------------------------------

GLOBAL_TARGETS: list[TargetConfig] = [
    TargetConfig(
        name="claude_desktop_global",
        display_name="Claude Desktop",
        config_path="~/Library/Application Support/Claude/claude_desktop_config.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#D97757",
        base_target="claude_desktop",
        category=Category.DESKTOP,
    ),
    TargetConfig(
        name="claude_code_global",
        display_name="Claude Code",
        config_path="~/.claude.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#D97757",
        base_target="claude_code",
        category=Category.CLI,
    ),
    TargetConfig(
        name="antigravity_global",
        display_name="Antigravity",
        config_path="~/.gemini/antigravity/mcp_config.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#4285F4",
        base_target="antigravity",
    ),
    TargetConfig(
        name="vscode_global",
        display_name="VS Code",
        config_path="~/Library/Application Support/Code/User/mcp.json",
        root_key="servers",
        format_type=FormatType.VSCODE,
        scope=Scope.GLOBAL,
        color="#007ACC",
        base_target="vscode",
    ),
    TargetConfig(
        name="cursor_global",
        display_name="Cursor",
        config_path="~/.cursor/mcp.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#00D4AA",
        base_target="cursor",
    ),
    TargetConfig(
        name="gemini_cli_global",
        display_name="Gemini CLI",
        config_path="~/.gemini/settings.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#0F9D58",
        nested=True,
        base_target="gemini_cli",
        category=Category.CLI,
    ),
    TargetConfig(
        name="opencode_global",
        display_name="OpenCode",
        config_path="~/.config/opencode/opencode.json",
        root_key="mcp",
        format_type=FormatType.OPENCODE,
        scope=Scope.GLOBAL,
        color="#FF6B6B",
        nested=True,
        base_target="opencode",
        category=Category.CLI,
    ),
    TargetConfig(
        name="copilot_cli_global",
        display_name="GitHub Copilot CLI",
        config_path="~/.copilot/mcp-config.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#6E40C9",
        base_target="copilot_cli",
        category=Category.CLI,
    ),
    TargetConfig(
        name="jetbrains_global",
        display_name="JetBrains (Copilot)",
        config_path="~/.config/github-copilot/intellij/mcp.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#FC801D",
        base_target="jetbrains",
    ),
    # ---- VS Code extension plugins ----
    TargetConfig(
        name="cline_vscode_global",
        display_name="Cline (VS Code)",
        config_path="~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#E8912D",
        base_target="cline_vscode",
        category=Category.PLUGIN,
    ),
    TargetConfig(
        name="roocode_vscode_global",
        display_name="Roo Code (VS Code)",
        config_path="~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#00C853",
        base_target="roocode_vscode",
        category=Category.PLUGIN,
    ),
    TargetConfig(
        name="roocode_antigravity_global",
        display_name="Roo Code (Antigravity)",
        config_path="~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#00C853",
        base_target="roocode_antigravity",
        category=Category.PLUGIN,
    ),
    TargetConfig(
        name="kilocode_vscode_global",
        display_name="Kilo Code (VS Code)",
        config_path="~/Library/Application Support/Code/User/globalStorage/kilocode.kilo-code/settings/cline_mcp_settings.json",
        root_key="mcpServers",
        scope=Scope.GLOBAL,
        color="#FF4081",
        base_target="kilocode_vscode",
        category=Category.PLUGIN,
    ),
]

# ---------------------------------------------------------------------------
# Project targets (only targets that support project-level configs)
# ---------------------------------------------------------------------------

PROJECT_TARGETS: list[TargetConfig] = [
    TargetConfig(
        name="claude_code_project",
        display_name="Claude Code",
        config_path=".mcp.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#D97757",
        base_target="claude_code",
        category=Category.CLI,
    ),
    TargetConfig(
        name="antigravity_project",
        display_name="Antigravity",
        config_path=".antigravity/mcp_config.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#4285F4",
        base_target="antigravity",
    ),
    TargetConfig(
        name="vscode_project",
        display_name="VS Code",
        config_path=".vscode/mcp.json",
        root_key="servers",
        format_type=FormatType.VSCODE,
        scope=Scope.PROJECT,
        color="#007ACC",
        base_target="vscode",
    ),
    TargetConfig(
        name="cursor_project",
        display_name="Cursor",
        config_path=".cursor/mcp.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#00D4AA",
        base_target="cursor",
    ),
    TargetConfig(
        name="gemini_cli_project",
        display_name="Gemini CLI",
        config_path=".gemini/settings.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#0F9D58",
        nested=True,
        base_target="gemini_cli",
        category=Category.CLI,
    ),
    TargetConfig(
        name="opencode_project",
        display_name="OpenCode",
        config_path="opencode.json",
        root_key="mcp",
        format_type=FormatType.OPENCODE,
        scope=Scope.PROJECT,
        color="#FF6B6B",
        nested=True,
        base_target="opencode",
        category=Category.CLI,
    ),
    TargetConfig(
        name="copilot_cli_project",
        display_name="GitHub Copilot CLI",
        config_path=".copilot/mcp-config.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#6E40C9",
        base_target="copilot_cli",
        category=Category.CLI,
    ),
    # ---- VS Code extension plugins (project-level) ----
    TargetConfig(
        name="roocode_vscode_project",
        display_name="Roo Code (VS Code)",
        config_path=".roo/mcp.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#00C853",
        base_target="roocode_vscode",
        category=Category.PLUGIN,
    ),
    TargetConfig(
        name="roocode_antigravity_project",
        display_name="Roo Code (Antigravity)",
        config_path=".roo/mcp.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#00C853",
        base_target="roocode_antigravity",
        category=Category.PLUGIN,
    ),
    TargetConfig(
        name="kilocode_vscode_project",
        display_name="Kilo Code (VS Code)",
        config_path=".kilocode/mcp.json",
        root_key="mcpServers",
        scope=Scope.PROJECT,
        color="#FF4081",
        base_target="kilocode_vscode",
        category=Category.PLUGIN,
    ),
]

# Combined list for convenience
ALL_TARGETS: list[TargetConfig] = GLOBAL_TARGETS + PROJECT_TARGETS


def get_target(name: str) -> Optional[TargetConfig]:
    """Look up a target by internal name."""
    return next((t for t in ALL_TARGETS if t.name == name), None)


def get_targets_by_scope(scope: Scope) -> list[TargetConfig]:
    """Return targets filtered by scope."""
    return [t for t in ALL_TARGETS if t.scope == scope]
