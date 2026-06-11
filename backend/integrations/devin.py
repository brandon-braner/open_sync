# Devin (Devin Desktop — the rebranded Windsurf editor, Cognition)
# Docs: https://docs.devin.ai/desktop
#
# Devin Desktop reads both new (.devin/) and legacy (.windsurf/) project
# paths; .devin/ takes precedence and is the write target. The ~/.codeium/
# user-level tree was explicitly kept by the rebrand.
#
# MCP:       ~/.codeium/windsurf/mcp_config.json ("mcpServers") — global only.
# Skills:    .devin/skills/<name>/SKILL.md (reads .windsurf/skills/ and
#            .agents/skills/); global ~/.agents/skills/.
# Workflows: ~/.codeium/windsurf/global_workflows/ and .devin/workflows/
#            (reads .windsurf/workflows/) — these are Devin's slash commands.
# Subagents: .devin/agents/ (Devin Local / Devin CLI worker profiles).
# Global rules (~/.codeium/windsurf/memories/global_rules.md) and AGENTS.md
# are not managed here.

from integrations.base import EntityTarget, Integration

devin = Integration(
    id="devin",
    display_name="Devin",
    color="#1ABC9C",
    category="editor",
    docs_url="https://docs.devin.ai/desktop",
    notes="Devin Desktop (formerly Windsurf). The cloud Devin agent is "
    "configured at app.devin.ai; it reads repo-committed skills and AGENTS.md.",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.codeium/windsurf/mcp_config.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "global": EntityTarget(path="~/.agents/skills/", handler="skill_dir"),
            "project": EntityTarget(
                path=".devin/skills/",
                handler="skill_dir",
                read_paths=[".windsurf/skills/", ".agents/skills/"],
            ),
        },
        "command": {
            "global": EntityTarget(
                path="~/.codeium/windsurf/global_workflows/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
            ),
            "project": EntityTarget(
                path=".devin/workflows/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
                read_paths=[".windsurf/workflows/"],
            ),
        },
        "subagent": {
            "project": EntityTarget(
                path=".devin/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
        },
    },
)
