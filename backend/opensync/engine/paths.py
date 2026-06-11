"""Path resolution for integration targets.

Global paths start with '~' and resolve against the user's home directory
(overridable via OPENSYNC_HOME for tests and sandboxed runs). Project paths
are relative and resolve against a project directory.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from opensync.integrations.base import EntityTarget


def home() -> Path:
    override = os.environ.get("OPENSYNC_HOME")
    return Path(override) if override else Path.home()


def opensync_dir() -> Path:
    return home() / ".opensync"


def _expand(raw: str, project_dir: str | None) -> Path:
    if raw.startswith("~"):
        return home() / raw[1:].lstrip("/")
    if project_dir:
        return Path(project_dir) / raw
    return Path(raw)


def resolve(target: EntityTarget, project_dir: str | None = None) -> Path:
    """Resolve a target's primary (write) path."""
    raw = target.os_paths.get(sys.platform, target.path)
    return _expand(raw, project_dir)


def resolve_read_paths(
    target: EntityTarget, project_dir: str | None = None
) -> list[Path]:
    """All paths scanned during discovery: primary first, then read-only extras."""
    paths = [resolve(target, project_dir)]
    for raw in target.read_paths:
        paths.append(_expand(raw, project_dir))
    return paths
