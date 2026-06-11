# GitHub Copilot in VS Code
# Docs: https://code.visualstudio.com/docs/copilot
#
# MCP:      user-profile mcp.json (root key "servers", VS Code entry format)
#           and project .vscode/mcp.json. NOT settings.json.
# Skills:   .github/skills/<name>/SKILL.md (workspace); VS Code also scans
#           .claude/skills/ and .agents/skills/. Personal: ~/.copilot/skills/.
# Prompts:  .github/prompts/*.prompt.md
# Agents:   .github/agents/<name>.md
# Instructions (.github/copilot-instructions.md, AGENTS.md) are not managed.

from integrations.base import EntityTarget, Integration

vscode_github_copilot = Integration(
    id="vscode_github_copilot",
    display_name="GitHub Copilot (VS Code)",
    color="#007ACC",
    category="editor",
    docs_url="https://code.visualstudio.com/docs/copilot",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/Library/Application Support/Code/User/mcp.json",
                handler="json_mcp",
                options={"root_key": "servers", "style": "vscode"},
                os_paths={
                    "linux": "~/.config/Code/User/mcp.json",
                    "win32": "~/AppData/Roaming/Code/User/mcp.json",
                },
            ),
            "project": EntityTarget(
                path=".vscode/mcp.json",
                handler="json_mcp",
                options={"root_key": "servers", "style": "vscode"},
            ),
        },
        "skill": {
            "global": EntityTarget(path="~/.copilot/skills/", handler="skill_dir"),
            "project": EntityTarget(
                path=".github/skills/",
                handler="skill_dir",
                read_paths=[".claude/skills/", ".agents/skills/"],
            ),
        },
        "rule": {
            "project": EntityTarget(
                path=".github/instructions/",
                handler="markdown_dir",
                options={"suffix": ".instructions.md",
                         "frontmatter": "copilot_instructions"},
                notes="Repo-wide .github/copilot-instructions.md and AGENTS.md "
                "are also read by Copilot; sync to Codex to manage AGENTS.md.",
            ),
        },
        "command": {
            "project": EntityTarget(
                path=".github/prompts/",
                handler="markdown_dir",
                options={"suffix": ".prompt.md", "frontmatter": "copilot_prompt"},
            ),
        },
        "subagent": {
            "project": EntityTarget(
                path=".github/agents/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "copilot_agent"},
            ),
        },
    },
)
