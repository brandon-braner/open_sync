"""Skill discovery and write-back for all supported AI code agents.

Each agent that exposes a concept of "system prompt", "custom instructions",
or named rule files is supported here.  The public API mirrors
``llm_provider_discovery``:

  * ``list_skill_targets()``        – metadata about every writable target
  * ``discover_all_skills()``       – read skills from every agent config
  * ``write_skill_to_target()``     – push one Skill into a specific agent
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from models import Skill

# ---------------------------------------------------------------------------
# Optional YAML support (PyYAML)
# ---------------------------------------------------------------------------
try:
    import yaml  # type: ignore

    _YAML_OK = True
except ImportError:  # pragma: no cover
    _YAML_OK = False


# ---------------------------------------------------------------------------
# Config paths
# ---------------------------------------------------------------------------
_OPENCODE_CONFIG_PATH = Path("~/.config/opencode/opencode.json")
_CONTINUE_CONFIG_PATH = Path("~/.continue/config.yaml")
_AIDER_CONFIG_PATH = Path("~/.aider.conf.yml")
_CLAUDE_CODE_CONFIG_PATH = Path("~/.claude.json")
_VSCODE_SETTINGS_PATH = Path("~/Library/Application Support/Code/User/settings.json")
_WINDSURF_RULES_PATH = Path("~/.windsurfrules")
_PLANDEX_HOME_PATH = Path("~/.plandex-home")
_GEMINI_CONFIG_PATH = Path("~/.gemini/settings.json")
_AMP_CONFIG_PATH = Path("~/.amp/settings.json")
_CURSOR_GLOBAL_RULES = Path("~/.cursor/rules")

# Delimiter used when embedding a skill inside a plain-text instructions field
_SKILL_START = "<!-- OPENSYNC_SKILL:{name} -->"
_SKILL_END = "<!-- /OPENSYNC_SKILL:{name} -->"


# ---------------------------------------------------------------------------
# Skill targets metadata
# ---------------------------------------------------------------------------
SKILL_TARGETS: list[dict[str, str]] = [
    {
        "id": "opencode_global",
        "display_name": "OpenCode (global)",
        "config_path": "~/.config/opencode/opencode.json",
        "scope": "global",
        "color": "#FF6B6B",
    },
    {
        "id": "continue",
        "display_name": "Continue",
        "config_path": "~/.continue/config.yaml",
        "scope": "global",
        "color": "#4ECDC4",
    },
    {
        "id": "aider",
        "display_name": "Aider",
        "config_path": "~/.aider.conf.yml",
        "scope": "global",
        "color": "#45B7D1",
    },
    {
        "id": "claude_code",
        "display_name": "Claude Code",
        "config_path": "~/.claude.json",
        "scope": "global",
        "color": "#E67E22",
    },
    {
        "id": "roo_cline",
        "display_name": "Roo Code / Cline",
        "config_path": "~/Library/Application Support/Code/User/settings.json",
        "scope": "global",
        "color": "#9B59B6",
    },
    {
        "id": "windsurf",
        "display_name": "Windsurf",
        "config_path": "~/.windsurfrules",
        "scope": "global",
        "color": "#1ABC9C",
    },
    {
        "id": "plandex",
        "display_name": "Plandex",
        "config_path": "~/.plandex-home/",
        "scope": "global",
        "color": "#F39C12",
    },
    {
        "id": "gemini_cli",
        "display_name": "Gemini CLI",
        "config_path": "~/.gemini/settings.json",
        "scope": "global",
        "color": "#3498DB",
    },
    {
        "id": "amp",
        "display_name": "Amp (Sourcegraph)",
        "config_path": "~/.amp/settings.json",
        "scope": "global",
        "color": "#E74C3C",
    },
    {
        "id": "cursor_global",
        "display_name": "Cursor (global rules)",
        "config_path": "~/.cursor/rules/",
        "scope": "global",
        "color": "#95A5A6",
    },
    {
        "id": "opencode_project",
        "display_name": "OpenCode (project)",
        "config_path": "<project>/opencode.json",
        "scope": "project",
        "color": "#FF6B6B",
    },
    {
        "id": "cursor_project",
        "display_name": "Cursor (project rules)",
        "config_path": "<project>/.cursor/rules/",
        "scope": "project",
        "color": "#95A5A6",
    },
]


def list_skill_targets() -> list[dict[str, str]]:
    return SKILL_TARGETS


# ---------------------------------------------------------------------------
# JSON / YAML helpers (same as llm_provider_discovery)
# ---------------------------------------------------------------------------


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def _read_yaml(path: Path) -> dict[str, Any]:
    if not _YAML_OK or not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except Exception:
        return {}


def _write_yaml(path: Path, data: dict[str, Any]) -> None:
    if not _YAML_OK:
        raise RuntimeError("PyYAML is not installed; cannot write YAML file")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False)


def _read_text(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Delimiter helpers for plain-text injection
# ---------------------------------------------------------------------------


def _inject_skill_block(existing: str, skill: Skill) -> str:
    """Insert or replace a delimited skill block inside a plain-text string."""
    start_tag = _SKILL_START.format(name=skill.name)
    end_tag = _SKILL_END.format(name=skill.name)

    # If already present, replace
    if start_tag in existing:
        before = existing[: existing.index(start_tag)]
        after_end = existing.index(end_tag) + len(end_tag)
        after = existing[after_end:]
        return f"{before}{start_tag}\n{skill.content}\n{end_tag}{after}"

    # Append new block
    sep = "\n\n" if existing.strip() else ""
    return f"{existing}{sep}{start_tag}\n{skill.content}\n{end_tag}\n"


def _extract_skill_blocks(text: str) -> list[Skill]:
    """Parse all skills embedded as delimited blocks in a plain-text string."""
    import re

    pattern = re.compile(
        r"<!-- OPENSYNC_SKILL:(.+?) -->\n(.*?)\n<!-- /OPENSYNC_SKILL:\1 -->",
        re.DOTALL,
    )
    skills = []
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        content = m.group(2).strip()
        skills.append(Skill(name=name, content=content, sources=["skill_discovery"]))
    return skills


# ---------------------------------------------------------------------------
# OpenCode (global)
# ---------------------------------------------------------------------------


def _discover_opencode_global(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _OPENCODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    instructions: dict[str, Any] = data.get("instructions", {})
    if not isinstance(instructions, dict):
        return []
    result = []
    for name, val in instructions.items():
        content = val.get("content", "") if isinstance(val, dict) else str(val)
        if not content:
            continue
        result.append(
            Skill(
                name=name,
                content=content,
                description=val.get("description", "") if isinstance(val, dict) else "",
                sources=["opencode_global"],
            )
        )
    return result


def _write_skill_to_opencode(
    skill: Skill,
    config_path: Path | None = None,
    project_path: str | None = None,
    target_id: str = "opencode_global",
) -> dict[str, Any]:
    if target_id == "opencode_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for opencode_project target",
            }
        path = Path(project_path).expanduser() / "opencode.json"
    else:
        path = (config_path or _OPENCODE_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "instructions" not in data or not isinstance(data["instructions"], dict):
            data["instructions"] = {}
        entry: dict[str, Any] = {"content": skill.content}
        if skill.description:
            entry["description"] = skill.description
        data["instructions"][skill.name] = entry
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to OpenCode instructions as '{skill.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to OpenCode: {exc}"}


# ---------------------------------------------------------------------------
# Continue
# ---------------------------------------------------------------------------


def _discover_continue(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    data = _read_yaml(path)
    if not data:
        return []
    results = []

    # systemMessage → single global skill
    sys_msg = data.get("systemMessage", "")
    if sys_msg and isinstance(sys_msg, str):
        # Check if it contains skill blocks
        blocks = _extract_skill_blocks(sys_msg)
        if blocks:
            results.extend(blocks)
        else:
            results.append(
                Skill(
                    name="systemMessage",
                    content=sys_msg,
                    description="Continue system message",
                    sources=["continue"],
                )
            )

    # rules[] → individual skills
    for rule in data.get("rules", []):
        if isinstance(rule, str):
            results.append(Skill(name=rule[:40], content=rule, sources=["continue"]))
        elif isinstance(rule, dict):
            name = rule.get("name", rule.get("rule", "")[:40])
            content = rule.get("rule", rule.get("content", ""))
            if content:
                results.append(Skill(name=name, content=content, sources=["continue"]))

    return results


def _write_skill_to_continue(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(path)

        # Inject into systemMessage using delimiter blocks
        existing_msg = data.get("systemMessage", "")
        data["systemMessage"] = _inject_skill_block(existing_msg, skill)

        _write_yaml(path, data)
        return {
            "success": True,
            "message": f"Written to Continue systemMessage as '{skill.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Continue: {exc}"}


# ---------------------------------------------------------------------------
# Aider
# ---------------------------------------------------------------------------


def _discover_aider(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    data = _read_yaml(path)
    if not data:
        return []

    read_files: list[str] = data.get("read", []) or []
    if isinstance(read_files, str):
        read_files = [read_files]

    results = []
    for fpath in read_files:
        fp = Path(fpath).expanduser()
        content = _read_text(fp)
        if not content:
            continue
        blocks = _extract_skill_blocks(content)
        if blocks:
            results.extend(blocks)
        else:
            results.append(
                Skill(
                    name=fp.stem,
                    content=content,
                    description=f"Aider read-file: {fpath}",
                    sources=["aider"],
                )
            )
    return results


def _write_skill_to_aider(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(path)

        # Write skill content to ~/.aider-skills/<name>.md and register in read[]
        skill_dir = Path("~/.aider-skills").expanduser()
        skill_file = skill_dir / f"{skill.name}.md"
        skill_dir.mkdir(parents=True, exist_ok=True)
        _write_text(skill_file, skill.content)

        read_list: list = data.get("read", []) or []
        if isinstance(read_list, str):
            read_list = [read_list]
        skill_path_str = str(skill_file)
        if skill_path_str not in read_list:
            read_list.append(skill_path_str)
        data["read"] = read_list
        _write_yaml(path, data)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' written to {skill_file} and registered in Aider config",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Aider: {exc}"}


# ---------------------------------------------------------------------------
# Claude Code
# ---------------------------------------------------------------------------


def _discover_claude_code(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []
    results = []

    # instructions dict
    instructions = data.get("instructions", {})
    if isinstance(instructions, dict):
        for name, val in instructions.items():
            content = val.get("content", "") if isinstance(val, dict) else str(val)
            if content:
                results.append(
                    Skill(name=name, content=content, sources=["claude_code"])
                )

    # top-level systemPrompt
    sys_prompt = data.get("systemPrompt", "")
    if sys_prompt and not results:
        blocks = _extract_skill_blocks(sys_prompt)
        if blocks:
            results.extend(blocks)
        else:
            results.append(
                Skill(
                    name="systemPrompt",
                    content=sys_prompt,
                    sources=["claude_code"],
                )
            )
    return results


def _write_skill_to_claude_code(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "instructions" not in data or not isinstance(data["instructions"], dict):
            data["instructions"] = {}
        data["instructions"][skill.name] = {"content": skill.content}
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to Claude Code instructions as '{skill.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Claude Code: {exc}"}


# ---------------------------------------------------------------------------
# Roo Code / Cline
# ---------------------------------------------------------------------------


def _discover_roo_cline(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []
    results = []
    for prefix in ("cline", "roo-cline"):
        text = data.get(f"{prefix}.customInstructions", "")
        if text and isinstance(text, str):
            blocks = _extract_skill_blocks(text)
            if blocks:
                for b in blocks:
                    b.sources = ["roo_cline"]
                results.extend(blocks)
            else:
                results.append(
                    Skill(
                        name=f"{prefix}.customInstructions",
                        content=text,
                        description=f"{prefix} custom instructions",
                        sources=["roo_cline"],
                    )
                )
            break  # avoid duplicating when both prefixes exist
    return results


def _write_skill_to_roo_cline(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("cline.customInstructions", "")
        data["cline.customInstructions"] = _inject_skill_block(existing, skill)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' injected into Roo/Cline customInstructions",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Roo/Cline: {exc}"}


# ---------------------------------------------------------------------------
# Windsurf
# ---------------------------------------------------------------------------


def _discover_windsurf(rules_path: Path | None = None) -> list[Skill]:
    path = (rules_path or _WINDSURF_RULES_PATH).expanduser()
    text = _read_text(path)
    if not text:
        return []
    blocks = _extract_skill_blocks(text)
    if blocks:
        for b in blocks:
            b.sources = ["windsurf"]
        return blocks
    # Treat entire file as one skill
    return [
        Skill(
            name=".windsurfrules",
            content=text,
            description="Windsurf global rules",
            sources=["windsurf"],
        )
    ]


def _write_skill_to_windsurf(
    skill: Skill, rules_path: Path | None = None
) -> dict[str, Any]:
    path = (rules_path or _WINDSURF_RULES_PATH).expanduser()
    try:
        existing = _read_text(path)
        updated = _inject_skill_block(existing, skill)
        _write_text(path, updated)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' written to {path.name}",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Windsurf: {exc}"}


# ---------------------------------------------------------------------------
# Plandex
# ---------------------------------------------------------------------------


def _discover_plandex(home_path: Path | None = None) -> list[Skill]:
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    if not home.is_dir():
        return []
    results = []
    for json_file in home.glob("*.json"):
        data = _read_json(json_file)
        prompt = data.get("systemPrompt") or data.get("instructions")
        if prompt and isinstance(prompt, str):
            blocks = _extract_skill_blocks(prompt)
            if blocks:
                for b in blocks:
                    b.sources = ["plandex"]
                results.extend(blocks)
            else:
                results.append(
                    Skill(
                        name=json_file.stem,
                        content=prompt,
                        sources=["plandex"],
                    )
                )
    return results


def _write_skill_to_plandex(
    skill: Skill, home_path: Path | None = None
) -> dict[str, Any]:
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    try:
        home.mkdir(parents=True, exist_ok=True)
        file_path = home / f"{skill.name}.json"
        data = _read_json(file_path)
        data["systemPrompt"] = skill.content
        if skill.description:
            data["description"] = skill.description
        _write_json(file_path, data)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' written to Plandex as '{file_path.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Plandex: {exc}"}


# ---------------------------------------------------------------------------
# Gemini CLI
# ---------------------------------------------------------------------------


def _discover_gemini_cli(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _GEMINI_CONFIG_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []
    prompt = data.get("systemPrompt") or data.get("instructions")
    if not prompt or not isinstance(prompt, str):
        return []
    blocks = _extract_skill_blocks(prompt)
    if blocks:
        for b in blocks:
            b.sources = ["gemini_cli"]
        return blocks
    return [Skill(name="systemPrompt", content=prompt, sources=["gemini_cli"])]


def _write_skill_to_gemini_cli(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _GEMINI_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("systemPrompt", "")
        data["systemPrompt"] = _inject_skill_block(existing, skill)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' injected into Gemini CLI systemPrompt",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Gemini CLI: {exc}"}


# ---------------------------------------------------------------------------
# Amp (Sourcegraph)
# ---------------------------------------------------------------------------


def _discover_amp(config_path: Path | None = None) -> list[Skill]:
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []
    instructions = data.get("instructions")
    if not instructions or not isinstance(instructions, str):
        return []
    blocks = _extract_skill_blocks(instructions)
    if blocks:
        for b in blocks:
            b.sources = ["amp"]
        return blocks
    return [Skill(name="instructions", content=instructions, sources=["amp"])]


def _write_skill_to_amp(
    skill: Skill, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("instructions", "")
        data["instructions"] = _inject_skill_block(existing, skill)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Skill '{skill.name}' injected into Amp instructions",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Amp: {exc}"}


# ---------------------------------------------------------------------------
# Cursor – rule files  (.mdc / .md)
# ---------------------------------------------------------------------------


def _discover_cursor(rules_dir: Path | None = None) -> list[Skill]:
    base = (rules_dir or _CURSOR_GLOBAL_RULES).expanduser()
    if not base.is_dir():
        return []
    results = []
    for f in base.glob("*.mdc"):
        content = _read_text(f)
        if content:
            results.append(
                Skill(
                    name=f.stem,
                    content=content,
                    description=f"Cursor global rule: {f.name}",
                    sources=["cursor_global"],
                )
            )
    return results


def _write_skill_to_cursor(
    skill: Skill,
    rules_dir: Path | None = None,
    project_path: str | None = None,
    target_id: str = "cursor_global",
) -> dict[str, Any]:
    if target_id == "cursor_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for cursor_project target",
            }
        base = Path(project_path).expanduser() / ".cursor" / "rules"
    else:
        base = (rules_dir or _CURSOR_GLOBAL_RULES).expanduser()
    try:
        base.mkdir(parents=True, exist_ok=True)
        rule_file = base / f"{skill.name}.mdc"
        _write_text(rule_file, skill.content)
        return {"success": True, "message": f"Cursor rule written to {rule_file}"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write Cursor rule: {exc}"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def discover_all_skills() -> list[Skill]:
    """Discover skills from every supported agent config."""
    skills: list[Skill] = []
    skills.extend(_discover_opencode_global())
    skills.extend(_discover_continue())
    skills.extend(_discover_aider())
    skills.extend(_discover_claude_code())
    skills.extend(_discover_roo_cline())
    skills.extend(_discover_windsurf())
    skills.extend(_discover_plandex())
    skills.extend(_discover_gemini_cli())
    skills.extend(_discover_amp())
    skills.extend(_discover_cursor())
    return skills


def write_skill_to_target(
    skill: Skill, target_id: str, project_path: str | None = None
) -> dict[str, Any]:
    """Write *skill* into the config for the given agent *target_id*."""
    if target_id == "opencode_global":
        return _write_skill_to_opencode(skill, target_id="opencode_global")
    if target_id == "opencode_project":
        return _write_skill_to_opencode(
            skill, project_path=project_path, target_id="opencode_project"
        )
    if target_id == "continue":
        return _write_skill_to_continue(skill)
    if target_id == "aider":
        return _write_skill_to_aider(skill)
    if target_id == "claude_code":
        return _write_skill_to_claude_code(skill)
    if target_id == "roo_cline":
        return _write_skill_to_roo_cline(skill)
    if target_id == "windsurf":
        return _write_skill_to_windsurf(skill)
    if target_id == "plandex":
        return _write_skill_to_plandex(skill)
    if target_id == "gemini_cli":
        return _write_skill_to_gemini_cli(skill)
    if target_id == "amp":
        return _write_skill_to_amp(skill)
    if target_id == "cursor_global":
        return _write_skill_to_cursor(skill, target_id="cursor_global")
    if target_id == "cursor_project":
        return _write_skill_to_cursor(
            skill, project_path=project_path, target_id="cursor_project"
        )
    return {"success": False, "message": f"Unknown skill target: '{target_id}'"}
