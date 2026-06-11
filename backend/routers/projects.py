"""Project CRUD. Creating a project auto-discovers and imports everything
already configured in that directory."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

import store
from engine import engine
from integrations.base import ENTITY_KINDS

router = APIRouter(tags=["projects"])


@router.get("/projects")
def list_projects():
    return store.list_projects()


@router.post("/projects")
def add_project(data: dict):
    name = (data.get("name") or "").strip()
    path = (data.get("path") or "").strip()
    if not name or not path:
        raise HTTPException(status_code=400, detail="name and path are required")
    resolved = Path(path).expanduser()
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {resolved}")
    try:
        project = store.add_project(name, str(resolved))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Auto-import everything already configured in the project directory.
    imported: dict[str, list[str]] = {}
    if data.get("auto_import", True):
        for kind in ENTITY_KINDS:
            try:
                discovered = engine.discover(kind, "project", project.id)
                specs = [
                    {
                        "name": item.name,
                        "integration": item.sources[0],
                        "scope": "project",
                        "project_id": project.id,
                    }
                    for item in discovered
                ]
                entities = engine.import_items(kind, specs)
                if entities:
                    imported[kind] = [e.name for e in entities]
            except Exception:
                continue  # never fail project creation over one bad config
    return {"project": project, "imported": imported}


@router.delete("/projects/{project_id}")
def remove_project(project_id: str):
    if not store.remove_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project removed"}
