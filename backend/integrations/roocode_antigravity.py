from integrations.base import Integration, ScopedConfig

roocode_antigravity = Integration(
    id="roocode_antigravity",
    display_name="Roo Code (Antigravity)",
    color="#00C853",
    category="plugin",
    mcp={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json",
            root_key="mcpServers",
        ),
        "project": ScopedConfig(config_path=".roo/mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/",
            native="false",
        ),
        "project": ScopedConfig(config_path="<project>/.roo/", native="false"),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/Library/Application Support/Antigravity/User/globalStorage/rooveterinaryinc.roo-cline/settings/",
            native="false",
        ),
        "project": ScopedConfig(config_path="<project>/.roo/", native="false"),
    },
)
