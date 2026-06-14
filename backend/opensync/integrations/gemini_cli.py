# Gemini CLI (Google)
# Docs: https://github.com/google-gemini/gemini-cli
#
# MCP:      ~/.gemini/settings.json / .gemini/settings.json ("mcpServers",
#           nested inside the larger settings file).
# Skills:   ~/.gemini/skills/ and .gemini/skills/ (also reads .agents/skills/).
# Commands: ~/.gemini/commands/*.toml and .gemini/commands/*.toml — TOML files
#           with `description` and `prompt` keys.
# Subagents: ~/.gemini/agents/ and .gemini/agents/ (markdown + frontmatter).

from opensync.integrations.base import EntityTarget, Integration

gemini_cli = Integration(
    id="gemini_cli",
    display_name="Gemini CLI",
    color="#0F9D58",
    category="cli",
    docs_url="https://github.com/google-gemini/gemini-cli",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.gemini/settings.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
            "project": EntityTarget(
                path=".gemini/settings.json",
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "global": EntityTarget(
                path="~/.gemini/skills/",
                handler="skill_dir",
                read_paths=["~/.agents/skills/"],
            ),
            "project": EntityTarget(
                path=".gemini/skills/",
                handler="skill_dir",
                read_paths=[".agents/skills/"],
            ),
        },
        "rule": {
            "global": EntityTarget(
                path="~/.gemini/GEMINI.md", handler="markdown_blocks"
            ),
            "project": EntityTarget(path="GEMINI.md", handler="markdown_blocks"),
        },
        "command": {
            "global": EntityTarget(
                path="~/.gemini/commands/", handler="toml_command"
            ),
            "project": EntityTarget(
                path=".gemini/commands/", handler="toml_command"
            ),
        },
        "subagent": {
            "global": EntityTarget(
                path="~/.gemini/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
            "project": EntityTarget(
                path=".gemini/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
        },
    },
)
