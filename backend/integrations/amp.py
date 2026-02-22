from integrations.base import Integration, ScopedConfig

amp = Integration(
    id="amp",
    display_name="Amp (Sourcegraph)",
    color="#E74C3C",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.amp/settings.json", root_key="mcpServers"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.amp/settings.json", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.amp/settings.json", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.amp/settings.json", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.amp/settings.json", native="false"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.amp/settings.json"),
    },
)
