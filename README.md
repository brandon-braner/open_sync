<p align="center">
  <img src="docs/banner.png" alt="OpenSync – Sync MCP servers across all your AI agents &amp; IDEs" width="800" />
</p>

# OpenSync

**Sync MCP servers, skills, workflows, and LLM providers across AI agents and IDEs — from one place.**

Managing the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is painful when you use multiple AI tools. Each editor, CLI, and desktop app keeps its own config file in its own format. Add a server in Cursor, then copy-paste it into Claude Desktop, VS Code, Gemini CLI… and repeat every time something changes.

OpenSync fixes this. Register your MCP servers once, pick the targets you care about, and sync. You can also manage **skills** (custom instructions / system prompts), **workflows** (slash-command sequences), and **LLM providers** across tools — all from the same dashboard.

---

## ✨ Features

- **Centralized MCP registry** — Add, edit, and remove MCP server definitions in a single local database (SQLite).
- **Centralized skills registry** — Manage custom instructions, system prompts, and rule files across all agents.
- **Centralized workflows registry** — Manage reusable slash-command workflows and push them to any supported tool.
- **LLM provider management** — Discover, register, and sync LLM API keys and base URLs across all your AI tools.
- **One-click sync** — Push servers, skills, workflows, or providers to any combination of supported targets at once.
- **Auto-discovery** — Detects servers, skills, workflows, and LLM configs already present in your installed tools and imports them.
- **Project scanner** — Point OpenSync at any project directory and it will automatically discover all agent artifacts (Antigravity, Cursor, Claude Code, Continue, Aider, Copilot, Windsurf, OpenCode, and more).
- **Global & project scopes** — Manage a system-wide set of configurations *and* per-project overrides.
- **Config backups** — Timestamped backups are created before every write, so nothing is ever lost.
- **Format translation** — Automatically converts between the different JSON/YAML/Markdown schemas each tool expects.
- **Project management** — Create named projects, browse directories, and import global configs into any project.
- **Two-tier Web UI** — A React-based dashboard with a top-level section selector and contextual sub-navigation for MCP Servers, Skills, Workflows, and LLM Providers.

---

## 🎯 Supported MCP Server Targets

| Category | Target | Scope |
|----------|--------|-------|
| **Editors** | Cursor | Global & Project |
| | VS Code | Global & Project |
| | Antigravity | Global & Project |
| | JetBrains (Copilot) | Global |
| **Desktop** | Claude Desktop | Global |
| **CLI** | Claude Code | Global & Project |
| | Gemini CLI | Global & Project |
| | GitHub Copilot CLI | Global & Project |
| | OpenCode | Global & Project |
| **Plugins** | Cline (VS Code) | Global |
| | Roo Code (VS Code) | Global & Project |
| | Roo Code (Antigravity) | Global & Project |
| | Kilo Code (VS Code) | Global & Project |

---

## 🧠 Supported Skills Targets

Skills are custom instructions, system prompts, or rule files injected into AI agents. OpenSync can read and write skills across:

| Target | Scope |
|--------|-------|
| OpenCode (global / project) | Global & Project |
| Continue | Global & Project |
| Aider | Global & Project |
| Claude Code | Global & Project |
| Roo Code / Cline | Global & Project |
| Windsurf | Global & Project |
| Cursor (rules) | Global & Project |
| Plandex | Global & Project |
| Gemini CLI | Global & Project |
| Amp (Sourcegraph) | Global & Project |
| Antigravity | Global & Project |

---

## 🔁 Supported Workflows Targets

Workflows are reusable, step-based slash-command sequences. OpenSync injects them natively (e.g. OpenCode `scripts`, Continue `slashCommands`) or as delimited text blocks in existing config files.

| Target | Scope | Native support |
|--------|-------|:-:|
| OpenCode (global / project) | Global & Project | ✅ |
| Continue | Global & Project | ✅ |
| Aider | Global & Project | — |
| Claude Code | Global & Project | — |
| Roo Code / Cline | Global & Project | — |
| Windsurf | Global & Project | — |
| Cursor (rules) | Global & Project | — |
| Plandex | Global & Project | — |
| Gemini CLI | Global & Project | — |
| Amp (Sourcegraph) | Global & Project | — |
| Antigravity | Global & Project | — |

---

## 🤖 Supported LLM Provider Targets

OpenSync can discover your existing LLM API keys and model configs from installed tools, and sync them back out to any of the supported targets.

| Target | Scope |
|--------|-------|
| OpenCode | Global & Project |
| Continue | Global & Project |
| Aider | Global & Project |
| Claude Code | Global & Project |
| Roo Code / Cline | Global & Project |
| Windsurf | Global & Project |
| Plandex | Global & Project |
| Gemini CLI | Global & Project |
| Amp (Sourcegraph) | Global & Project |
| Cursor | Global (read-only discovery) |

---

## 📋 Requirements

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Python** | ≥ 3.11 | Backend runtime |
| **[uv](https://docs.astral.sh/uv/)** | latest | Python package & project manager |
| **Node.js** | ≥ 18 | Frontend build tooling |
| **npm** | ≥ 9 | Frontend dependency management |

> [!NOTE]
> OpenSync currently targets **macOS**. Config paths for targets like Claude Desktop and VS Code extensions use macOS-specific locations (`~/Library/Application Support/…`).

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/brandonbraner/open_sync.git
cd open_sync
```

### 2. Install backend dependencies

[uv](https://docs.astral.sh/uv/) handles the virtual environment and dependencies automatically from `pyproject.toml`:

```bash
cd backend
uv sync
cd ..
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Run the app

The included `run.sh` script starts both servers in parallel:

```bash
./run.sh
```

This will start:

| Service | URL |
|---------|-----|
| Backend (FastAPI) | `http://localhost:8001` |
| Frontend (Vite + React) | `http://localhost:5173` |

Open **<http://localhost:5173>** in your browser.

Press `Ctrl+C` to stop both servers.

#### Running the backend only

If you only need the API (no UI):

```bash
cd backend
uv run main.py
```

The API is available at `http://localhost:8001` with interactive docs at `http://localhost:8001/docs`.

### Running backend tests

```bash
cd backend
python3 -m unittest discover -s tests -v
```

---

## 🏗️ Architecture

```
open_sync/
├── backend/                        # FastAPI + SQLite
│   ├── main.py                     # Uvicorn entrypoint
│   ├── api.py                      # REST API routes
│   ├── models.py                   # Pydantic request/response models
│   ├── config_targets.py           # MCP target definitions (paths, formats, scopes)
│   ├── config_manager.py           # Read / write / sync logic for MCP configs
│   ├── server_registry.py          # CRUD for the MCP server registry
│   ├── skill_registry.py           # CRUD for the skills registry
│   ├── workflow_registry.py        # CRUD for the workflows registry
│   ├── llm_provider_registry.py    # CRUD for the LLM providers registry
│   ├── project_registry.py         # CRUD for named projects
│   ├── skill_discovery.py          # Discover & write skills from/to AI tools
│   ├── workflow_discovery.py       # Discover & write workflows from/to AI tools
│   ├── llm_provider_discovery.py   # Discover & write LLM providers from/to AI tools
│   ├── project_importer.py         # Scan a project dir for agent artifacts
│   ├── mcp_registry_client.py      # Official MCP registry proxy
│   ├── database.py                 # SQLite schema, migrations, JSON import
│   └── pyproject.toml              # Python dependencies
├── frontend/                       # Vite + React 19
│   ├── src/
│   │   ├── App.jsx                 # Main application component (two-tier nav)
│   │   ├── api.js                  # API client
│   │   ├── main.jsx                # React entry point
│   │   └── index.css               # Styles
│   └── package.json                # Node dependencies
├── run.sh                          # Dev launcher (backend + frontend)
└── opensync.db                     # SQLite database (auto-created on first run)
```

---

## 📡 API Overview

All endpoints are under `/api`. Full interactive documentation is auto-generated at `/docs` when the backend is running.

### MCP Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/servers` | List all MCP servers (discovered + registry) |
| `GET` | `/api/registry` | List servers in the OpenSync registry |
| `POST` | `/api/registry` | Add a new server to the registry |
| `PUT` | `/api/registry/{id}` | Update a server by ID |
| `DELETE` | `/api/registry/{id}` | Remove a server by ID |
| `POST` | `/api/registry/import` | Import a global server into a project |
| `GET` | `/api/targets` | List sync targets and their status |
| `POST` | `/api/sync` | Sync servers to selected targets |
| `DELETE` | `/api/servers/{name}` | Remove a server from one or more targets |

### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/registry/skills` | List skills in the registry |
| `POST` | `/api/registry/skills` | Add a new skill |
| `DELETE` | `/api/registry/skills/{id}` | Remove a skill |
| `POST` | `/api/registry/skills/import` | Copy a skill from global to a project |
| `GET` | `/api/registry/skills/discover` | Discover skills from installed AI tools |
| `GET` | `/api/registry/skills/targets` | List skill push targets |
| `POST` | `/api/registry/skills/sync` | Push a skill to one or more targets |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/registry/workflows` | List workflows in the registry |
| `POST` | `/api/registry/workflows` | Add a new workflow |
| `DELETE` | `/api/registry/workflows/{id}` | Remove a workflow |
| `POST` | `/api/registry/workflows/import` | Copy a workflow from global to a project |
| `GET` | `/api/registry/workflows/discover` | Discover workflows from installed AI tools |
| `GET` | `/api/registry/workflows/targets` | List workflow push targets |
| `POST` | `/api/registry/workflows/sync` | Push a workflow to one or more targets |

### LLM Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/registry/llm-providers` | List LLM providers in the registry |
| `POST` | `/api/registry/llm-providers` | Add a new LLM provider |
| `DELETE` | `/api/registry/llm-providers/{id}` | Remove an LLM provider |
| `POST` | `/api/registry/llm-providers/import` | Copy a provider from global to a project |
| `GET` | `/api/registry/llm-providers/discover` | Discover providers from installed AI tools |
| `GET` | `/api/registry/llm-providers/targets` | List LLM provider push targets |
| `POST` | `/api/registry/llm-providers/sync` | Push a provider to one or more targets |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a new project (auto-imports existing configs) |
| `DELETE` | `/api/projects/{name}` | Remove a project |
| `GET` | `/api/browse` | List subdirectories for the directory browser |
| `GET` | `/api/pick-directory` | Open native macOS folder picker |

### Project Importer

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/registry/import-from-project/scan` | Scan a project dir for agent artifacts |
| `POST` | `/api/registry/import-from-project/commit` | Save scanned artifacts into the registry |

### Official MCP Registry

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mcp-registry/search` | Search the official MCP Registry |
| `POST` | `/api/mcp-registry/import` | Import a server from the official registry |

---

## 🗄️ Data Storage

OpenSync stores all registry data in a local **SQLite** database (`opensync.db`) in the project root. The database is auto-created on first run and contains tables for MCP servers, skills, workflows, LLM providers, and projects — all scoped to either global or a named project.

---

## 📄 License

This project is open source. See the repository for license details.
