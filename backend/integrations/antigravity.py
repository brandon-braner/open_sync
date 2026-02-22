from integrations.base import Integration, ScopedConfig

antigravity = Integration(
    id="antigravity",
    display_name="Antigravity",
    color="#4285F4",
    category="editor",
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
)
