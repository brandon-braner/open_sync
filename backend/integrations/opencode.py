# OpenCode
# Docs: https://opencode.ai/docs
#
# MCP:      ~/.config/opencode/opencode.json / opencode.json — "mcp" key,
#           OpenCode-specific entry format (type local/remote, command array,
#           environment).
# Skills:   ~/.config/opencode/skill/ and .opencode/skill/ (singular dirs).
# Commands: ~/.config/opencode/command/*.md and .opencode/command/*.md.
# Agents:   ~/.config/opencode/agent/*.md and .opencode/agent/*.md.
# LLM:      "provider" key in opencode.json (read-only discovery).

from integrations.base import EntityTarget, Integration

opencode = Integration(
    id="opencode",
    display_name="OpenCode",
    color="#FF6B6B",
    category="cli",
    docs_url="https://opencode.ai/docs",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.config/opencode/opencode.json",
                handler="json_mcp",
                options={"root_key": "mcp", "style": "opencode"},
            ),
            "project": EntityTarget(
                path="opencode.json",
                handler="json_mcp",
                options={"root_key": "mcp", "style": "opencode"},
            ),
        },
        "skill": {
            "global": EntityTarget(
                path="~/.config/opencode/skill/", handler="skill_dir"
            ),
            "project": EntityTarget(
                path=".opencode/skill/",
                handler="skill_dir",
                read_paths=[".agents/skills/"],
            ),
        },
        "rule": {
            "global": EntityTarget(
                path="~/.config/opencode/AGENTS.md", handler="markdown_blocks"
            ),
            "project": EntityTarget(path="AGENTS.md", handler="markdown_blocks"),
        },
        "command": {
            "global": EntityTarget(
                path="~/.config/opencode/command/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_command"},
            ),
            "project": EntityTarget(
                path=".opencode/command/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_command"},
            ),
        },
        "subagent": {
            "global": EntityTarget(
                path="~/.config/opencode/agent/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
            "project": EntityTarget(
                path=".opencode/agent/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_agent"},
            ),
        },
        "llm": {
            "global": EntityTarget(
                path="~/.config/opencode/opencode.json",
                handler="llm_json",
                options={"root_key": "provider"},
                capability="read_only",
            ),
            "project": EntityTarget(
                path="opencode.json",
                handler="llm_json",
                options={"root_key": "provider"},
                capability="read_only",
            ),
        },
    },
)
