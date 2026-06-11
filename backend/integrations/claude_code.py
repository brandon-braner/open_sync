# Claude Code (Anthropic CLI)
# Docs: https://code.claude.com/docs
#
# MCP:      ~/.claude.json ("mcpServers", user scope) / .mcp.json (project, committable)
# Skills:   ~/.claude/skills/<name>/SKILL.md / .claude/skills/<name>/SKILL.md
# Commands: ~/.claude/commands/*.md / .claude/commands/*.md
# Agents:   ~/.claude/agents/*.md / .claude/agents/*.md (markdown + YAML frontmatter)
#
# v1 OpenSync injected skills into CLAUDE.md between marker comments; those
# blocks are cleaned up on the first skill sync (legacy_marker_paths).

from integrations.base import EntityTarget, Integration

claude_code = Integration(
    id="claude_code",
    display_name="Claude Code",
    color="#D97757",
    category="cli",
    docs_url="https://code.claude.com/docs",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.claude.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
                notes="Claude Code also stores session state in this file; "
                "avoid syncing while Claude Code is running.",
            ),
            "project": EntityTarget(
                path=".mcp.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "global": EntityTarget(
                path="~/.claude/skills/",
                handler="skill_dir",
                legacy_marker_paths=["~/.claude/CLAUDE.md"],
            ),
            "project": EntityTarget(
                path=".claude/skills/",
                handler="skill_dir",
                legacy_marker_paths=["CLAUDE.md"],
            ),
        },
        "rule": {
            "global": EntityTarget(
                path="~/.claude/CLAUDE.md", handler="markdown_blocks"
            ),
            "project": EntityTarget(path="CLAUDE.md", handler="markdown_blocks"),
        },
        "command": {
            "global": EntityTarget(
                path="~/.claude/commands/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_command"},
            ),
            "project": EntityTarget(
                path=".claude/commands/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_command"},
            ),
        },
        "subagent": {
            "global": EntityTarget(
                path="~/.claude/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
            "project": EntityTarget(
                path=".claude/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
        },
    },
)
