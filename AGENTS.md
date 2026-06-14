# AGENTS.md

> This file is read by every AGENTS.md-aware coding agent (Codex, GitHub
> Copilot, Cursor, Devin, OpenCode, Antigravity, …). It defines how OpenSync
> is built and the standard of engineering expected here. **Claude Code reads
> [`CLAUDE.md`](CLAUDE.md), which mirrors these rules.**

## What OpenSync is

OpenSync is a **local-first registry and sync engine** for AI-coding-tool
configuration. Every AI tool keeps its MCP servers, skills, rules, commands,
subagents, and LLM providers in its own config in its own format. OpenSync
stores one canonical copy of each item in a local SQLite registry and
translates it into each tool's native format on sync — with drift detection,
diff previews, and rotated backups.

**Read the full architecture before making non-trivial changes:**
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). It is the authoritative map and
must be kept in sync with the code.

---

## Engineering standard — this is a professional project

OpenSync is built as a **professional, production-grade project**. Every change
must meet this bar. There are no exceptions for "quick" changes.

1. **Tests are mandatory.** Every behavioral change ships with tests. New
   integration → `test_manifests.py` covers it automatically; add cases if it
   has novel behavior. New handler → add golden round-trip tests in
   `test_handlers.py`. New engine logic → cover it in `test_engine.py`. New
   endpoint → cover it in `test_api.py`. Never lower coverage.
2. **Documentation is mandatory and stays current.** When you change structure,
   update [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), the relevant README
   section, and inline docstrings in the same change. Stale docs are a bug.
3. **The architectural map is mandatory and stays current.** The repository
   map, component model, data-flow, and state machine in
   `docs/ARCHITECTURE.md` must reflect reality. If you add/move/rename a
   module, table, handler, or endpoint, update the map.
4. **Follow the existing architecture.** Respect the layer rules and invariants
   in §"Key invariants" of `docs/ARCHITECTURE.md`. Do not introduce tool-specific
   paths/formats outside `integrations/`, do not write files from handlers, do
   not silently overwrite drifted configs.
5. **Keep the suite green.** `make test` (or `make test-backend`) must pass
   before a change is considered done. If you add a frontend test runner, wire
   it into `make test-frontend`.

---

## Tech stack

| Area | Stack |
|------|-------|
| Backend | Python ≥ 3.11, FastAPI, Uvicorn, Pydantic v2, SQLite (stdlib) |
| Format libs | `tomlkit` (TOML, comment-preserving), `pyyaml`, `httpx` |
| Package mgr | [uv](https://docs.astral.sh/uv/) (backend), npm (frontend) |
| Build | hatchling (`backend/hatch_build.py` bundles the SPA into the wheel) |
| Frontend | React 19, Vite 6, Monaco Editor (no router lib — hash routing) |
| Tests | pytest (`--group dev`); frontend runner not yet configured |

---

## Commands

```bash
# Run (dev: backend :8001 + frontend :5173, both hot-reload)
./run.sh

# Tests
make test                  # everything
make test-backend          # pytest
cd backend && uv run --group dev pytest -v
cd backend && uv run --group dev pytest tests/test_engine.py -v   # one file

# Install deps
(cd backend && uv sync)
(cd frontend && npm install)

# Build frontend into frontend/dist (bundled into wheel by hatch_build.py)
cd frontend && npm run build

# Run the packaged app
uvx open-sync              # or: cd backend && uv run opensync
```

Useful flags: `--port`, `--no-browser`, `--db <path>`. Env overrides:
`OPENSYNC_DB_PATH` (registry DB), `OPENSYNC_HOME` (home dir; used by tests).

---

## Project layout (short form)

```
AGENTS.md          CLAUDE.md          README.md          Makefile   run.sh
docs/              ARCHITECTURE.md    CONTRIBUTING_INTEGRATIONS.md
backend/
  opensync/
    main.py cli.py models.py store.py mcp_registry_client.py
    db/            schema.sql (v2) · migrate.py (v1→v2)
    engine/        engine.py paths.py hash.py backup.py frontmatter.py
    engine/handlers/  8 pure format handlers (read + plan_write/plan_remove)
    integrations/     base.py + 1 manifest per tool + ALL_INTEGRATIONS
    routers/          /api/* (integrations, projects, entities, sync, fs, lsp, mcp_registry)
  tests/              conftest · manifests · handlers · engine · api · migrate
frontend/
  src/  App.jsx api.js entityKinds.js hooks/ pages/ components/
```

Full, annotated map: [`docs/ARCHITECTURE.md` §2](docs/ARCHITECTURE.md#2-repository-map).

---

## Architecture in one screen

```
Web UI (React) ──/api──► FastAPI routers
                            │
              ┌─────────────┴─────────────┐
        Sync Engine                  Store + SQLite (v2)
   discover/import/status/         entities · projects
   plan/apply/pull                 sync_state · backups
        │
   ┌────┴──────────────────┐
 Integrations (manifests)   Handlers (pure format I/O)
 1 file/tool — the ONLY     read → canonical model
 place tool paths/formats   plan_write → FileChange (never writes)
 live                       │
                            ▼
                  Filesystem (~ and project/)
```

**Three rules that govern every decision:**

1. **Manifests drive everything.** No per-tool path/format knowledge outside
   `backend/integrations/`. Discovery, sync, status, and the frontend tool list
   all derive from manifests. Adding a tool = one file + one line.
2. **Handlers plan, the engine writes.** Handlers return `FileChange` objects;
   the engine is the only thing that touches disk. That chokepoint is what makes
   dry-run previews, backups, and drift safety universal.
3. **Per-item (canonical) hashing.** Drift compares parsed models, not file
   bytes — tools rewrite their own configs constantly.

Full detail, data flows, and the drift state machine:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Code conventions

- **Python:** follow existing style. `from __future__ import annotations`, type
  hints, Pydantic models for all data crossing the API boundary. Docstrings on
  every module and public function.
- **Frontend:** functional React, hooks, no class components. Fetch goes
  through `src/api.js`. Per-kind UI config lives in `entityKinds.js` — do not
  hardcode tool metadata in components.
- **No tool-specific knowledge leaks.** A path or format detail that applies to
  one tool belongs in that tool's manifest, nowhere else.
- **Handlers are pure.** Never import `os`/`shutil`/`pathlib.write*` in a
  handler. Return `FileChange`s only.
- **`read` never raises.** Missing/unparseable → `{}`.
- **Comments:** match the existing style — concise, explain *why*, cite the
  tool's docs URL at the top of each manifest.
- **Secrets:** LLM provider keys are stored in the local SQLite DB exactly as
  the tools store them. Never log or print them.

---

## How to do common tasks

### Add a new tool integration
1. Create `backend/opensync/integrations/{tool}.py` with an `Integration`.
   Cite the tool's docs URL in a header comment.
2. Import it and append to `ALL_INTEGRATIONS` in `integrations/__init__.py`.
3. Run `cd backend && uv run --group dev pytest -v tests/test_manifests.py`.
   The parametrised suite validates handler existence, path shape, and
   format-conflict freedom automatically.
4. If the tool needs a *new format*, add a handler in `engine/handlers/` and
   golden round-trip tests in `test_handlers.py`.
Full guide: [`docs/CONTRIBUTING_INTEGRATIONS.md`](docs/CONTRIBUTING_INTEGRATIONS.md).

### Change the schema
Edit `db/schema.sql`, bump the `meta` version, and if it's a migration write
the path in `db/migrate.py`. Add a `test_migrate.py` case.

### Add an API endpoint
Add the route in the matching `routers/` file (keep `entities.py` catch-all
mounted last). Add a `test_api.py` case. Document it in
`docs/ARCHITECTURE.md` §3.5.

### Add frontend behavior
Component/page in `src/`. Fetch via `api.js`. If it's tool metadata, it comes
from `GET /api/integrations` — do not hardcode it.

---

## Don't

- Don't write files from handlers.
- Don't overwrite drifted/conflict cells without an explicit force or pull.
- Don't add per-tool paths or formats outside `integrations/`.
- Don't lower test coverage or skip the suite.
- Don't let `docs/ARCHITECTURE.md`, this file, or `CLAUDE.md` drift from the
  code.
- Don't commit secrets, `opensync.db`, or `frontend/dist`.
