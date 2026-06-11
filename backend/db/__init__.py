"""SQLite database for OpenSync (schema v2).

The path can be overridden with the OPENSYNC_DB_PATH environment variable
(used by tests).
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path

_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "opensync.db"

SCHEMA_VERSION = 2
_SCHEMA_SQL = (Path(__file__).resolve().parent / "schema.sql").read_text(
    encoding="utf-8"
)


def db_path() -> Path:
    override = os.environ.get("OPENSYNC_DB_PATH")
    return Path(override) if override else _DEFAULT_DB_PATH


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def schema_version(conn: sqlite3.Connection) -> int:
    has_meta = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'"
    ).fetchone()
    if not has_meta:
        return 0
    row = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    return int(row["value"]) if row else 0


def init_db() -> None:
    """Create v2 tables and migrate a v1 database if present."""
    from db.migrate import migrate_v1_to_v2

    conn = get_connection()
    try:
        version = schema_version(conn)
        if version >= SCHEMA_VERSION:
            return
        has_v1 = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='servers'"
        ).fetchone()
        conn.executescript(_SCHEMA_SQL)
        if has_v1:
            migrate_v1_to_v2(conn)
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
            (str(SCHEMA_VERSION),),
        )
        conn.commit()
    finally:
        conn.close()
