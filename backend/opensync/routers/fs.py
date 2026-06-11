"""Filesystem helpers for the project directory picker."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/fs", tags=["fs"])


@router.get("/browse")
def browse_directories(path: str = Query(default="~")):
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
        pass
    return {
        "path": str(resolved),
        "parent": str(resolved.parent) if resolved != resolved.parent else None,
        "children": children,
    }


@router.get("/pick-directory")
def pick_directory():
    """Open the native macOS Finder folder picker and return the selection."""
    import platform
    import subprocess

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
            return {"path": None}
        return {"path": result.stdout.strip().rstrip("/")}
    except subprocess.TimeoutExpired:
        return {"path": None}
