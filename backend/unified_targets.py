"""Accessor functions that derive flat target dicts from ALL_INTEGRATIONS.

This module is the bridge between the Integration model layer and the
consumer modules (config_targets, skill_discovery, workflow_discovery,
llm_provider_discovery). It should not define any tool data directly —
all tool definitions live in backend/integrations/*.py.
"""

from __future__ import annotations

from typing import Any

from integrations import ALL_INTEGRATIONS
from integrations.base import Integration  # noqa: F401 – re-exported for convenience

# Legacy name kept for any callers that imported TOOLS directly
TOOLS = ALL_INTEGRATIONS


# ---------------------------------------------------------------------------
# Accessor helpers  (return plain dicts; callers construct typed objects)
# ---------------------------------------------------------------------------


def get_mcp_target_dicts(scope: str) -> list[dict[str, Any]]:
    """Return flat MCP target dicts for the given scope ('global' or 'project')."""
    result: list[dict[str, Any]] = []
    for integration in ALL_INTEGRATIONS:
        result.extend(d for d in integration.mcp_dicts() if d["scope"] == scope)
    return result


def get_skill_targets() -> list[dict[str, Any]]:
    """Return flat skill target dicts (all scopes), sorted by display_name."""
    result: list[dict[str, Any]] = []
    for integration in ALL_INTEGRATIONS:
        result.extend(integration.skill_dicts())
    return sorted(result, key=lambda t: t["display_name"].lower())


def get_workflow_targets() -> list[dict[str, Any]]:
    """Return flat workflow target dicts (all scopes), sorted by display_name."""
    result: list[dict[str, Any]] = []
    for integration in ALL_INTEGRATIONS:
        result.extend(integration.workflow_dicts())
    return sorted(result, key=lambda t: t["display_name"].lower())


def get_llm_targets() -> list[dict[str, Any]]:
    """Return flat LLM provider target dicts (all scopes)."""
    result: list[dict[str, Any]] = []
    for integration in ALL_INTEGRATIONS:
        result.extend(integration.llm_dicts())
    return result


def get_all_tool_ids() -> list[str]:
    """Return list of all canonical integration base IDs."""
    return [i.id for i in ALL_INTEGRATIONS]
