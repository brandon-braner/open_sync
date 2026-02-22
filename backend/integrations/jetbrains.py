from integrations.base import Integration, ScopedConfig

jetbrains = Integration(
    id="jetbrains",
    display_name="JetBrains (Copilot)",
    color="#FC801D",
    category="editor",
    mcp={
        "global": ScopedConfig(
            config_path="~/.config/github-copilot/intellij/mcp.json",
            root_key="mcpServers",
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/.config/github-copilot/intellij/", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/.config/github-copilot/intellij/", native="false"
        ),
    },
)
