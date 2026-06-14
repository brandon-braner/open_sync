# OpenSync — Architecture

> **Living document.** This map describes how OpenSync is built and why. When
> the codebase changes structurally, update this file alongside the code — do
> not let it drift. It is the authoritative reference for contributors and for
> AI agents working in this repository (see `AGENTS.md` / `CLAUDE.md`).

This document is the detailed companion to the high-level overview in
[`../README.md`](../README.md). For the practical "how to add a tool" guide,
see [`CONTRIBUTING_INTEGRATIONS.md`](CONTRIBUTING_INTEGRATIONS.md).

---

## 1. System Overview

OpenSync is a **local-first registry and sync engine** for AI-coding-tool
configuration. The core problem it solves: every AI tool (Claude Code, Codex,
Cursor, Copilot, Gemini CLI, …) keeps its MCP servers, skills, rules,
commands, subagents, and LLM providers in its own config file in its own
format. OpenSync stores one canonical copy of each item in a local SQLite
registry and translates it into every tool's native format on sync — with
drift detection, diff previews, and backups.

```
                            ┌─────────────────────────────────────┐
                            │           Web UI (React)            │
                            │  Vite + React 19, hash-routed SPA   │
                            └────────────────┬────────────────────┘
                                             │  fetch /api/*  (same origin)
                                             ▼
            ┌──────────────────────────────────────────────────────────┐
            │                    FastAPI app (main.py)                  │
            │   routers/ : integrations, projects, entities,           │
            │              sync, fs, mcp_registry, lsp (WS)             │
            └──────┬───────────────────────────────────┬───────────────┘
                   │                                   │
                   ▼                                   ▼
   ┌──────────────────────────────┐      ┌──────────────────────────────┐
   │       Sync Engine            │      │          Store               │
   │  engine/engine.py            │      │   store.py — generic CRUD    │
   │  discover / import / status  │◄────►│   over the v2 schema         │
   │  plan / apply / pull         │      │                              │
   └──────┬───────────┬───────────┘      └──────────────┬───────────────┘
          │           │                                 │
          ▼           ▼                                 ▼
 ┌─────────────┐ ┌──────────────┐           ┌───────────────────────┐
   Integrations  │   Handlers    │           │   SQLite (schema v2)  │
   manifests/    │   (format I/O)│           │  entities, projects,  │
   1 file/tool   │  8 handlers   │           │  sync_state, backups  │
 └──────┬───────┘ └──────┬───────┘           └───────────────────────┘
        │ single source    │ pure: read +     ▲
        │ of truth for     │ plan_write only  │
        │ paths/formats    │ (never write)    │ ~/.opensync/opensync.db
        ▼                  ▼
   ┌──────────────────────────────────┐
   │   Filesystem (~ and project/)    │
   │  ~/.claude.json  .mcp.json       │
   │  ~/.cursor/mcp.json  AGENTS.md   │
   │  ~/.codex/config.toml  …         │
   └──────────────────────────────────┘
```

### Design philosophy

Three rules dominate every decision in this codebase:

1. **Manifests drive everything.** No per-tool path or format knowledge exists
   outside `backend/integrations/`. Discovery, import, sync, status, and the
   entire frontend tool list are *derived* from the manifests. Adding a tool is
   one file + one line in `ALL_INTEGRATIONS`.
2. **Handlers plan, the engine writes.** Format handlers are pure: they return
   `FileChange(path, before, after)` objects and never touch the filesystem.
   The engine does all diffing, backing up, and atomic writing — that single
   chokepoint is what makes dry-run previews, backups, and drift safety
   universal across every format.
3. **Per-item hashing.** Drift is detected on the *parsed canonical model*,
   not file bytes. Tools rewrite their own config files constantly (Claude Code
   stores session state in `~/.claude.json`), so byte-level hashing would
   report endless false drift.

---

## 2. Repository Map

```
open_sync/
├── AGENTS.md                     # Universal agent dev guidelines (read by Codex,
│                                 #   Copilot, Cursor, Devin, OpenCode, …)
├── CLAUDE.md                     # Claude Code dev guidelines
├── README.md                     # Project overview + getting started
├── Makefile                      # run | test | test-backend | test-frontend
├── run.sh                        # starts backend + frontend dev servers
├── CODEOWNERS
├── docs/
│   ├── ARCHITECTURE.md           # ← THIS FILE
│   ├── CONTRIBUTING_INTEGRATIONS.md  # how to add a tool manifest
│   └── banner.png
├── backend/
│   ├── pyproject.toml            # deps: fastapi, uvicorn, pydantic, pyyaml,
│   │                             #   httpx, tomlkit, websockets
│   ├── hatch_build.py            # bundles frontend/dist into wheel as static/
│   ├── opensync/                 # the Python package
│   │   ├── main.py               # FastAPI app + static mount + CORS
│   │   ├── cli.py                # `opensync` console entrypoint
│   │   ├── models.py             # canonical entity models + API DTOs
│   │   ├── store.py              # generic CRUD over the v2 schema
│   │   ├── mcp_registry_client.py# official MCP Registry (modelcontextprotocol)
│   │   ├── db/
│   │   │   ├── __init__.py       # init_db(), get_connection(), v1 migration
│   │   │   ├── schema.sql        # v2 schema (5 tables)
│   │   │   └── migrate.py        # v1 → v2 data migration
│   │   ├── engine/
│   │   │   ├── engine.py         # discover/import/status/plan/apply/pull
│   │   │   ├── paths.py          # ~ / project / per-OS path resolution
│   │   │   ├── hash.py           # canonical-model sha256 (drift detection)
│   │   │   ├── backup.py         # rotated backups (~/.opensync/backups)
│   │   │   ├── frontmatter.py    # YAML frontmatter parse/emit
│   │   │   └── handlers/         # format translators (see §5)
│   │   ├── integrations/         # 1 manifest per tool (see §4)
│   │   │   ├── base.py           # Integration & EntityTarget models
│   │   │   ├── __init__.py       # ALL_INTEGRATIONS registry
│   │   │   ├── claude_code.py    # …one file per supported tool…
│   │   │   └── …
│   │   └── routers/              # /api/* endpoints
│   │       ├── __init__.py       # api_router composition
│   │       ├── integrations.py   # GET /api/integrations
│   │       ├── projects.py       # project CRUD + auto-import on register
│   │       ├── entities.py       # /api/{kind} CRUD + discover/import/status
│   │       ├── sync.py           # plan / apply / pull
│   │       ├── fs.py             # directory browse + native picker
│   │       ├── mcp_registry.py   # search + import from MCP Registry
│   │       └── lsp.py            # WebSocket bridge /ws/lsp/{language}
│   └── tests/                    # pytest suite (see §8)
│       ├── conftest.py           # isolated DB + home per test
│       ├── test_manifests.py     # manifest invariants, parametrised
│       ├── test_handlers.py      # golden round-trip per handler
│       ├── test_engine.py        # state machine + flows
│       ├── test_api.py           # API integration flows
│       └── test_migrate.py       # v1 → v2 migration
├── frontend/
│   ├── package.json              # react 19, vite 6, monaco-editor
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx              # React entry
│       ├── App.jsx               # shell, routing, scope state
│       ├── api.js                # thin fetch wrapper over /api/*
│       ├── entityKinds.js        # per-kind UI config (label/icon/form/urlKind)
│       ├── colors.js
│       ├── index.css
│       ├── hooks/useHashRoute.js # hash-based routing
│       ├── lspClient.js          # LSP WebSocket client
│       ├── monacoSetup.js
│       ├── pages/
│       │   ├── EntityPage.jsx    # generic list + status matrix + import tab
│       │   ├── ProjectsPage.jsx
│       │   └── McpRegistryBrowserPage.jsx
│       └── components/
│           ├── DiffModal.jsx     # unified-diff preview before apply
│           ├── StatusPill.jsx    # the in-sync/outdated/drifted/… cell
│           ├── ScopeBar.jsx      # global ⇄ project switch
│           ├── forms/            # per-kind create/edit forms
│           ├── layout/Sidebar.jsx
│           └── ui/               # ToastContainer, buttons, etc.
└── marketing-site/               # separate marketing site
```

---

## 3. Backend Component Model

### 3.1 Layers and dependencies

```
          ┌─────────────────────────────────────────────┐
   HTTP ─ │  routers/   (thin: validation → call layer) │
          └──────────────────────┬──────────────────────┘
                                 │
          ┌──────────────────────▼──────────────────────┐
   logic  │  engine/    (the only place that writes     │
          │  files: backups + atomic writes)            │
          └──────┬─────────────────┬────────────────────┘
                 │                 │
   ┌─────────────▼─────┐   ┌───────▼──────────────────────┐
   │ integrations/     │   │ store.py + db/ (SQLite CRUD) │
   │ manifests only —  │   │ no format/path knowledge     │
   │ paths + handler   │   └──────────────────────────────┘
   │ selection         │
   └────────┬──────────┘
            │ references by name
   ┌────────▼───────────────────────────────────────────┐
   │ engine/handlers/  pure format I/O, return FileChange│
   └────────────────────────────────────────────────────┘
```

**Dependency rule (strict):** a lower layer never imports a higher one.
`store.py` and `integrations/` know nothing about FastAPI. Handlers know
nothing about integrations or the engine. The engine is the only layer that
orchestrates them all. Keep it this way when adding code.

### 3.2 `models.py` — canonical models

Each entity kind has one canonical Pydantic model that describes *what the item
is*, independent of any tool's on-disk format:

| Kind | Canonical model | Distinctive fields |
|------|-----------------|--------------------|
| `mcp` | `McpServer` | `command`, `args`, `env`, `type`, `url`, `headers` |
| `skill` | `SkillEntity` | `description`, `content`, `files: {relpath: SkillFile}` |
| `rule` | `RuleEntity` | `description`, `content` (markdown) |
| `command` | `CommandEntity` | `description`, `content`, `argument_hint` |
| `subagent` | `SubagentEntity` | `description`, `content`, `model`, `tools` |
| `llm` | `LlmProvider` | `provider_type`, `api_key`, `base_url`, `default_model` (read-only) |

`KIND_MODELS` maps kind-string → class. `split_canonical` /
`build_canonical` move between a flat `(name, description, content, data)` tuple
(the DB row shape) and the typed model. Handlers parse tool files into these
models and build them back out on write.

### 3.3 `db/schema.sql` — schema v2

Five tables; `init_db()` creates them idempotently and runs the v1→v2 migration
on first start.

| Table | Purpose | Key |
|-------|---------|-----|
| `meta` | schema version marker | `key` |
| `projects_v2` | registered project dirs | `id` (name & path unique) |
| `entities` | the registry rows | `id`; unique on `(kind, name, scope, project_id)` |
| `entity_files` | supporting files for skills (BLOBs) | `(entity_id, relpath)` |
| `sync_state` | "what we last synced where, and its hash" | `(entity_id, integration)` |
| `backup_runs` | record of each backup run | `id` |

`sync_state.synced_hash` is the crux of drift detection: it records the
canonical hash at the moment we last wrote to a tool. Comparing it against the
*current* registry hash and the *current* tool-file hash yields the cell status
(see §6).

The DB path defaults to `~/.opensync/opensync.db`, overridable via
`OPENSYNC_DB_PATH` (used by tests).

### 3.4 `store.py` — generic CRUD

A thin SQLite access layer with one job per entity type. It knows the schema
but **not** formats, paths, or tool names. All writes go through a context
manager that commits on success and always closes. `canonical_of(entity)`
rebuilds the typed model from an `Entity` row.

### 3.5 `routers/` — API surface

All endpoints live under `/api`. Routers are thin: parse the request, delegate
to the engine or store, return DTOs from `models.py`. `entities.py` registers
catch-all `/{kind}` routes and is mounted **last** so it doesn't shadow others.

Key endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/integrations` | the manifest list — the frontend's single source of tool metadata |
| `GET/POST/DELETE /api/projects` | register/remove a project (register auto-imports its configs) |
| `GET/POST/PUT/DELETE /api/{kind}` | entity CRUD |
| `GET /api/{kind}/discover` | scan all tool configs for items |
| `POST /api/{kind}/import` | bring discovered items into the registry |
| `GET /api/{kind}/status` | the per-entity × per-tool status matrix |
| `POST /api/sync/plan` | dry run → `SyncPlan` (diffs + warnings) |
| `POST /api/sync/apply` | execute a plan (backups + atomic writes) |
| `POST /api/sync/pull` | accept a tool's version back into the registry |
| `GET /api/mcp-registry/search` | search the official MCP Registry |
| `POST /api/mcp-registry/import` | import a registry server into OpenSync |
| `GET /api/fs/browse` | directory listing for the path picker |
| `WS  /ws/lsp/{language}` | LSP bridge for in-UI editing |

---

## 4. Integrations — Manifest-Driven Tools

`backend/integrations/base.py` defines two Pydantic models:

- **`Integration`** — one AI application. Fields: `id`, `display_name`,
  `color`, `category` (`editor`/`desktop`/`cli`/`cloud`/`plugin`), `docs_url`,
  and `targets`: a nested dict `{kind → {scope → EntityTarget}}`.
- **`EntityTarget`** — one `(kind, scope)` surface. Fields: `path` (the primary
  write target), `handler` (key into `HANDLERS`), `options` (handler-specific:
  `root_key`, `style`, `suffix`, `frontmatter`, `table`…), `capability`
  (`native`/`fallback`/`read_only`/`legacy`), `read_paths` (extra
  discovery-only locations), `os_paths` (per-`sys.platform` overrides; default
  `path` is the macOS location), `legacy_marker_paths`, and `notes`.

Path conventions (enforced by `test_manifests.py`):

- Global paths start with `~` (resolve against home).
- Project paths are relative (no leading `/` or `~`).
- Directory targets end with `/`; file targets end with an extension.

`integrations/__init__.py` holds `ALL_INTEGRATIONS` (ordered list) and
`INTEGRATIONS_BY_ID` (dict). **Display order in the UI is the list order.**

### Supported tools (current)

| id | display_name | category | Kinds (G=global, P=project) |
|----|--------------|----------|------------------------------|
| `claude_code` | Claude Code | cli | mcp GP · skill GP · rule GP · command GP · subagent GP |
| `claude_desktop` | Claude Desktop | desktop | mcp G |
| `codex` | Codex | cli | mcp GP · skill GP · rule GP · command G(legacy) |
| `vscode` | GitHub Copilot (VS Code) | editor | mcp GP · skill GP · rule P · command P · subagent P |
| `copilot_cli` | GitHub Copilot CLI | cli | mcp GP · skill GP · subagent GP |
| `cursor` | Cursor | editor | mcp GP · skill GP · rule P · command GP · subagent GP |
| `devin` | Devin | editor | mcp G · skill GP · rule GP · command GP · subagent P |
| `gemini_cli` | Gemini CLI | cli | mcp GP · skill GP · rule GP · command GP · subagent GP |
| `opencode` | OpenCode | cli | mcp GP · skill GP · rule GP · command GP · subagent GP |
| `antigravity` | Antigravity | editor | mcp GP · skill GP · command GP |
| `warp` | Warp | cli | skill GP · command GP |

Adding a tool: create one file in `integrations/`, import it in `__init__.py`,
append to `ALL_INTEGRATIONS`, run `tests/test_manifests.py`. Full guide:
[`CONTRIBUTING_INTEGRATIONS.md`](CONTRIBUTING_INTEGRATIONS.md).

---

## 5. Format Handlers

`engine/handlers/` — one class per on-disk format. Each implements the
`FormatHandler` ABC (`base.py`):

```python
class FormatHandler(ABC):
    name: str
    kinds: frozenset[str]
    def read(self, root, opts) -> dict[str, BaseModel]: ...      # parse disk → models
    def plan_write(self, root, items, opts) -> list[FileChange]: # merge items, no write
    def plan_remove(self, root, names, opts) -> list[FileChange]: # remove items, no write
```

**Handlers never write files.** They return `FileChange` plan objects
(`path`, `before`, `after`, `binary`, `mode`, `prune_parents_to`). The engine
diffs, backs up, and applies them. A `read` failure must yield `{}`, never
raise — one broken tool config must not break discovery/status for the rest.

| Handler | Format | Used by | Notable options |
|---------|--------|---------|-----------------|
| `json_mcp` | MCP servers in JSON | Claude Code, Cursor, VS Code, Copilot CLI, Gemini, OpenCode, Antigravity, Claude Desktop | `root_key`, `style` (`standard`/`vscode`/`opencode`), `bridge_remote` |
| `toml_mcp` | MCP servers in TOML | Codex | `table` |
| `markdown_dir` | one `.md` per item | commands, subagents, prompts | `suffix`, `frontmatter` (`claude_command`/`copilot_prompt`/`plain`/`claude_agent`/`copilot_agent`) |
| `markdown_blocks` | managed blocks between markers | rules (CLAUDE.md, AGENTS.md, GEMINI.md, devin `global_rules.md`) | — |
| `skill_dir` | Agent Skills `SKILL.md` folders + files | skills everywhere | — |
| `toml_command` | Gemini-style `.toml` commands | Gemini CLI | — |
| `yaml_workflow` | Warp `.yaml` workflows | Warp | — |
| `llm_json` | LLM provider discovery (read-only) | — | `root_key` |

`handlers/__init__.py` registers every handler in the `HANDLERS` dict, keyed by
`name`. Adding a format: implement the ABC, add golden round-trip tests in
`tests/test_handlers.py`, register it here.

---

## 6. The Sync Engine & State Machine

`engine/engine.py` is the heart of OpenSync. Six operations, all manifest-driven:

```
  discover → import → status → plan_sync → apply_plan → pull
```

### 6.1 The per-cell status state machine

For every `(entity, integration)` pair, the engine computes a status by
comparing **three hashes**:

| Hash | Meaning | Source |
|------|---------|--------|
| `reg_hash` | what the registry says now | `item_hash(canonical_of(entity))` |
| `synced_hash` | what we last wrote to this tool | `sync_state.synced_hash` |
| `target_hash` | what's actually in the tool's file now | `item_hash(parsed tool item)` |

```
   reg_hash, synced_hash, target_hash  ──►  _cell_status()
                                            │
            target == reg (and not None) ──►  in_sync
            synced is None                ──►  not_synced
            target is None                ──►  missing
            reg ≠ synced, target == synced──►  outdated   (registry changed; push ↑)
            reg == synced, target ≠ synced──►  drifted    (tool changed; pull ↓)
            otherwise                     ──►  conflict   (both changed)
```

`read_only` targets surface as `unsupported`. Statuses the UI renders:
`✓ in sync · ↑ outdated · ↓ drifted · ⚠ conflict · ○ not synced · ✕ missing`.

### 6.2 plan_sync (dry run)

1. Group selected entities by `(integration, scope, project)` so multi-item
   files are written once.
2. For each group, compute cell status; **exclude drifted/conflict cells unless
   explicitly forced** (caller passes `force: [{entity_id, integration}]`).
   Excluded cells become `PlanWarning`s, never silent overwrites.
3. Call `handler.plan_write(root, models, options)` → `FileChange` list.
   For `skill` kind, also strip v1 marker blocks from instruction files.
4. Drop no-op changes; render unified diffs (text) or size notes (binary);
   attach mode-change notes.
5. Cache the plan (id + full `FileChange` list + pending state updates) in an
   in-memory `_PLAN_CACHE` with a **10-minute TTL**. Returns a `SyncPlan` with
   `plan_id`.

### 6.3 apply_plan

1. Pop the cached plan; reject if missing or expired (caller must re-plan).
2. `backup.create_backup_run(label, [paths])` copies every *existing*
   to-be-modified file into `~/.opensync/backups/<run_id>/`; the 20 newest
   runs are retained (`backup.rotate()`). Record the run in `backup_runs`.
3. Apply each `FileChange` atomically: write to `*.opensync-tmp`, then
   `os.replace` (crash-safe). Deletes `unlink(missing_ok=True)` and prune empty
   parent dirs. Binary changes are base64-decoded; mode bits are applied.
4. Update `sync_state` for every included entity with the new canonical hash.

### 6.4 pull (accept tool's version)

Reads the item back from the tool's config and overwrites the registry copy,
then records the sync state so the cell flips to `in_sync`. The escape hatch
for drift.

### 6.5 discover / import

`discover` reads **every** target's primary path *plus* `read_paths` (legacy
dirs, shared cross-tool dirs like `.agents/skills/`), merging by name with
"first occurrence wins". Each discovered item is tagged with its source
integration ids and whether it already exists / differs in the registry.
`import` upserts the chosen items into the registry and seeds `sync_state` for
the source integration (so it's immediately `in_sync` there).

---

## 7. Cross-Cutting Concerns

### 7.1 Path resolution (`engine/paths.py`)

- `home()` → `Path.home()`, overridable via `OPENSYNC_HOME` (tests/sandbox).
- `opensync_dir()` → `home() / ".opensync"` (DB + backups live here).
- `resolve(target, project_dir)` picks `os_paths[sys.platform]` if present,
  else `target.path`, then expands `~` or joins to `project_dir`.
- `resolve_read_paths` → primary path + every `read_paths` entry (discovery).

### 7.2 Hashing (`engine/hash.py`)

`item_hash` → `sha256(json.dumps(model.model_dump(), sort_keys=True))`. Stable
across key-order churn in tool files; the foundation of all drift detection.

### 7.3 Backups (`engine/backup.py`)

One run per `apply_plan`. Absolute paths flattened with `__` separators into a
single flat dir. `LABEL.txt` records the run label. `KEEP_RUNS = 20`.
`backup_runs` table mirrors this so the UI can list/restore.

### 7.4 Frontend (`frontend/`)

React 19 + Vite 6 single-page app. No router library — `hooks/useHashRoute.js`
parses `window.location.hash`. The entire tool list, capability matrix, and
form layout derive from `GET /api/integrations`; there is **no hardcoded tool
metadata in the frontend**. `entityKinds.js` configures per-kind UI (label,
icon, form fields, urlKind). `EntityPage.jsx` is generic across all six kinds:
list + status matrix + discover/import tab. Monaco provides the diff/code
editor; `lspClient.js` connects to the `/ws/lsp/{language}` bridge.

The built bundle is served by FastAPI at `/` (bundled into the wheel as
`opensync/static` via `hatch_build.py`; or `frontend/dist` in a source
checkout).

---

## 8. Testing

Tests are a **first-class deliverable**, not an afterthought (see the
professional-engineering mandate in `AGENTS.md`). Every PR must keep the suite
green and add coverage for new behavior.

**Run them:**
```bash
make test                       # all
make test-backend               # pytest only
cd backend && uv run --group dev pytest -v
cd backend && uv run --group dev pytest tests/test_manifests.py -v   # one file
```

**Layout (`backend/tests/`):**

| File | Covers |
|------|--------|
| `conftest.py` | `env` fixture: isolated `OPENSYNC_HOME` + `OPENSYNC_DB_PATH` per test; `home`, `project` fixtures |
| `test_manifests.py` | manifest invariants — parametrised over *every* integration: handler exists & supports the kind, path shape (`~`-global, relative-project), no two tools write conflicting formats to the same file |
| `test_handlers.py` | golden round-trip per handler: write → read back → equals canonical; "preserves unrelated content" cases |
| `test_engine.py` | the discover/import/status/plan/apply/pull flows and the drift state machine |
| `test_api.py` | end-to-end API flows through the FastAPI app |
| `test_migrate.py` | v1 → v2 schema/data migration |

**Conventions:**
- Isolate everything: every test gets a fresh home + DB via `env`.
- Handlers are pure — test them with `plan_write` → inspect `FileChange`s, no disk.
- When adding an integration, `test_manifests.py` validates it automatically.
- When adding a handler, add golden round-trip tests (write/read equality +
  unrelated-content preservation).
- Frontend has no test runner yet (see `Makefile` `test-frontend` placeholder) —
  adding one is a tracked gap.

---

## 9. Build, Run, Package

```bash
# Dev (both servers, hot reload)
./run.sh                          # backend :8001, frontend :5173

# Backend only
cd backend && uv run python -m opensync.main
cd backend && uv run --group dev pytest -v

# Frontend only
cd frontend && npm install && npm run dev

# Production-style (built wheel serves the SPA)
cd frontend && npm run build      # → frontend/dist
cd backend && uv sync && uv run opensync

# Publish (maintainers)
# hatch_build.py bundles frontend/dist into the wheel as opensync/static
```

Config via env / flags:
- `OPENSYNC_DB_PATH` / `--db` — registry DB location (default `~/.opensync/opensync.db`)
- `OPENSYNC_HOME` — home dir override (tests/sandbox)
- `--port`, `--no-browser`, `--host`

---

## 10. Key Invariants (do not break these)

1. **No tool-specific paths or formats outside `integrations/`.** All such
   knowledge lives in manifests. The frontend learns tools from the API.
2. **Handlers are pure.** They return `FileChange`s; the engine is the sole
   writer. Never call filesystem APIs from a handler.
3. **`read` never raises.** A broken tool config yields `{}`.
4. **Drifted/conflict cells are never silently overwritten.** They require an
   explicit `force` or a `pull`.
5. **Every apply is backed up first** and writes atomically (`tmp` + `replace`).
6. **Canonical hashing, not byte hashing.** Drift compares parsed models.
7. **`AGENTS.md` / `CLAUDE.md` / this file stay in sync with the code.** When
   structure changes, update the docs in the same change.

---

## 11. Glossary

- **Entity** — one registry item (an MCP server, skill, rule, command,
  subagent, or LLM provider).
- **Canonical model** — the tool-agnostic Pydantic representation of an entity.
- **Integration / manifest** — the declarative description of one AI tool.
- **EntityTarget** — one `(kind, scope)` surface of an integration.
- **Handler** — a translator between a canonical model and one on-disk format.
- **Cell** — one `(entity, integration)` pair in the status matrix.
- **Scope** — `global` (user-wide, `~/...`) or `project` (repo-committed).
- **Drift** — the tool's file changed since we last synced to it (`↓`).
- **Outdated** — the registry changed since we last synced (`↑`).
