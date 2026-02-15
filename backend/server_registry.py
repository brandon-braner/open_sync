"""Local server registry – persistent store for MCP servers managed by OpenSync.

Servers are stored in the ``opensync.db`` SQLite database.  The table has
columns for scope (global / project) and an optional project name, replacing
the old nested-JSON structure in ``servers.json``.
"""

from __future__ import annotations

import json
import uuid

from database import get_connection
from models import McpServer

SOURCE_TAG = "opensync"


def _row_to_server(row) -> McpServer:
    """Convert a sqlite3.Row to an McpServer."""
    return McpServer(
        id=row["id"],
        name=row["name"],
        command=row["command"],
        args=json.loads(row["args"]) if row["args"] else [],
        env=json.loads(row["env"]) if row["env"] else {},
        type=row["type"],
        url=row["url"],
        headers=json.loads(row["headers"]) if row["headers"] else {},
        sources=[SOURCE_TAG],
    )


def list_servers(scope: str = "global", project: str | None = None) -> list[McpServer]:
    """Return servers for the given scope."""
    conn = get_connection()
    try:
        if scope == "project" and project:
            rows = conn.execute(
                "SELECT * FROM servers WHERE scope = ? AND project = ?",
                (scope, project),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM servers WHERE scope = 'global' AND project = ''",
            ).fetchall()
        return [_row_to_server(r) for r in rows]
    finally:
        conn.close()


def get_server(
    name: str, scope: str = "global", project: str | None = None
) -> McpServer | None:
    """Look up a single server by name in the given scope."""
    conn = get_connection()
    try:
        if scope == "project" and project:
            row = conn.execute(
                "SELECT * FROM servers WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM servers WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_server(row)
    finally:
        conn.close()


def get_server_by_id(server_id: str) -> McpServer | None:
    """Look up a single server by its stable UUID."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM servers WHERE id = ?", (server_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_server(row)
    finally:
        conn.close()


def add_server(
    server: McpServer, scope: str = "global", project: str | None = None
) -> McpServer:
    """Add or update a server in the given scope. Returns the saved server."""
    conn = get_connection()
    try:
        actual_scope = scope if (scope == "project" and project) else "global"
        proj_val = project if (scope == "project" and project) else ""
        server_id = server.id or str(uuid.uuid4())

        # Check if a server with this name already exists in this scope
        existing = conn.execute(
            "SELECT id FROM servers WHERE name = ? AND scope = ? AND project = ?",
            (server.name, actual_scope, proj_val),
        ).fetchone()

        if existing:
            # Update existing entry, keep the same id
            server_id = existing["id"]
            conn.execute(
                """UPDATE servers SET command = ?, args = ?, env = ?,
                   type = ?, url = ?, headers = ? WHERE id = ?""",
                (
                    server.command,
                    json.dumps(server.args) if server.args else "[]",
                    json.dumps(server.env) if server.env else "{}",
                    server.type,
                    server.url,
                    json.dumps(server.headers) if server.headers else "{}",
                    server_id,
                ),
            )
        else:
            conn.execute(
                """INSERT INTO servers
                   (id, name, scope, project, command, args, env, type, url, headers)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    server_id,
                    server.name,
                    actual_scope,
                    proj_val,
                    server.command,
                    json.dumps(server.args) if server.args else "[]",
                    json.dumps(server.env) if server.env else "{}",
                    server.type,
                    server.url,
                    json.dumps(server.headers) if server.headers else "{}",
                ),
            )
        conn.commit()
    finally:
        conn.close()
    server.id = server_id
    server.sources = [SOURCE_TAG]
    return server


def remove_server(name: str, scope: str = "global", project: str | None = None) -> bool:
    """Remove a server from the given scope. Returns True if it existed."""
    conn = get_connection()
    try:
        if scope == "project" and project:
            cur = conn.execute(
                "DELETE FROM servers WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            )
        else:
            cur = conn.execute(
                "DELETE FROM servers WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def rename_server(server_id: str, new_name: str) -> McpServer | None:
    """Rename a server by its stable ID. Returns the updated server or None."""
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE servers SET name = ? WHERE id = ?",
            (new_name, server_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    finally:
        conn.close()
    return get_server_by_id(server_id)
