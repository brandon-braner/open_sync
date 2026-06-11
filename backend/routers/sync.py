"""Sync plan / apply / pull."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engine import engine

router = APIRouter(prefix="/sync", tags=["sync"])

_KIND_ALIASES = {
    "mcp": "mcp",
    "skills": "skill",
    "skill": "skill",
    "rules": "rule",
    "rule": "rule",
    "commands": "command",
    "command": "command",
    "subagents": "subagent",
    "subagent": "subagent",
    "llm": "llm",
}


class PlanRequest(BaseModel):
    kind: str
    entity_ids: list[str]
    integrations: list[str]
    force: list[dict] = Field(default_factory=list)  # [{entity_id, integration}]


class ApplyRequest(BaseModel):
    plan_id: str


class PullRequest(BaseModel):
    entity_id: str
    integration: str


@router.post("/plan")
def plan(req: PlanRequest):
    kind = _KIND_ALIASES.get(req.kind)
    if kind is None:
        raise HTTPException(status_code=400, detail=f"Unknown kind: {req.kind}")
    if not req.entity_ids or not req.integrations:
        raise HTTPException(
            status_code=400, detail="entity_ids and integrations are required"
        )
    return engine.plan_sync(kind, req.entity_ids, req.integrations, req.force)


@router.post("/apply")
def apply(req: ApplyRequest):
    result = engine.apply_plan(req.plan_id)
    if not result.success:
        raise HTTPException(status_code=409, detail=result.message)
    return result


@router.post("/pull")
def pull(req: PullRequest):
    entity = engine.pull(req.entity_id, req.integration)
    if entity is None:
        raise HTTPException(
            status_code=404,
            detail="Item not found in that tool's configuration",
        )
    return entity
