from integrations.base import Integration, ScopedConfig

windsurf = Integration(
    id="windsurf",
    display_name="Windsurf",
    color="#1ABC9C",
    category="editor",
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
