# Contributing New Integrations

This guide explains how to add support for a new AI tool or editor to OpenSync.

## Overview

An integration is **one declarative manifest file**. It states, for every
entity kind the tool supports (`mcp`, `skill`, `command`, `subagent`, `llm`)
and every scope (`global`, `project`):

- where the config lives (`path`)
- which **format handler** reads/writes it (`handler` + `options`)

Discovery, import, sync, drift status, and the web UI all derive from the
manifest. There is no other place to register a tool.

## Architecture

```
backend/opensync/integrations/
├── __init__.py      # ALL_INTEGRATIONS registry
├── base.py          # Integration & EntityTarget models
├── codex.py         # Example integration
└── ...              # One file per tool

backend/opensync/engine/handlers/   # Format handlers (shared across tools)
```

## Step-by-Step Guide

### 1. Create the manifest

Create `backend/opensync/integrations/{tool_id}.py`:

```python
from integrations.base import EntityTarget, Integration

{tool_id} = Integration(
    id="{tool_id}",
    display_name="{Display Name}",
    color="#HEXCOLOR",
    category="editor",          # editor | desktop | cli | cloud | plugin
    docs_url="https://...",
    targets={
        "mcp": {
            "global": EntityTarget(
                path="~/.{tool}/mcp.json",                  # '~' = home
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
            "project": EntityTarget(
                path=".{tool}/mcp.json",                    # project-relative
                handler="json_mcp",
                options={"root_key": "mcpServers", "style": "standard"},
            ),
        },
        "skill": {
            "project": EntityTarget(
                path=".{tool}/skills/",
                handler="skill_dir",
                read_paths=[".agents/skills/"],   # extra discovery-only dirs
            ),
        },
        # Omit a kind or scope entirely if the tool doesn't support it.
    },
)
```

`EntityTarget` fields worth knowing:

| Field | Purpose |
|---|---|
| `capability` | `native` (default), `fallback`, `read_only` (discovery only), `legacy` (deprecated by the tool) |
| `read_paths` | Additional locations scanned during discovery (legacy dirs, shared cross-tool dirs) |
| `os_paths` | Per-OS overrides of `path`, keyed by `sys.platform` (`linux`, `win32`); `path` itself is the macOS location |
| `notes` | Caveat surfaced as a tooltip in the UI |

### 2. Pick (or add) a format handler

| Handler | Format | Key options |
|---|---|---|
| `json_mcp` | MCP servers in a JSON file | `root_key`, `style` (`standard`/`vscode`/`opencode`), `bridge_remote` |
| `toml_mcp` | MCP servers in TOML (Codex) | `table` |
| `markdown_dir` | One `.md` file per item | `suffix`, `frontmatter` (`claude_command`/`copilot_prompt`/`plain`/`claude_agent`/`copilot_agent`) |
| `skill_dir` | Agent Skills `SKILL.md` folders | — |
| `toml_command` | Gemini-style `.toml` commands | — |
| `yaml_workflow` | Warp-style `.yaml` workflows | — |
| `llm_json` | LLM provider discovery | `root_key` (read-only) |

If the tool uses a genuinely new format, add a handler in
`backend/opensync/engine/handlers/` implementing `read` / `plan_write` /
`plan_remove` (return `FileChange` objects — never write files directly),
and register it in `backend/opensync/engine/handlers/__init__.py`.

### 3. Register it

In `backend/opensync/integrations/__init__.py`, import the manifest and append it to
`ALL_INTEGRATIONS`.

### 4. Run the tests

```bash
cd backend && uv run --group dev pytest -v tests/test_manifests.py
```

The manifest test suite is parametrised over every integration, so your new
tool is validated automatically: handler exists and supports the declared
kind, paths have the right shape (`~`-prefixed global, relative project),
and no two integrations write conflicting formats to the same file.

If you added a new handler, add golden round-trip tests for it in
`tests/test_handlers.py` (write → read back → assert equality with the
canonical model, plus a "preserves unrelated content" case).

### 5. Manual check

```bash
./run.sh
```

Your tool appears automatically in the UI (target checkboxes, status matrix
columns, discovery sources) — there is nothing to register in the frontend.

## Conventions

- Global paths start with `~`; project paths are relative (no leading `/` or `~`).
- Directory targets end with `/`; file targets end with an extension.
- Cite the tool's documentation URL in a comment header at the top of the manifest, and note anything that is UI-only (and therefore not syncable) in `notes`.
