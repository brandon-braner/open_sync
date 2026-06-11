# OpenAI Codex — covers the CLI, the IDE extension (they share ~/.codex),
# and notes for cloud Codex (repo-committed files only, no MCP).
# Docs: https://developers.openai.com/codex
#
# MCP:      ~/.codex/config.toml [mcp_servers.<name>] (TOML) and project
#           .codex/config.toml (honoured in trusted projects only).
# Skills:   ~/.codex/skills/<name>/SKILL.md / .codex/skills/; Codex also
#           scans .agents/skills/ in the repo.
# Prompts:  ~/.codex/prompts/*.md — deprecated by Codex in favour of skills,
#           kept as a legacy target.
# Instructions: AGENTS.md (repo) / ~/.codex/AGENTS.md — not managed here.

from integrations.base import EntityTarget, Integration

codex = Integration(
    id="codex",
    display_name="Codex",
    color="#10A37F",
    category="cli",
    docs_url="https://developers.openai.com/codex",
    notes="The Codex CLI and IDE extension share this configuration. Cloud "
    "Codex only reads repo-committed files (AGENTS.md, project skills) and "
    "does not support MCP.",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.codex/config.toml",
                handler="toml_mcp",
                options={"table": "mcp_servers"},
            ),
            "project": EntityTarget(
                path=".codex/config.toml",
                handler="toml_mcp",
                options={"table": "mcp_servers"},
                notes="Project config is only honoured once the project is "
                "trusted in Codex.",
            ),
        },
        "skill": {
            "global": EntityTarget(path="~/.codex/skills/", handler="skill_dir"),
            "project": EntityTarget(
                path=".codex/skills/",
                handler="skill_dir",
                read_paths=[".agents/skills/"],
            ),
        },
        "command": {
            "global": EntityTarget(
                path="~/.codex/prompts/",
                handler="markdown_dir",
                options={"suffix": ".md", "frontmatter": "claude_command"},
                capability="legacy",
                notes="Codex custom prompts are deprecated in favour of skills.",
            ),
        },
    },
)
