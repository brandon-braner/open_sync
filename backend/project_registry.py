"""Project registry – named projects with directory paths.

Projects are stored in the ``opensync.db`` SQLite database, replacing
the old ``projects.json`` file.
"""

from __future__ import annotations

from pathlib import Path

from database import get_connection


def list_projects() -> list[dict[str, str]]:
    """Return all projects as [{name, path}, ...]."""
    conn = get_connection()
    try:
        rows = conn.execute("SELECT name, path FROM projects").fetchall()
        return [{"name": r["name"], "path": r["path"]} for r in rows]
    finally:
        conn.close()


def add_project(name: str, path: str) -> dict[str, str]:
    """Add a project. Path is resolved to an absolute directory."""
    resolved = str(Path(path).expanduser().resolve())
    p = Path(resolved)
    if not p.is_dir():
        raise ValueError(f"Not a directory: {resolved}")
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO projects (name, path) VALUES (?, ?)",
            (name, resolved),
        )
        conn.commit()
    finally:
        conn.close()
    return {"name": name, "path": resolved}


def remove_project(name: str) -> bool:
    """Remove a project by name. Returns True if it existed."""
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM projects WHERE name = ?", (name,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def get_project(name: str) -> dict[str, str] | None:
    """Look up a project by name."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT name, path FROM projects WHERE name = ?", (name,)
        ).fetchone()
        if row is None:
            return None
        return {"name": row["name"], "path": row["path"]}
    finally:
        conn.close()
