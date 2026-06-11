# Cursor
# Docs: https://cursor.com/docs
#
# MCP:      ~/.cursor/mcp.json / .cursor/mcp.json ("mcpServers")
# Skills:   .cursor/skills/<name>/SKILL.md (also reads .agents/skills/);
#           ~/.cursor/skills/ for personal skills.
# Commands: .cursor/commands/*.md; ~/.cursor/commands/ (community-documented).
# Subagents: .cursor/agents/*.md and ~/.cursor/agents/ (Cursor 2.4+).
# Rules (.cursor/rules/*.mdc) and the global "User Rules" (settings UI only)
# are not managed here.

from integrations.base import EntityTarget, Integration

cursor = Integration(
    id="cursor",
    display_name="Cursor",
    color="#00D4AA",
    category="editor",
    docs_url="https://cursor.com/docs",
    notes="Global 'User Rules' live in the Cursor settings UI and cannot be "
    "file-synced.",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.cursor/mcp.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
            "project": EntityTarget(
                path=".cursor/mcp.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "global": EntityTarget(path="~/.cursor/skills/", handler="skill_dir"),
            "project": EntityTarget(
                path=".cursor/skills/",
                handler="skill_dir",
                read_paths=[".agents/skills/"],
            ),
        },
        "rule": {
            "project": EntityTarget(
                path=".cursor/rules/",
                handler="markdown_dir",
                options={"suffix": ".mdc", "frontmatter": "cursor_mdc"},
                notes="Synced rules are written as always-apply .mdc files. "
                "Global 'User Rules' live in the Cursor settings UI.",
            ),
        },
        "command": {
            "global": EntityTarget(
                path="~/.cursor/commands/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
            ),
            "project": EntityTarget(
                path=".cursor/commands/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
            ),
        },
        "subagent": {
            "global": EntityTarget(
                path="~/.cursor/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
            "project": EntityTarget(
                path=".cursor/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
        },
    },
)
