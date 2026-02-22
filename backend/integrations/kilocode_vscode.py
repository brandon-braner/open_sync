from integrations.base import Integration, ScopedConfig

kilocode_vscode = Integration(
    id="kilocode_vscode",
    display_name="Kilo Code (VS Code)",
    color="#FF4081",
    category="plugin",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/globalStorage/kilocode.kilo-code/settings/cline_mcp_settings.json",
            root_key="mcpServers",
        ),
        "project": ScopedConfig(
            config_path=".kilocode/mcp.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/settings.json",
            native="false",
        ),
        "project": ScopedConfig(config_path="<project>/.kilocode/", native="false"),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/settings.json",
            native="false",
        ),
        "project": ScopedConfig(config_path="<project>/.kilocode/", native="false"),
    },
)
