"""Client for the official MCP Registry at registry.modelcontextprotocol.io."""

from __future__ import annotations

from typing import Any

import httpx

REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1"
_TIMEOUT = 15.0


async def search_servers(
    query: str = "",
    cursor: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    """Search the official MCP registry for servers.

    Returns the raw JSON response with ``servers`` and ``metadata`` keys.
    """
    params: dict[str, Any] = {"version": "latest", "limit": min(limit, 100)}
    if query:
        params["search"] = query
    if cursor:
        params["cursor"] = cursor

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{REGISTRY_BASE}/servers", params=params)
        resp.raise_for_status()
        return resp.json()


async def get_server_detail(server_name: str) -> dict[str, Any]:
    """Fetch the latest version of a specific MCP server from the registry."""
    encoded = server_name.replace("/", "%2F")
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{REGISTRY_BASE}/servers/{encoded}/versions/latest")
        resp.raise_for_status()
        return resp.json()
