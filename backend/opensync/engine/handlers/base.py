"""FormatHandler interface and FileChange plan objects."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel


@dataclass
class FileChange:
    """A planned modification to one file."""

    path: Path
    before: str | None  # None = file does not exist
    after: str | None  # None = delete file
    binary: bool = False  # before/after hold base64-encoded bytes
    # Desired POSIX permission bits (e.g. 0o755) to apply on write; None
    # means leave the mode alone. Set by handlers that track modes.
    mode: int | None = None
    # After a delete, remove now-empty parent directories up to (but not
    # including) this path. Set by directory-tree handlers (skill_dir).
    prune_parents_to: Path | None = None

    @property
    def is_noop(self) -> bool:
        return self.before == self.after and self.mode is None


class FormatHandler(ABC):
    """Reads/plans one on-disk config format.

    `root` is the resolved target path from the manifest: a file for
    single-file formats (json_mcp, toml_mcp) or a directory for
    one-file-per-item formats (markdown_dir, skill_dir, …).
    """

    name: str
    kinds: frozenset[str]

    @abstractmethod
    def read(self, root: Path, opts: dict) -> dict[str, BaseModel]:
        """Parse current disk state into name → canonical model.

        Missing or unparseable files yield {} — discovery and status must
        never raise because one tool's config is broken.
        """

    @abstractmethod
    def plan_write(
        self, root: Path, items: list[BaseModel], opts: dict
    ) -> list[FileChange]:
        """Merge items into the current disk state without touching
        unrelated keys or files."""

    @abstractmethod
    def plan_remove(
        self, root: Path, names: list[str], opts: dict
    ) -> list[FileChange]:
        """Remove the named items from the current disk state."""


def read_text_or_none(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def read_bytes_or_none(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except OSError:
        return None
