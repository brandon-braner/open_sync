# OpenCode
# Docs: https://opencode.ai/docs
#
# MCP:
#   Global config: ~/.config/opencode/opencode.json   (key: "mcp", nested format)
#   Project config: opencode.json                      (key: "mcp", nested format)
#   Config uses opencode-specific MCP format (type: "local"|"remote", command array)
#   Ref: https://opencode.ai/docs/mcp
#
# Skills:
#   Global:  ~/.config/opencode/opencode.json  (native — stored within config file)
#   Project: <project>/opencode.json
#   Ref: https://opencode.ai/docs/skills
#
# Workflows:
#   Global:  ~/.config/opencode/opencode.json  (native — stored within config file)
#   Project: <project>/opencode.json
#   Ref: https://opencode.ai/docs/workflows
#
# LLM / Model settings:
#   Global:  ~/.config/opencode/opencode.json
#   Project: opencode.json
#   Ref: https://opencode.ai/docs/config

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
