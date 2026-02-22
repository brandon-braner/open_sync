"""Core config read / write / sync logic."""

from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    import yaml as _yaml

    _YAML_OK = True
except ImportError:
    _YAML_OK = False

from config_targets import (
    FormatType,
    Scope,
    TargetConfig,
    get_target,
    get_targets_by_scope,
)
from models import McpServer, SyncResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_json(path: str) -> dict[str, Any]:
    """Read a JSON file, returning {} if missing or empty."""
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, data: dict[str, Any]) -> None:
    """Write data as pretty-printed JSON, creating parent dirs if needed."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _read_yaml(path: str) -> dict[str, Any]:
    """Read a YAML file, returning {} if missing, empty, or PyYAML unavailable."""
    if not _YAML_OK:
        return {}
    p = Path(path)
    if not p.exists() or p.stat().st_size == 0:
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return _yaml.safe_load(f) or {}


def _write_yaml(path: str, data: dict[str, Any]) -> None:
    """Write data as YAML, creating parent dirs if needed."""
    if not _YAML_OK:
        raise RuntimeError("PyYAML is not installed; cannot write YAML config")
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        _yaml.dump(data, f, default_flow_style=False, allow_unicode=True)


def _read_config(path: str, is_yaml: bool) -> dict[str, Any]:
    """Read JSON or YAML depending on flag."""
    return _read_yaml(path) if is_yaml else _read_json(path)


def _write_config(path: str, data: dict[str, Any], is_yaml: bool) -> None:
    """Write JSON or YAML depending on flag."""
    if is_yaml:
        _write_yaml(path, data)
    else:
        _write_json(path, data)


# ---------------------------------------------------------------------------
# Format conversion
# ---------------------------------------------------------------------------


def _to_canonical(name: str, entry: dict[str, Any], target: TargetConfig) -> McpServer:
    """Convert a target-specific entry to the canonical McpServer model."""

    if target.format_type == FormatType.OPENCODE:
        # OpenCode: command is array, env key is "environment"
        cmd_list: list[str] = entry.get("command", [])
        command = cmd_list[0] if cmd_list else None
        args = cmd_list[1:] if len(cmd_list) > 1 else []
        return McpServer(
            name=name,
            command=command,
            args=args,
            env=entry.get("environment", {}),
            type=entry.get("type"),
            url=entry.get("url"),
            headers=entry.get("headers", {}),
            sources=[target.name],
        )

    # Standard / VS Code
    return McpServer(
        name=name,
        command=entry.get("command"),
        args=entry.get("args", []),
        env=entry.get("env", {}),
        type=entry.get("type"),
        url=entry.get("url"),
        headers=entry.get("headers", {}),
        sources=[target.name],
    )


def _from_canonical(server: McpServer, target: TargetConfig) -> dict[str, Any]:
    """Convert a canonical McpServer to the target-specific JSON entry.

    Key conversions:
    - OpenCode: command becomes array, env → environment, type is always set
    - VS Code:  supports stdio/http/sse natively, so url/type/headers pass through
    - Standard (Claude Desktop/Code, Antigravity, Gemini CLI, Copilot CLI,
      JetBrains): only support stdio — remote servers are wrapped with
      ``npx mcp-remote <url>`` which is the standard bridge pattern.
    """

    # ── OpenCode ──────────────────────────────────────────────────────────
    if target.format_type == FormatType.OPENCODE:
        entry: dict[str, Any] = {}
        if server.url:
            entry["type"] = "remote"
            entry["url"] = server.url
            if server.headers:
                entry["headers"] = server.headers
        else:
            entry["type"] = "local"
            cmd_array = []
            if server.command:
                cmd_array.append(server.command)
            cmd_array.extend(server.args)
            entry["command"] = cmd_array
            if server.env:
                entry["environment"] = server.env
        return entry

    # ── VS Code ───────────────────────────────────────────────────────────
    if target.format_type == FormatType.VSCODE:
        entry = {}
        if server.url:
            entry["type"] = server.type or "http"
            entry["url"] = server.url
            if server.headers:
                entry["headers"] = server.headers
        else:
            if server.command:
                entry["command"] = server.command
            if server.args:
                entry["args"] = server.args
            if server.env:
                entry["env"] = server.env
        return entry

    # ── Standard targets (Claude, Antigravity, Gemini CLI, etc.) ──────────
    entry = {}
    if server.url:
        # Convert remote → stdio via mcp-remote bridge
        entry["command"] = "npx"
        args = ["mcp-remote", server.url]
        if server.headers:
            for key, value in server.headers.items():
                args.extend(["--header", f"{key}: {value}"])
        entry["args"] = args
    else:
        if server.command:
            entry["command"] = server.command
        if server.args:
            entry["args"] = server.args
        if server.env:
            entry["env"] = server.env
        if server.type and server.type == "stdio":
            entry["type"] = server.type
    return entry


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def _resolve_path(target: TargetConfig, project_dir: str | None = None) -> str:
    """Get the actual filesystem path for a target, considering scope."""
    if target.scope == Scope.PROJECT and project_dir:
        return target.resolve_for_project(project_dir)
    return target.resolved_path


def read_target_servers(
    target: TargetConfig, project_dir: str | None = None
) -> dict[str, McpServer]:
    """Read all MCP servers from a single target config file."""
    path = _resolve_path(target, project_dir)
    is_yaml = target.format_type == FormatType.YAML
    data = _read_config(path, is_yaml)
    raw_servers: dict[str, Any] = data.get(target.root_key, {})
    return {
        name: _to_canonical(name, entry, target)
        for name, entry in raw_servers.items()
        if isinstance(entry, dict)
    }


def discover_all_servers(
    scope: Scope = Scope.GLOBAL, project_dir: str | None = None
) -> dict[str, McpServer]:
    """Scan targets in the given scope and build a deduplicated server list."""
    targets = get_targets_by_scope(scope)
    merged: dict[str, McpServer] = {}
    for target in targets:
        try:
            servers = read_target_servers(target, project_dir)
        except Exception:
            continue
        for name, srv in servers.items():
            if name in merged:
                for src in srv.sources:
                    if src not in merged[name].sources:
                        merged[name].sources.append(src)
            else:
                merged[name] = srv
    return merged


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


def backup_config(target: TargetConfig, project_dir: str | None = None) -> str | None:
    """Create a timestamped backup of a target config file."""
    path = Path(_resolve_path(target, project_dir))
    if not path.exists():
        return None
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_suffix(f".bak.{ts}")
    shutil.copy2(path, backup_path)
    return str(backup_path)


def write_servers_to_target(
    target: TargetConfig,
    servers: list[McpServer],
    *,
    create_backup: bool = True,
    project_dir: str | None = None,
) -> SyncResult:
    """Write (merge) the given servers into a target's config file."""
    path = _resolve_path(target, project_dir)
    is_yaml = target.format_type == FormatType.YAML

    try:
        if create_backup:
            backup_config(target, project_dir)

        existing = _read_config(path, is_yaml)
        server_entries: dict[str, Any] = existing.get(target.root_key, {})
        for srv in servers:
            server_entries[srv.name] = _from_canonical(srv, target)

        existing[target.root_key] = server_entries
        _write_config(path, existing, is_yaml)

        return SyncResult(
            target=target.name,
            success=True,
            message=f"Wrote {len(servers)} server(s) to {target.display_name}",
            servers_written=[s.name for s in servers],
        )
    except Exception as exc:
        return SyncResult(
            target=target.name,
            success=False,
            message=f"Error writing to {target.display_name}: {exc}",
        )


def remove_server_from_target(
    target: TargetConfig, server_name: str, project_dir: str | None = None
) -> SyncResult:
    """Remove a single server from a target config."""
    path = _resolve_path(target, project_dir)
    is_yaml = target.format_type == FormatType.YAML
    try:
        data = _read_config(path, is_yaml)
        servers = data.get(target.root_key, {})
        if server_name not in servers:
            return SyncResult(
                target=target.name,
                success=True,
                message=f"Server '{server_name}' not found in {target.display_name}",
            )
        del servers[server_name]
        data[target.root_key] = servers
        _write_config(path, data, is_yaml)
        return SyncResult(
            target=target.name,
            success=True,
            message=f"Removed '{server_name}' from {target.display_name}",
        )
    except Exception as exc:
        return SyncResult(
            target=target.name,
            success=False,
            message=f"Error removing from {target.display_name}: {exc}",
        )


def rename_server_in_target(
    target: TargetConfig,
    old_name: str,
    new_name: str,
    project_dir: str | None = None,
) -> SyncResult:
    """Rename a server key in a target config file."""
    path = _resolve_path(target, project_dir)
    is_yaml = target.format_type == FormatType.YAML
    try:
        data = _read_config(path, is_yaml)
        servers = data.get(target.root_key, {})
        if old_name not in servers:
            return SyncResult(
                target=target.name,
                success=True,
                message=f"Server '{old_name}' not in {target.display_name}",
            )
        entry = servers.pop(old_name)
        servers[new_name] = entry
        data[target.root_key] = servers
        _write_config(path, data, is_yaml)
        return SyncResult(
            target=target.name,
            success=True,
            message=f"Renamed '{old_name}' → '{new_name}' in {target.display_name}",
        )
    except Exception as exc:
        return SyncResult(
            target=target.name,
            success=False,
            message=f"Error renaming in {target.display_name}: {exc}",
        )


# ---------------------------------------------------------------------------
# High-level sync
# ---------------------------------------------------------------------------


def sync_servers(
    server_names: list[str],
    target_names: list[str],
    scope: Scope = Scope.GLOBAL,
    project_dir: str | None = None,
) -> tuple[list[SyncResult], dict[str, str]]:
    """Sync selected servers to selected targets. Returns (results, backup_paths)."""
    all_servers = discover_all_servers(scope, project_dir)
    servers_to_sync = [all_servers[n] for n in server_names if n in all_servers]

    results: list[SyncResult] = []
    backups: dict[str, str] = {}

    for tname in target_names:
        target = get_target(tname)
        if target is None:
            results.append(
                SyncResult(
                    target=tname, success=False, message=f"Unknown target: {tname}"
                )
            )
            continue

        if bp := backup_config(target, project_dir):
            backups[tname] = bp

        result = write_servers_to_target(
            target, servers_to_sync, create_backup=False, project_dir=project_dir
        )
        results.append(result)

    return results, backups
