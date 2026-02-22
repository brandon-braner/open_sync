from integrations.base import Integration, ScopedConfig

cline_vscode = Integration(
    id="cline_vscode",
    display_name="Cline (VS Code)",
    color="#E8912D",
    category="plugin",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
            root_key="mcpServers",
        ),
        "project": ScopedConfig(
            config_path=".vscode/cline_mcp_settings.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/settings.json",
            native="false",
        ),
        "project": ScopedConfig(
            config_path="<project>/.vscode/settings.json", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/settings.json",
            native="false",
        ),
        "project": ScopedConfig(
            config_path="<project>/.vscode/settings.json", native="false"
        ),
    },
)
