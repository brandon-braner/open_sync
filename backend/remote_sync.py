"""FastAPI router – Remote OpenSync server sync.

This module provides two groups of endpoints:

**Server-side** (this instance is the remote):
  GET  /api/remote/catalog
      Returns all global-scope artifacts so remote clients can browse them.

**Client-side** (this instance consumes a remote):
  GET    /api/remote/servers               – List registered remote servers
  POST   /api/remote/servers               – Register a new remote server
  DELETE /api/remote/servers/{sid}         – Remove a registered remote server
  GET    /api/remote/servers/{sid}/catalog – Fetch the remote catalog
  POST   /api/remote/servers/{sid}/pull    – Pull selected artifacts locally
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel as _BaseModel

import agent_registry
import llm_provider_registry
import server_registry
import skill_registry
import workflow_registry
from database import get_connection
from models import (
    PullRequest,
    RemoteCatalog,
    RemoteServer,
)

router = APIRouter(prefix="/api/remote", tags=["Remote Sync"])

# ---------------------------------------------------------------------------
# Internal DB helpers for remote_servers table
# ---------------------------------------------------------------------------


def _row_to_remote_server(row) -> RemoteServer:
    return RemoteServer(
        id=row["id"],
        name=row["name"],
        url=row["url"],
        api_key=row["api_key"],
        created_at=row["created_at"],
    )


def _list_remote_servers() -> list[RemoteServer]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM remote_servers ORDER BY created_at"
        ).fetchall()
        return [_row_to_remote_server(r) for r in rows]
    finally:
        conn.close()


def _get_remote_server(sid: str) -> RemoteServer | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM remote_servers WHERE id = ?", (sid,)
        ).fetchone()
        return _row_to_remote_server(row) if row else None
    finally:
        conn.close()


def _add_remote_server(name: str, url: str, api_key: Optional[str]) -> RemoteServer:
    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO remote_servers (id, name, url, api_key, created_at) VALUES (?, ?, ?, ?, ?)",
            (sid, name, url.rstrip("/"), api_key, now),
        )
        conn.commit()
    except Exception as exc:
        conn.close()
        # Surface unique-constraint violations as a clear HTTP error
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=409,
                detail=f"A remote server with URL '{url}' is already registered",
            )
        raise
    conn.close()
    return RemoteServer(
        id=sid, name=name, url=url.rstrip("/"), api_key=api_key, created_at=now
    )


def _delete_remote_server(sid: str) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute("DELETE FROM remote_servers WHERE id = ?", (sid,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Server-side: expose this instance's catalog
# ---------------------------------------------------------------------------


@router.get(
    "/catalog",
    response_model=RemoteCatalog,
    summary="Expose this OpenSync instance's global artifact catalog",
    description=(
        "Returns all global-scope artifacts registered on this OpenSync server "
        "so that remote clients can browse and pull from it."
    ),
)
def get_local_catalog() -> RemoteCatalog:
    """Return all global artifacts published by this OpenSync instance."""
    return RemoteCatalog(
        servers=server_registry.list_servers("global"),
        skills=skill_registry.list_skills("global"),
        workflows=workflow_registry.list_workflows("global"),
        agents=agent_registry.list_agents("global"),
        llm_providers=llm_provider_registry.list_llm_providers("global"),
    )


# ---------------------------------------------------------------------------
# Client-side: manage registered remote servers
# ---------------------------------------------------------------------------


class _RegisterRequest(_BaseModel):
    name: str
    url: str
    api_key: Optional[str] = None


@router.get(
    "/servers",
    response_model=list[RemoteServer],
    summary="List registered remote OpenSync servers",
)
def list_remote_servers() -> list[RemoteServer]:
    return _list_remote_servers()


@router.post(
    "/servers",
    response_model=RemoteServer,
    status_code=201,
    summary="Register a remote OpenSync server",
)
def add_remote_server(req: _RegisterRequest) -> RemoteServer:
    """Persist a remote OpenSync server URL for future catalog browsing."""
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400, detail="url must start with http:// or https://"
        )
    return _add_remote_server(req.name, req.url, req.api_key)


@router.delete(
    "/servers/{sid}",
    summary="Remove a registered remote OpenSync server",
)
def remove_remote_server(sid: str) -> dict:
    if not _delete_remote_server(sid):
        raise HTTPException(status_code=404, detail=f"Remote server '{sid}' not found")
    return {"message": "Remote server removed"}


# ---------------------------------------------------------------------------
# Client-side: browse & pull from a remote
# ---------------------------------------------------------------------------


def _build_headers(remote: RemoteServer) -> dict[str, str]:
    """Return HTTP headers for calling the remote, including auth if configured."""
    headers: dict[str, str] = {"Accept": "application/json"}
    if remote.api_key:
        headers["Authorization"] = f"Bearer {remote.api_key}"
    return headers


async def _fetch_remote_catalog(remote: RemoteServer) -> RemoteCatalog:
    """Fetch the catalog from a remote OpenSync instance."""
    url = f"{remote.url}/api/remote/catalog"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=_build_headers(remote))
            resp.raise_for_status()
            return RemoteCatalog(**resp.json())
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Remote server returned {exc.response.status_code}: {exc.response.text}",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to reach remote OpenSync server: {exc}",
        )


@router.get(
    "/servers/{sid}/catalog",
    response_model=RemoteCatalog,
    summary="Fetch the artifact catalog from a registered remote OpenSync server",
)
async def get_remote_catalog(sid: str) -> RemoteCatalog:
    remote = _get_remote_server(sid)
    if remote is None:
        raise HTTPException(status_code=404, detail=f"Remote server '{sid}' not found")
    return await _fetch_remote_catalog(remote)


@router.post(
    "/servers/{sid}/pull",
    summary="Pull selected artifacts from a remote OpenSync server into the local registry",
    description=(
        "Fetches the named artifacts from the remote server's catalog and imports "
        "them into the local registry under the specified scope."
    ),
)
async def pull_from_remote(sid: str, req: PullRequest) -> dict:
    """Pull selected artifacts from a remote server into the local registry."""
    remote = _get_remote_server(sid)
    if remote is None:
        raise HTTPException(status_code=404, detail=f"Remote server '{sid}' not found")

    catalog = await _fetch_remote_catalog(remote)

    scope = req.scope
    project = req.project_name
    imported: dict[str, list[str]] = {
        "servers": [],
        "skills": [],
        "workflows": [],
        "agents": [],
        "llm_providers": [],
    }

    # -- MCP Servers --
    catalog_servers = {s.name: s for s in catalog.servers}
    for name in req.server_names:
        if name not in catalog_servers:
            continue
        srv = catalog_servers[name]
        srv.id = None  # force fresh UUID in local registry
        srv.sources = []
        server_registry.add_server(srv, scope, project)
        imported["servers"].append(name)

    # -- Skills --
    catalog_skills = {s.name: s for s in catalog.skills}
    for name in req.skill_names:
        if name not in catalog_skills:
            continue
        skill = catalog_skills[name]
        skill.id = None
        skill.sources = []
        skill_registry.add_skill(skill, scope, project)
        imported["skills"].append(name)

    # -- Workflows --
    catalog_workflows = {w.name: w for w in catalog.workflows}
    for name in req.workflow_names:
        if name not in catalog_workflows:
            continue
        wf = catalog_workflows[name]
        wf.id = None
        wf.sources = []
        workflow_registry.add_workflow(wf, scope, project)
        imported["workflows"].append(name)

    # -- Agents --
    catalog_agents = {a.name: a for a in catalog.agents}
    for name in req.agent_names:
        if name not in catalog_agents:
            continue
        agent = catalog_agents[name]
        agent.id = None
        agent.sources = []
        agent_registry.add_agent(agent, scope, project)
        imported["agents"].append(name)

    # -- LLM Providers --
    catalog_providers = {p.name: p for p in catalog.llm_providers}
    for name in req.llm_provider_names:
        if name not in catalog_providers:
            continue
        prov = catalog_providers[name]
        prov.id = None
        prov.sources = []
        llm_provider_registry.add_llm_provider(prov, scope, project)
        imported["llm_providers"].append(name)

    total = sum(len(v) for v in imported.values())
    return {"imported": imported, "total": total}
