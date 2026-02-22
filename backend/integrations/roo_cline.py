from integrations.base import Integration, ScopedConfig

roo_cline = Integration(
    id="roo_cline",
    display_name="Roo Code / Cline",
    color="#00C853",
    category="plugin",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
            root_key="mcpServers",
        ),
        "project": ScopedConfig(config_path=".roo/mcp.json", root_key="mcpServers"),
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
    llm={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Code/User/settings.json"
        ),
        "project": ScopedConfig(config_path=".vscode/settings.json"),
    },
)
