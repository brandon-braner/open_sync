"""SQLite database backend for OpenSync registries.

Replaces the JSON file storage (servers.json, projects.json) with a local
SQLite database (opensync.db).  The public helpers in this module are used
by ``server_registry`` and ``project_registry``.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "opensync.db"

# Paths to the legacy JSON files (used for one-time migration)
_SERVERS_JSON = Path(__file__).resolve().parent.parent / "servers.json"
_PROJECTS_JSON = Path(__file__).resolve().parent.parent / "projects.json"


# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------


def get_connection() -> sqlite3.Connection:
    """Return a connection with row_factory and WAL mode enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    name TEXT PRIMARY KEY,
    path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS servers (
    id       TEXT NOT NULL PRIMARY KEY,
    name     TEXT NOT NULL,
    scope    TEXT NOT NULL DEFAULT 'global',
    project  TEXT NOT NULL DEFAULT '',
    command  TEXT,
    args     TEXT DEFAULT '[]',
    env      TEXT DEFAULT '{}',
    type     TEXT,
    url      TEXT,
    headers  TEXT DEFAULT '{}',
    UNIQUE (name, scope, project)
);

CREATE TABLE IF NOT EXISTS skills (
    id       TEXT NOT NULL PRIMARY KEY,
    name     TEXT NOT NULL,
    scope    TEXT NOT NULL DEFAULT 'global',
    project  TEXT NOT NULL DEFAULT '',
    description TEXT,
    content  TEXT,
    UNIQUE (name, scope, project)
);

CREATE TABLE IF NOT EXISTS workflows (
    id       TEXT NOT NULL PRIMARY KEY,
    name     TEXT NOT NULL,
    scope    TEXT NOT NULL DEFAULT 'global',
    project  TEXT NOT NULL DEFAULT '',
    description TEXT,
    content  TEXT,
    UNIQUE (name, scope, project)
);

CREATE TABLE IF NOT EXISTS llm_providers (
    id       TEXT NOT NULL PRIMARY KEY,
    name     TEXT NOT NULL,
    scope    TEXT NOT NULL DEFAULT 'global',
    project  TEXT NOT NULL DEFAULT '',
    provider_type TEXT,
    api_key  TEXT,
    base_url TEXT,
    UNIQUE (name, scope, project)
);

CREATE TABLE IF NOT EXISTS agents (
    id          TEXT NOT NULL PRIMARY KEY,
    name        TEXT NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'global',
    project     TEXT NOT NULL DEFAULT '',
    description TEXT,
    content     TEXT,
    model       TEXT,
    tools       TEXT,
    UNIQUE (name, scope, project)
);
"""


def _create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA_SQL)


# ---------------------------------------------------------------------------
# JSON → SQLite migration
# ---------------------------------------------------------------------------


def _tables_empty(conn: sqlite3.Connection) -> bool:
    """Return True if both tables have zero rows."""
    srv_count = conn.execute("SELECT COUNT(*) FROM servers").fetchone()[0]
    prj_count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    return srv_count == 0 and prj_count == 0


def _migrate_from_json(conn: sqlite3.Connection) -> None:
    """Import data from servers.json and projects.json into the database.

    Only runs when the DB tables are empty and the JSON files exist.
    """
    projects_migrated = 0
    servers_migrated = 0

    # --- Projects ---
    if _PROJECTS_JSON.exists() and _PROJECTS_JSON.stat().st_size > 0:
        with open(_PROJECTS_JSON, "r", encoding="utf-8") as f:
            projects_data: dict[str, Any] = json.load(f)
        for name, info in projects_data.items():
            conn.execute(
                "INSERT OR IGNORE INTO projects (name, path) VALUES (?, ?)",
                (name, info["path"]),
            )
            projects_migrated += 1

    # --- Servers ---
    if _SERVERS_JSON.exists() and _SERVERS_JSON.stat().st_size > 0:
        with open(_SERVERS_JSON, "r", encoding="utf-8") as f:
            servers_data: dict[str, Any] = json.load(f)

        # Global servers
        for name, entry in servers_data.get("global", {}).items():
            _insert_server(conn, name, "global", None, entry)
            servers_migrated += 1

        # Project-scoped servers
        for project_name, project_servers in servers_data.get("projects", {}).items():
            for name, entry in project_servers.items():
                _insert_server(conn, name, "project", project_name, entry)
                servers_migrated += 1

    conn.commit()
    logger.info(
        "Migrated %d server(s) and %d project(s) from JSON files",
        servers_migrated,
        projects_migrated,
    )


def _insert_server(
    conn: sqlite3.Connection,
    name: str,
    scope: str,
    project: str | None,
    entry: dict[str, Any],
) -> None:
    conn.execute(
        """INSERT OR IGNORE INTO servers
           (id, name, scope, project, command, args, env, type, url, headers)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            str(uuid.uuid4()),
            name,
            scope,
            project or "",
            entry.get("command"),
            json.dumps(entry.get("args", [])),
            json.dumps(entry.get("env", {})),
            entry.get("type"),
            entry.get("url"),
            json.dumps(entry.get("headers", {})),
        ),
    )


# ---------------------------------------------------------------------------
# Public init
# ---------------------------------------------------------------------------


def init_db() -> None:
    """Create tables (if needed) and run the JSON migration on first use."""
    conn = get_connection()
    try:
        _create_tables(conn)
        _ensure_id_column(conn)
        _migrate_steps_to_content(conn)
        if _tables_empty(conn):
            _migrate_from_json(conn)
    finally:
        conn.close()


def _migrate_steps_to_content(conn: sqlite3.Connection) -> None:
    """Rename the `steps` column to `content` in the workflows table if needed."""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(workflows)").fetchall()]
    if "steps" in cols and "content" not in cols:
        # SQLite doesn't support RENAME COLUMN on older versions — recreate table
        conn.executescript("""
            ALTER TABLE workflows RENAME TO _workflows_old;
            CREATE TABLE workflows (
                id       TEXT NOT NULL PRIMARY KEY,
                name     TEXT NOT NULL,
                scope    TEXT NOT NULL DEFAULT 'global',
                project  TEXT NOT NULL DEFAULT '',
                description TEXT,
                content  TEXT,
                UNIQUE (name, scope, project)
            );
            INSERT INTO workflows (id, name, scope, project, description, content)
            SELECT id, name, scope, project, description, steps FROM _workflows_old;
            DROP TABLE _workflows_old;
        """)
        conn.commit()
        logger.info("Migrated workflows table: steps -> content")


def _ensure_id_column(conn: sqlite3.Connection) -> None:
    """Backfill the `id` column for existing rows that predate the schema change."""
    # Check if the id column exists
    cols = [row[1] for row in conn.execute("PRAGMA table_info(servers)").fetchall()]
    if "id" not in cols:
        # Need to recreate the table with the new schema
        conn.executescript("""
            ALTER TABLE servers RENAME TO _servers_old;
            CREATE TABLE servers (
                id       TEXT NOT NULL PRIMARY KEY,
                name     TEXT NOT NULL,
                scope    TEXT NOT NULL DEFAULT 'global',
                project  TEXT NOT NULL DEFAULT '',
                command  TEXT,
                args     TEXT DEFAULT '[]',
                env      TEXT DEFAULT '{}',
                type     TEXT,
                url      TEXT,
                headers  TEXT DEFAULT '{}',
                UNIQUE (name, scope, project)
            );
        """)
        rows = conn.execute("SELECT * FROM _servers_old").fetchall()
        for row in rows:
            conn.execute(
                """INSERT INTO servers
                   (id, name, scope, project, command, args, env, type, url, headers)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    row["name"],
                    row["scope"],
                    row["project"],
                    row["command"],
                    row["args"],
                    row["env"],
                    row["type"],
                    row["url"],
                    row["headers"],
                ),
            )
        conn.execute("DROP TABLE _servers_old")
        conn.commit()
        logger.info("Migrated servers table to include id column")
        return
    # Backfill any rows missing an id
    rows = conn.execute(
        "SELECT rowid FROM servers WHERE id IS NULL OR id = ''"
    ).fetchall()
    if rows:
        for row in rows:
            conn.execute(
                "UPDATE servers SET id = ? WHERE rowid = ?",
                (str(uuid.uuid4()), row["rowid"]),
            )
        conn.commit()
        logger.info("Backfilled %d server(s) with UUIDs", len(rows))
