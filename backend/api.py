"""FastAPI router – REST API for OpenSync."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
import pydantic
import httpx

import mcp_registry_client
import project_registry
import server_registry
import skill_registry
import workflow_registry
import llm_provider_registry
import llm_provider_discovery
import skill_discovery
import workflow_discovery
import project_importer
from config_manager import (
    discover_all_servers,
    read_target_servers,
    remove_server_from_target,
    rename_server_in_target,
    write_servers_to_target,
)
from config_targets import Scope, get_target, get_targets_by_scope
from models import (
    AddServerRequest,
    ImportServerRequest,
    McpRegistryImportRequest,
    McpServer,
    RemoveServerRequest,
    SyncRequest,
    SyncResponse,
    TargetStatus,
    UpdateServerRequest,
    Skill,
    Workflow,
    LlmProvider,
)

router = APIRouter(prefix="/api")


def _parse_scope(scope: str) -> Scope:
    try:
        return Scope(scope)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {scope}")


def _resolve_project_dir(project_path: Optional[str], scope: Scope) -> Optional[str]:
    if scope == Scope.PROJECT:
        if not project_path:
            raise HTTPException(
                status_code=400,
                detail="project_path is required for project scope",
            )
        p = Path(project_path).expanduser().resolve()
        if not p.is_dir():
            raise HTTPException(status_code=400, detail=f"Not a directory: {p}")
        return str(p)
    return None


# ---- Registry (managed servers) -------------------------------------------


@router.get("/registry", response_model=list[McpServer])
def list_registry_servers(
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    """Return servers stored in the OpenSync local registry for the given scope."""
    return server_registry.list_servers(scope, project_name)


@router.post("/registry", response_model=McpServer)
def add_registry_server(req: AddServerRequest):
    """Add or update a server in the local registry (persisted to servers.json)."""
    srv = McpServer(
        name=req.name,
        command=req.command,
        args=req.args,
        env=req.env,
        type=req.type,
        url=req.url,
        headers=req.headers,
        sources=[],
    )
    reg_scope = req.scope or "global"
    return server_registry.add_server(srv, reg_scope, req.project_name)


@router.put("/registry/{server_id}", response_model=McpServer)
def update_registry_server(server_id: str, req: UpdateServerRequest):
    """Update an existing server's configuration in the registry."""
    existing = server_registry.get_server_by_id(server_id)
    if existing is None:
        raise HTTPException(
            status_code=404, detail=f"Server '{server_id}' not in registry"
        )

    old_name = existing.name
    new_name = req.name or old_name
    is_rename = new_name != old_name
    reg_scope = req.scope or "global"

    # If renaming, update the key in all target configs that have the old name
    if is_rename:
        scope_enum = Scope.PROJECT if reg_scope == "project" else Scope.GLOBAL
        project_dir = None
        if reg_scope == "project" and req.project_name:
            proj = project_registry.get_project(req.project_name)
            if proj:
                project_dir = proj["path"]
        targets = get_targets_by_scope(scope_enum)
        for t in targets:
            try:
                rename_server_in_target(t, old_name, new_name, project_dir)
            except Exception:
                pass  # best-effort rename in targets
        # Rename in the registry DB
        server_registry.rename_server(server_id, new_name)

    # Now update the rest of the fields
    srv = McpServer(
        id=server_id,
        name=new_name,
        command=req.command,
        args=req.args,
        env=req.env,
        type=req.type,
        url=req.url,
        headers=req.headers,
        sources=[],
    )
    return server_registry.add_server(srv, reg_scope, req.project_name)


@router.post("/registry/import", response_model=McpServer)
def import_from_global(req: ImportServerRequest):
    """Copy a server from the global registry into a project's registry."""
    global_srv = server_registry.get_server(req.server_name, "global")
    if global_srv is None:
        raise HTTPException(
            status_code=404,
            detail=f"Server '{req.server_name}' not found in global registry",
        )
    # Clear the id so a fresh UUID is generated for the project copy
    global_srv.id = None
    return server_registry.add_server(global_srv, "project", req.project_name)


@router.delete("/registry/{server_id}")
def remove_registry_server(
    server_id: str,
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    """Remove a server from the local registry by its UUID."""
    existing = server_registry.get_server_by_id(server_id)
    if existing is None:
        raise HTTPException(
            status_code=404, detail=f"Server '{server_id}' not in registry"
        )
    server_registry.remove_server(existing.name, scope, project_name)
    return {"message": f"Server '{existing.name}' removed from registry"}


# ---- Official MCP Registry ------------------------------------------------


_RUNTIME_MAP = {
    "npm": "npx",
    "pypi": "uvx",
    "oci": "docker",
}


def _transform_registry_server(data: dict) -> McpServer:
    """Convert an official MCP registry ServerJSON into a local McpServer."""
    server_json = data.get("server", data)
    name = server_json["name"]
    title = server_json.get("title") or name.rsplit("/", 1)[-1]

    # Prefer the first stdio package, fall back to first available
    packages = server_json.get("packages") or []
    remotes = server_json.get("remotes") or []
    pkg = None
    for p in packages:
        transport = p.get("transport", {})
        if transport.get("type") == "stdio":
            pkg = p
            break
    if pkg is None and packages:
        pkg = packages[0]

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
            if reg_type == "oci":
                args = ["run", "-i", "--rm", identifier]
            else:
                args = ["-y", identifier]
        else:
            command = identifier

        # Package arguments
        for pa in pkg.get("packageArguments") or []:
            pa_name = pa.get("name", "")
            pa_default = pa.get("default", "")
            if pa.get("type") == "named" and pa_name:
                flag = f"--{pa_name}" if not pa_name.startswith("-") else pa_name
                args.append(flag)
                if pa_default:
                    args.append(pa_default)
            elif pa_default:
                args.append(pa_default)

        # Runtime arguments
        for ra in pkg.get("runtimeArguments") or []:
            ra_name = ra.get("name", "")
            ra_val = ra.get("value", ra.get("default", ""))
            if ra.get("type") == "named" and ra_name:
                flag = f"--{ra_name}" if not ra_name.startswith("-") else ra_name
                args.append(flag)
                if ra_val:
                    args.append(ra_val)
            elif ra_val:
                args.append(ra_val)

        # Environment variables
        for ev in pkg.get("environmentVariables") or []:
            ev_name = ev.get("name", "")
            ev_val = ev.get("value") or ev.get("default") or ""
            if ev_name:
                env[ev_name] = ev_val
    elif remotes:
        # Remote-only server (streamable-http / sse)
        remote = remotes[0]
        srv_type = remote.get("type")
        url = remote.get("url")

    return McpServer(
        name=title,
        command=command,
        args=args,
        env=env,
        type=srv_type,
        url=url,
        sources=[],
    )


@router.get("/mcp-registry/search")
async def search_mcp_registry(
    q: str = Query("", description="Search query"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Proxy search to the official MCP Registry."""
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


@router.post("/mcp-registry/import", response_model=McpServer)
async def import_from_mcp_registry(req: McpRegistryImportRequest):
    """Fetch a server from the official MCP Registry and add it locally."""
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

    srv = _transform_registry_server(data)
    scope = req.scope or "global"
    return server_registry.add_server(srv, scope, req.project_name)


# ---- Projects --------------------------------------------------------------


@router.get("/projects")
def list_projects():
    """Return all saved projects."""
    return project_registry.list_projects()


@router.post("/projects")
def add_project(data: dict):
    """Create a named project with a directory path.

    After creating the project, any MCP servers already configured in that
    project directory (e.g. .cursor/mcp.json, .vscode/mcp.json, etc.) are
    automatically imported into the servers.json registry under the project.
    """
    name = data.get("name", "").strip()
    path = data.get("path", "").strip()
    if not name or not path:
        raise HTTPException(status_code=400, detail="name and path are required")
    try:
        result = project_registry.add_project(name, path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Auto-import existing MCP servers from the project directory
    imported = []
    try:
        discovered = discover_all_servers(Scope.PROJECT, result["path"])
        for srv_name, srv in discovered.items():
            server_registry.add_server(srv, scope="project", project=name)
            imported.append(srv_name)
    except Exception:
        pass  # Don't fail the project creation if import has issues

    result["imported_servers"] = imported
    return result


@router.delete("/projects/{project_name}")
def remove_project(project_name: str):
    """Remove a project by name."""
    removed = project_registry.remove_project(project_name)
    if not removed:
        raise HTTPException(
            status_code=404, detail=f"Project '{project_name}' not found"
        )
    return {"message": f"Project '{project_name}' removed"}


# ---- Directory browser -----------------------------------------------------


@router.get("/browse")
def browse_directories(
    path: str = Query(default="~", description="Directory to list"),
):
    """List subdirectories at the given path for the directory browser."""
    resolved = Path(path).expanduser().resolve()
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail=f"Not a directory: {resolved}")
    children = []
    try:
        for entry in sorted(resolved.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                children.append(entry.name)
    except PermissionError:
        pass  # Some dirs aren't readable
    return {
        "path": str(resolved),
        "parent": str(resolved.parent) if resolved != resolved.parent else None,
        "children": children,
    }


@router.get("/pick-directory")
def pick_directory():
    """Open the native macOS Finder folder picker and return the selected path."""
    import subprocess
    import platform

    if platform.system() != "Darwin":
        raise HTTPException(
            status_code=501,
            detail="Native folder picker is only available on macOS",
        )

    try:
        result = subprocess.run(
            [
                "osascript",
                "-e",
                'POSIX path of (choose folder with prompt "Select project directory")',
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            # User cancelled the dialog
            return {"path": None}
        selected = result.stdout.strip().rstrip("/")
        return {"path": selected}
    except subprocess.TimeoutExpired:
        return {"path": None}


# ---- Servers (discovery + registry merge) ----------------------------------


@router.get("/servers", response_model=list[McpServer])
def list_servers(
    scope: str = Query("global"),
    project_path: Optional[str] = Query(None),
):
    """Return all MCP servers: registry servers merged with discovered servers."""
    s = _parse_scope(scope)
    pdir = _resolve_project_dir(project_path, s)

    # Start with discovered servers
    merged = discover_all_servers(s, pdir)

    # Determine which project name to use for registry lookup
    from project_registry import list_projects

    reg_project = None
    if s == Scope.PROJECT and pdir:
        # Find the project name matching this path
        for proj in list_projects():
            if proj["path"] == str(pdir):
                reg_project = proj["name"]
                break

    reg_scope = "project" if s == Scope.PROJECT else "global"

    # Merge in registry servers for the current scope
    for reg_srv in server_registry.list_servers(reg_scope, reg_project):
        if reg_srv.name in merged:
            if "opensync" not in merged[reg_srv.name].sources:
                merged[reg_srv.name].sources.append("opensync")
            # Carry the stable ID from the registry
            if reg_srv.id:
                merged[reg_srv.name].id = reg_srv.id
        else:
            merged[reg_srv.name] = reg_srv

    return list(merged.values())


# ---- Targets ---------------------------------------------------------------


@router.get("/targets", response_model=list[TargetStatus])
def list_targets(
    scope: str = Query("global"),
    project_path: Optional[str] = Query(None),
):
    """Return status of sync targets for the given scope."""
    s = _parse_scope(scope)
    pdir = _resolve_project_dir(project_path, s)
    targets = get_targets_by_scope(s)

    result: list[TargetStatus] = []
    for t in targets:
        resolved = t.resolve_for_project(pdir) if pdir else t.resolved_path
        try:
            srvs = read_target_servers(t, pdir)
            exists = True
        except Exception:
            srvs = {}
            exists = Path(resolved).exists() if resolved else False
        result.append(
            TargetStatus(
                name=t.name,
                display_name=t.display_name,
                config_path=resolved,
                config_exists=exists,
                server_count=len(srvs),
                scope=s.value,
                category=t.category.value,
                servers=list(srvs.keys()),
            )
        )
    return result


@router.get("/targets/{name}/servers", response_model=list[McpServer])
def get_target_servers(
    name: str,
    project_path: Optional[str] = Query(None),
):
    """List servers installed in a specific target."""
    target = get_target(name)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Unknown target: {name}")
    pdir = _resolve_project_dir(project_path, target.scope)
    try:
        servers = read_target_servers(target, pdir)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return list(servers.values())


# ---- Sync ------------------------------------------------------------------


@router.post("/sync", response_model=SyncResponse)
def do_sync(req: SyncRequest):
    """Sync selected servers to selected targets.

    Servers can come from either discovered configs OR the local registry.
    We merge both pools before syncing.
    """
    s = _parse_scope(req.scope)
    pdir = _resolve_project_dir(req.project_path, s)

    # Build the combined server pool (discovered + registry)
    all_servers = discover_all_servers(s, pdir)

    # Resolve project name for scoped registry lookup
    from project_registry import list_projects

    reg_project = None
    reg_scope = "project" if s == Scope.PROJECT else "global"
    if s == Scope.PROJECT and pdir:
        for proj in list_projects():
            if proj["path"] == str(pdir):
                reg_project = proj["name"]
                break

    for reg_srv in server_registry.list_servers(reg_scope, reg_project):
        if reg_srv.name not in all_servers:
            all_servers[reg_srv.name] = reg_srv

    servers_to_sync = [all_servers[n] for n in req.server_names if n in all_servers]

    from config_manager import backup_config

    results = []
    backups: dict[str, str] = {}

    for tname in req.target_names:
        target = get_target(tname)
        if target is None:
            results.append(
                {
                    "target": tname,
                    "success": False,
                    "message": f"Unknown target: {tname}",
                }
            )
            continue
        if bp := backup_config(target, pdir):
            backups[tname] = bp
        result = write_servers_to_target(
            target, servers_to_sync, create_backup=False, project_dir=pdir
        )
        results.append(result)

    return SyncResponse(results=results, backup_paths=backups)


# ---- Remove ----------------------------------------------------------------


@router.delete("/servers/{server_name:path}")
def remove_server(
    server_name: str,
    req: RemoveServerRequest,
    project_path: Optional[str] = Query(None),
):
    """Remove a server from one or more targets."""
    results = []
    for tname in req.target_names:
        target = get_target(tname)
        if target is None:
            results.append(
                {
                    "target": tname,
                    "success": False,
                    "message": f"Unknown target: {tname}",
                }
            )
            continue
        pdir = _resolve_project_dir(project_path, target.scope)
        r = remove_server_from_target(target, server_name, pdir)
        results.append(r.model_dump())
    return {"results": results}


# ---- Skills ----------------------------------------------------------------


@router.get("/registry/skills", response_model=list[Skill])
def list_registry_skills(
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    return skill_registry.list_skills(scope, project_name)


@router.post("/registry/skills", response_model=Skill)
def add_registry_skill(req: dict):
    s = Skill(
        name=req.get("name"),
        description=req.get("description"),
        content=req.get("content", ""),
        sources=[],
    )
    return skill_registry.add_skill(
        s, req.get("scope", "global"), req.get("project_name")
    )


@router.delete("/registry/skills/{skill_id}")
def remove_registry_skill(
    skill_id: str,
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    existing = skill_registry.get_skill_by_id(skill_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    skill_registry.remove_skill(existing.name, scope, project_name)
    return {"message": "Skill removed"}


class _ImportSkillRequest(pydantic.BaseModel):
    skill_id: str
    project_name: str


@router.post("/registry/skills/import", response_model=Skill)
def import_skill_from_global(req: _ImportSkillRequest):
    """Copy a skill from the global registry into a project's registry."""
    global_skill = skill_registry.get_skill_by_id(req.skill_id)
    if global_skill is None:
        raise HTTPException(
            status_code=404,
            detail=f"Skill '{req.skill_id}' not found in global registry",
        )
    global_skill.id = None  # fresh UUID for the project copy
    return skill_registry.add_skill(global_skill, "project", req.project_name)


# ---- Workflows -------------------------------------------------------------


@router.get("/registry/workflows", response_model=list[Workflow])
def list_registry_workflows(
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    return workflow_registry.list_workflows(scope, project_name)


@router.post("/registry/workflows", response_model=Workflow)
def add_registry_workflow(req: dict):
    w = Workflow(
        name=req.get("name"),
        description=req.get("description"),
        content=req.get("content"),
        sources=[],
    )
    return workflow_registry.add_workflow(
        w, req.get("scope", "global"), req.get("project_name")
    )


@router.delete("/registry/workflows/{workflow_id}")
def remove_registry_workflow(
    workflow_id: str,
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    existing = workflow_registry.get_workflow_by_id(workflow_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflow_registry.remove_workflow(existing.name, scope, project_name)
    return {"message": "Workflow removed"}


class _ImportWorkflowRequest(pydantic.BaseModel):
    workflow_id: str
    project_name: str


@router.post("/registry/workflows/import", response_model=Workflow)
def import_workflow_from_global(req: _ImportWorkflowRequest):
    """Copy a workflow from the global registry into a project's registry."""
    global_wf = workflow_registry.get_workflow_by_id(req.workflow_id)
    if global_wf is None:
        raise HTTPException(
            status_code=404,
            detail=f"Workflow '{req.workflow_id}' not found in global registry",
        )
    global_wf.id = None
    return workflow_registry.add_workflow(global_wf, "project", req.project_name)


# ---- LLM Providers ---------------------------------------------------------


@router.get("/registry/llm-providers/discover", response_model=list[LlmProvider])
def discover_llm_providers_from_configs():
    """Discover LLM providers from global AI tool config files (OpenCode, etc.)."""
    return llm_provider_discovery.discover_all_llm_providers()


@router.get("/registry/llm-providers/targets")
def list_llm_provider_targets():
    """Return all writable LLM provider targets (e.g. OpenCode)."""
    return llm_provider_discovery.list_llm_provider_targets()


class _SyncProviderRequest(pydantic.BaseModel):
    provider_id: str
    target_ids: list[str]
    project_path: Optional[str] = None


@router.post("/registry/llm-providers/sync")
def sync_llm_provider_to_targets(req: _SyncProviderRequest):
    """Push a registered LLM provider into one or more agent config files."""
    provider = llm_provider_registry.get_llm_provider_by_id(req.provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="LLM Provider not found")
    results = [
        {
            "target_id": tid,
            **llm_provider_discovery.write_provider_to_target(
                provider, tid, req.project_path
            ),
        }
        for tid in req.target_ids
    ]
    return {"results": results}


@router.get("/registry/llm-providers", response_model=list[LlmProvider])
def list_registry_llm_providers(
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    return llm_provider_registry.list_llm_providers(scope, project_name)


@router.post("/registry/llm-providers", response_model=LlmProvider)
def add_registry_llm_provider(req: dict):
    p = LlmProvider(
        name=req.get("name"),
        provider_type=req.get("provider_type"),
        api_key=req.get("api_key"),
        base_url=req.get("base_url"),
        sources=[],
    )
    return llm_provider_registry.add_llm_provider(
        p, req.get("scope", "global"), req.get("project_name")
    )


@router.delete("/registry/llm-providers/{provider_id}")
def remove_registry_llm_provider(
    provider_id: str,
    scope: str = Query("global"),
    project_name: Optional[str] = Query(None),
):
    existing = llm_provider_registry.get_llm_provider_by_id(provider_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="LLM Provider not found")
    llm_provider_registry.remove_llm_provider(existing.name, scope, project_name)
    return {"message": "LLM Provider removed"}


class _ImportProviderRequest(pydantic.BaseModel):
    provider_id: str
    project_name: str


@router.post("/registry/llm-providers/import", response_model=LlmProvider)
def import_provider_from_global(req: _ImportProviderRequest):
    """Copy an LLM provider from the global registry into a project's registry."""
    global_prov = llm_provider_registry.get_llm_provider_by_id(req.provider_id)
    if global_prov is None:
        raise HTTPException(
            status_code=404,
            detail=f"LLM Provider '{req.provider_id}' not found in global registry",
        )
    global_prov.id = None
    return llm_provider_registry.add_llm_provider(
        global_prov, "project", req.project_name
    )


# ---- Skills sync -----------------------------------------------------------


@router.get("/registry/skills/discover")
def discover_skills_from_configs(project_path: Optional[str] = None):
    """Discover skills from global AI tool config files (and optionally a project)."""
    return skill_discovery.discover_all_skills(project_path=project_path)


@router.get("/registry/skills/targets")
def list_skill_targets():
    """Return all skill write targets."""
    return skill_discovery.list_skill_targets()


class _SyncSkillRequest(pydantic.BaseModel):
    skill_id: str
    target_ids: list[str]
    project_path: Optional[str] = None


@router.post("/registry/skills/sync")
def sync_skill_to_targets(req: _SyncSkillRequest):
    """Push a registered Skill into one or more agent config files."""
    from skill_registry import get_skill_by_id

    skill = get_skill_by_id(req.skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    results = [
        {
            "target_id": tid,
            **skill_discovery.write_skill_to_target(skill, tid, req.project_path),
        }
        for tid in req.target_ids
    ]
    return {"results": results}


# ---- Workflows sync --------------------------------------------------------


@router.get("/registry/workflows/discover")
def discover_workflows_from_configs(project_path: Optional[str] = None):
    """Discover workflows from global AI tool config files (and optionally a project)."""
    return workflow_discovery.discover_all_workflows(project_path=project_path)


@router.get("/registry/workflows/targets")
def list_workflow_targets():
    """Return all workflow write targets."""
    return workflow_discovery.list_workflow_targets()


class _SyncWorkflowRequest(pydantic.BaseModel):
    workflow_id: str
    target_ids: list[str]
    project_path: Optional[str] = None


@router.post("/registry/workflows/sync")
def sync_workflow_to_targets(req: _SyncWorkflowRequest):
    """Push a registered Workflow into one or more agent config files."""
    from workflow_registry import get_workflow_by_id

    workflow = get_workflow_by_id(req.workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    results = [
        {
            "target_id": tid,
            **workflow_discovery.write_workflow_to_target(
                workflow, tid, req.project_path
            ),
        }
        for tid in req.target_ids
    ]
    return {"results": results}


# ---- Import from project directory -----------------------------------------


class _ScanProjectRequest(pydantic.BaseModel):
    project_path: str


@router.post("/registry/import-from-project/scan")
def scan_project_for_artifacts(req: _ScanProjectRequest):
    """Scan a project directory and return all discoverable artifacts."""
    from pathlib import Path as _Path

    p = _Path(req.project_path).expanduser()
    if not p.is_dir():
        raise HTTPException(
            status_code=400, detail=f"Directory not found: {req.project_path}"
        )
    return project_importer.scan_project(req.project_path)


class _ImportItem(pydantic.BaseModel):
    name: str
    type: str  # "skill" | "workflow"
    description: Optional[str] = None
    content: str = ""


class _CommitImportRequest(pydantic.BaseModel):
    items: list[_ImportItem]
    scope: str = "global"
    project_name: Optional[str] = None


@router.post("/registry/import-from-project/commit")
def commit_imported_artifacts(req: _CommitImportRequest):
    """Save selected artifacts into the skill / workflow registries."""
    items = [i.model_dump() for i in req.items]
    return project_importer.commit_artifacts(items, req.scope, req.project_name)
