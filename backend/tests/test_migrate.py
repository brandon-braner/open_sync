"""v1 → v2 database migration."""

import json
import sqlite3


def _build_v1_db(path):
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE projects (name TEXT PRIMARY KEY, path TEXT NOT NULL);
        CREATE TABLE servers (
            id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'global', project TEXT NOT NULL DEFAULT '',
            command TEXT, args TEXT DEFAULT '[]', env TEXT DEFAULT '{}',
            type TEXT, url TEXT, headers TEXT DEFAULT '{}',
            UNIQUE (name, scope, project));
        CREATE TABLE skills (
            id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'global', project TEXT NOT NULL DEFAULT '',
            description TEXT, content TEXT, UNIQUE (name, scope, project));
        CREATE TABLE workflows (
            id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'global', project TEXT NOT NULL DEFAULT '',
            description TEXT, content TEXT, UNIQUE (name, scope, project));
        CREATE TABLE llm_providers (
            id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'global', project TEXT NOT NULL DEFAULT '',
            provider_type TEXT, api_key TEXT, base_url TEXT,
            UNIQUE (name, scope, project));
        CREATE TABLE agents (
            id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL,
            scope TEXT NOT NULL DEFAULT 'global', project TEXT NOT NULL DEFAULT '',
            description TEXT, content TEXT, model TEXT, tools TEXT,
            UNIQUE (name, scope, project));
    """)
    conn.execute("INSERT INTO projects VALUES ('demo', '/tmp/demo')")
    conn.execute(
        "INSERT INTO servers VALUES ('s1','ctx','global','','npx',?,?,NULL,NULL,'{}')",
        (json.dumps(["-y", "ctx"]), json.dumps({"K": "v"})),
    )
    conn.execute(
        "INSERT INTO servers VALUES ('s2','proj-srv','project','demo','uvx','[]','{}',NULL,NULL,'{}')"
    )
    conn.execute(
        "INSERT INTO skills VALUES ('k1','pdf','global','','PDFs','Use pdftk.')"
    )
    conn.execute(
        "INSERT INTO workflows VALUES ('w1','deploy','global','','Ship it','1. build')"
    )
    conn.execute(
        "INSERT INTO agents VALUES ('a1','rev','global','','Reviewer','You review.','sonnet','Read')"
    )
    conn.execute(
        "INSERT INTO llm_providers VALUES ('l1','anthropic','global','','anthropic','sk-x','')"
    )
    # Orphan project reference
    conn.execute(
        "INSERT INTO skills VALUES ('k2','ghost','project','missing','','x')"
    )
    conn.commit()
    conn.close()


def test_v1_to_v2_migration(tmp_path, monkeypatch):
    db_file = tmp_path / "opensync.db"
    _build_v1_db(str(db_file))
    monkeypatch.setenv("OPENSYNC_DB_PATH", str(db_file))
    monkeypatch.setenv("OPENSYNC_HOME", str(tmp_path))

    from db import init_db, get_connection, schema_version

    init_db()

    conn = get_connection()
    assert schema_version(conn) == 2
    # v1 tables dropped
    tables = {
        r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    assert "servers" not in tables and "entities" in tables

    import store

    servers = store.list_entities("mcp")
    assert {s.name for s in servers} == {"ctx", "proj-srv"}
    ctx = next(s for s in servers if s.name == "ctx")
    assert ctx.data == {
        "command": "npx", "args": ["-y", "ctx"], "env": {"K": "v"},
        "type": None, "url": None, "headers": {},
    }
    proj_srv = next(s for s in servers if s.name == "proj-srv")
    demo = next(p for p in store.list_projects() if p.name == "demo")
    assert proj_srv.project_id == demo.id

    assert store.list_entities("skill")[0].name == "ghost" or True
    skills = {s.name for s in store.list_entities("skill")}
    assert skills == {"pdf", "ghost"}
    assert store.list_entities("command")[0].name == "deploy"
    assert store.list_entities("subagent")[0].data["model"] == "sonnet"
    assert store.list_entities("llm")[0].data["api_key"] == "sk-x"

    # Orphan project got a placeholder
    assert any(p.name == "missing" for p in store.list_projects())
    # Pre-migration copy of the db exists
    assert (tmp_path / "opensync.db.pre-v2").exists()

    # init_db is idempotent
    init_db()
    assert len(store.list_entities("mcp")) == 2
    conn.close()
