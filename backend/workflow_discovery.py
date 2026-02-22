"""Workflow discovery and write-back for all supported AI code agents.

OpenCode and Continue have native workflow/slash-command concepts.
All other agents store workflows as a delimited text block embedded in
their custom-instructions / system-prompt field (same delimiter pattern
as skill_discovery, but with ``OPENSYNC_WORKFLOW`` tags).

Public API mirrors ``llm_provider_discovery``:

  * ``list_workflow_targets()``      – metadata about every writable target
  * ``discover_all_workflows()``     – read workflows from every agent config
  * ``write_workflow_to_target()``   – push one Workflow into a specific agent
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from models import Workflow

# ---------------------------------------------------------------------------
# Optional YAML support
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

# Delimiters for agents that embed workflows in their text instruction fields
_WF_START = "<!-- OPENSYNC_WORKFLOW:{name} -->"
_WF_END = "<!-- /OPENSYNC_WORKFLOW:{name} -->"


# ---------------------------------------------------------------------------
# Workflow targets metadata
# ---------------------------------------------------------------------------
WORKFLOW_TARGETS: list[dict[str, str]] = [
    {
        "id": "opencode_global",
        "display_name": "OpenCode (global)",
        "config_path": "~/.config/opencode/opencode.json",
        "scope": "global",
        "color": "#FF6B6B",
        "native": "true",
    },
    {
        "id": "continue",
        "display_name": "Continue",
        "config_path": "~/.continue/config.yaml",
        "scope": "global",
        "color": "#4ECDC4",
        "native": "true",
    },
    {
        "id": "aider",
        "display_name": "Aider",
        "config_path": "~/.aider.conf.yml",
        "scope": "global",
        "color": "#45B7D1",
        "native": "false",
    },
    {
        "id": "claude_code",
        "display_name": "Claude Code",
        "config_path": "~/.claude.json",
        "scope": "global",
        "color": "#E67E22",
        "native": "false",
    },
    {
        "id": "roo_cline",
        "display_name": "Roo Code / Cline",
        "config_path": "~/Library/Application Support/Code/User/settings.json",
        "scope": "global",
        "color": "#9B59B6",
        "native": "false",
    },
    {
        "id": "windsurf",
        "display_name": "Windsurf",
        "config_path": "~/.windsurfrules",
        "scope": "global",
        "color": "#1ABC9C",
        "native": "false",
    },
    {
        "id": "plandex",
        "display_name": "Plandex",
        "config_path": "~/.plandex-home/",
        "scope": "global",
        "color": "#F39C12",
        "native": "false",
    },
    {
        "id": "gemini_cli",
        "display_name": "Gemini CLI",
        "config_path": "~/.gemini/settings.json",
        "scope": "global",
        "color": "#3498DB",
        "native": "false",
    },
    {
        "id": "amp",
        "display_name": "Amp (Sourcegraph)",
        "config_path": "~/.amp/settings.json",
        "scope": "global",
        "color": "#E74C3C",
        "native": "false",
    },
    {
        "id": "cursor_global",
        "display_name": "Cursor (global rules)",
        "config_path": "~/.cursor/rules/",
        "scope": "global",
        "color": "#95A5A6",
        "native": "false",
    },
    {
        "id": "opencode_project",
        "display_name": "OpenCode (project)",
        "config_path": "<project>/opencode.json",
        "scope": "project",
        "color": "#FF6B6B",
        "native": "true",
    },
    {
        "id": "cursor_project",
        "display_name": "Cursor (project rules)",
        "config_path": "<project>/.cursor/rules/",
        "scope": "project",
        "color": "#95A5A6",
        "native": "false",
    },
    {
        "id": "continue_project",
        "display_name": "Continue (project)",
        "config_path": "<project>/.continue/config.yaml",
        "scope": "project",
        "color": "#4ECDC4",
        "native": "true",
    },
    {
        "id": "aider_project",
        "display_name": "Aider (project)",
        "config_path": "<project>/.aider.conf.yml",
        "scope": "project",
        "color": "#45B7D1",
        "native": "false",
    },
    {
        "id": "claude_code_project",
        "display_name": "Claude Code (project)",
        "config_path": "<project>/.claude/settings.json",
        "scope": "project",
        "color": "#E67E22",
        "native": "false",
    },
    {
        "id": "roo_cline_project",
        "display_name": "Roo Code / Cline (project)",
        "config_path": "<project>/.vscode/settings.json",
        "scope": "project",
        "color": "#9B59B6",
        "native": "false",
    },
    {
        "id": "windsurf_project",
        "display_name": "Windsurf (project)",
        "config_path": "<project>/.windsurfrules",
        "scope": "project",
        "color": "#1ABC9C",
        "native": "false",
    },
    {
        "id": "plandex_project",
        "display_name": "Plandex (project)",
        "config_path": "<project>/.plandex/",
        "scope": "project",
        "color": "#F39C12",
        "native": "false",
    },
    {
        "id": "amp_project",
        "display_name": "Amp (project)",
        "config_path": "<project>/.amp/settings.json",
        "scope": "project",
        "color": "#E74C3C",
        "native": "false",
    },
    {
        "id": "gemini_cli_project",
        "display_name": "Gemini CLI (project)",
        "config_path": "<project>/.gemini/settings.json",
        "scope": "project",
        "color": "#3498DB",
        "native": "false",
    },
    {
        "id": "antigravity_global",
        "display_name": "Antigravity (global)",
        "config_path": "~/.agent/workflows/",
        "scope": "global",
        "color": "#6C3483",
        "native": "false",
    },
    {
        "id": "antigravity_project",
        "display_name": "Antigravity (project)",
        "config_path": "<project>/.agent/workflows/",
        "scope": "project",
        "color": "#6C3483",
        "native": "false",
    },
]


def list_workflow_targets() -> list[dict[str, str]]:
    return sorted(WORKFLOW_TARGETS, key=lambda t: t["display_name"].lower())


# ---------------------------------------------------------------------------
# JSON / YAML / text helpers
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
# Workflow → formatted text block helpers
# ---------------------------------------------------------------------------


def _workflow_to_text(workflow: Workflow) -> str:
    """Render a Workflow as a readable text block for embedding."""
    lines = [f"# Workflow: {workflow.name}"]
    if workflow.description:
        lines.append(workflow.description)
    if workflow.content:
        lines.append("")
        lines.append(workflow.content)
    return "\n".join(lines)


def _inject_workflow_block(existing: str, workflow: Workflow) -> str:
    start_tag = _WF_START.format(name=workflow.name)
    end_tag = _WF_END.format(name=workflow.name)
    content_text = _workflow_to_text(workflow)

    if start_tag in existing:
        before = existing[: existing.index(start_tag)]
        after_end = existing.index(end_tag) + len(end_tag)
        after = existing[after_end:]
        return f"{before}{start_tag}\n{content_text}\n{end_tag}{after}"

    sep = "\n\n" if existing.strip() else ""
    return f"{existing}{sep}{start_tag}\n{content_text}\n{end_tag}\n"


def _extract_workflow_blocks(text: str) -> list[Workflow]:
    """Parse all workflows embedded as delimited blocks in a plain-text string."""
    pattern = re.compile(
        r"<!-- OPENSYNC_WORKFLOW:(.+?) -->\n(.*?)\n<!-- /OPENSYNC_WORKFLOW:\1 -->",
        re.DOTALL,
    )
    workflows = []
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        content = m.group(2).strip()
        # Parse numbered steps from embedded text
        steps = []
        for line in content.splitlines():
            line = line.strip()
            step_match = re.match(r"^\d+\.\s+(.+)$", line)
            if step_match:
                steps.append(step_match.group(1))
        if not steps:
            steps = [content]
        # Extract description (second line after # header)
        desc = ""
        content_lines = content.splitlines()
        if len(content_lines) > 1 and not content_lines[1].startswith("#"):
            desc = content_lines[1].strip()
        workflows.append(
            Workflow(
                name=name,
                description=desc,
                content=content,
                sources=["workflow_discovery"],
            )
        )
    return workflows


# ---------------------------------------------------------------------------
# OpenCode  (native — uses scripts/keybinds section)
# ---------------------------------------------------------------------------


def _discover_opencode_global(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _OPENCODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    scripts: dict[str, Any] = data.get("scripts", {})
    if not isinstance(scripts, dict):
        return []
    results = []
    for name, val in scripts.items():
        if isinstance(val, dict):
            desc = val.get("description", "")
            wf_content = val.get("command") or val.get("run") or ""
        elif isinstance(val, str):
            desc = ""
            wf_content = val
        else:
            continue
        results.append(
            Workflow(
                name=name,
                description=desc,
                content=wf_content,
                sources=["opencode_global"],
            )
        )
    return results


def _write_workflow_to_opencode(
    workflow: Workflow,
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
        if "scripts" not in data or not isinstance(data["scripts"], dict):
            data["scripts"] = {}
        entry: dict[str, Any] = {"command": workflow.content or ""}
        if workflow.description:
            entry["description"] = workflow.description
        data["scripts"][workflow.name] = entry
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to OpenCode scripts as '{workflow.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to OpenCode: {exc}"}


# ---------------------------------------------------------------------------
# Continue  (native — slashCommands[])
# ---------------------------------------------------------------------------


def _discover_continue(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    data = _read_yaml(path)
    if not data:
        return []
    results = []
    for cmd in data.get("slashCommands", []):
        if not isinstance(cmd, dict):
            continue
        name = cmd.get("name") or cmd.get("command", "")
        desc = cmd.get("description", "")
        steps = cmd.get("steps") or []
        if not steps:
            prompt = cmd.get("prompt") or cmd.get("run") or cmd.get("action") or ""
            steps = [prompt] if prompt else []
        if name:
            results.append(
                Workflow(
                    name=name,
                    description=desc,
                    steps=steps,
                    sources=["continue"],
                )
            )
    return results


def _write_workflow_to_continue(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(path)
        cmds: list = data.get("slashCommands") or []
        # Update or append
        found = False
        for i, cmd in enumerate(cmds):
            if isinstance(cmd, dict) and (
                cmd.get("name") == workflow.name or cmd.get("command") == workflow.name
            ):
                cmds[i] = {
                    "name": workflow.name,
                    "description": workflow.description or "",
                    "steps": workflow.steps or [],
                }
                found = True
                break
        if not found:
            cmds.append(
                {
                    "name": workflow.name,
                    "description": workflow.description or "",
                    "steps": workflow.steps or [],
                }
            )
        data["slashCommands"] = cmds
        _write_yaml(path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' written to Continue slashCommands",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Continue: {exc}"}


# ---------------------------------------------------------------------------
# Aider  (embedded block in read-file)
# ---------------------------------------------------------------------------


def _discover_aider(config_path: Path | None = None) -> list[Workflow]:
    cfg_path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    data = _read_yaml(cfg_path)
    if not data:
        return []
    read_files: list = data.get("read", []) or []
    if isinstance(read_files, str):
        read_files = [read_files]
    results = []
    for fpath in read_files:
        text = _read_text(Path(fpath).expanduser())
        results.extend(_extract_workflow_blocks(text))
    return results


def _write_workflow_to_aider(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    cfg_path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(cfg_path)
        wf_dir = Path("~/.aider-workflows").expanduser()
        wf_file = wf_dir / f"{workflow.name}.md"
        wf_dir.mkdir(parents=True, exist_ok=True)
        existing = _read_text(wf_file)
        _write_text(wf_file, _inject_workflow_block(existing, workflow))
        read_list: list = data.get("read", []) or []
        if isinstance(read_list, str):
            read_list = [read_list]
        if str(wf_file) not in read_list:
            read_list.append(str(wf_file))
        data["read"] = read_list
        _write_yaml(cfg_path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' written to {wf_file} and registered in Aider",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Aider: {exc}",
        }


# ---------------------------------------------------------------------------
# Claude Code  (embedded block in instructions)
# ---------------------------------------------------------------------------


def _discover_claude_code(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    workflows_raw: dict = data.get("workflows", {})
    if isinstance(workflows_raw, dict):
        results = []
        for name, val in workflows_raw.items():
            wf_content = (
                val.get("content") or "\n".join(val.get("steps", []))
                if isinstance(val, dict)
                else ""
            )
            desc = val.get("description", "") if isinstance(val, dict) else ""
            results.append(
                Workflow(
                    name=name,
                    description=desc,
                    content=wf_content,
                    sources=["claude_code"],
                )
            )
        if results:
            return results
    # Fallback: embedded blocks in systemPrompt
    prompt = data.get("systemPrompt", "")
    return _extract_workflow_blocks(prompt)


def _write_workflow_to_claude_code(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "workflows" not in data or not isinstance(data["workflows"], dict):
            data["workflows"] = {}
        data["workflows"][workflow.name] = {
            "description": workflow.description or "",
            "content": workflow.content or "",
        }
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' written to Claude Code",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Claude Code: {exc}",
        }


# ---------------------------------------------------------------------------
# Roo / Cline  (embedded as delimiter block in customInstructions)
# ---------------------------------------------------------------------------


def _discover_roo_cline(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    data = _read_json(path)
    for prefix in ("cline", "roo-cline"):
        text = data.get(f"{prefix}.customInstructions", "")
        if text:
            wfs = _extract_workflow_blocks(text)
            for w in wfs:
                w.sources = ["roo_cline"]
            return wfs
    return []


def _write_workflow_to_roo_cline(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("cline.customInstructions", "")
        data["cline.customInstructions"] = _inject_workflow_block(existing, workflow)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' embedded in Roo/Cline customInstructions",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Roo/Cline: {exc}",
        }


# ---------------------------------------------------------------------------
# Windsurf  (embedded block in .windsurfrules)
# ---------------------------------------------------------------------------


def _discover_windsurf(rules_path: Path | None = None) -> list[Workflow]:
    path = (rules_path or _WINDSURF_RULES_PATH).expanduser()
    text = _read_text(path)
    wfs = _extract_workflow_blocks(text)
    for w in wfs:
        w.sources = ["windsurf"]
    return wfs


def _write_workflow_to_windsurf(
    workflow: Workflow, rules_path: Path | None = None
) -> dict[str, Any]:
    path = (rules_path or _WINDSURF_RULES_PATH).expanduser()
    try:
        existing = _read_text(path)
        _write_text(path, _inject_workflow_block(existing, workflow))
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' embedded in {path.name}",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Windsurf: {exc}",
        }


# ---------------------------------------------------------------------------
# Plandex  (embedded block in systemPrompt field)
# ---------------------------------------------------------------------------


def _discover_plandex(home_path: Path | None = None) -> list[Workflow]:
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    if not home.is_dir():
        return []
    results = []
    for json_file in home.glob("*.json"):
        data = _read_json(json_file)
        prompt = data.get("systemPrompt", "")
        wfs = _extract_workflow_blocks(prompt)
        for w in wfs:
            w.sources = ["plandex"]
        results.extend(wfs)
    return results


def _write_workflow_to_plandex(
    workflow: Workflow, home_path: Path | None = None
) -> dict[str, Any]:
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    try:
        home.mkdir(parents=True, exist_ok=True)
        file_path = home / f"{workflow.name}.json"
        data = _read_json(file_path)
        existing = data.get("systemPrompt", "")
        data["systemPrompt"] = _inject_workflow_block(existing, workflow)
        if workflow.description:
            data["description"] = workflow.description
        _write_json(file_path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' written to Plandex",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Plandex: {exc}",
        }


# ---------------------------------------------------------------------------
# Gemini CLI  (embedded block in systemPrompt)
# ---------------------------------------------------------------------------


def _discover_gemini_cli(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _GEMINI_CONFIG_PATH).expanduser()
    data = _read_json(path)
    prompt = data.get("systemPrompt", "")
    wfs = _extract_workflow_blocks(prompt)
    for w in wfs:
        w.sources = ["gemini_cli"]
    return wfs


def _write_workflow_to_gemini_cli(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _GEMINI_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("systemPrompt", "")
        data["systemPrompt"] = _inject_workflow_block(existing, workflow)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' embedded in Gemini CLI systemPrompt",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Gemini CLI: {exc}",
        }


# ---------------------------------------------------------------------------
# Amp  (embedded block in instructions)
# ---------------------------------------------------------------------------


def _discover_amp(config_path: Path | None = None) -> list[Workflow]:
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    data = _read_json(path)
    instructions = data.get("instructions", "")
    if not isinstance(instructions, str):
        return []
    wfs = _extract_workflow_blocks(instructions)
    for w in wfs:
        w.sources = ["amp"]
    return wfs


def _write_workflow_to_amp(
    workflow: Workflow, config_path: Path | None = None
) -> dict[str, Any]:
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        existing = data.get("instructions", "")
        data["instructions"] = _inject_workflow_block(existing, workflow)
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' embedded in Amp instructions",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write workflow to Amp: {exc}"}


# ---------------------------------------------------------------------------
# Cursor  (.mdc rule files — one file per workflow)
# ---------------------------------------------------------------------------


def _discover_cursor(rules_dir: Path | None = None) -> list[Workflow]:
    base = (rules_dir or _CURSOR_GLOBAL_RULES).expanduser()
    if not base.is_dir():
        return []
    results = []
    for f in base.glob("*.mdc"):
        text = _read_text(f)
        wfs = _extract_workflow_blocks(text)
        if wfs:
            for w in wfs:
                w.sources = ["cursor_global"]
            results.extend(wfs)
        else:
            if text:
                results.append(
                    Workflow(
                        name=f.stem,
                        content=text.strip(),
                        sources=["cursor_global"],
                    )
                )
    return results


def _write_workflow_to_cursor(
    workflow: Workflow,
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
        rule_file = base / f"{workflow.name}.mdc"
        existing = _read_text(rule_file)
        _write_text(rule_file, _inject_workflow_block(existing, workflow))
        return {
            "success": True,
            "message": f"Workflow '{workflow.name}' written to Cursor rule {rule_file.name}",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write workflow to Cursor: {exc}",
        }


# ---------------------------------------------------------------------------
# Antigravity  (.agent/workflows/*.md)
# ---------------------------------------------------------------------------


def _write_workflow_to_antigravity(
    workflow: Workflow,
    workflows_dir: Path | None = None,
    project_path: str | None = None,
    target_id: str = "antigravity_global",
) -> dict[str, Any]:
    """Write workflow as a .md file into the Antigravity .agent/workflows/ directory."""
    if target_id == "antigravity_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for antigravity_project target",
            }
        base = Path(project_path).expanduser() / ".agent" / "workflows"
    else:
        base = (workflows_dir or Path("~/.agent/workflows")).expanduser()
    try:
        base.mkdir(parents=True, exist_ok=True)
        slug = workflow.name.lower().replace(" ", "-").replace("/", "-")
        wf_file = base / f"{slug}.md"
        content = (
            f"---\nname: {workflow.name}\ndescription: {workflow.description or ''}\n---\n\n"
            f"# {workflow.name}\n\n{workflow.description or ''}\n\n{workflow.content or ''}"
        ).strip()
        _write_text(wf_file, content)
        return {
            "success": True,
            "message": f"Antigravity workflow written to {wf_file}",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write Antigravity workflow: {exc}",
        }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def discover_all_workflows() -> list[Workflow]:
    """Discover workflows from every supported agent config."""
    workflows: list[Workflow] = []
    workflows.extend(_discover_opencode_global())
    workflows.extend(_discover_continue())
    workflows.extend(_discover_aider())
    workflows.extend(_discover_claude_code())
    workflows.extend(_discover_roo_cline())
    workflows.extend(_discover_windsurf())
    workflows.extend(_discover_plandex())
    workflows.extend(_discover_gemini_cli())
    workflows.extend(_discover_amp())
    workflows.extend(_discover_cursor())
    return workflows


def write_workflow_to_target(
    workflow: Workflow, target_id: str, project_path: str | None = None
) -> dict[str, Any]:
    """Write *workflow* into the config for the given agent *target_id*."""
    if target_id == "opencode_global":
        return _write_workflow_to_opencode(workflow, target_id="opencode_global")
    if target_id == "opencode_project":
        return _write_workflow_to_opencode(
            workflow, project_path=project_path, target_id="opencode_project"
        )
    if target_id == "continue":
        return _write_workflow_to_continue(workflow)
    if target_id == "continue_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for continue_project target",
            }
        return _write_workflow_to_continue(
            workflow, config_path=Path(project_path) / ".continue" / "config.yaml"
        )
    if target_id == "aider_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for aider_project target",
            }
        return _write_workflow_to_aider(
            workflow, config_path=Path(project_path) / ".aider.conf.yml"
        )
    if target_id == "claude_code_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for claude_code_project target",
            }
        return _write_workflow_to_claude_code(
            workflow, config_path=Path(project_path) / ".claude" / "settings.json"
        )
    if target_id == "roo_cline_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for roo_cline_project target",
            }
        return _write_workflow_to_roo_cline(
            workflow, config_path=Path(project_path) / ".vscode" / "settings.json"
        )
    if target_id == "windsurf_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for windsurf_project target",
            }
        return _write_workflow_to_windsurf(
            workflow, rules_path=Path(project_path) / ".windsurfrules"
        )
    if target_id == "gemini_cli_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for gemini_cli_project target",
            }
        return _write_workflow_to_gemini_cli(
            workflow, config_path=Path(project_path) / ".gemini" / "settings.json"
        )
    if target_id == "aider":
        return _write_workflow_to_aider(workflow)
    if target_id == "claude_code":
        return _write_workflow_to_claude_code(workflow)
    if target_id == "roo_cline":
        return _write_workflow_to_roo_cline(workflow)
    if target_id == "windsurf":
        return _write_workflow_to_windsurf(workflow)
    if target_id == "plandex":
        return _write_workflow_to_plandex(workflow)
    if target_id == "plandex_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for plandex_project target",
            }
        return _write_workflow_to_plandex(
            workflow, home_path=Path(project_path) / ".plandex"
        )
    if target_id == "amp":
        return _write_workflow_to_amp(workflow)
    if target_id == "amp_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for amp_project target",
            }
        return _write_workflow_to_amp(
            workflow, config_path=Path(project_path) / ".amp" / "settings.json"
        )
    if target_id == "gemini_cli":
        return _write_workflow_to_gemini_cli(workflow)
    # (amp global handled above)
    if target_id == "cursor_global":
        return _write_workflow_to_cursor(workflow, target_id="cursor_global")
    if target_id == "cursor_project":
        return _write_workflow_to_cursor(
            workflow, project_path=project_path, target_id="cursor_project"
        )
    if target_id == "antigravity_global":
        return _write_workflow_to_antigravity(workflow, target_id="antigravity_global")
    if target_id == "antigravity_project":
        return _write_workflow_to_antigravity(
            workflow, project_path=project_path, target_id="antigravity_project"
        )
    return {"success": False, "message": f"Unknown workflow target: '{target_id}'"}
