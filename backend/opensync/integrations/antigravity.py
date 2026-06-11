# Antigravity (Google DeepMind)
#
# MCP:       ~/.gemini/antigravity/mcp_config.json / .antigravity/mcp_config.json
# Skills:    ~/.agents/skills/ and .agents/skills/ (Agent Skills standard dirs)
# Workflows: ~/.agents/workflows/ and .agents/workflows/

from opensync.integrations.base import EntityTarget, Integration

antigravity = Integration(
    id="antigravity",
    display_name="Antigravity",
    color="#4285F4",
    category="editor",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.gemini/antigravity/mcp_config.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
            "project": EntityTarget(
                path=".antigravity/mcp_config.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "global": EntityTarget(path="~/.agents/skills/", handler="skill_dir"),
            "project": EntityTarget(path=".agents/skills/", handler="skill_dir"),
        },
        "command": {
            "global": EntityTarget(
                path="~/.agents/workflows/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
            ),
            "project": EntityTarget(
                path=".agents/workflows/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "plain"},
            ),
        },
    },
)
