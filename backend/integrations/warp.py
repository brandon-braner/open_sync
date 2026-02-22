# Warp Terminal
# Docs: https://docs.warp.dev
#
# MCP: not supported
# LLM config: not applicable (model managed by Warp's cloud service)
#
# Skills (AI Agent skills — YAML files):
#   Global:  ~/.warp/skills/             (available across all projects)
#   Project: <project>/.warp/skills/     (discovered up from CWD to repo root)
#   Ref: https://docs.warp.dev/features/agent-mode/skills
#
# Workflows (parameterized command sequences — YAML files):
#   Global:  ~/.warp/workflows/          (available globally via Command Palette)
#   Project: <project>/.warp/workflows/  (project-specific workflows)
#   Ref: https://docs.warp.dev/features/workflows

from integrations.base import Integration, ScopedConfig

warp = Integration(
    id="warp",
    display_name="Warp",
    color="#01CBA4",
    category="desktop",
    mcp_support=False,
    llm_support=False,
    agent_support=False,
    skill={
        "global": ScopedConfig(config_path="~/.warp/skills/", native="true"),
        "project": ScopedConfig(config_path="<project>/.warp/skills/", native="true"),
    },
    workflow={
        "global": ScopedConfig(config_path="~/.warp/workflows/", native="true"),
        "project": ScopedConfig(
            config_path="<project>/.warp/workflows/", native="true"
        ),
    },
)
