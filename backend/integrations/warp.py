# Warp Terminal
# Docs: https://docs.warp.dev
#
# MCP: configured in the Warp UI, not file-based — unsupported here.
# Skills:    ~/.warp/skills/ and .warp/skills/ (SKILL.md folders).
# Workflows: ~/.warp/workflows/*.yaml and .warp/workflows/*.yaml —
#            parameterised command sequences (name/command/description YAML).

from integrations.base import EntityTarget, Integration

warp = Integration(
    id="warp",
    display_name="Warp",
    color="#01CBA4",
    category="desktop",
    notes="MCP servers and model selection are managed in the Warp UI.",
    targets={
        "skill": {
            "global": EntityTarget(path="~/.warp/skills/", handler="skill_dir"),
            "project": EntityTarget(path=".warp/skills/", handler="skill_dir"),
        },
        "command": {
            "global": EntityTarget(
                path="~/.warp/workflows/", handler="yaml_workflow"
            ),
            "project": EntityTarget(
                path=".warp/workflows/", handler="yaml_workflow"
            ),
        },
    },
)
