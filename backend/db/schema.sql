-- OpenSync schema v2

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS projects_v2 (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS entities (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL CHECK (kind IN ('mcp','skill','rule','command','subagent','llm')),
    name        TEXT NOT NULL,
    scope       TEXT NOT NULL CHECK (scope IN ('global','project')),
    project_id  TEXT REFERENCES projects_v2(id) ON DELETE CASCADE,
    description TEXT NOT NULL DEFAULT '',
    data        TEXT NOT NULL DEFAULT '{}',
    content     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (kind, name, scope, project_id)
);

CREATE TABLE IF NOT EXISTS entity_files (
    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relpath   TEXT NOT NULL,
    content   BLOB NOT NULL,
    PRIMARY KEY (entity_id, relpath)
);

CREATE TABLE IF NOT EXISTS sync_state (
    entity_id    TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    integration  TEXT NOT NULL,
    scope        TEXT NOT NULL,
    project_id   TEXT,
    target_path  TEXT NOT NULL,
    synced_hash  TEXT NOT NULL,
    synced_at    TEXT NOT NULL,
    PRIMARY KEY (entity_id, integration)
);

CREATE TABLE IF NOT EXISTS backup_runs (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    label      TEXT,
    dir        TEXT NOT NULL
);
