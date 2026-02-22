"""Local LLM provider registry – persistent store for providers managed by OpenSync."""

from __future__ import annotations

import uuid

from database import get_connection
from models import LlmProvider

SOURCE_TAG = "opensync"


def _row_to_llm_provider(row) -> LlmProvider:
    return LlmProvider(
        id=row["id"],
        name=row["name"],
        provider_type=row["provider_type"],
        api_key=row["api_key"],
        base_url=row["base_url"],
        sources=[SOURCE_TAG],
    )


def list_llm_providers(scope: str = "global", project: str | None = None) -> list[LlmProvider]:
    conn = get_connection()
    try:
        if scope == "project" and project:
            rows = conn.execute(
                "SELECT * FROM llm_providers WHERE scope = ? AND project = ?",
                (scope, project),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM llm_providers WHERE scope = 'global' AND project = ''",
            ).fetchall()
        return [_row_to_llm_provider(r) for r in rows]
    finally:
        conn.close()


def get_llm_provider(
    name: str, scope: str = "global", project: str | None = None
) -> LlmProvider | None:
    conn = get_connection()
    try:
        if scope == "project" and project:
            row = conn.execute(
                "SELECT * FROM llm_providers WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM llm_providers WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            ).fetchone()
        if row is None:
            return None
        return _row_to_llm_provider(row)
    finally:
        conn.close()


def get_llm_provider_by_id(provider_id: str) -> LlmProvider | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM llm_providers WHERE id = ?", (provider_id,)
        ).fetchone()
        if row is None:
            return None
        return _row_to_llm_provider(row)
    finally:
        conn.close()


def add_llm_provider(
    provider: LlmProvider, scope: str = "global", project: str | None = None
) -> LlmProvider:
    conn = get_connection()
    try:
        actual_scope = scope if (scope == "project" and project) else "global"
        proj_val = project if (scope == "project" and project) else ""
        provider_id = provider.id or str(uuid.uuid4())

        existing = conn.execute(
            "SELECT id FROM llm_providers WHERE name = ? AND scope = ? AND project = ?",
            (provider.name, actual_scope, proj_val),
        ).fetchone()

        if existing:
            provider_id = existing["id"]
            conn.execute(
                "UPDATE llm_providers SET provider_type = ?, api_key = ?, base_url = ? WHERE id = ?",
                (provider.provider_type, provider.api_key, provider.base_url, provider_id),
            )
        else:
            conn.execute(
                """INSERT INTO llm_providers
                   (id, name, scope, project, provider_type, api_key, base_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    provider_id,
                    provider.name,
                    actual_scope,
                    proj_val,
                    provider.provider_type,
                    provider.api_key,
                    provider.base_url,
                ),
            )
        conn.commit()
    finally:
        conn.close()
    provider.id = provider_id
    provider.sources = [SOURCE_TAG]
    return provider


def remove_llm_provider(name: str, scope: str = "global", project: str | None = None) -> bool:
    conn = get_connection()
    try:
        if scope == "project" and project:
            cur = conn.execute(
                "DELETE FROM llm_providers WHERE name = ? AND scope = ? AND project = ?",
                (name, scope, project),
            )
        else:
            cur = conn.execute(
                "DELETE FROM llm_providers WHERE name = ? AND scope = 'global' AND project = ''",
                (name,),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def rename_llm_provider(provider_id: str, new_name: str) -> LlmProvider | None:
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE llm_providers SET name = ? WHERE id = ?",
            (new_name, provider_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    finally:
        conn.close()
    return get_llm_provider_by_id(provider_id)
