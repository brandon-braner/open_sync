"""Expose the integration manifests — the frontend derives every tool list,
capability flag, and caveat from this single endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from opensync.engine import paths
from opensync.integrations import ALL_INTEGRATIONS

router = APIRouter(tags=["integrations"])


@router.get("/integrations")
def list_integrations():
    result = []
    for integration in ALL_INTEGRATIONS:
        targets = {}
        for kind, scopes in integration.targets.items():
            targets[kind] = {}
            for scope, target in scopes.items():
                entry = target.model_dump()
                if scope == "global":
                    resolved = paths.resolve(target)
                    entry["resolved_path"] = str(resolved)
                    entry["exists"] = resolved.exists()
                targets[kind][scope] = entry
        result.append(
            {
                "id": integration.id,
                "display_name": integration.display_name,
                "color": integration.color,
                "category": integration.category,
                "docs_url": integration.docs_url,
                "notes": integration.notes,
                "targets": targets,
            }
        )
    return result
