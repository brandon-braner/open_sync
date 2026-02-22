"""Single source of truth for all AI tool sync targets.

Each tool entry in TOOLS defines config paths for the feature types it supports:
  mcp      – MCP server sync
  skill    – Skill/instruction sync
  workflow – Workflow sync
  llm      – LLM provider sync

Omitting a type key hides that tool from the corresponding page.
Each type has 'global' and/or 'project' scope sub-configs.

Target IDs are always ``{tool_id}_global`` / ``{tool_id}_project``.

Accessor functions return the flat lists expected by each consumer module.
"""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Canonical tool definitions
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    {
        "id": "opencode",
        "display_name": "OpenCode",
        "color": "#FF6B6B",
        "category": "cli",
        "mcp": {
            "global": {
                "config_path": "~/.config/opencode/opencode.json",
                "root_key": "mcp",
                "format_type": "opencode",
                "nested": True,
            },
            "project": {
                "config_path": "opencode.json",
                "root_key": "mcp",
                "format_type": "opencode",
                "nested": True,
            },
        },
        "skill": {
            "global": {
                "config_path": "~/.config/opencode/opencode.json",
                "native": "true",
            },
            "project": {"config_path": "<project>/opencode.json", "native": "true"},
        },
        "workflow": {
            "global": {
                "config_path": "~/.config/opencode/opencode.json",
                "native": "true",
            },
            "project": {"config_path": "<project>/opencode.json", "native": "true"},
        },
        "llm": {
            "global": {"config_path": "~/.config/opencode/opencode.json"},
            "project": {"config_path": "opencode.json"},
        },
    },
    {
        "id": "continue",
        "display_name": "Continue",
        "color": "#4ECDC4",
        "category": "editor",
        "mcp": {
            "global": {
                "config_path": "~/.continue/config.yaml",
                "root_key": "mcpServers",
                "format_type": "yaml",
            },
            "project": {
                "config_path": ".continue/config.yaml",
                "root_key": "mcpServers",
                "format_type": "yaml",
            },
        },
        "skill": {
            "global": {"config_path": "~/.continue/config.yaml", "native": "false"},
            "project": {
                "config_path": "<project>/.continue/config.yaml",
                "native": "false",
            },
        },
        "workflow": {
            "global": {"config_path": "~/.continue/config.yaml", "native": "false"},
            "project": {
                "config_path": "<project>/.continue/config.yaml",
                "native": "false",
            },
        },
        "llm": {
            "global": {"config_path": "~/.continue/config.yaml"},
            "project": {"config_path": ".continue/config.yaml"},
        },
    },
    {
        "id": "aider",
        "display_name": "Aider",
        "color": "#45B7D1",
        "category": "cli",
        "mcp": {
            "global": {
                "config_path": "~/.aider.conf.yml",
                "root_key": "mcpServers",
                "format_type": "yaml",
            },
        },
        "skill": {
            "global": {"config_path": "~/.aider.conf.yml", "native": "false"},
            "project": {"config_path": "<project>/.aider.conf.yml", "native": "false"},
        },
        "workflow": {
            "global": {"config_path": "~/.aider.conf.yml", "native": "false"},
            "project": {"config_path": "<project>/.aider.conf.yml", "native": "false"},
        },
        "llm": {
            "global": {"config_path": "~/.aider.conf.yml"},
            "project": {"config_path": ".aider.conf.yml"},
        },
    },
    {
        "id": "claude_code",
        "display_name": "Claude Code",
        "color": "#D97757",
        "category": "cli",
        "mcp": {
            "global": {"config_path": "~/.claude.json", "root_key": "mcpServers"},
            "project": {"config_path": ".mcp.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {"config_path": "~/.claude.json", "native": "false"},
            "project": {
                "config_path": "<project>/.claude/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {"config_path": "~/.claude.json", "native": "false"},
            "project": {
                "config_path": "<project>/.claude/settings.json",
                "native": "false",
            },
        },
        "llm": {
            "global": {"config_path": "~/.claude.json"},
            "project": {"config_path": ".claude/settings.json"},
        },
    },
    {
        "id": "claude_desktop",
        "display_name": "Claude Desktop",
        "color": "#D97757",
        "category": "desktop",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Claude/claude_desktop_config.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Claude/claude_desktop_config.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Claude/claude_desktop_config.json",
                "native": "false",
            },
        },
    },
    {
        "id": "roo_cline",
        "display_name": "Roo Code / Cline",
        "color": "#00C853",
        "category": "plugin",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
                "root_key": "mcpServers",
            },
            "project": {"config_path": ".roo/mcp.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
        "llm": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json"
            },
            "project": {"config_path": ".vscode/settings.json"},
        },
    },
    {
        "id": "cline_vscode",
        "display_name": "Cline (VS Code)",
        "color": "#E8912D",
        "category": "plugin",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
                "root_key": "mcpServers",
            },
            "project": {
                "config_path": ".vscode/cline_mcp_settings.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
    },
    {
        "id": "kilocode_vscode",
        "display_name": "Kilo Code (VS Code)",
        "color": "#FF4081",
        "category": "plugin",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/globalStorage/kilocode.kilo-code/settings/cline_mcp_settings.json",
                "root_key": "mcpServers",
            },
            "project": {"config_path": ".kilocode/mcp.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {"config_path": "<project>/.kilocode/", "native": "false"},
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {"config_path": "<project>/.kilocode/", "native": "false"},
        },
    },
    {
        "id": "vscode",
        "display_name": "VS Code",
        "color": "#007ACC",
        "category": "editor",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/mcp.json",
                "root_key": "servers",
                "format_type": "vscode",
            },
            "project": {
                "config_path": ".vscode/mcp.json",
                "root_key": "servers",
                "format_type": "vscode",
            },
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Code/User/settings.json",
                "native": "false",
            },
            "project": {
                "config_path": "<project>/.vscode/settings.json",
                "native": "false",
            },
        },
    },
    {
        "id": "windsurf",
        "display_name": "Windsurf",
        "color": "#1ABC9C",
        "category": "editor",
        "mcp": {
            "global": {
                "config_path": "~/.codeium/windsurf/mcp_config.json",
                "root_key": "mcpServers",
            },
            "project": {
                "config_path": ".windsurf/mcp_config.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {"config_path": "~/.windsurf/skills/", "native": "true"},
            "project": {"config_path": "<project>/.windsurf/skills/", "native": "true"},
        },
        "workflow": {
            "global": {"config_path": "~/.windsurf/workflows/", "native": "true"},
            "project": {
                "config_path": "<project>/.windsurf/workflows/",
                "native": "true",
            },
        },
        "llm": {
            "global": {"config_path": "~/.codeium/windsurf/mcp_settings.json"},
            "project": {"config_path": ".windsurf/mcp_settings.json"},
        },
    },
    {
        "id": "plandex",
        "display_name": "Plandex",
        "color": "#F39C12",
        "category": "cli",
        # No MCP support
        "skill": {
            "global": {"config_path": "~/.plandex-home/", "native": "false"},
            "project": {"config_path": "<project>/.plandex/", "native": "false"},
        },
        "workflow": {
            "global": {"config_path": "~/.plandex-home/", "native": "false"},
            "project": {"config_path": "<project>/.plandex/", "native": "false"},
        },
        "llm": {
            "global": {"config_path": "~/.plandex-home/"},
            "project": {"config_path": ".plandex/"},
        },
    },
    {
        "id": "gemini_cli",
        "display_name": "Gemini CLI",
        "color": "#0F9D58",
        "category": "cli",
        "mcp": {
            "global": {
                "config_path": "~/.gemini/settings.json",
                "root_key": "mcpServers",
                "nested": True,
            },
            "project": {
                "config_path": ".gemini/settings.json",
                "root_key": "mcpServers",
                "nested": True,
            },
        },
        "skill": {
            "global": {"config_path": "~/.gemini/settings.json", "native": "false"},
            "project": {
                "config_path": "<project>/.gemini/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {"config_path": "~/.gemini/commands/", "native": "true"},
            "project": {"config_path": "<project>/.gemini/commands/", "native": "true"},
        },
        "llm": {
            "global": {"config_path": "~/.gemini/settings.json"},
            "project": {"config_path": ".gemini/settings.json"},
        },
    },
    {
        "id": "amp",
        "display_name": "Amp (Sourcegraph)",
        "color": "#E74C3C",
        "category": "cli",
        "mcp": {
            "global": {"config_path": "~/.amp/settings.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {"config_path": "~/.amp/settings.json", "native": "false"},
            "project": {
                "config_path": "<project>/.amp/settings.json",
                "native": "false",
            },
        },
        "workflow": {
            "global": {"config_path": "~/.amp/settings.json", "native": "false"},
            "project": {
                "config_path": "<project>/.amp/settings.json",
                "native": "false",
            },
        },
        "llm": {
            "global": {"config_path": "~/.amp/settings.json"},
        },
    },
    {
        "id": "cursor",
        "display_name": "Cursor",
        "color": "#00D4AA",
        "category": "editor",
        "mcp": {
            "global": {"config_path": "~/.cursor/mcp.json", "root_key": "mcpServers"},
            "project": {"config_path": ".cursor/mcp.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {"config_path": "~/.cursor/rules/", "native": "true"},
            "project": {"config_path": "<project>/.cursor/rules/", "native": "true"},
        },
        "workflow": {
            "global": {"config_path": "~/.cursor/rules/", "native": "true"},
            "project": {"config_path": "<project>/.cursor/rules/", "native": "true"},
        },
        "llm": {
            "global": {"config_path": "~/.cursor/", "read_only": True},
        },
    },
    {
        "id": "copilot_cli",
        "display_name": "GitHub Copilot CLI",
        "color": "#6E40C9",
        "category": "cli",
        "mcp": {
            "global": {
                "config_path": "~/.copilot/mcp-config.json",
                "root_key": "mcpServers",
            },
            "project": {
                "config_path": ".copilot/mcp-config.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {"config_path": "~/.copilot/", "native": "false"},
            "project": {"config_path": "<project>/.copilot/", "native": "false"},
        },
        "workflow": {
            "global": {"config_path": "~/.copilot/", "native": "false"},
            "project": {"config_path": "<project>/.copilot/", "native": "false"},
        },
    },
    {
        "id": "jetbrains",
        "display_name": "JetBrains (Copilot)",
        "color": "#FC801D",
        "category": "editor",
        "mcp": {
            "global": {
                "config_path": "~/.config/github-copilot/intellij/mcp.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {
                "config_path": "~/.config/github-copilot/intellij/",
                "native": "false",
            },
        },
        "workflow": {
            "global": {
                "config_path": "~/.config/github-copilot/intellij/",
                "native": "false",
            },
        },
    },
    {
        "id": "roocode_antigravity",
        "display_name": "Roo Code (Antigravity)",
        "color": "#00C853",
        "category": "plugin",
        "mcp": {
            "global": {
                "config_path": "~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
                "root_key": "mcpServers",
            },
            "project": {"config_path": ".roo/mcp.json", "root_key": "mcpServers"},
        },
        "skill": {
            "global": {
                "config_path": "~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/",
                "native": "false",
            },
            "project": {"config_path": "<project>/.roo/", "native": "false"},
        },
        "workflow": {
            "global": {
                "config_path": "~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/",
                "native": "false",
            },
            "project": {"config_path": "<project>/.roo/", "native": "false"},
        },
    },
    {
        "id": "antigravity",
        "display_name": "Antigravity",
        "color": "#4285F4",
        "category": "editor",
        "mcp": {
            "global": {
                "config_path": "~/.gemini/antigravity/mcp_config.json",
                "root_key": "mcpServers",
            },
            "project": {
                "config_path": ".antigravity/mcp_config.json",
                "root_key": "mcpServers",
            },
        },
        "skill": {
            "global": {"config_path": "~/.agents/skills/", "native": "true"},
            "project": {"config_path": "<project>/.agents/skills/", "native": "true"},
        },
        "workflow": {
            "global": {"config_path": "~/.agents/workflows/", "native": "true"},
            "project": {
                "config_path": "<project>/.agents/workflows/",
                "native": "true",
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Accessor helpers  (return plain dicts; callers construct typed objects)
# ---------------------------------------------------------------------------


def _target_id(tool_id: str, scope: str) -> str:
    return f"{tool_id}_{scope}"


def get_mcp_target_dicts(scope: str) -> list[dict[str, Any]]:
    """Return flat MCP target dicts for the given scope ('global' or 'project')."""
    result = []
    for tool in TOOLS:
        if "mcp" not in tool or scope not in tool["mcp"]:
            continue
        cfg = tool["mcp"][scope]
        result.append(
            {
                "name": _target_id(tool["id"], scope),
                "display_name": tool["display_name"],
                "config_path": cfg["config_path"],
                "root_key": cfg.get("root_key", "mcpServers"),
                "scope": scope,
                "format_type": cfg.get("format_type", "standard"),
                "color": tool.get("color", "#888888"),
                "nested": cfg.get("nested", False),
                "base_target": tool["id"],
                "category": tool.get("category", "editor"),
            }
        )
    return result


def get_skill_targets() -> list[dict[str, Any]]:
    """Return flat skill target dicts (all scopes), sorted by display_name."""
    result = []
    for tool in TOOLS:
        if "skill" not in tool:
            continue
        for scope, cfg in tool["skill"].items():
            result.append(
                {
                    "id": _target_id(tool["id"], scope),
                    "display_name": tool["display_name"],
                    "config_path": cfg["config_path"],
                    "scope": scope,
                    "color": tool.get("color", "#888888"),
                    "native": cfg.get("native", "false"),
                }
            )
    return sorted(result, key=lambda t: t["display_name"].lower())


def get_workflow_targets() -> list[dict[str, Any]]:
    """Return flat workflow target dicts (all scopes), sorted by display_name."""
    result = []
    for tool in TOOLS:
        if "workflow" not in tool:
            continue
        for scope, cfg in tool["workflow"].items():
            result.append(
                {
                    "id": _target_id(tool["id"], scope),
                    "display_name": tool["display_name"],
                    "config_path": cfg["config_path"],
                    "scope": scope,
                    "color": tool.get("color", "#888888"),
                    "native": cfg.get("native", "false"),
                }
            )
    return sorted(result, key=lambda t: t["display_name"].lower())


def get_llm_targets() -> list[dict[str, Any]]:
    """Return flat LLM provider target dicts (all scopes)."""
    result = []
    for tool in TOOLS:
        if "llm" not in tool:
            continue
        for scope, cfg in tool["llm"].items():
            result.append(
                {
                    "id": _target_id(tool["id"], scope),
                    "display_name": tool["display_name"]
                    + (" (read-only)" if cfg.get("read_only") else ""),
                    "config_path": cfg["config_path"],
                    "scope": scope,
                    "color": tool.get("color", "#888888"),
                }
            )
    return result


def get_all_tool_ids() -> list[str]:
    """Return list of all canonical tool base IDs."""
    return [t["id"] for t in TOOLS]
