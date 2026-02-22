from integrations.base import Integration, ScopedConfig

claude_desktop = Integration(
    id="claude_desktop",
    display_name="Claude Desktop",
    color="#D97757",
    category="desktop",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Claude/claude_desktop_config.json",
            root_key="mcpServers",
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Claude/claude_desktop_config.json",
            native="false",
        ),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Claude/claude_desktop_config.json",
            native="false",
        ),
    },
)
