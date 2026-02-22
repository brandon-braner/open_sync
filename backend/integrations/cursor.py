from integrations.base import Integration, ScopedConfig

cursor = Integration(
    id="cursor",
    display_name="Cursor",
    color="#00D4AA",
    category="editor",
    mcp={
        "global": ScopedConfig(config_path="~/.cursor/mcp.json", root_key="mcpServers"),
        "project": ScopedConfig(config_path=".cursor/mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(config_path="~/.cursor/rules/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/rules/", native="true"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.cursor/rules/", native="true"),
        "project": ScopedConfig(config_path="<project>/.cursor/rules/", native="true"),
    },
    llm={
        "global": ScopedConfig(config_path="~/.cursor/", read_only=True),
    },
)
