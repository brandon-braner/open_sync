# Antigravity (by Google DeepMind)
#
# MCP:
#   Global config: ~/.gemini/antigravity/mcp_config.json  (root key: "mcpServers")
#   Project config: .antigravity/mcp_config.json          (root key: "mcpServers")
#
# Skills:
#   Global:  ~/.agents/skills/     (native markdown skill files)
#   Project: <project>/.agents/skills/
#
# Workflows:
#   Global:  ~/.agents/workflows/     (native markdown workflow files)
#   Project: <project>/.agents/workflows/

from integrations.base import Integration, ScopedConfig

antigravity = Integration(
    id="antigravity",
    display_name="Antigravity",
    color="#4285F4",
    category="editor",
    llm_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/.gemini/antigravity/mcp_config.json", root_key="mcpServers"
        ),
        "project": ScopedConfig(
            config_path=".antigravity/mcp_config.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.agents/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.agents/skills/", native="true"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.agents/workflows/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.agents/workflows/", native="true"
        ),
    },
    agent_support=False,
)
