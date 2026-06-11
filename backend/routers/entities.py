"""Generic entity routes, parameterised by kind.

kind ∈ mcp | skills | commands | subagents | llm (URL segment is plural
where natural; mapped to the internal kind names).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

import store
from engine import engine
from models import KIND_MODELS

router = APIRouter(tags=["entities"])

_URL_KINDS = {
    "mcp": "mcp",
    "skills": "skill",
    "commands": "command",
    "subagents": "subagent",
    "llm": "llm",
}


def _kind(url_kind: str) -> str:
    kind = _URL_KINDS.get(url_kind)
    if kind is None:
        raise HTTPException(status_code=404, detail=f"Unknown kind: {url_kind}")
    return kind


def _canonical(kind: str, payload: dict):
    try:
        return KIND_MODELS[kind].model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/{url_kind}/discover")
def discover(
    url_kind: str,
    scope: str = Query("global"),
    project_id: Optional[str] = Query(None),
):
    return engine.discover(_kind(url_kind), scope, project_id)


@router.post("/{url_kind}/import")
def import_items(url_kind: str, payload: dict):
    items = payload.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="items is required")
    imported = engine.import_items(_kind(url_kind), items)
    return {"imported": imported}


@router.get("/{url_kind}/status")
def status(
    url_kind: str,
    scope: str = Query("global"),
    project_id: Optional[str] = Query(None),
):
    return engine.status(_kind(url_kind), scope, project_id)


@router.get("/{url_kind}")
def list_entities(
    url_kind: str,
    scope: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
):
    return store.list_entities(_kind(url_kind), scope, project_id)


@router.post("/{url_kind}")
def create_entity(url_kind: str, payload: dict):
    kind = _kind(url_kind)
    scope = payload.get("scope", "global")
    project_id = payload.get("project_id")
    if scope == "project" and not project_id:
        raise HTTPException(
            status_code=400, detail="project_id is required for project scope"
        )
    canonical = _canonical(kind, payload)
    try:
        return store.create_entity(kind, canonical, scope, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.put("/{url_kind}/{entity_id}")
def update_entity(url_kind: str, entity_id: str, payload: dict):
    kind = _kind(url_kind)
    entity = store.get_entity(entity_id)
    if entity is None or entity.kind != kind:
        raise HTTPException(status_code=404, detail="Not found")
    canonical = _canonical(kind, payload)
    updated = store.update_entity(entity_id, canonical)
    if updated is None:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@router.delete("/{url_kind}/{entity_id}")
def delete_entity(url_kind: str, entity_id: str):
    kind = _kind(url_kind)
    entity = store.get_entity(entity_id)
    if entity is None or entity.kind != kind:
        raise HTTPException(status_code=404, detail="Not found")
    store.delete_entity(entity_id)
    return {"message": f"Deleted '{entity.name}'"}
