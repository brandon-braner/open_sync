"""Local skill registry – persistent store for skills managed by OpenSync."""

from __future__ import annotations

import uuid

from database import get_connection
from models import Skill

SOURCE_TAG = "opensync"


def _row_to_skill(row) -> Skill:
    return Skill(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        content=row["content"],
        sources=[SOURCE_TAG],
    )


def list_skills(scope: str = "global", project: str | None = None) -> list[Skill]:
    """Return skills for the given scope."""
    conn = get_connection()
    try:
        if scope == "project" and project:
            rows = conn.execute(
                "SELECT * FROM skills WHERE scope = ? AND project = ?",
                (scope, project),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM skills WHERE scope = 'global' AND project = ''",
            ).fetchall()
        return [_row_to_skill(r) for r in rows]
    finally:
        conn.close()


def get_skill(
    name: str, scope: str = "global", project: str | None = None
) -> Skill | None:
    conn = get_connection()
    try:
        if scope == "project" and project:
            row = conn.execute(
                "SELECT * FROM skills WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM skills WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_skill(row)
    finally:
        conn.close()


def get_skill_by_id(skill_id: str) -> Skill | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM skills WHERE id = ?", (skill_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_skill(row)
    finally:
        conn.close()


def add_skill(
    skill: Skill, scope: str = "global", project: str | None = None
) -> Skill:
    conn = get_connection()
    try:
        actual_scope = scope if (scope == "project" and project) else "global"
        proj_val = project if (scope == "project" and project) else ""
        skill_id = skill.id or str(uuid.uuid4())

        existing = conn.execute(
            "SELECT id FROM skills WHERE name = ? AND scope = ? AND project = ?",
            (skill.name, actual_scope, proj_val),
        ).fetchone()

        if existing:
            skill_id = existing["id"]
            conn.execute(
                "UPDATE skills SET description = ?, content = ? WHERE id = ?",
                (skill.description, skill.content, skill_id),
            )
        else:
            conn.execute(
                """INSERT INTO skills
                   (id, name, scope, project, description, content)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    skill_id,
                    skill.name,
                    actual_scope,
                    proj_val,
                    skill.description,
                    skill.content,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    skill.id = skill_id
    skill.sources = [SOURCE_TAG]
    return skill


def remove_skill(name: str, scope: str = "global", project: str | None = None) -> bool:
    conn = get_connection()
    try:
        if scope == "project" and project:
            cur = conn.execute(
                "DELETE FROM skills WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            )
        else:
            cur = conn.execute(
                "DELETE FROM skills WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def rename_skill(skill_id: str, new_name: str) -> Skill | None:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE skills SET name = ? WHERE id = ?",
            (new_name, skill_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    finally:
        conn.close()
    return get_skill_by_id(skill_id)
