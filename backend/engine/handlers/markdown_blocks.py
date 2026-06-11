"""Rules synced as managed blocks inside a shared instructions file
(CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, global_rules.md…).

OpenSync only ever touches the content between its own markers; everything
the user wrote outside them is preserved verbatim:

    <!-- opensync:rule:<name> | <description> -->
    ...rule content...
    <!-- /opensync:rule:<name> -->
"""

from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel

from engine.handlers.base import FileChange, FormatHandler, read_text_or_none
from models import RuleEntity

_BLOCK_RE = re.compile(
    r"<!--\s*opensync:rule:(?P<name>[^|>]+?)\s*(?:\|\s*(?P<desc>[^>]*?)\s*)?-->"
    r"\n(?P<body>.*?)\n?<!--\s*/opensync:rule:[^>]*?-->",
    re.DOTALL,
)


def _sanitize(text: str) -> str:
    return text.replace("-->", "").replace("|", "/").replace("\n", " ").strip()


def _render_block(item: RuleEntity) -> str:
    header = f"<!-- opensync:rule:{_sanitize(item.name)}"
    if item.description:
        header += f" | {_sanitize(item.description)}"
    header += " -->"
    body = item.content.strip("\n")
    return f"{header}\n{body}\n<!-- /opensync:rule:{_sanitize(item.name)} -->"


class MarkdownBlocksHandler(FormatHandler):
    name = "markdown_blocks"
    kinds = frozenset({"rule"})

    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        text = read_text_or_none(root)
        if not text:
            return {}
        result: dict[str, BaseModel] = {}
        for match in _BLOCK_RE.finditer(text):
            name = match.group("name").strip()
            result[name] = RuleEntity(
                name=name,
                description=(match.group("desc") or "").strip(),
                content=match.group("body").strip("\n"),
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        before = read_text_or_none(root)
        text = before or ""
        for item in items:
            rendered = _render_block(item)
            replaced = False
            # Re-scan per item: replacement shifts spans.
            for match in _BLOCK_RE.finditer(text):
                if match.group("name").strip() == item.name:
                    text = text[: match.start()] + rendered + text[match.end():]
                    replaced = True
                    break
            if not replaced:
                text = (text.rstrip("\n") + "\n\n") if text.strip() else ""
                text += rendered + "\n"
        if not text.endswith("\n"):
            text += "\n"
        return [FileChange(path=root, before=before, after=text)]

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        before = read_text_or_none(root)
        if before is None:
            return []
        text = before
        for name in names:
            for match in _BLOCK_RE.finditer(text):
                if match.group("name").strip() == name:
                    text = text[: match.start()] + text[match.end():]
                    break
        text = re.sub(r"\n{3,}", "\n\n", text)
        if text == before:
            return []
        return [FileChange(path=root, before=before, after=text)]
