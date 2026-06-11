"""MCP servers in a TOML config file — Codex's ~/.codex/config.toml.

Entries live under [<table>.<name>] (default table "mcp_servers"):

    [mcp_servers.context7]
    command = "npx"
    args = ["-y", "@upstash/context7-mcp"]
    env = { API_KEY = "..." }

Remote servers use `url` (+ optional `bearer_token_env_var`). tomlkit is
used so user comments and formatting in the rest of the file survive every
write.
"""

from __future__ import annotations

from pathlib import Path

import tomlkit
from pydantic import BaseModel
from tomlkit.exceptions import TOMLKitError

from engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from models import McpServer


class TomlMcpHandler(FormatHandler):
    name = "toml_mcp"
    kinds = frozenset({"mcp"})

    def _load(self, root: Path) -> tomlkit.TOMLDocument:
        text = read_text_or_none(root)
        if not text:
            return tomlkit.document()
        try:
            return tomlkit.parse(text)
        except TOMLKitError:
            return tomlkit.document()

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        doc = self._load(root)
        table = doc.get(opts.get("table", "mcp_servers"))
        if table is None:
            return {}
        result: dict[str, BaseModel] = {}
        for name, entry in table.items():
            try:
                fields = dict(entry)
            except (TypeError, ValueError):
                continue
            result[name] = McpServer(
                name=str(name),
                command=fields.get("command"),
                args=list(fields.get("args") or []),
                env={str(k): str(v) for k, v in dict(fields.get("env") or {}).items()},
                type=fields.get("type"),
                url=fields.get("url"),
                headers={
                    str(k): str(v)
                    for k, v in dict(fields.get("headers") or {}).items()
                },
            )
        return result

    def _plan(self, root: Path, mutate, opts: dict) -> list[FileChange]:
        before = read_text_or_none(root)
        doc = self._load(root)
        table_key = opts.get("table", "mcp_servers")
        if table_key not in doc:
            doc[table_key] = tomlkit.table(is_super_table=True)
        mutate(doc[table_key])
        after = tomlkit.dumps(doc)
        if not after.endswith("\n"):
            after += "\n"
        return [FileChange(path=root, before=before, after=after)]

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        def mutate(table) -> None:
            for item in items:
                entry = tomlkit.table()
                if item.url:
                    entry["url"] = item.url
                    if item.headers:
                        headers = tomlkit.inline_table()
                        headers.update(item.headers)
                        entry["headers"] = headers
                else:
                    if item.command:
                        entry["command"] = item.command
                    if item.args:
                        entry["args"] = list(item.args)
                    if item.env:
                        env = tomlkit.inline_table()
                        env.update(item.env)
                        entry["env"] = env
                table[item.name] = entry

        return self._plan(root, mutate, opts)

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        def mutate(table) -> None:
            for name in names:
                if name in table:
                    del table[name]

        return self._plan(root, mutate, opts)
