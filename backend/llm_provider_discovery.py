"""Discover and write LLM providers from/to global AI tool config files.

Currently supports:
- OpenCode  (~/.config/opencode/opencode.json)  — ``provider`` block
"""

from __future__ import annotations

import contextlib
import json
from pathlib import Path
from typing import Any

from models import LlmProvider


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_json(path: Path) -> dict[str, Any]:
    """Return parsed JSON from *path*, or {} if missing / unreadable."""
    with contextlib.suppress(Exception):
        if path.exists() and path.stat().st_size > 0:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return {}


def _write_json(path: Path, data: dict[str, Any]) -> None:
    """Write *data* as pretty-printed JSON, creating parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# Writable LLM provider targets
# ---------------------------------------------------------------------------

LLM_PROVIDER_TARGETS: list[dict[str, str]] = [
    {
        "id": "opencode",
        "display_name": "OpenCode (global)",
        "config_path": "~/.config/opencode/opencode.json",
        "scope": "global",
        "color": "#FF6B6B",
    },
    {
        "id": "opencode_project",
        "display_name": "OpenCode (project)",
        "config_path": "opencode.json",  # relative to project root
        "scope": "project",
        "color": "#FF9F7F",
    },
    # Future targets: cursor, continue, etc.
]


def list_llm_provider_targets() -> list[dict[str, str]]:
    """Return all known writable LLM provider targets."""
    return LLM_PROVIDER_TARGETS


# ---------------------------------------------------------------------------
# OpenCode — discovery
# ---------------------------------------------------------------------------

_OPENCODE_CONFIG_PATH = Path("~/.config/opencode/opencode.json")


def _discover_opencode(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse the ``provider`` block from an OpenCode global config."""
    path = (config_path or _OPENCODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    providers_raw: dict[str, Any] = data.get("provider", {})
    if not isinstance(providers_raw, dict):
        return []

    result: list[LlmProvider] = []
    for key, entry in providers_raw.items():
        if not isinstance(entry, dict):
            continue

        display_name: str = entry.get("name") or key
        options: dict[str, Any] = entry.get("options", {}) or {}
        api_key: str | None = options.get("apiKey") or None
        base_url: str | None = options.get("baseURL") or options.get("baseUrl") or None

        # "api" in opencode is sometimes a base URL (e.g. zhipuai), not a key.
        # Treat it as base_url only when it looks like a URL.
        raw_api = entry.get("api")
        if raw_api and isinstance(raw_api, str) and raw_api.startswith("http"):
            base_url = raw_api
            api_key = None

        result.append(
            LlmProvider(
                name=display_name,
                provider_type=key,
                api_key=api_key,
                base_url=base_url,
                sources=["opencode"],
            )
        )

    return result


# ---------------------------------------------------------------------------
# OpenCode — write
# ---------------------------------------------------------------------------


def _provider_to_opencode_entry(provider: LlmProvider) -> dict[str, Any]:
    """Convert a canonical LlmProvider to an OpenCode provider dict entry."""
    entry: dict[str, Any] = {}

    # Only add "name" when it differs from the key (provider_type)
    if provider.name and provider.name != provider.provider_type:
        entry["name"] = provider.name

    options: dict[str, Any] = {}
    if provider.base_url:
        options["baseURL"] = provider.base_url
    if provider.api_key:
        options["apiKey"] = provider.api_key
    if options:
        entry["options"] = options

    return entry


def _write_provider_to_opencode(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert a single provider entry into an OpenCode config file."""
    path = (config_path or _OPENCODE_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "provider" not in data or not isinstance(data["provider"], dict):
            data["provider"] = {}
        key = provider.provider_type or provider.name
        data["provider"][key] = _provider_to_opencode_entry(provider)
        _write_json(path, data)
        return {"success": True, "message": f"Written to OpenCode as provider '{key}'"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to OpenCode: {exc}"}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def discover_all_llm_providers() -> list[LlmProvider]:
    """Return LLM providers discovered from all known global config files."""
    providers: list[LlmProvider] = []
    providers.extend(_discover_opencode())
    # Future: add _discover_cursor(), _discover_continue(), etc. here
    return providers


def write_provider_to_target(
    provider: LlmProvider, target_id: str, project_path: str | None = None
) -> dict[str, Any]:
    """Write *provider* to the config file for the given *target_id*.

    For project-scoped targets, pass *project_path* to resolve the config
    file relative to the project root.

    Returns a dict with ``success`` (bool) and ``message`` (str).
    """
    if target_id == "opencode":
        return _write_provider_to_opencode(provider)

    if target_id == "opencode_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the opencode_project target",
            }
        config = Path(project_path) / "opencode.json"
        return _write_provider_to_opencode(provider, config)

    return {"success": False, "message": f"Unknown LLM provider target: '{target_id}'"}
