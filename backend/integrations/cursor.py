# Cursor
# Docs: https://docs.cursor.com
#
# MCP:
#   Global config: ~/.cursor/mcp.json        (root key: "mcpServers")
#   Project config: .cursor/mcp.json         (root key: "mcpServers")
#   Access via: Cursor Settings → MCP
#   Ref: https://docs.cursor.com/context/model-context-protocol
#
# Skills (Agent Skills — SKILL.md in subdirectories):
#   Global:  ~/.cursor/skills/               (skills available across all projects)
#   Project: <project>/.cursor/skills/       (per-project skills, version-controlled)
#   Each skill is a subdirectory with a SKILL.md file.
#   Ref: https://cursor.com/docs/context/skills
#
# Workflows (Cursor Commands — .md files):
#   Global:  ~/.cursor/commands/             (commands available across all projects)
#   Project: <project>/.cursor/commands/     (per-project commands, version-controlled)
#   Triggered via "/" prefix in chat.
#   Ref: https://cursor.com/docs/context/commands
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
    llm_support=False,
    mcp={
        "global": ScopedConfig(config_path="~/.cursor/mcp.json", root_key="mcpServers"),
        "project": ScopedConfig(config_path=".cursor/mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(config_path="~/.cursor/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/skills/", native="true"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.cursor/commands/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.cursor/commands/", native="true"
        ),
    },
    agent={
        "global": ScopedConfig(config_path="~/.cursor/agents/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/agents/", native="true"),
    },
)
