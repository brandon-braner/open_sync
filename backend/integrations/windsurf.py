# Windsurf (Codeium)
# Docs: https://docs.windsurf.com
#
# MCP:
#   Global config: ~/.codeium/windsurf/mcp_config.json   (root key: "mcpServers")
#   Project config: .windsurf/mcp_config.json             (root key: "mcpServers")
#   Access via: Windsurf Settings → Cascade → Plugins (MCP servers) → View raw config
#   Ref: https://docs.windsurf.com/windsurf/mcp
#
# Skills:
#   Global:  ~/.windsurf/skills/             (native markdown skill files)
#   Project: <project>/.windsurf/skills/
#   Ref: https://docs.windsurf.com/windsurf/memories-and-rules
#
# Workflows:
#   Global:  ~/.windsurf/workflows/          (native markdown workflow files)
#   Project: <project>/.windsurf/workflows/
#
# LLM / Model settings:
#   Global:  ~/.codeium/windsurf/mcp_settings.json
#   Project: .windsurf/mcp_settings.json
#   Ref: https://docs.windsurf.com/windsurf/settings

from integrations.base import Integration, ScopedConfig

windsurf = Integration(
    id="windsurf",
    display_name="Windsurf",
    color="#1ABC9C",
    category="editor",
    agent_support=False,
    mcp={
        "global": ScopedConfig(
            config_path="~/.codeium/windsurf/mcp_config.json", root_key="mcpServers"
        ),
        "project": ScopedConfig(
            config_path=".windsurf/mcp_config.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.windsurf/skills/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.windsurf/skills/", native="true"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.windsurf/workflows/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.windsurf/workflows/", native="true"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.codeium/windsurf/mcp_settings.json"),
        "project": ScopedConfig(config_path=".windsurf/mcp_settings.json"),
    },
)
