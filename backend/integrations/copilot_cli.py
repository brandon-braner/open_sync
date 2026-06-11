# GitHub Copilot CLI
# Docs: https://docs.github.com/en/copilot/how-tos/copilot-cli
#
# MCP:      ~/.copilot/mcp-config.json (global; accepts the standard
#           "mcpServers" wrapper). Project level: .mcp.json (shared with
#           Claude Code) or .github/mcp.json.
# Skills:   ~/.copilot/skills/ (also reads ~/.claude/skills/, ~/.agents/skills/);
#           project .github/skills/.
# Agents:   ~/.copilot/agents/*.agent.md; project .github/agents/*.md.

from integrations.base import EntityTarget, Integration

copilot_cli = Integration(
    id="copilot_cli",
    display_name="GitHub Copilot CLI",
    color="#6E40C9",
    category="cli",
    docs_url="https://docs.github.com/en/copilot/how-tos/copilot-cli",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.copilot/mcp-config.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
            "project": EntityTarget(
                path=".mcp.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
                read_paths=[".github/mcp.json"],
                notes="Project MCP config is .mcp.json, shared with Claude Code.",
            ),
        },
        "skill": {
            "global": EntityTarget(
                path="~/.copilot/skills/",
                handler="skill_dir",
                read_paths=["~/.claude/skills/", "~/.agents/skills/"],
            ),
            "project": EntityTarget(
                path=".github/skills/",
                handler="skill_dir",
                read_paths=[".claude/skills/", ".agents/skills/"],
            ),
        },
        "subagent": {
            "global": EntityTarget(
                path="~/.copilot/agents/",
                handler="markdown_dir",
                options={"suffix": ".agent.md", "frontmatter": "copilot_agent"},
            ),
            "project": EntityTarget(
                path=".github/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "copilot_agent"},
            ),
        },
    },
)
