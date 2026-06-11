"""One markdown file per item in a directory — commands and subagents.

Options:
  suffix      – file suffix incl. extension (".md", ".prompt.md", ".agent.md")
  frontmatter – field mapping style:
      claude_command – description / argument-hint        → CommandEntity
      copilot_prompt – description                        → CommandEntity
      plain          – no frontmatter, body only          → CommandEntity
      claude_agent   – name/description/model/tools       → SubagentEntity
      copilot_agent  – name/description/tools             → SubagentEntity
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from engine import frontmatter
from engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from models import CommandEntity, SubagentEntity

_COMMAND_STYLES = {"claude_command", "copilot_prompt", "plain"}
_AGENT_STYLES = {"claude_agent", "copilot_agent"}


def _tools_to_str(value) -> str:
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    return str(value or "")


def _parse(name: str, text: str, style: str) -> BaseModel:
    meta, body = frontmatter.parse(text)
    if style in _AGENT_STYLES:
        return SubagentEntity(
            name=str(meta.get("name") or name),
            description=str(meta.get("description") or ""),
            content=body,
            model=str(meta.get("model") or ""),
            tools=_tools_to_str(meta.get("tools")),
        )
    if style == "plain":
        return CommandEntity(name=name, content=text.strip("\n"))
    return CommandEntity(
        name=name,
        description=str(meta.get("description") or ""),
        content=body,
        argument_hint=str(meta.get("argument-hint") or ""),
    )


def _render(item: BaseModel, style: str) -> str:
    if style in _AGENT_STYLES:
        meta = {"name": item.name, "description": item.description}
        if style == "claude_agent" and item.model:
            meta["model"] = item.model
        if item.tools:
            meta["tools"] = item.tools
        return frontmatter.render(meta, item.content)
    if style == "plain":
        return item.content.rstrip("\n") + "\n"
    meta = {"description": item.description}
    if getattr(item, "argument_hint", ""):
        meta["argument-hint"] = item.argument_hint
    return frontmatter.render(meta, item.content)


class MarkdownDirHandler(FormatHandler):
    name = "markdown_dir"
    kinds = frozenset({"command", "subagent"})

    def _file_for(self, root: Path, name: str, opts: dict) -> Path:
        return root / f"{name}{opts.get('suffix', '.md')}"

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        if not root.is_dir():
            return {}
        suffix = opts.get("suffix", ".md")
        style = opts.get("frontmatter", "plain")
        result: dict[str, BaseModel] = {}
        for path in sorted(root.iterdir()):
            if not path.is_file() or not path.name.endswith(suffix):
                continue
            text = read_text_or_none(path)
            if text is None:
                continue
            name = path.name[: -len(suffix)]
            if not name:
                continue
            result[name] = _parse(name, text, style)
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        style = opts.get("frontmatter", "plain")
        changes = []
        for item in items:
            path = self._file_for(root, item.name, opts)
            changes.append(
                FileChange(
                    path=path,
                    before=read_text_or_none(path),
                    after=_render(item, style),
                )
            )
        return changes

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        changes = []
        for name in names:
            path = self._file_for(root, name, opts)
            before = read_text_or_none(path)
            if before is not None:
                changes.append(FileChange(path=path, before=before, after=None))
        return changes
