"""Agent Skills standard: <dir>/<skill-name>/SKILL.md plus supporting files.

SKILL.md carries YAML frontmatter (name, description) and a markdown body.
Every other file in the skill folder (scripts, references, assets) is part
of the skill and synced verbatim; binary files travel base64-encoded.
plan_write mirrors the folder — supporting files present on disk but absent
from the entity are deleted, so renames don't leave stale copies behind.

OS/tooling artifacts (.DS_Store, __pycache__, .git, …) are never read or
mirrored, so they don't cause false drift between tools.
"""

from __future__ import annotations

import base64
import os
import stat
from pathlib import Path

from pydantic import BaseModel

from opensync.engine import frontmatter
from opensync.engine.handlers.base import (
    FileChange,
    FormatHandler,
    read_bytes_or_none,
    read_text_or_none,
)
from opensync.models import SkillEntity, SkillFile

_SKIP_DIRS = {"__pycache__", ".git", "node_modules", ".venv"}
_SKIP_FILES = {".DS_Store", "Thumbs.db"}
_SKIP_SUFFIXES = (".pyc",)

# Mode applied to executable / non-executable synced files. Only the execute
# bits are meaningful across machines; read/write default to the conventional
# 0o755 / 0o644 so umask differences between hosts don't cause drift.
_EXEC_MODE = 0o755
_NON_EXEC_MODE = 0o644
_ANY_EXEC = 0o111


def _iter_files(skill_dir: Path):
    """All synced files in a skill folder, depth-first, deterministic order."""
    for dirpath, dirnames, filenames in os.walk(skill_dir):
        dirnames[:] = sorted(d for d in dirnames if d not in _SKIP_DIRS)
        for fn in sorted(filenames):
            if fn in _SKIP_FILES or fn.endswith(_SKIP_SUFFIXES):
                continue
            yield Path(dirpath) / fn


def _is_executable(path: Path) -> bool:
    """True if any execute bit is set on disk."""
    try:
        return bool(stat.S_IMODE(os.stat(path).st_mode) & _ANY_EXEC)
    except OSError:
        return False


def _to_skill_file(raw: bytes, executable: bool = False) -> SkillFile:
    try:
        return SkillFile(
            encoding="text", data=raw.decode("utf-8"), executable=executable
        )
    except UnicodeDecodeError:
        return SkillFile(
            encoding="base64",
            data=base64.b64encode(raw).decode("ascii"),
            executable=executable,
        )


def _file_bytes(f: SkillFile) -> bytes:
    if f.encoding == "base64":
        return base64.b64decode(f.data)
    return f.data.encode("utf-8")


def _safe_rel(rel: str) -> Path | None:
    """Validate a registry-supplied relative path before writing under root."""
    p = Path(rel)
    if p.is_absolute() or not p.parts or ".." in p.parts:
        return None
    return p


def _resolve_mode(path: Path, executable: bool, exists: bool) -> int | None:
    """Desired mode to apply, or None when no chmod is needed.

    For executable files we always normalise to 0o755 so a script keeps its
    +x across machines. For non-executable files we only emit a mode when the
    on-disk file currently has an execute bit (to strip it); brand-new plain
    files fall back to the process umask, preserving prior behavior.
    """
    desired = _EXEC_MODE if executable else _NON_EXEC_MODE
    if not exists:
        return desired if executable else None
    try:
        current = stat.S_IMODE(os.stat(path).st_mode)
    except OSError:
        return desired if executable else None
    return desired if current != desired else None


def _bytes_change(
    path: Path,
    new: bytes | None,
    root: Path,
    executable: bool = False,
) -> FileChange:
    """Build a FileChange from raw bytes, as text when both sides are UTF-8.

    `executable` is only consulted for writes (new is not None); deletes
    don't need a mode since the file is going away.
    """
    old = read_bytes_or_none(path)
    mode = (
        _resolve_mode(path, executable, exists=old is not None)
        if new is not None
        else None
    )
    try:
        return FileChange(
            path=path,
            before=old.decode("utf-8") if old is not None else None,
            after=new.decode("utf-8") if new is not None else None,
            mode=mode,
            prune_parents_to=root,
        )
    except UnicodeDecodeError:
        b64 = lambda b: base64.b64encode(b).decode("ascii")  # noqa: E731
        return FileChange(
            path=path,
            before=b64(old) if old is not None else None,
            after=b64(new) if new is not None else None,
            binary=True,
            mode=mode,
            prune_parents_to=root,
        )


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
            files: dict[str, SkillFile] = {}
            for path in _iter_files(sub):
                if path == skill_md:
                    continue
                raw = read_bytes_or_none(path)
                if raw is None:
                    continue
                files[path.relative_to(sub).as_posix()] = _to_skill_file(
                    raw, executable=_is_executable(path)
                )
            result[name] = SkillEntity(
                name=name,
                description=str(meta.get("description") or ""),
                content=body,
                files=files,
            )
        return result

    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        changes = []
        for item in items:
            skill_dir = root / item.name
            skill_md = skill_dir / "SKILL.md"
            after = frontmatter.render(
                {"name": item.name, "description": item.description}, item.content
            )
            changes.append(
                FileChange(
                    path=skill_md,
                    before=read_text_or_none(skill_md),
                    after=after,
                    prune_parents_to=root,
                )
            )
            expected = {"SKILL.md"}
            for rel, f in sorted(item.files.items()):
                relpath = _safe_rel(rel)
                if relpath is None or relpath.as_posix() == "SKILL.md":
                    continue
                expected.add(relpath.as_posix())
                changes.append(
                    _bytes_change(
                        skill_dir / relpath, _file_bytes(f), root, executable=f.executable
                    )
                )
            if skill_dir.is_dir():
                for path in _iter_files(skill_dir):
                    if path.relative_to(skill_dir).as_posix() not in expected:
                        changes.append(_bytes_change(path, None, root))
        return changes

    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        changes = []
        for name in names:
            skill_dir = root / name
            if not skill_dir.is_dir():
                continue
            # Delete everything (including artifacts _iter_files skips) so
            # the folder itself can be pruned away.
            for dirpath, _dirnames, filenames in os.walk(skill_dir):
                for fn in sorted(filenames):
                    changes.append(_bytes_change(Path(dirpath) / fn, None, root))
        return changes
