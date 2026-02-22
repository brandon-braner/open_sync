"""Local workflow registry – persistent store for workflows managed by OpenSync."""

from __future__ import annotations

import uuid

from database import get_connection
from models import Workflow

SOURCE_TAG = "opensync"


def _row_to_workflow(row) -> Workflow:
    return Workflow(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        content=row["content"],
        sources=[SOURCE_TAG],
    )


def list_workflows(scope: str = "global", project: str | None = None) -> list[Workflow]:
    conn = get_connection()
    try:
        if scope == "project" and project:
            rows = conn.execute(
                "SELECT * FROM workflows WHERE scope = ? AND project = ?",
                (scope, project),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM workflows WHERE scope = 'global' AND project = ''",
            ).fetchall()
        return [_row_to_workflow(r) for r in rows]
    finally:
        conn.close()


def get_workflow(
    name: str, scope: str = "global", project: str | None = None
) -> Workflow | None:
    conn = get_connection()
    try:
        if scope == "project" and project:
            row = conn.execute(
                "SELECT * FROM workflows WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM workflows WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_workflow(row)
    finally:
        conn.close()


def get_workflow_by_id(workflow_id: str) -> Workflow | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM workflows WHERE id = ?", (workflow_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_workflow(row)
    finally:
        conn.close()


def add_workflow(
    workflow: Workflow, scope: str = "global", project: str | None = None
) -> Workflow:
    conn = get_connection()
    try:
        actual_scope = scope if (scope == "project" and project) else "global"
        proj_val = project if (scope == "project" and project) else ""
        workflow_id = workflow.id or str(uuid.uuid4())

        existing = conn.execute(
            "SELECT id FROM workflows WHERE name = ? AND scope = ? AND project = ?",
            (workflow.name, actual_scope, proj_val),
        ).fetchone()

        if existing:
            workflow_id = existing["id"]
            conn.execute(
                "UPDATE workflows SET description = ?, content = ? WHERE id = ?",
                (workflow.description, workflow.content, workflow_id),
            )
        else:
            conn.execute(
                """INSERT INTO workflows
                   (id, name, scope, project, description, content)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    workflow_id,
                    workflow.name,
                    actual_scope,
                    proj_val,
                    workflow.description,
                    workflow.content,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    workflow.id = workflow_id
    workflow.sources = [SOURCE_TAG]
    return workflow


def remove_workflow(
    name: str, scope: str = "global", project: str | None = None
) -> bool:
    conn = get_connection()
    try:
        if scope == "project" and project:
            cur = conn.execute(
                "DELETE FROM workflows WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            )
        else:
            cur = conn.execute(
                "DELETE FROM workflows WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def rename_workflow(workflow_id: str, new_name: str) -> Workflow | None:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE workflows SET name = ? WHERE id = ?",
            (new_name, workflow_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    finally:
        conn.close()
    return get_workflow_by_id(workflow_id)
