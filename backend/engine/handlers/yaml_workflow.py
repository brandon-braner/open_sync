"""Warp workflows: <dir>/<name>.yaml with name/command/description keys."""

from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel

from engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from models import CommandEntity


class YamlWorkflowHandler(FormatHandler):
    name = "yaml_workflow"
    kinds = frozenset({"command"})

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        if not root.is_dir():
            return {}
        result: dict[str, BaseModel] = {}
        for path in sorted(list(root.glob("*.yaml")) + list(root.glob("*.yml"))):
            text = read_text_or_none(path)
            if text is None:
                continue
            try:
                data = yaml.safe_load(text) or {}
            except yaml.YAMLError:
                continue
            if not isinstance(data, dict):
                continue
            name = str(data.get("name") or path.stem)
            result[name] = CommandEntity(
                name=name,
                description=str(data.get("description") or ""),
                content=str(data.get("command") or ""),
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        changes = []
        for item in items:
            path = root / f"{item.name}.yaml"
            data = {"name": item.name, "command": item.content}
            if item.description:
                data["description"] = item.description
            after = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
            changes.append(
                FileChange(path=path, before=read_text_or_none(path), after=after)
            )
        return changes

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        changes = []
        for name in names:
            path = root / f"{name}.yaml"
            before = read_text_or_none(path)
            if before is not None:
                changes.append(FileChange(path=path, before=before, after=None))
        return changes
