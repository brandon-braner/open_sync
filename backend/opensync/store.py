"""Generic CRUD over the v2 schema: entities, projects, sync state, backups."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from contextlib import contextmanager

from opensync.db import get_connection
from opensync.models import Entity, Project, build_canonical, split_canonical


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _db():
    """Connection that commits on success and always closes."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _entity_from_row(row: sqlite3.Row) -> Entity:
    return Entity(
        id=row["id"],
        kind=row["kind"],
        name=row["name"],
        scope=row["scope"],
        project_id=row["project_id"],
        description=row["description"] or "",
        content=row["content"] or "",
        data=json.loads(row["data"] or "{}"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def canonical_of(entity: Entity) -> BaseModel:
    return build_canonical(
        entity.kind, entity.name, entity.description, entity.content, entity.data
    )


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def list_projects() -> list[Project]:
    with _db() as conn:
        rows = conn.execute("SELECT * FROM projects_v2 ORDER BY name").fetchall()
    return [Project(id=r["id"], name=r["name"], path=r["path"]) for r in rows]


def get_project(project_id: str) -> Optional[Project]:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM projects_v2 WHERE id = ?", (project_id,)
        ).fetchone()
    return Project(id=row["id"], name=row["name"], path=row["path"]) if row else None


def add_project(name: str, path: str) -> Project:
    project = Project(id=str(uuid.uuid4()), name=name, path=path)
    with _db() as conn:
        try:
            conn.execute(
                "INSERT INTO projects_v2 (id, name, path) VALUES (?, ?, ?)",
                (project.id, project.name, project.path),
            )
        except sqlite3.IntegrityError:
            raise ValueError(f"A project with that name or path already exists")
    return project


def remove_project(project_id: str) -> bool:
    with _db() as conn:
        cur = conn.execute("DELETE FROM projects_v2 WHERE id = ?", (project_id,))
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------


def list_entities(
    kind: str, scope: Optional[str] = None, project_id: Optional[str] = None
) -> list[Entity]:
    query = "SELECT * FROM entities WHERE kind = ?"
    params: list = [kind]
    if scope:
        query += " AND scope = ?"
        params.append(scope)
        if scope == "project" and project_id:
            query += " AND project_id = ?"
            params.append(project_id)
    query += " ORDER BY name"
    with _db() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_entity_from_row(r) for r in rows]


def get_entity(entity_id: str) -> Optional[Entity]:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM entities WHERE id = ?", (entity_id,)
        ).fetchone()
    return _entity_from_row(row) if row else None


def find_entity(
    kind: str, name: str, scope: str, project_id: Optional[str]
) -> Optional[Entity]:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM entities WHERE kind=? AND name=? AND scope=? "
            "AND project_id IS ?",
            (kind, name, scope, project_id),
        ).fetchone()
    return _entity_from_row(row) if row else None


def create_entity(
    kind: str, canonical: BaseModel, scope: str, project_id: Optional[str]
) -> Entity:
    name, description, content, data = split_canonical(canonical)
    # SQLite UNIQUE treats NULL project_id values as distinct, so the table
    # constraint alone does not catch global-scope duplicates.
    if find_entity(kind, name, scope, project_id) is not None:
        raise ValueError(f"{kind} '{name}' already exists in this scope")
    now = _now()
    entity = Entity(
        id=str(uuid.uuid4()),
        kind=kind,
        name=name,
        scope=scope,
        project_id=project_id,
        description=description,
        content=content,
        data=data,
        created_at=now,
        updated_at=now,
    )
    with _db() as conn:
        try:
            conn.execute(
                """INSERT INTO entities
                   (id, kind, name, scope, project_id, description, data,
                    content, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    entity.id, kind, name, scope, project_id, description,
                    json.dumps(data), content, now, now,
                ),
            )
        except sqlite3.IntegrityError:
            raise ValueError(
                f"{kind} '{name}' already exists in this scope"
            )
    return entity


def update_entity(entity_id: str, canonical: BaseModel) -> Optional[Entity]:
    name, description, content, data = split_canonical(canonical)
    with _db() as conn:
        cur = conn.execute(
            """UPDATE entities
               SET name=?, description=?, data=?, content=?, updated_at=?
               WHERE id=?""",
            (name, description, json.dumps(data), content, _now(), entity_id),
        )
    if cur.rowcount == 0:
        return None
    return get_entity(entity_id)


def upsert_entity(
    kind: str, canonical: BaseModel, scope: str, project_id: Optional[str]
) -> Entity:
    name = canonical.model_dump()["name"]
    existing = find_entity(kind, name, scope, project_id)
    if existing:
        return update_entity(existing.id, canonical)
    return create_entity(kind, canonical, scope, project_id)


def delete_entity(entity_id: str) -> bool:
    with _db() as conn:
        cur = conn.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Sync state
# ---------------------------------------------------------------------------


def get_sync_states(entity_ids: list[str]) -> dict[tuple[str, str], dict]:
    """Map (entity_id, integration) → sync_state row dict."""
    if not entity_ids:
        return {}
    placeholders = ",".join("?" * len(entity_ids))
    with _db() as conn:
        rows = conn.execute(
            f"SELECT * FROM sync_state WHERE entity_id IN ({placeholders})",
            entity_ids,
        ).fetchall()
    return {(r["entity_id"], r["integration"]): dict(r) for r in rows}


def set_sync_state(
    entity_id: str,
    integration: str,
    scope: str,
    project_id: Optional[str],
    target_path: str,
    synced_hash: str,
) -> None:
    with _db() as conn:
        conn.execute(
            """INSERT INTO sync_state
               (entity_id, integration, scope, project_id, target_path,
                synced_hash, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (entity_id, integration) DO UPDATE SET
                 scope=excluded.scope, project_id=excluded.project_id,
                 target_path=excluded.target_path,
                 synced_hash=excluded.synced_hash, synced_at=excluded.synced_at""",
            (entity_id, integration, scope, project_id, target_path,
             synced_hash, _now()),
        )


def clear_sync_state(entity_id: str, integration: str) -> None:
    with _db() as conn:
        conn.execute(
            "DELETE FROM sync_state WHERE entity_id=? AND integration=?",
            (entity_id, integration),
        )


# ---------------------------------------------------------------------------
# Backup runs
# ---------------------------------------------------------------------------


def record_backup(run_id: str, label: str, directory: str) -> None:
    with _db() as conn:
        conn.execute(
            "INSERT INTO backup_runs (id, created_at, label, dir) VALUES (?, ?, ?, ?)",
            (run_id, _now(), label, directory),
        )


def list_backups(limit: int = 50) -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def prune_backup_records(keep_ids: list[str]) -> None:
    with _db() as conn:
        if keep_ids:
            placeholders = ",".join("?" * len(keep_ids))
            conn.execute(
                f"DELETE FROM backup_runs WHERE id NOT IN ({placeholders})", keep_ids
            )
        else:
            conn.execute("DELETE FROM backup_runs")
