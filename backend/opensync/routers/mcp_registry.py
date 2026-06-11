"""Proxy to the official MCP Registry (browse + import into OpenSync)."""

from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from opensync import mcp_registry_client
from opensync import store
from opensync.models import McpServer

router = APIRouter(prefix="/mcp-registry", tags=["mcp-registry"])


class RegistryImportRequest(BaseModel):
    server_name: str
    scope: str = "global"
    project_id: Optional[str] = None


@router.get("/search")
async def search(
    q: str = Query("", description="Search query"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        return await mcp_registry_client.search_servers(q, cursor, limit)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"MCP Registry error: {exc.response.text}",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Failed to reach MCP Registry: {exc}"
        )


@router.post("/import")
async def import_server(req: RegistryImportRequest):
    try:
        data = await mcp_registry_client.get_server_detail(req.server_name)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"MCP Registry error: {exc.response.text}",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Failed to reach MCP Registry: {exc}"
        )

    server = _transform_registry_server(data)
    try:
        return store.create_entity("mcp", server, req.scope, req.project_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


_RUNTIME_MAP = {
    "npm": "npx",
    "pypi": "uvx",
    "oci": "docker",
}


def _append_argument(args: list[str], arg: dict) -> None:
    name = arg.get("name", "")
    value = arg.get("value", arg.get("default", ""))
    if arg.get("type") == "named" and name:
        args.append(f"--{name}" if not name.startswith("-") else name)
        if value:
            args.append(value)
    elif value:
        args.append(value)


def _transform_registry_server(data: dict) -> McpServer:
    """Convert an official MCP registry ServerJSON into a canonical McpServer."""
    server_json = data.get("server", data)
    name = server_json["name"]
    title = server_json.get("title") or name.rsplit("/", 1)[-1]

    packages = server_json.get("packages") or []
    remotes = server_json.get("remotes") or []

    # Prefer the first stdio package, fall back to first available
    pkg = next(
        (p for p in packages if p.get("transport", {}).get("type") == "stdio"),
        packages[0] if packages else None,
    )

    command = None
    args: list[str] = []
    env: dict[str, str] = {}
    srv_type = None
    url = None

    if pkg:
        reg_type = pkg.get("registryType", "")
        identifier = pkg.get("identifier", "")
        transport = pkg.get("transport", {})
        srv_type = transport.get("type")
        url = transport.get("url")

        runtime = pkg.get("runtimeHint") or _RUNTIME_MAP.get(reg_type)
        if runtime:
            command = runtime
            args = (
                ["run", "-i", "--rm", identifier]
                if reg_type == "oci"
                else ["-y", identifier]
            )
        else:
            command = identifier

        for pa in pkg.get("packageArguments") or []:
            _append_argument(args, pa)
        for ra in pkg.get("runtimeArguments") or []:
            _append_argument(args, ra)
        for ev in pkg.get("environmentVariables") or []:
            if ev.get("name"):
                env[ev["name"]] = ev.get("value") or ev.get("default") or ""
    elif remotes:
        remote = remotes[0]
        srv_type = remote.get("type")
        url = remote.get("url")

    return McpServer(
        name=title, command=command, args=args, env=env, type=srv_type, url=url
    )
