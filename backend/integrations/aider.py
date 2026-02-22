from integrations.base import Integration, ScopedConfig

aider = Integration(
    id="aider",
    display_name="Aider",
    color="#45B7D1",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.aider.conf.yml", root_key="mcpServers", format_type="yaml"
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.aider.conf.yml", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.aider.conf.yml", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.aider.conf.yml", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.aider.conf.yml", native="false"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.aider.conf.yml"),
        "project": ScopedConfig(config_path=".aider.conf.yml"),
    },
)
