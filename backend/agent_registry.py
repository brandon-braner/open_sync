"""Local agent registry – persistent store for agents managed by OpenSync."""

from __future__ import annotations

import uuid

from database import get_connection
from models import Agent

SOURCE_TAG = "opensync"


def _row_to_agent(row) -> Agent:
    return Agent(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        content=row["content"],
        model=row["model"],
        tools=row["tools"],
        sources=[SOURCE_TAG],
    )


def list_agents(scope: str = "global", project: str | None = None) -> list[Agent]:
    """Return agents for the given scope."""
    conn = get_connection()
    try:
        if scope == "project" and project:
            rows = conn.execute(
                "SELECT * FROM agents WHERE scope = ? AND project = ?",
                (scope, project),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM agents WHERE scope = 'global' AND project = ''",
            ).fetchall()
        return [_row_to_agent(r) for r in rows]
    finally:
        conn.close()


def get_agent(
    name: str, scope: str = "global", project: str | None = None
) -> Agent | None:
    conn = get_connection()
    try:
        if scope == "project" and project:
            row = conn.execute(
                "SELECT * FROM agents WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM agents WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_agent(row)
    finally:
        conn.close()


def get_agent_by_id(agent_id: str) -> Agent | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
        if row is None:
            return None
        return _row_to_agent(row)
    finally:
        conn.close()


def add_agent(agent: Agent, scope: str = "global", project: str | None = None) -> Agent:
    conn = get_connection()
    try:
        actual_scope = scope if (scope == "project" and project) else "global"
        proj_val = project if (scope == "project" and project) else ""
        agent_id = agent.id or str(uuid.uuid4())

        existing = conn.execute(
            "SELECT id FROM agents WHERE name = ? AND scope = ? AND project = ?",
            (agent.name, actual_scope, proj_val),
        ).fetchone()

        if existing:
            agent_id = existing["id"]
            conn.execute(
                "UPDATE agents SET description = ?, content = ?, model = ?, tools = ? WHERE id = ?",
                (agent.description, agent.content, agent.model, agent.tools, agent_id),
            )
        else:
            conn.execute(
                """INSERT INTO agents
                   (id, name, scope, project, description, content, model, tools)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    agent_id,
                    agent.name,
                    actual_scope,
                    proj_val,
                    agent.description,
                    agent.content,
                    agent.model,
                    agent.tools,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    agent.id = agent_id
    agent.sources = [SOURCE_TAG]
    return agent


def remove_agent(name: str, scope: str = "global", project: str | None = None) -> bool:
    conn = get_connection()
    try:
        if scope == "project" and project:
            cur = conn.execute(
                "DELETE FROM agents WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            )
        else:
            cur = conn.execute(
                "DELETE FROM agents WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def rename_agent(agent_id: str, new_name: str) -> Agent | None:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE agents SET name = ? WHERE id = ?",
            (new_name, agent_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    finally:
        conn.close()
    return get_agent_by_id(agent_id)
