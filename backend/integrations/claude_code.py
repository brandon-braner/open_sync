from integrations.base import Integration, ScopedConfig

claude_code = Integration(
    id="claude_code",
    display_name="Claude Code",
    color="#D97757",
    category="cli",
    mcp={
        "global": ScopedConfig(config_path="~/.claude.json", root_key="mcpServers"),
        "project": ScopedConfig(config_path=".mcp.json", root_key="mcpServers"),
    },
    skill={
        "global": ScopedConfig(config_path="~/.claude.json", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.claude/settings.json", native="false"
        ),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.claude.json", native="false"),
        "project": ScopedConfig(
            config_path="<project>/.claude/settings.json", native="false"
        ),
    },
    llm={
        "global": ScopedConfig(config_path="~/.claude.json"),
        "project": ScopedConfig(config_path=".claude/settings.json"),
    },
)
