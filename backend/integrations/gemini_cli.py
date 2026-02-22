# Gemini CLI (Google)
# Docs: https://github.com/google-gemini/gemini-cli
#
# MCP:
#   Global config: ~/.gemini/settings.json   (root key: "mcpServers", nested)
#   Project config: .gemini/settings.json    (root key: "mcpServers", nested)
#   Ref: https://github.com/google-gemini/gemini-cli/blob/main/docs/mcp.md
#
# Skills:
#   Global:  ~/.gemini/skills/               (native markdown skill files; also supports ~/.agents/skills/)
#   Project: <project>/.gemini/skills/
#   Ref: https://github.com/google-gemini/gemini-cli/blob/main/docs/skills.md
#
# Workflows (slash commands / .toml files):
#   Global:  ~/.gemini/commands/             (native — global slash commands)
#   Project: <project>/.gemini/commands/
#   Ref: https://github.com/google-gemini/gemini-cli/blob/main/docs/slash-commands.md
#
# LLM / Model settings:
#   Global:  ~/.gemini/settings.json
#   Project: .gemini/settings.json
#   Ref: https://github.com/google-gemini/gemini-cli/blob/main/docs/settings.md

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
        "global": ScopedConfig(config_path="~/.gemini/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.gemini/skills/", native="true"),
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
