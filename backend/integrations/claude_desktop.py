# Claude Desktop (Anthropic)
# Docs: https://modelcontextprotocol.io/quickstart/user
#
# MCP:
#   macOS config: ~/Library/Application Support/Claude/claude_desktop_config.json
#                 (root key: "mcpServers")
#   Windows config: %APPDATA%\Claude\claude_desktop_config.json
#   Access via: Claude Desktop → Settings → Developer → Edit Config
#   Ref: https://docs.anthropic.com/en/docs/claude-desktop/mcp
#
# Skills / Workflows: not supported natively
# LLM config: managed through Anthropic account / claude.ai settings

from integrations.base import Integration, ScopedConfig

claude_desktop = Integration(
    id="claude_desktop",
    display_name="Claude Desktop",
    color="#D97757",
    category="desktop",
    skill_support=False,
    workflow_support=False,
    llm_support=False,
    agent_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Claude/claude_desktop_config.json",
            root_key="mcpServers",
        ),
    },
)
