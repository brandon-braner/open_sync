"""Discover and write LLM providers from/to global AI tool config files.

Currently supports:
- OpenCode     (~/.config/opencode/opencode.json)           — ``provider`` block
- Continue     (~/.continue/config.yaml)                    — ``models`` array
- Aider        (~/.aider.conf.yml)                          — flat YAML keys
- Claude Code  (~/.claude.json)                             — ``providers`` dict
- Roo/Cline    (VS Code settings.json)                      — ``cline.*`` keys
- Windsurf     (~/.codeium/windsurf/mcp_settings.json)      — ``aiProviders`` dict
- Plandex      (~/.plandex-home/*.json)                     — ``openAIBase`` key
- Gemini CLI   (~/.gemini/settings.json)                    — ``model`` key
- Amp          (~/.amp/settings.json)                       — ``model.*`` keys
- Cursor       (~/.cursor/ SQLite)                          — read-only via DB
"""

from __future__ import annotations

import contextlib
import json
import sqlite3
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


def _read_yaml(path: Path) -> dict[str, Any]:
    """Return parsed YAML from *path*, or {} if missing/unreadable/no PyYAML."""
    try:
        import yaml  # type: ignore
    except ImportError:
        return {}
    with contextlib.suppress(Exception):
        if path.exists() and path.stat().st_size > 0:
            with open(path, "r", encoding="utf-8") as f:
                result = yaml.safe_load(f)
                if isinstance(result, dict):
                    return result
    return {}


def _write_yaml(path: Path, data: dict[str, Any]) -> None:
    """Write *data* as YAML, creating parent dirs if needed."""
    import yaml  # type: ignore

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)


# ---------------------------------------------------------------------------
# Writable LLM provider targets
# ---------------------------------------------------------------------------

from unified_targets import get_llm_targets as _get_llm_targets

LLM_PROVIDER_TARGETS: list[dict] = _get_llm_targets()


def list_llm_provider_targets() -> list[dict]:
    """Return all known writable LLM provider targets."""
    return _get_llm_targets()


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
# Continue — discovery  (~/.continue/config.yaml)
# ---------------------------------------------------------------------------

_CONTINUE_CONFIG_PATH = Path("~/.continue/config.yaml")


def _discover_continue(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse the ``models`` array from a Continue config.yaml."""
    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    data = _read_yaml(path)
    models = data.get("models", [])
    if not isinstance(models, list):
        return []

    result: list[LlmProvider] = []
    for entry in models:
        if not isinstance(entry, dict):
            continue
        provider_type: str = entry.get("provider") or ""
        title: str = entry.get("title") or entry.get("model") or provider_type
        api_key: str | None = entry.get("apiKey") or None
        base_url: str | None = entry.get("apiBase") or None

        if not title:
            continue

        result.append(
            LlmProvider(
                name=title,
                provider_type=provider_type or title,
                api_key=api_key,
                base_url=base_url,
                sources=["continue"],
            )
        )
    return result


# ---------------------------------------------------------------------------
# Continue — write
# ---------------------------------------------------------------------------


def _write_provider_to_continue(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert a provider entry into Continue's models array."""
    try:
        import yaml  # type: ignore  # noqa: F401
    except ImportError:
        return {
            "success": False,
            "message": "PyYAML is required to write Continue config",
        }

    path = (config_path or _CONTINUE_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(path)
        if "models" not in data or not isinstance(data["models"], list):
            data["models"] = []

        # Find and update existing entry by provider_type, or append
        key = provider.provider_type or provider.name
        existing_idx = next(
            (
                i
                for i, m in enumerate(data["models"])
                if isinstance(m, dict) and m.get("provider") == key
            ),
            None,
        )
        entry: dict[str, Any] = {"provider": key, "title": provider.name}
        if provider.api_key:
            entry["apiKey"] = provider.api_key
        if provider.base_url:
            entry["apiBase"] = provider.base_url

        if existing_idx is not None:
            data["models"][existing_idx] = entry
        else:
            data["models"].append(entry)

        _write_yaml(path, data)
        return {"success": True, "message": f"Written to Continue as model '{key}'"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Continue: {exc}"}


# ---------------------------------------------------------------------------
# Aider — discovery  (~/.aider.conf.yml)
# ---------------------------------------------------------------------------

_AIDER_CONFIG_PATH = Path("~/.aider.conf.yml")


def _discover_aider(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse OpenAI-compatible keys from an Aider config YAML."""
    path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    data = _read_yaml(path)
    if not data:
        return []

    api_key: str | None = data.get("openai-api-key") or None
    base_url: str | None = data.get("openai-api-base") or None
    model: str | None = data.get("model") or None

    # Only emit a provider if we found at least one meaningful field
    if not any([api_key, base_url, model]):
        return []

    name = model or "aider"
    return [
        LlmProvider(
            name=name,
            provider_type="openai",
            api_key=api_key,
            base_url=base_url,
            sources=["aider"],
        )
    ]


# ---------------------------------------------------------------------------
# Aider — write
# ---------------------------------------------------------------------------


def _write_provider_to_aider(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert provider fields into Aider's flat YAML config."""
    try:
        import yaml  # type: ignore  # noqa: F401
    except ImportError:
        return {"success": False, "message": "PyYAML is required to write Aider config"}

    path = (config_path or _AIDER_CONFIG_PATH).expanduser()
    try:
        data = _read_yaml(path)
        if provider.api_key:
            data["openai-api-key"] = provider.api_key
        if provider.base_url:
            data["openai-api-base"] = provider.base_url
        if provider.name and provider.name != "aider":
            data["model"] = provider.name
        _write_yaml(path, data)
        return {"success": True, "message": "Written to Aider config"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Aider: {exc}"}


# ---------------------------------------------------------------------------
# Claude Code — discovery  (~/.claude.json)
# ---------------------------------------------------------------------------

_CLAUDE_CODE_CONFIG_PATH = Path("~/.claude.json")


def _discover_claude_code(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse the ``providers`` dict from a Claude Code config JSON."""
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    data = _read_json(path)
    providers_raw: dict[str, Any] = data.get("providers", {})
    if not isinstance(providers_raw, dict):
        return []

    result: list[LlmProvider] = []
    for key, entry in providers_raw.items():
        if not isinstance(entry, dict):
            continue
        display_name: str = entry.get("name") or key
        api_key: str | None = entry.get("apiKey") or None
        base_url: str | None = entry.get("baseURL") or entry.get("baseUrl") or None
        result.append(
            LlmProvider(
                name=display_name,
                provider_type=key,
                api_key=api_key,
                base_url=base_url,
                sources=["claude_code"],
            )
        )
    return result


# ---------------------------------------------------------------------------
# Claude Code — write
# ---------------------------------------------------------------------------


def _write_provider_to_claude_code(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert a provider entry into Claude Code's providers dict."""
    path = (config_path or _CLAUDE_CODE_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "providers" not in data or not isinstance(data["providers"], dict):
            data["providers"] = {}
        key = provider.provider_type or provider.name
        entry: dict[str, Any] = {}
        if provider.name and provider.name != key:
            entry["name"] = provider.name
        if provider.api_key:
            entry["apiKey"] = provider.api_key
        if provider.base_url:
            entry["baseURL"] = provider.base_url
        data["providers"][key] = entry
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to Claude Code as provider '{key}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Claude Code: {exc}"}


# ---------------------------------------------------------------------------
# Roo Code / Cline — discovery  (VS Code settings.json)
# ---------------------------------------------------------------------------

_VSCODE_SETTINGS_PATH = Path("~/Library/Application Support/Code/User/settings.json")


def _discover_roo_cline(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse Cline / Roo Code keys from VS Code's settings.json."""
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []

    # Both Cline and Roo Code use similar key prefixes
    api_key: str | None = (
        data.get("cline.apiKey")
        or data.get("roo-cline.apiKey")
        or data.get("claude-dev.apiKey")
        or None
    )
    base_url: str | None = (
        data.get("cline.openAiBaseUrl")
        or data.get("roo-cline.openAiBaseUrl")
        or data.get("cline.ollamaBaseUrl")
        or None
    )
    provider_type: str = (
        data.get("cline.apiProvider") or data.get("roo-cline.apiProvider") or "openai"
    )

    if not any([api_key, base_url]):
        return []

    return [
        LlmProvider(
            name=provider_type,
            provider_type=provider_type,
            api_key=api_key,
            base_url=base_url,
            sources=["roo_cline"],
        )
    ]


# ---------------------------------------------------------------------------
# Roo Code / Cline — write
# ---------------------------------------------------------------------------


def _write_provider_to_roo_cline(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert Cline/Roo Code keys into VS Code settings.json."""
    path = (config_path or _VSCODE_SETTINGS_PATH).expanduser()
    try:
        data = _read_json(path)
        key = provider.provider_type or provider.name
        data["cline.apiProvider"] = key
        if provider.api_key:
            data["cline.apiKey"] = provider.api_key
        if provider.base_url:
            data["cline.openAiBaseUrl"] = provider.base_url
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to VS Code settings as Cline provider '{key}'",
        }
    except Exception as exc:
        return {
            "success": False,
            "message": f"Failed to write to Roo/Cline settings: {exc}",
        }


# ---------------------------------------------------------------------------
# Windsurf — discovery  (~/.codeium/windsurf/mcp_settings.json)
# ---------------------------------------------------------------------------

_WINDSURF_CONFIG_PATH = Path("~/.codeium/windsurf/mcp_settings.json")


def _discover_windsurf(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse the ``aiProviders`` dict from a Windsurf mcp_settings.json."""
    path = (config_path or _WINDSURF_CONFIG_PATH).expanduser()
    data = _read_json(path)

    # Windsurf may store providers under "aiProviders" or "providers"
    providers_raw: dict[str, Any] = (
        data.get("aiProviders") or data.get("providers") or {}
    )
    if not isinstance(providers_raw, dict):
        return []

    result: list[LlmProvider] = []
    for key, entry in providers_raw.items():
        if not isinstance(entry, dict):
            continue
        display_name: str = entry.get("name") or key
        api_key: str | None = entry.get("apiKey") or None
        base_url: str | None = entry.get("baseURL") or entry.get("baseUrl") or None
        result.append(
            LlmProvider(
                name=display_name,
                provider_type=key,
                api_key=api_key,
                base_url=base_url,
                sources=["windsurf"],
            )
        )
    return result


# ---------------------------------------------------------------------------
# Windsurf — write
# ---------------------------------------------------------------------------


def _write_provider_to_windsurf(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Upsert a provider entry into Windsurf's aiProviders dict."""
    path = (config_path or _WINDSURF_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "aiProviders" not in data or not isinstance(data["aiProviders"], dict):
            data["aiProviders"] = {}
        key = provider.provider_type or provider.name
        entry: dict[str, Any] = {}
        if provider.name and provider.name != key:
            entry["name"] = provider.name
        if provider.api_key:
            entry["apiKey"] = provider.api_key
        if provider.base_url:
            entry["baseURL"] = provider.base_url
        data["aiProviders"][key] = entry
        _write_json(path, data)
        return {"success": True, "message": f"Written to Windsurf as provider '{key}'"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Windsurf: {exc}"}


# ---------------------------------------------------------------------------
# Plandex — discovery  (~/.plandex-home/*.json)
# ---------------------------------------------------------------------------

_PLANDEX_HOME_PATH = Path("~/.plandex-home")


def _discover_plandex(home_path: Path | None = None) -> list[LlmProvider]:
    """Scan the Plandex home directory for provider config JSON files."""
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    if not home.is_dir():
        return []

    result: list[LlmProvider] = []
    for json_file in sorted(home.glob("*.json")):
        data = _read_json(json_file)
        if not data:
            continue
        api_key: str | None = data.get("apiKey") or data.get("openAIApiKey") or None
        base_url: str | None = data.get("openAIBase") or data.get("baseURL") or None
        provider_type: str = data.get("provider") or data.get("model") or "openai"

        if not any([api_key, base_url]):
            continue

        result.append(
            LlmProvider(
                name=json_file.stem,
                provider_type=provider_type,
                api_key=api_key,
                base_url=base_url,
                sources=["plandex"],
            )
        )
    return result


# ---------------------------------------------------------------------------
# Plandex — write
# ---------------------------------------------------------------------------


def _write_provider_to_plandex(
    provider: LlmProvider, home_path: Path | None = None
) -> dict[str, Any]:
    """Write a provider to a dedicated JSON file inside the Plandex home dir."""
    home = (home_path or _PLANDEX_HOME_PATH).expanduser()
    try:
        home.mkdir(parents=True, exist_ok=True)
        key = provider.provider_type or provider.name
        file_path = home / f"{key}.json"
        data = _read_json(file_path)
        data["provider"] = key
        if provider.api_key:
            data["apiKey"] = provider.api_key
        if provider.base_url:
            data["openAIBase"] = provider.base_url
        _write_json(file_path, data)
        return {"success": True, "message": f"Written to Plandex as '{key}.json'"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Plandex: {exc}"}


# ---------------------------------------------------------------------------
# Gemini CLI — discovery  (~/.gemini/settings.json)
# ---------------------------------------------------------------------------

_GEMINI_CLI_CONFIG_PATH = Path("~/.gemini/settings.json")


def _discover_gemini_cli(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse the model field from Gemini CLI's settings.json."""
    path = (config_path or _GEMINI_CLI_CONFIG_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []

    model: str | None = data.get("model") or None
    # Gemini CLI stores no API key in file (uses ADC / env var)
    if not model:
        return []

    return [
        LlmProvider(
            name=model,
            provider_type="google",
            api_key=None,
            base_url=None,
            sources=["gemini_cli"],
        )
    ]


# ---------------------------------------------------------------------------
# Gemini CLI — write
# ---------------------------------------------------------------------------


def _write_provider_to_gemini_cli(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Write the model name into Gemini CLI's settings.json."""
    path = (config_path or _GEMINI_CLI_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        # Write model name (Gemini CLI uses the provider name as the model)
        data["model"] = provider.name
        _write_json(path, data)
        return {
            "success": True,
            "message": f"Written to Gemini CLI with model '{provider.name}'",
        }
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Gemini CLI: {exc}"}


# ---------------------------------------------------------------------------
# Amp (Sourcegraph) — discovery  (~/.amp/settings.json)
# ---------------------------------------------------------------------------

_AMP_CONFIG_PATH = Path("~/.amp/settings.json")


def _discover_amp(config_path: Path | None = None) -> list[LlmProvider]:
    """Parse provider info from Amp's settings.json."""
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    data = _read_json(path)
    if not data:
        return []

    # Amp stores config under a "model" sub-object or at top level
    model_block: dict[str, Any] = data.get("model") or data
    provider_type: str = model_block.get("provider") or ""
    api_key: str | None = model_block.get("apiKey") or data.get("apiKey") or None
    base_url: str | None = (
        model_block.get("baseUrl") or model_block.get("baseURL") or None
    )
    name: str = model_block.get("model") or provider_type

    if not any([api_key, base_url, provider_type]):
        return []

    return [
        LlmProvider(
            name=name or "amp",
            provider_type=provider_type or "openai",
            api_key=api_key,
            base_url=base_url,
            sources=["amp"],
        )
    ]


# ---------------------------------------------------------------------------
# Amp — write
# ---------------------------------------------------------------------------


def _write_provider_to_amp(
    provider: LlmProvider, config_path: Path | None = None
) -> dict[str, Any]:
    """Write provider into Amp's settings.json under the 'model' key."""
    path = (config_path or _AMP_CONFIG_PATH).expanduser()
    try:
        data = _read_json(path)
        if "model" not in data or not isinstance(data["model"], dict):
            data["model"] = {}
        key = provider.provider_type or provider.name
        data["model"]["provider"] = key
        data["model"]["model"] = provider.name
        if provider.api_key:
            data["model"]["apiKey"] = provider.api_key
        if provider.base_url:
            data["model"]["baseUrl"] = provider.base_url
        _write_json(path, data)
        return {"success": True, "message": f"Written to Amp as provider '{key}'"}
    except Exception as exc:
        return {"success": False, "message": f"Failed to write to Amp: {exc}"}


# ---------------------------------------------------------------------------
# Cursor — discovery (read-only, SQLite)
# ---------------------------------------------------------------------------

# Cursor stores settings in a VS Code-compatible SQLite DB.
# On macOS the path is:
_CURSOR_DB_PATH = Path(
    "~/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
)

# Mapping of SQLite itemTable keys to canonical fields
_CURSOR_KEY_MAP: dict[str, tuple[str, str]] = {
    # key_in_db                -> (canonical_field, provider_type_hint)
    "openAIKey": ("api_key", "openai"),
    "openAIAPIKey": ("api_key", "openai"),
    "anthropicApiKey": ("api_key", "anthropic"),
    "openAIBaseURL": ("base_url", "openai"),
    "cursor.openaiBaseUrl": ("base_url", "openai"),
}


def _discover_cursor(db_path: Path | None = None) -> list[LlmProvider]:
    """Attempt to read LLM provider keys from Cursor's SQLite state database."""
    path = (db_path or _CURSOR_DB_PATH).expanduser()
    if not path.exists():
        return []

    collected: dict[str, dict[str, Any]] = {}  # provider_type -> fields

    try:
        with sqlite3.connect(str(path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT key, value FROM itemTable WHERE key IN ({})".format(
                    ",".join("?" * len(_CURSOR_KEY_MAP))
                ),
                list(_CURSOR_KEY_MAP.keys()),
            ).fetchall()
    except Exception:
        return []

    for row in rows:
        db_key: str = row["key"]
        raw_value: str = row["value"] or ""
        field, provider_hint = _CURSOR_KEY_MAP.get(db_key, ("", ""))
        if not field or not raw_value:
            continue
        if provider_hint not in collected:
            collected[provider_hint] = {"api_key": None, "base_url": None}
        collected[provider_hint][field] = raw_value

    result: list[LlmProvider] = []
    for ptype, fields in collected.items():
        result.append(
            LlmProvider(
                name=ptype,
                provider_type=ptype,
                api_key=fields.get("api_key"),
                base_url=fields.get("base_url"),
                sources=["cursor"],
            )
        )
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def discover_all_llm_providers() -> list[LlmProvider]:
    """Return LLM providers discovered from all known global config files."""
    providers: list[LlmProvider] = []
    providers.extend(_discover_opencode())
    providers.extend(_discover_continue())
    providers.extend(_discover_aider())
    providers.extend(_discover_claude_code())
    providers.extend(_discover_roo_cline())
    providers.extend(_discover_windsurf())
    providers.extend(_discover_plandex())
    providers.extend(_discover_gemini_cli())
    providers.extend(_discover_amp())
    providers.extend(_discover_cursor())
    return providers


def write_provider_to_target(
    provider: LlmProvider, target_id: str, project_path: str | None = None
) -> dict[str, Any]:
    """Write *provider* to the config file for the given *target_id*.

    For project-scoped targets, pass *project_path* to resolve the config
    file relative to the project root.

    Returns a dict with ``success`` (bool) and ``message`` (str).
    """
    # Accept both bare IDs (legacy) and new _global scoped IDs produced by llm_dicts().
    # _project IDs already have explicit handling below.
    _GLOBAL_ALIASES = {
        "opencode_global": "opencode",
        "continue_global": "continue",
        "aider_global": "aider",
        "claude_code_global": "claude_code",
        "roo_cline_global": "roo_cline",
        "windsurf_global": "windsurf",
        "plandex_global": "plandex",
        "gemini_cli_global": "gemini_cli",
        "amp_global": "amp",
        "cursor_global": "cursor",
    }
    if target_id in _GLOBAL_ALIASES:
        target_id = _GLOBAL_ALIASES[target_id]

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

    if target_id == "continue":
        return _write_provider_to_continue(provider)

    if target_id == "continue_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the continue_project target",
            }
        return _write_provider_to_continue(
            provider, config_path=Path(project_path) / ".continue" / "config.yaml"
        )

    if target_id == "aider":
        return _write_provider_to_aider(provider)

    if target_id == "aider_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the aider_project target",
            }
        return _write_provider_to_aider(
            provider, config_path=Path(project_path) / ".aider.conf.yml"
        )

    if target_id == "claude_code":
        return _write_provider_to_claude_code(provider)

    if target_id == "claude_code_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the claude_code_project target",
            }
        return _write_provider_to_claude_code(
            provider, config_path=Path(project_path) / ".claude" / "settings.json"
        )

    if target_id == "roo_cline":
        return _write_provider_to_roo_cline(provider)

    if target_id == "roo_cline_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the roo_cline_project target",
            }
        return _write_provider_to_roo_cline(
            provider, config_path=Path(project_path) / ".vscode" / "settings.json"
        )

    if target_id == "windsurf":
        return _write_provider_to_windsurf(provider)

    if target_id == "windsurf_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the windsurf_project target",
            }
        return _write_provider_to_windsurf(
            provider,
            config_path=Path(project_path) / ".windsurf" / "mcp_settings.json",
        )

    if target_id == "plandex":
        return _write_provider_to_plandex(provider)

    if target_id == "plandex_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the plandex_project target",
            }
        return _write_provider_to_plandex(
            provider, home_path=Path(project_path) / ".plandex"
        )

    if target_id == "gemini_cli":
        return _write_provider_to_gemini_cli(provider)

    if target_id == "gemini_cli_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the gemini_cli_project target",
            }
        return _write_provider_to_gemini_cli(
            provider, config_path=Path(project_path) / ".gemini" / "settings.json"
        )

    if target_id == "amp":
        return _write_provider_to_amp(provider)

    if target_id == "amp_project":
        if not project_path:
            return {
                "success": False,
                "message": "project_path is required for the amp_project target",
            }
        return _write_provider_to_amp(
            provider, config_path=Path(project_path) / ".amp" / "settings.json"
        )

    if target_id == "cursor":
        return {
            "success": False,
            "message": "Cursor does not support write-back (read-only SQLite store)",
        }

    return {"success": False, "message": f"Unknown LLM provider target: '{target_id}'"}
