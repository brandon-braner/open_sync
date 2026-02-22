# VS Code (Microsoft)
# Docs: https://code.visualstudio.com/docs
#
# MCP:
#   Global config: ~/Library/Application Support/Code/User/mcp.json
#                  (root key: "servers", uses VS Code-specific format)
#   Project config: .vscode/mcp.json   (root key: "servers")
#   Access via: VS Code → Settings → MCP or add to workspace settings
#   Ref: https://code.visualstudio.com/docs/copilot/chat/mcp-servers
#
# Skills / Workflows: not supported natively (handled via Copilot extension)
# LLM config: not applicable — model managed through VS Code Copilot extension settings

from integrations.base import Integration, ScopedConfig

vscode = Integration(
    id="vscode",
    display_name="VS Code",
    color="#007ACC",
    category="editor",
    skill_support=False,
    workflow_support=False,
    llm_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/mcp.json",
            root_key="servers",
            format_type="vscode",
        ),
        "project": ScopedConfig(
            config_path=".vscode/mcp.json", root_key="servers", format_type="vscode"
        ),
    },
)
