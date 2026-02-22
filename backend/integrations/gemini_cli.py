from integrations.base import Integration, ScopedConfig

gemini_cli = Integration(
    id="gemini_cli",
    display_name="Gemini CLI",
    color="#0F9D58",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.gemini/settings.json", root_key="mcpServers", nested=True
        ),
        "project": ScopedConfig(
            config_path=".gemini/settings.json", root_key="mcpServers", nested=True
        ),
    },
    skill={
        "global": ScopedConfig(config_path="~/.gemini/settings.json", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.gemini/settings.json", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.gemini/commands/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.gemini/commands/", native="true"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.gemini/settings.json"),
        "project": ScopedConfig(config_path=".gemini/settings.json"),
    },
)
