"""OpenSync – MCP Server Configuration Manager."""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api import router
from database import init_db

# Initialize SQLite database (creates tables, migrates JSON data on first run)
init_db()

app = FastAPI(
    title="OpenSync",
    description="Sync MCP server configurations across AI agents and IDEs",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")


def run():
    import uvicorn

    port = int(os.environ.get("OPENSYNC_PORT", 8001))
    host = os.environ.get("OPENSYNC_HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    run()
