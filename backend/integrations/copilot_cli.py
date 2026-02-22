from integrations.base import Integration, ScopedConfig

copilot_cli = Integration(
    id="copilot_cli",
    display_name="GitHub Copilot CLI",
    color="#6E40C9",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.copilot/mcp-config.json", root_key="mcpServers"
        ),
        "project": ScopedConfig(
            config_path=".copilot/mcp-config.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.copilot/", native="false"),
        "project": ScopedConfig(config_path="<project>/.copilot/", native="false"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.copilot/", native="false"),
        "project": ScopedConfig(config_path="<project>/.copilot/", native="false"),
    },
)
