"""Agent Skills standard: <dir>/<skill-name>/SKILL.md.

SKILL.md carries YAML frontmatter (name, description) and a markdown body.
Supporting files in the skill folder are left untouched.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from engine import frontmatter
from engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from models import SkillEntity


class SkillDirHandler(FormatHandler):
    name = "skill_dir"
    kinds = frozenset({"skill"})

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        if not root.is_dir():
            return {}
        result: dict[str, BaseModel] = {}
        for sub in sorted(root.iterdir()):
            skill_md = sub / "SKILL.md"
            if not sub.is_dir() or not skill_md.is_file():
                continue
            text = read_text_or_none(skill_md)
            if text is None:
                continue
            meta, body = frontmatter.parse(text)
            name = str(meta.get("name") or sub.name)
            result[name] = SkillEntity(
                name=name,
                description=str(meta.get("description") or ""),
                content=body,
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        changes = []
        for item in items:
            path = root / item.name / "SKILL.md"
            after = frontmatter.render(
                {"name": item.name, "description": item.description}, item.content
            )
            changes.append(
                FileChange(path=path, before=read_text_or_none(path), after=after)
            )
        return changes

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        changes = []
        for name in names:
            path = root / name / "SKILL.md"
            before = read_text_or_none(path)
            if before is not None:
                changes.append(FileChange(path=path, before=before, after=None))
        return changes
