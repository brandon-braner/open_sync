"""FastAPI router – REST API for OpenSync."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import project_registry
import server_registry
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
    McpServer,
    RemoveServerRequest,
    SyncRequest,
    SyncResponse,
    TargetStatus,
    UpdateServerRequest,
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
