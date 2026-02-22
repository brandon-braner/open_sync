from integrations.base import Integration, ScopedConfig

continue_ = Integration(
    id="continue",
    display_name="Continue",
    color="#4ECDC4",
    category="editor",
    mcp={
        "global": ScopedConfig(
            config_path="~/.continue/config.yaml",
            root_key="mcpServers",
            format_type="yaml",
        ),
        "project": ScopedConfig(
            config_path=".continue/config.yaml",
            root_key="mcpServers",
            format_type="yaml",
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.continue/config.yaml", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.continue/config.yaml", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.continue/config.yaml", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.continue/config.yaml", native="false"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.continue/config.yaml"),
        "project": ScopedConfig(config_path=".continue/config.yaml"),
    },
)
