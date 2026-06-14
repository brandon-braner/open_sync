"""Gemini CLI slash commands: <dir>/<name>.toml with `description`/`prompt`."""

from __future__ import annotations

from pathlib import Path

import tomlkit
from pydantic import BaseModel
from tomlkit.exceptions import TOMLKitError

from opensync.engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from opensync.models import CommandEntity


class TomlCommandHandler(FormatHandler):
    name = "toml_command"
    kinds = frozenset({"command"})

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        if not root.is_dir():
            return {}
        result: dict[str, BaseModel] = {}
        for path in sorted(root.glob("*.toml")):
            text = read_text_or_none(path)
            if text is None:
                continue
            try:
                doc = tomlkit.parse(text)
            except TOMLKitError:
                continue
            name = path.stem
            result[name] = CommandEntity(
                name=name,
                description=str(doc.get("description") or ""),
                content=str(doc.get("prompt") or ""),
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        changes = []
        for item in items:
            path = root / f"{item.name}.toml"
            doc = tomlkit.document()
            if item.description:
                doc["description"] = item.description
            doc["prompt"] = tomlkit.string(item.content, multiline="\n" in item.content)
            changes.append(
                FileChange(
                    path=path,
                    before=read_text_or_none(path),
                    after=tomlkit.dumps(doc),
                )
            )
        return changes

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        changes = []
        for name in names:
            path = root / f"{name}.toml"
            before = read_text_or_none(path)
            if before is not None:
                changes.append(FileChange(path=path, before=before, after=None))
        return changes
