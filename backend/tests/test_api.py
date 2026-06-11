"""API surface tests via TestClient (generic entities router + sync flow)."""

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture()
def client(env):
    from routers import api_router

    app = FastAPI()
    app.include_router(api_router)
    return TestClient(app)


def test_integrations_endpoint(client):
    data = client.get("/api/integrations").json()
    ids = {i["id"] for i in data}
    assert {"claude_code", "codex", "devin", "cursor"} <= ids
    codex = next(i for i in data if i["id"] == "codex")
    assert codex["targets"]["mcp"]["global"]["handler"] == "toml_mcp"


def test_entity_crud(client):
    created = client.post(
        "/api/mcp",
        json={"name": "ctx", "command": "npx", "args": ["-y", "ctx"], "scope": "global"},
    )
    assert created.status_code == 200, created.text
    entity = created.json()

    assert client.post(
        "/api/mcp", json={"name": "ctx", "command": "x", "scope": "global"}
    ).status_code == 409

    listed = client.get("/api/mcp").json()
    assert len(listed) == 1

    updated = client.put(
        f"/api/mcp/{entity['id']}", json={"name": "ctx", "command": "uvx"}
    ).json()
    assert updated["data"]["command"] == "uvx"

    assert client.delete(f"/api/mcp/{entity['id']}").status_code == 200
    assert client.get("/api/mcp").json() == []


def test_unknown_kind_404(client):
    assert client.get("/api/widgets").status_code == 404


def test_project_scope_requires_project_id(client):
    resp = client.post("/api/skills", json={"name": "s", "scope": "project"})
    assert resp.status_code == 400


def test_discover_import_status_sync_flow(client, home):
    cfg = home / ".cursor" / "mcp.json"
    cfg.parent.mkdir(parents=True)
    cfg.write_text(json.dumps({"mcpServers": {"ctx": {"command": "npx"}}}))

    found = client.get("/api/mcp/discover").json()
    assert found[0]["name"] == "ctx" and "cursor" in found[0]["sources"]

    imported = client.post(
        "/api/mcp/import",
        json={"items": [{"name": "ctx", "integration": "cursor", "scope": "global"}]},
    ).json()["imported"]
    entity_id = imported[0]["id"]

    statuses = client.get("/api/mcp/status").json()
    cell = next(
        c for c in statuses[0]["cells"] if c["integration"] == "claude_code"
    )
    assert cell["status"] == "not_synced"

    plan = client.post(
        "/api/sync/plan",
        json={"kind": "mcp", "entity_ids": [entity_id], "integrations": ["claude_code"]},
    ).json()
    assert plan["changes"] and "+" in plan["changes"][0]["diff"]

    result = client.post("/api/sync/apply", json={"plan_id": plan["plan_id"]}).json()
    assert result["success"]
    assert (home / ".claude.json").exists()

    statuses = client.get("/api/mcp/status").json()
    cell = next(
        c for c in statuses[0]["cells"] if c["integration"] == "claude_code"
    )
    assert cell["status"] == "in_sync"


def test_projects_auto_import(client, env):
    proj_dir = env / "myproj"
    (proj_dir / ".cursor").mkdir(parents=True)
    (proj_dir / ".cursor" / "mcp.json").write_text(
        json.dumps({"mcpServers": {"db": {"command": "uvx", "args": ["db-mcp"]}}})
    )

    resp = client.post(
        "/api/projects", json={"name": "myproj", "path": str(proj_dir)}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["imported"].get("mcp") == ["db"]

    project_id = body["project"]["id"]
    entities = client.get(
        "/api/mcp", params={"scope": "project", "project_id": project_id}
    ).json()
    assert entities[0]["name"] == "db"
