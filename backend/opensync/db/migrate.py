"""One-shot migration of a v1 OpenSync database to schema v2.

v1 had five near-identical typed tables (servers, skills, workflows,
llm_providers, agents) plus projects keyed by name. v2 stores everything in
a single generic `entities` table with the kind-specific fields packed into
a JSON `data` column, and projects keyed by uuid.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_V1_TABLES = ("servers", "skills", "workflows", "llm_providers", "agents")

# SQLite cannot parameterize DDL identifiers (table/column names), so dynamic
# DROP statements interpolate the name. This strict pattern guards that
# interpolation — only plain identifiers are ever executed.
_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _drop_table_if_exists(conn: sqlite3.Connection, table: str) -> None:
    """Drop a table by name, refusing anything that isn't a plain identifier.

    Identifiers can't be bound as parameters in SQLite DDL, so the name is
    validated before interpolation as defense in depth against injection.
    """
    if not _IDENTIFIER_RE.match(table):
        raise ValueError(f"Refusing to drop table with unsafe name: {table!r}")
    conn.execute(f"DROP TABLE IF EXISTS {table}")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _backup_db_file(conn: sqlite3.Connection) -> None:
    row = conn.execute("PRAGMA database_list").fetchone()
    db_file = row[2] if row else None
    if db_file:
        try:
            shutil.copy2(db_file, db_file + ".pre-v2")
            logger.info("Backed up v1 database to %s.pre-v2", db_file)
        except OSError:
            logger.warning("Could not back up %s before migration", db_file)


def _migrate_projects(conn: sqlite3.Connection) -> dict[str, str]:
    """Copy v1 projects (name → path) into projects_v2; return name → id."""
    name_to_id: dict[str, str] = {}
    for row in conn.execute("SELECT name, path FROM projects").fetchall():
        pid = str(uuid.uuid4())
        conn.execute(
            "INSERT OR IGNORE INTO projects_v2 (id, name, path) VALUES (?, ?, ?)",
            (pid, row["name"], row["path"]),
        )
        name_to_id[row["name"]] = pid
    return name_to_id


def _project_id_for(
    conn: sqlite3.Connection, name_to_id: dict[str, str], project_name: str
) -> str:
    """Resolve a v1 project name, creating a placeholder project for orphans."""
    if project_name in name_to_id:
        return name_to_id[project_name]
    pid = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO projects_v2 (id, name, path) VALUES (?, ?, ?)",
        (pid, project_name, f"<unknown:{project_name}>"),
    )
    name_to_id[project_name] = pid
    logger.warning("v1 rows referenced unknown project %r; placeholder created", project_name)
    return pid


def _insert_entity(
    conn: sqlite3.Connection,
    name_to_id: dict[str, str],
    row: sqlite3.Row,
    kind: str,
    description: str,
    content: str,
    data: dict,
) -> None:
    project_id = None
    if row["scope"] == "project" and row["project"]:
        project_id = _project_id_for(conn, name_to_id, row["project"])
    now = _now()
    conn.execute(
        """INSERT OR IGNORE INTO entities
           (id, kind, name, scope, project_id, description, data, content,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            row["id"] or str(uuid.uuid4()),
            kind,
            row["name"],
            row["scope"] or "global",
            project_id,
            description or "",
            json.dumps(data),
            content or "",
            now,
            now,
        ),
    )


def migrate_v1_to_v2(conn: sqlite3.Connection) -> None:
    _backup_db_file(conn)
    name_to_id = _migrate_projects(conn)

    for row in conn.execute("SELECT * FROM servers").fetchall():
        _insert_entity(
            conn, name_to_id, row, "mcp", "", "",
            {
                "command": row["command"],
                "args": json.loads(row["args"] or "[]"),
                "env": json.loads(row["env"] or "{}"),
                "type": row["type"],
                "url": row["url"],
                "headers": json.loads(row["headers"] or "{}"),
            },
        )

    for row in conn.execute("SELECT * FROM skills").fetchall():
        _insert_entity(
            conn, name_to_id, row, "skill", row["description"], row["content"], {}
        )

    for row in conn.execute("SELECT * FROM workflows").fetchall():
        _insert_entity(
            conn, name_to_id, row, "command", row["description"], row["content"],
            {"argument_hint": ""},
        )

    for row in conn.execute("SELECT * FROM agents").fetchall():
        _insert_entity(
            conn, name_to_id, row, "subagent", row["description"], row["content"],
            {"model": row["model"] or "", "tools": row["tools"] or ""},
        )

    for row in conn.execute("SELECT * FROM llm_providers").fetchall():
        _insert_entity(
            conn, name_to_id, row, "llm", "", "",
            {
                "provider_type": row["provider_type"] or "",
                "api_key": row["api_key"] or "",
                "base_url": row["base_url"] or "",
                "default_model": "",
            },
        )

    for table in _V1_TABLES + ("projects",):
        _drop_table_if_exists(conn, table)

    logger.info("Migrated v1 database to schema v2")
