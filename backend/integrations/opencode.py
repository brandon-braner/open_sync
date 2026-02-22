from integrations.base import Integration, ScopedConfig

opencode = Integration(
    id="opencode",
    display_name="OpenCode",
    color="#FF6B6B",
    category="cli",
    mcp={
        "global": ScopedConfig(
            config_path="~/.config/opencode/opencode.json",
            root_key="mcp",
            format_type="opencode",
            nested=True,
        ),
        "project": ScopedConfig(
            config_path="opencode.json",
            root_key="mcp",
            format_type="opencode",
            nested=True,
        ),
    },
    skill={
        "global": ScopedConfig(
            config_path="~/.config/opencode/opencode.json", native="true"
        ),
        "project": ScopedConfig(config_path="<project>/opencode.json", native="true"),
    },
    workflow={
        "global": ScopedConfig(
            config_path="~/.config/opencode/opencode.json", native="true"
        ),
        "project": ScopedConfig(config_path="<project>/opencode.json", native="true"),
    },
    llm={
        "global": ScopedConfig(config_path="~/.config/opencode/opencode.json"),
        "project": ScopedConfig(config_path="opencode.json"),
    },
)
