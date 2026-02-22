from integrations.base import Integration, ScopedConfig

vscode = Integration(
    id="vscode",
    display_name="VS Code",
    color="#007ACC",
    category="editor",
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
