"""OpenSync – MCP Server Configuration Manager."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from opensync.db import init_db
from opensync.routers import api_router
from opensync.routers.lsp import router as lsp_router

# Initialize SQLite database (creates v2 tables, migrates a v1 db on first run)
init_db()

app = FastAPI(
    title="OpenSync",
    description="Sync MCP server configurations across AI agents and IDEs",
    version="0.1.0",
)

# CORS – allow the Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "http://127.0.0.1:*"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(lsp_router)  # WebSocket bridge at /ws/lsp/{language}


# Serve the built frontend: bundled into the wheel as opensync/static,
# or frontend/dist in a source checkout.
from pathlib import Path

_static_candidates = [
    Path(__file__).resolve().parent / "static",
    Path(__file__).resolve().parents[2] / "frontend" / "dist",
]
for _dist in _static_candidates:
    if (_dist / "index.html").is_file():
        app.mount("/", StaticFiles(directory=_dist, html=True), name="frontend")
        break


def run():
    import uvicorn

    uvicorn.run("opensync.main:app", host="0.0.0.0", port=8001, reload=True)


if __name__ == "__main__":
    run()
