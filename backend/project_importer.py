"""project_importer.py – scan a project directory for agent artifacts.

Discovers skills and workflows from all known agent/IDE config formats:
  - Antigravity  .agent/workflows/*.md, .agent/skills/*.md, .agent/rules/*.md
  - Cursor       .cursor/rules/*.mdc
  - Claude Code  CLAUDE.md
  - GitHub Copilot .github/copilot-instructions.md
  - Windsurf     .windsurfrules
  - OpenCode     opencode.json  (instructions → skill, scripts.* → workflows)
  - Continue     .continue/config.json or config.yaml
  - Aider        .aider.conf.yml  or  .aider.system.prompt.md
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

try:
    import yaml  # PyYAML – already a project dependency

    _YAML_OK = True
except ImportError:
    _YAML_OK = False


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


def _make_artifact(
    *,
    name: str,
    artifact_type: str,
    source: str,
    description: str | None = None,
    content: str = "",
    steps: list[str] | None = None,
    file_path: str = "",
) -> dict[str, Any]:
    return {
        "name": name,
        "type": artifact_type,  # "skill" | "workflow"
        "source": source,
        "description": description,
        "content": content,
        "steps": steps or [],
        "file_path": file_path,
    }


# ---------------------------------------------------------------------------
# Frontmatter helpers
# ---------------------------------------------------------------------------


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (frontmatter_dict, body_text). Handles --- delimited YAML."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm_text = text[3:end].strip()
    body = text[end + 4 :].strip()
    if _YAML_OK:
        try:
            fm = yaml.safe_load(fm_text) or {}
            if not isinstance(fm, dict):
                fm = {}
            return fm, body
        except Exception:
            pass
    # Minimal key:value fallback
    fm: dict[str, Any] = {}
    for line in fm_text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, body


def _stem_to_name(path: Path) -> str:
    """Convert a filename stem to a human-readable name."""
    return path.stem.replace("-", " ").replace("_", " ").title()


def _workflow_steps_from_markdown(body: str) -> list[str]:
    """Extract numbered / bullet list items or H2/H3 headings as steps."""
    steps: list[str] = []
    for line in body.splitlines():
        line = line.strip()
        # Numbered list:  1. Step text
        m = re.match(r"^\d+\.\s+(.+)", line)
        if m:
            steps.append(m.group(1).strip())
            continue
        # Bullet list:  - Step text  or  * Step text
        m = re.match(r"^[-*]\s+(.+)", line)
        if m:
            steps.append(m.group(1).strip())
            continue
        # H2/H3 headings (skip H1 — usually the title)
        m = re.match(r"^#{2,3}\s+(.+)", line)
        if m:
            steps.append(m.group(1).strip())
    return steps or [body[:200]] if body.strip() else []


# ---------------------------------------------------------------------------
# Per-agent scanners
# ---------------------------------------------------------------------------


def _scan_antigravity(root: Path) -> list[dict]:
    """Scan .agent/workflows/, .agent/skills/, .agent/rules/ directories."""
    results: list[dict] = []
    agent_dir = root / ".agent"
    if not agent_dir.is_dir():
        return results

    # Workflows
    for f in sorted((agent_dir / "workflows").glob("*.md")):
        if f.is_symlink() and not f.exists():
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        fm, body = _parse_frontmatter(text)
        name = fm.get("name") or _stem_to_name(f)
        desc = fm.get("description") or fm.get("desc")
        steps = _workflow_steps_from_markdown(body)
        results.append(
            _make_artifact(
                name=name,
                artifact_type="workflow",
                source="Antigravity (.agent/workflows)",
                description=desc,
                content=body,
                steps=steps,
                file_path=str(f),
            )
        )

    # Skills + Rules (both map to skills — they're instruction content)
    for subdir, label in [
        ("skills", "Antigravity (.agent/skills)"),
        ("rules", "Antigravity (.agent/rules)"),
    ]:
        for f in sorted((agent_dir / subdir).glob("*.md")):
            if f.is_symlink() and not f.exists():
                continue
            text = f.read_text(encoding="utf-8", errors="replace")
            fm, body = _parse_frontmatter(text)
            name = fm.get("name") or _stem_to_name(f)
            desc = fm.get("description") or fm.get("desc") or fm.get("trigger")
            results.append(
                _make_artifact(
                    name=name,
                    artifact_type="skill",
                    source=label,
                    description=desc,
                    content=text,
                    file_path=str(f),
                )
            )

    return results


def _scan_cursor(root: Path) -> list[dict]:
    """Scan .cursor/rules/*.mdc — treat each rule as a skill."""
    results: list[dict] = []
    rules_dir = root / ".cursor" / "rules"
    if not rules_dir.is_dir():
        return results
    for f in sorted(rules_dir.glob("*.mdc")):
        text = f.read_text(encoding="utf-8", errors="replace")
        fm, body = _parse_frontmatter(text)
        name = fm.get("name") or _stem_to_name(f)
        desc = fm.get("description") or fm.get("desc")
        results.append(
            _make_artifact(
                name=name,
                artifact_type="skill",
                source="Cursor (.cursor/rules)",
                description=desc,
                content=text,
                file_path=str(f),
            )
        )
    return results


def _scan_claude_code(root: Path) -> list[dict]:
    """CLAUDE.md at project root → single skill."""
    results: list[dict] = []
    f = root / "CLAUDE.md"
    if not f.exists():
        return results
    text = f.read_text(encoding="utf-8", errors="replace")
    fm, body = _parse_frontmatter(text)
    # Pull first H1 as name if present
    h1 = next(
        (
            line_.lstrip("# ").strip()
            for line_ in text.splitlines()
            if line_.startswith("# ")
        ),
        None,
    )
    name = fm.get("name") or h1 or f"{root.name} Claude Instructions"
    desc = fm.get("description") or "Project-level Claude Code instructions"
    results.append(
        _make_artifact(
            name=name,
            artifact_type="skill",
            source="Claude Code (CLAUDE.md)",
            description=desc,
            content=text,
            file_path=str(f),
        )
    )
    return results


def _scan_copilot(root: Path) -> list[dict]:
    """.github/copilot-instructions.md → single skill."""
    results: list[dict] = []
    f = root / ".github" / "copilot-instructions.md"
    if not f.exists():
        return results
    text = f.read_text(encoding="utf-8", errors="replace")
    fm, body = _parse_frontmatter(text)
    h1 = next(
        (
            line_.lstrip("# ").strip()
            for line_ in text.splitlines()
            if line_.startswith("# ")
        ),
        None,
    )
    name = fm.get("name") or h1 or f"{root.name} Copilot Instructions"
    desc = fm.get("description") or "GitHub Copilot project instructions"
    results.append(
        _make_artifact(
            name=name,
            artifact_type="skill",
            source="GitHub Copilot (.github/copilot-instructions.md)",
            description=desc,
            content=text,
            file_path=str(f),
        )
    )
    return results


def _scan_windsurf(root: Path) -> list[dict]:
    """.windsurfrules → single skill."""
    results: list[dict] = []
    f = root / ".windsurfrules"
    if not f.exists():
        return results
    text = f.read_text(encoding="utf-8", errors="replace")
    results.append(
        _make_artifact(
            name=f"{root.name} Windsurf Rules",
            artifact_type="skill",
            source="Windsurf (.windsurfrules)",
            description="Windsurf project rules",
            content=text,
            file_path=str(f),
        )
    )
    return results


def _scan_opencode(root: Path) -> list[dict]:
    """opencode.json → instructions (skill) + scripts (workflows)."""
    results: list[dict] = []
    f = root / "opencode.json"
    if not f.exists():
        return results
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return results

    # instructions field → skill
    instructions = data.get("instructions", "")
    if isinstance(instructions, str) and instructions.strip():
        results.append(
            _make_artifact(
                name=f"{root.name} OpenCode Instructions",
                artifact_type="skill",
                source="OpenCode (opencode.json)",
                description="Project-level OpenCode instructions",
                content=instructions,
                file_path=str(f),
            )
        )

    # scripts dict → one workflow per key
    scripts = data.get("scripts", {})
    if isinstance(scripts, dict):
        for key, script_def in scripts.items():
            if isinstance(script_def, dict):
                cmd = script_def.get("command", "")
                desc = script_def.get("description", "")
                steps = [cmd] if cmd else []
            elif isinstance(script_def, str):
                desc = ""
                steps = [script_def]
            else:
                continue
            results.append(
                _make_artifact(
                    name=key.replace("-", " ").replace("_", " ").title(),
                    artifact_type="workflow",
                    source="OpenCode (opencode.json scripts)",
                    description=desc or None,
                    content=str(script_def),
                    steps=steps,
                    file_path=str(f),
                )
            )

    return results


def _scan_continue(root: Path) -> list[dict]:
    """.continue/config.json or config.yaml → systemMessage + rules."""
    results: list[dict] = []
    continue_dir = root / ".continue"
    if not continue_dir.is_dir():
        return results

    data: dict = {}
    for fname in ["config.json", "config.yaml", "config.yml"]:
        fp = continue_dir / fname
        if not fp.exists():
            continue
        text = fp.read_text(encoding="utf-8", errors="replace")
        try:
            if fname.endswith(".json"):
                data = json.loads(text)
            elif _YAML_OK:
                data = yaml.safe_load(text) or {}
        except Exception:
            pass
        if data:
            file_path = str(fp)
            break
    else:
        return results

    # systemMessage → single skill
    sm = data.get("systemMessage", "")
    if isinstance(sm, str) and sm.strip():
        results.append(
            _make_artifact(
                name=f"{root.name} Continue System Prompt",
                artifact_type="skill",
                source="Continue (.continue/config)",
                description="Project system message for Continue",
                content=sm,
                file_path=file_path,
            )
        )

    # experimental.rules[] → one skill per rule
    rules = (data.get("experimental") or {}).get("rules", [])
    if isinstance(rules, list):
        for i, rule in enumerate(rules):
            if isinstance(rule, dict):
                name = rule.get("name") or f"{root.name} Continue Rule {i + 1}"
                content = rule.get("rule", "")
                desc = rule.get("description")
            elif isinstance(rule, str):
                name = f"{root.name} Continue Rule {i + 1}"
                content = rule
                desc = None
            else:
                continue
            results.append(
                _make_artifact(
                    name=name,
                    artifact_type="skill",
                    source="Continue (.continue/config rules)",
                    description=desc,
                    content=content,
                    file_path=file_path,
                )
            )

    return results


def _scan_aider(root: Path) -> list[dict]:
    """.aider.conf.yml system-prompt field OR .aider.system.prompt.md → skill."""
    results: list[dict] = []

    # Check .aider.system.prompt.md first
    prompt_file = root / ".aider.system.prompt.md"
    if prompt_file.exists():
        text = prompt_file.read_text(encoding="utf-8", errors="replace")
        results.append(
            _make_artifact(
                name=f"{root.name} Aider System Prompt",
                artifact_type="skill",
                source="Aider (.aider.system.prompt.md)",
                description="Aider project system prompt",
                content=text,
                file_path=str(prompt_file),
            )
        )

    # Check .aider.conf.yml for system-prompt key
    conf_file = root / ".aider.conf.yml"
    if conf_file.exists() and _YAML_OK:
        try:
            conf = yaml.safe_load(conf_file.read_text(encoding="utf-8")) or {}
            prompt = conf.get("system-prompt", "")
            if isinstance(prompt, str) and prompt.strip():
                results.append(
                    _make_artifact(
                        name=f"{root.name} Aider Config Prompt",
                        artifact_type="skill",
                        source="Aider (.aider.conf.yml)",
                        description="System prompt from Aider config",
                        content=prompt,
                        file_path=str(conf_file),
                    )
                )
        except Exception:
            pass

    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_SCANNERS = [
    _scan_antigravity,
    _scan_cursor,
    _scan_claude_code,
    _scan_copilot,
    _scan_windsurf,
    _scan_opencode,
    _scan_continue,
    _scan_aider,
]


def scan_project(project_path: str) -> list[dict[str, Any]]:
    """Scan *project_path* for all known agent artifact formats.

    Returns a list of ImportableArtifact dicts. Empty list if path doesn't
    exist or no recognisable artifacts are found.
    """
    root = Path(project_path).expanduser()
    if not root.is_dir():
        return []

    results: list[dict] = []
    for scanner in _SCANNERS:
        try:
            results.extend(scanner(root))
        except Exception:
            pass  # never crash the scan if one agent format fails

    return results


def commit_artifacts(
    items: list[dict[str, Any]],
    scope: str = "global",
    project_name: str | None = None,
) -> dict[str, Any]:
    """Save *items* into the skill / workflow registries.

    Returns {"imported": int, "errors": list[str]}.
    """
    import skill_registry
    import workflow_registry

    imported = 0
    errors: list[str] = []

    for item in items:
        try:
            artifact_type = item.get("type", "skill")
            name = (item.get("name") or "Unnamed").strip()
            desc = item.get("description")
            content = item.get("content") or ""
            steps = item.get("steps") or []

            if artifact_type == "skill":
                from models import Skill

                skill = Skill(
                    id=None,
                    name=name,
                    description=desc,
                    content=content,
                    scope=scope,
                    project_name=project_name,
                )
                skill_registry.add_skill(skill, scope, project_name)
            elif artifact_type == "workflow":
                from models import Workflow

                wf = Workflow(
                    id=None,
                    name=name,
                    description=desc,
                    steps=steps,
                    scope=scope,
                    project_name=project_name,
                )
                workflow_registry.add_workflow(wf, scope, project_name)
            else:
                errors.append(f"Unknown type '{artifact_type}' for '{name}'")
                continue

            imported += 1
        except Exception as exc:
            errors.append(f"{item.get('name', '?')}: {exc}")

    return {"imported": imported, "errors": errors}
