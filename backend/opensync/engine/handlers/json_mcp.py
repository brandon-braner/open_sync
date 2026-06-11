"""MCP servers stored as a named dict inside a JSON config file.

Styles:
  standard – { "command": str, "args": [], "env": {}, "url"?, "headers"? }
             (Claude Code/Desktop, Cursor, Devin, Copilot CLI, Gemini CLI…)
  vscode   – same fields but remote entries carry a "type" (http/sse);
             root key is "servers".
  opencode – { "type": "local"|"remote", "command": [array],
               "environment": {}, "url"? }

`bridge_remote` converts remote servers into a stdio `npx mcp-remote`
invocation for tools that only speak stdio (Claude Desktop).
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel

from opensync.engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from opensync.models import McpServer


def _parse_entry(name: str, entry: dict, style: str) -> McpServer:
    if style == "opencode":
        cmd_list = entry.get("command") or []
        if isinstance(cmd_list, str):
            cmd_list = [cmd_list]
        return McpServer(
            name=name,
            command=cmd_list[0] if cmd_list else None,
            args=list(cmd_list[1:]),
            env=entry.get("environment") or {},
            type=entry.get("type"),
            url=entry.get("url"),
            headers=entry.get("headers") or {},
        )
    return McpServer(
        name=name,
        command=entry.get("command"),
        args=entry.get("args") or [],
        env=entry.get("env") or {},
        type=entry.get("type"),
        url=entry.get("url"),
        headers=entry.get("headers") or {},
    )


def _render_entry(server: McpServer, style: str, bridge_remote: bool) -> dict:
    if style == "opencode":
        if server.url:
            entry: dict = {"type": "remote", "url": server.url}
            if server.headers:
                entry["headers"] = dict(server.headers)
        else:
            cmd = ([server.command] if server.command else []) + list(server.args)
            entry = {"type": "local", "command": cmd}
            if server.env:
                entry["environment"] = dict(server.env)
        return entry

    if server.url and bridge_remote:
        args = ["mcp-remote", server.url]
        for key, value in server.headers.items():
            args += ["--header", f"{key}: {value}"]
        return {"command": "npx", "args": args}

    entry = {}
    if server.url:
        if style == "vscode" or server.type in ("http", "sse"):
            entry["type"] = server.type or "http"
        entry["url"] = server.url
        if server.headers:
            entry["headers"] = dict(server.headers)
        return entry

    if server.command:
        entry["command"] = server.command
    if server.args:
        entry["args"] = list(server.args)
    if server.env:
        entry["env"] = dict(server.env)
    return entry


class JsonMcpHandler(FormatHandler):
    name = "json_mcp"
    kinds = frozenset({"mcp"})

    def _load(self, root: Path) -> dict:
        text = read_text_or_none(root)
        if not text or not text.strip():
            return {}
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {}
        return data if isinstance(data, dict) else {}

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        data = self._load(root)
        entries = data.get(opts.get("root_key", "mcpServers"), {})
        if not isinstance(entries, dict):
            return {}
        style = opts.get("style", "standard")
        return {
            name: _parse_entry(name, entry, style)
            for name, entry in entries.items()
            if isinstance(entry, dict)
        }

    def _plan(self, root: Path, mutate, opts: dict) -> list[FileChange]:
        before = read_text_or_none(root)
        data = self._load(root)
        root_key = opts.get("root_key", "mcpServers")
        entries = data.get(root_key)
        if not isinstance(entries, dict):
            entries = {}
        mutate(entries)
        data[root_key] = entries
        after = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        return [FileChange(path=root, before=before, after=after)]

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        style = opts.get("style", "standard")
        bridge = bool(opts.get("bridge_remote"))

        def mutate(entries: dict) -> None:
            for item in items:
                entries[item.name] = _render_entry(item, style, bridge)

        return self._plan(root, mutate, opts)

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        def mutate(entries: dict) -> None:
            for name in names:
                entries.pop(name, None)

        return self._plan(root, mutate, opts)
