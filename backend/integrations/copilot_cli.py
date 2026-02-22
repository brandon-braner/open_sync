# GitHub Copilot CLI
# Docs: https://docs.github.com/en/copilot/github-copilot-in-the-cli
#
# MCP:
#   Global config: ~/.copilot/mcp-config.json   (root key: "mcpServers")
#                  (default path; overridable via XDG_CONFIG_HOME env var)
#   Project config: .copilot/mcp-config.json    (root key: "mcpServers")
#   Add servers via: gh copilot /mcp add, or edit JSON directly
#   Ref: https://docs.github.com/en/copilot/how-tos/copilot-cli/using-mcp-with-copilot-cli
#
# Skills (SKILL.md files in subdirectories):
#   Global:  ~/.copilot/skills/              (personal skills, available across projects)
#   Project: <project>/.github/skills/       (project skills, committed to repo)
#   Also searches .claude/skills/ for cross-tool compatibility
#   Ref: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills
#
# Workflows: not supported natively
# LLM config: model selection managed through GitHub account / copilot settings

from integrations.base import Integration, ScopedConfig

copilot_cli = Integration(
    id="copilot_cli",
    display_name="GitHub Copilot CLI",
    color="#6E40C9",
    category="cli",
    workflow_support=False,
    llm_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/.copilot/mcp-config.json", root_key="mcpServers"
        ),
        "project": ScopedConfig(
            config_path=".copilot/mcp-config.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.copilot/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.github/skills/", native="true"),
    },
    agent={
        "global": ScopedConfig(config_path="~/.copilot/agents/", native="true"),
        "project": ScopedConfig(config_path="<project>/.github/agents/", native="true"),
    },
)
