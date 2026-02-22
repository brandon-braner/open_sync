# VS Code + GitHub Copilot
# Docs: https://code.visualstudio.com/docs/copilot
#
# MCP:
#   Global config: ~/Library/Application Support/Code/User/mcp.json
#                  (root key: "servers", uses VS Code-specific format)
#   Project config: .vscode/mcp.json   (root key: "servers")
#   Ref: https://code.visualstudio.com/docs/copilot/customization/mcp-servers
#
# Skills (Agent Skills — SKILL.md in subdirectories):
#   Global:  ~/.copilot/skills/              (user-level skills)
#   Project: <project>/.github/skills/       (workspace skills)
#   Each skill is a subdirectory with a SKILL.md file.
#   Ref: https://code.visualstudio.com/docs/copilot/customization/agent-skills
#
# Workflows (Prompt Files — .prompt.md files):
#   Global:  (user profile prompts/ folder)
#   Project: <project>/.github/prompts/      (workspace prompt files)
#   Triggered via # prefix in chat.
#   Ref: https://code.visualstudio.com/docs/copilot/customization/prompt-files
#
# Agents (Custom Agents — .agent.md files):
#   Project: <project>/.github/agents/       (workspace agents)
#   Ref: https://code.visualstudio.com/docs/copilot/customization/custom-agents
#
# LLM config: not applicable — model managed through Copilot extension settings

from integrations.base import Integration, ScopedConfig

vscode_github_copilot = Integration(
    id="vscode_github_copilot",
    display_name="VS Code + GitHub Copilot",
    color="#007ACC",
    category="editor",
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
    skill={
        "global": ScopedConfig(config_path="~/.copilot/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.github/skills/", native="true"),
    },
    workflow={
        "project": ScopedConfig(
            config_path="<project>/.github/prompts/", native="true"
        ),
    },
    agent={
        "project": ScopedConfig(config_path="<project>/.github/agents/", native="true"),
    },
)
