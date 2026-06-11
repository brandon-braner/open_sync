"""Central, rotated backups of config files modified by sync.

One backup run per apply: every to-be-modified file is copied into
~/.opensync/backups/<run_id>/ with its absolute path flattened into a safe
relative name. The newest KEEP_RUNS runs are retained.
"""

from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path

from engine import paths

KEEP_RUNS = 20


def backups_root() -> Path:
    return paths.opensync_dir() / "backups"


def _safe_name(path: Path) -> str:
    return str(path).lstrip("/").replace("/", "__")


def create_backup_run(label: str, files: list[Path]) -> tuple[str, Path] | None:
    """Copy existing files into a new backup dir. Returns (run_id, dir)."""
    existing = [f for f in files if f.exists()]
    if not existing:
        return None
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]
    run_dir = backups_root() / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "LABEL.txt").write_text(label + "\n", encoding="utf-8")
    for f in existing:
        shutil.copy2(f, run_dir / _safe_name(f))
    return run_id, run_dir


def rotate(keep: int = KEEP_RUNS) -> list[str]:
    """Delete the oldest runs beyond `keep`; return the kept run ids."""
    root = backups_root()
    if not root.is_dir():
        return []
    runs = sorted((d for d in root.iterdir() if d.is_dir()), key=lambda d: d.name)
    for old in runs[:-keep] if len(runs) > keep else []:
        shutil.rmtree(old, ignore_errors=True)
    return [d.name for d in runs[-keep:]]
