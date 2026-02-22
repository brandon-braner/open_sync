# Cursor
# Docs: https://docs.cursor.com
#
# MCP:
#   Global config: ~/.cursor/mcp.json        (root key: "mcpServers")
#   Project config: .cursor/mcp.json         (root key: "mcpServers")
#   Access via: Cursor Settings → MCP
#   Ref: https://docs.cursor.com/context/model-context-protocol
#
# Skills / Workflows (Cursor Rules — .mdc files):
#   Global:  ~/.cursor/rules/                (rules applied across all projects)
#   Project: <project>/.cursor/rules/        (per-project rules, version-controlled)
#   Ref: https://docs.cursor.com/context/rules-for-ai
#
# LLM / Model settings:
#   Global: ~/.cursor/  (read-only — managed through Cursor Settings UI)
#   Ref: https://docs.cursor.com/settings/models

from integrations.base import Integration, ScopedConfig

cursor = Integration(
    id="cursor",
    display_name="Cursor",
    color="#00D4AA",
    category="editor",
    mcp={
        "global": ScopedConfig(config_path="~/.cursor/mcp.json", root_key="mcpServers"),
        "project": ScopedConfig(config_path=".cursor/mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(config_path="~/.cursor/rules/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/rules/", native="true"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.cursor/rules/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/rules/", native="true"),
    },
    llm={
        "global": ScopedConfig(config_path="~/.cursor/", read_only=True),
    },
)
