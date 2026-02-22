from integrations.base import Integration, ScopedConfig

plandex = Integration(
    id="plandex",
    display_name="Plandex",
    color="#F39C12",
    category="cli",
    # No MCP support
    skill={
        "global": ScopedConfig(config_path="~/.plandex-home/", native="false"),
        "project": ScopedConfig(config_path="<project>/.plandex/", native="false"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.plandex-home/", native="false"),
        "project": ScopedConfig(config_path="<project>/.plandex/", native="false"),
    },
    llm={
        "global": ScopedConfig(config_path="~/.plandex-home/"),
        "project": ScopedConfig(config_path=".plandex/"),
    },
)
