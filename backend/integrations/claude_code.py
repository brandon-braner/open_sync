# Claude Code (Anthropic)
# Docs: https://docs.anthropic.com/en/docs/claude-code/mcp
#
# MCP:
#   Global config: ~/.claude.json         (root key: "mcpServers") — user/local scope
#   Project config: .mcp.json             (root key: "mcpServers") — project scope, shared with collaborators
#   Ref: https://docs.anthropic.com/en/docs/claude-code/mcp#configuration-scopes
#
# Skills (CLAUDE.md memory files):
#   Global:  ~/.claude/CLAUDE.md          (instructions loaded in every session)
#   Project: <project>/CLAUDE.md          (project-level instructions, committed to repo)
#   Ref: https://docs.anthropic.com/en/docs/claude-code/memory
#
# LLM / Model settings:
#   Global:  ~/.claude.json
#   Project: .claude/settings.json
#   Ref: https://docs.anthropic.com/en/docs/claude-code/settings

from integrations.base import Integration, ScopedConfig

claude_code = Integration(
    id="claude_code",
    display_name="Claude Code",
    color="#D97757",
    category="cli",
    workflow_support=False,
    mcp={
        "global": ScopedConfig(config_path="~/.claude.json", root_key="mcpServers"),
        "project": ScopedConfig(config_path=".mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(config_path="~/.claude/CLAUDE.md", native="true"),
        "project": ScopedConfig(config_path="<project>/CLAUDE.md", native="true"),
    },
    llm={
        "global": ScopedConfig(config_path="~/.claude.json"),
        "project": ScopedConfig(config_path=".claude/settings.json"),
    },
    agent={
        "global": ScopedConfig(config_path="~/.claude/agents/", native="true"),
        "project": ScopedConfig(config_path="<project>/.claude/agents/", native="true"),
    },
)
