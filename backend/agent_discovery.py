"""Agent discovery and write-back for all supported AI code agents.

Agents / subagents are specialized AI personas with their own system prompt,
tool permissions, and model settings.  All supported tools use Markdown files
with YAML frontmatter stored in dedicated directories.

Public API
----------
  * ``list_agent_targets()``        – metadata about every writable target
  * ``discover_all_agents()``       – read agents from every agent config dir
  * ``write_agent_to_target()``     – push one Agent into a specific target
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from models import Agent
from unified_targets import get_agent_targets as _get_agent_targets

# ---------------------------------------------------------------------------
# Agent targets metadata
# ---------------------------------------------------------------------------

AGENT_TARGETS: list[dict] = _get_agent_targets()


def list_agent_targets() -> list[dict]:
    return _get_agent_targets()


# ---------------------------------------------------------------------------
# Frontmatter helpers
# ---------------------------------------------------------------------------

_FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Return (frontmatter_dict, body) from a markdown file with YAML frontmatter."""
    m = _FM_RE.match(text)
    if not m:
        return {}, text
    fm_block = m.group(1)
    body = text[m.end() :]
    fm: dict[str, str] = {}
    for line in fm_block.splitlines():
        if ":" in line:
            key, _, val = line.partition(":")
            fm[key.strip()] = val.strip().strip("\"'")
    return fm, body


def _build_frontmatter(agent: Agent) -> str:
    """Build YAML frontmatter block from Agent fields."""
    lines = ["---"]
    lines.append(f"name: {agent.name}")
    if agent.description:
        lines.append(f"description: {agent.description}")
    if agent.model:
        lines.append(f"model: {agent.model}")
    if agent.tools:
        lines.append(f"tools: {agent.tools}")
    lines.append("---\n")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Generic directory-based discovery
# ---------------------------------------------------------------------------


def _discover_agents_dir(agents_dir: Path, source_tag: str) -> list[Agent]:
    """Discover agents from .md files in a directory."""
    if not agents_dir.is_dir():
        return []
    agents: list[Agent] = []
    for md_file in sorted(agents_dir.glob("*.md")):
        try:
            text = md_file.read_text(encoding="utf-8")
        except Exception:
            continue
        fm, body = _parse_frontmatter(text)
        name = fm.get("name", md_file.stem.replace("-", " "))
        a = Agent(
            name=name,
            description=fm.get("description"),
            content=body.strip(),
            model=fm.get("model"),
            tools=fm.get("tools"),
            sources=[source_tag],
        )
        agents.append(a)
    return agents


def _write_agent_to_dir(agent: Agent, agents_dir: Path) -> dict[str, Any]:
    """Write an agent as a .md file with YAML frontmatter into a directory."""
    try:
        agents_dir.mkdir(parents=True, exist_ok=True)
        slug = agent.name.lower().replace(" ", "-").replace("/", "-")
        agent_file = agents_dir / f"{slug}.md"
        header = _build_frontmatter(agent)
        body = agent.content or f"# {agent.name}\n\n{agent.description or ''}"
        agent_file.write_text(header + body, encoding="utf-8")
        return {
            "success": True,
            "message": f"Agent written to {agent_file}",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write agent: {exc}"}


# ---------------------------------------------------------------------------
# Per-tool config path resolution
# ---------------------------------------------------------------------------

_TOOL_DIRS: dict[str, dict[str, str]] = {
    "opencode": {
        "global": "~/.config/opencode/agents/",
        "project": ".opencode/agents/",
    },
    "claude_code": {
        "global": "~/.claude/agents/",
        "project": ".claude/agents/",
    },
    "copilot_cli": {
        "global": "~/.copilot/agents/",
        "project": ".github/agents/",
    },
    "gemini_cli": {
        "global": "~/.gemini/agents/",
        "project": ".gemini/agents/",
    },
    "cursor": {
        "global": "~/.cursor/agents/",
        "project": ".cursor/agents/",
    },
    "antigravity": {
        "global": "~/.agents/agents/",
        "project": ".agents/agents/",
    },
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def discover_all_agents(project_path: str | None = None) -> list[Agent]:
    """Discover agents from every supported tool's agent directory.

    If *project_path* is provided, project-scoped agent directories are also
    scanned.
    """
    agents: list[Agent] = []
    for tool_id, paths in _TOOL_DIRS.items():
        # Global scope
        global_dir = Path(paths["global"]).expanduser()
        agents.extend(_discover_agents_dir(global_dir, f"{tool_id}_global"))

    if project_path:
        pp = Path(project_path).expanduser()
        for tool_id, paths in _TOOL_DIRS.items():
            project_dir = pp / paths["project"]
            agents.extend(_discover_agents_dir(project_dir, f"{tool_id}_project"))

    return agents


def write_agent_to_target(
    agent: Agent,
    target_id: str,
    project_path: str | None = None,
) -> dict[str, Any]:
    """Write an Agent to a specific integration target.

    *target_id* format: ``{tool_id}_{scope}`` e.g. ``"opencode_global"``.
    """
    parts = target_id.rsplit("_", 1)
    if len(parts) < 2:
        return {"success": False, "message": f"Invalid target_id: {target_id}"}
    scope = parts[-1]
    tool_id = "_".join(parts[:-1])

    if tool_id not in _TOOL_DIRS:
        return {"success": False, "message": f"Unknown tool: {tool_id}"}

    if scope == "project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for project-scoped targets",
            }
        base_dir = Path(project_path).expanduser() / _TOOL_DIRS[tool_id]["project"]
    else:
        base_dir = Path(_TOOL_DIRS[tool_id]["global"]).expanduser()

    return _write_agent_to_dir(agent, base_dir)
