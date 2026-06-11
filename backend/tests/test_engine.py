"""Engine flows: discover → import → status state machine → plan/apply → pull."""

import json

import pytest

from opensync import store
from opensync.engine import engine
from opensync.models import McpServer, SkillEntity


def _seed_cursor_global(home, servers: dict):
    cfg = home / ".cursor" / "mcp.json"
    cfg.parent.mkdir(parents=True, exist_ok=True)
    cfg.write_text(json.dumps({"mcpServers": servers}))
    return cfg


def _make_entity(name="ctx", command="npx", args=None):
    return store.create_entity(
        "mcp",
        McpServer(name=name, command=command, args=args or []),
        "global",
        None,
    )


# ---------------------------------------------------------------------------
# Discover & import
# ---------------------------------------------------------------------------


def test_discover_finds_and_merges_sources(env, home):
    _seed_cursor_global(home, {"ctx": {"command": "npx", "args": ["ctx"]}})
    claude = home / ".claude.json"
    claude.write_text(json.dumps({"mcpServers": {"ctx": {"command": "npx", "args": ["ctx"]}}}))

    items = engine.discover("mcp", "global")
    assert len(items) == 1
    assert set(items[0].sources) == {"claude_code", "cursor"}
    assert not items[0].already_imported


def test_import_creates_entity_and_sync_state(env, home):
    _seed_cursor_global(home, {"ctx": {"command": "npx", "args": ["ctx"]}})
    imported = engine.import_items(
        "mcp", [{"name": "ctx", "integration": "cursor", "scope": "global"}]
    )
    assert len(imported) == 1
    entity = imported[0]
    assert entity.data["command"] == "npx"

    # Immediately in_sync for the source integration
    statuses = engine.status("mcp", "global")
    cursor_cell = next(
        c for c in statuses[0].cells if c.integration == "cursor"
    )
    assert cursor_cell.status == "in_sync"


def test_discover_reads_fallback_paths(env, project):
    proj = project.path
    legacy = engine.paths.Path(proj) / ".windsurf" / "skills" / "old-skill"
    legacy.mkdir(parents=True)
    (legacy / "SKILL.md").write_text("---\nname: old-skill\n---\n\nlegacy body\n")

    items = engine.discover("skill", "project", project.id)
    assert any(i.name == "old-skill" and "devin" in i.sources for i in items)


# ---------------------------------------------------------------------------
# Status state machine
# ---------------------------------------------------------------------------


def _cell(entity_id, integration, scope="global", project_id=None):
    statuses = engine.status("mcp", scope, project_id)
    row = next(s for s in statuses if s.entity_id == entity_id)
    return next(c for c in row.cells if c.integration == integration)


def test_status_lifecycle(env, home):
    entity = _make_entity()
    assert _cell(entity.id, "cursor").status == "not_synced"

    # sync → in_sync
    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    assert plan.changes and not plan.warnings
    result = engine.apply_plan(plan.plan_id)
    assert result.success
    assert _cell(entity.id, "cursor").status == "in_sync"

    # edit registry → outdated
    store.update_entity(entity.id, McpServer(name="ctx", command="uvx"))
    assert _cell(entity.id, "cursor").status == "outdated"

    # re-sync → in_sync again
    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    engine.apply_plan(plan.plan_id)
    assert _cell(entity.id, "cursor").status == "in_sync"

    # hand-edit the target file → drifted
    cfg = home / ".cursor" / "mcp.json"
    data = json.loads(cfg.read_text())
    data["mcpServers"]["ctx"]["command"] = "bunx"
    cfg.write_text(json.dumps(data))
    assert _cell(entity.id, "cursor").status == "drifted"

    # edit registry too → conflict
    store.update_entity(entity.id, McpServer(name="ctx", command="deno"))
    assert _cell(entity.id, "cursor").status == "conflict"

    # delete from target → missing
    data["mcpServers"] = {}
    cfg.write_text(json.dumps(data))
    assert _cell(entity.id, "cursor").status == "missing"


def test_plan_refuses_drifted_without_force(env, home):
    entity = _make_entity()
    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    engine.apply_plan(plan.plan_id)

    cfg = home / ".cursor" / "mcp.json"
    data = json.loads(cfg.read_text())
    data["mcpServers"]["ctx"]["command"] = "edited-by-hand"
    cfg.write_text(json.dumps(data))
    store.update_entity(entity.id, McpServer(name="ctx", command="uvx"))

    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    assert not plan.changes
    assert plan.warnings and plan.warnings[0].status == "conflict"

    forced = engine.plan_sync(
        "mcp", [entity.id], ["cursor"],
        force=[{"entity_id": entity.id, "integration": "cursor"}],
    )
    assert forced.changes
    engine.apply_plan(forced.plan_id)
    assert _cell(entity.id, "cursor").status == "in_sync"


def test_plan_is_dry_run(env, home):
    entity = _make_entity()
    engine.plan_sync("mcp", [entity.id], ["cursor"])
    assert not (home / ".cursor" / "mcp.json").exists()


def test_plan_warns_for_unsupported_target(env):
    skill = store.create_entity(
        "skill", SkillEntity(name="s", description="d", content="c"), "global", None
    )
    plan = engine.plan_sync("skill", [skill.id], ["claude_desktop"])
    assert not plan.changes
    assert plan.warnings[0].status == "unsupported"


def test_apply_unknown_plan_fails(env):
    assert not engine.apply_plan("nope").success


# ---------------------------------------------------------------------------
# Pull
# ---------------------------------------------------------------------------


def test_pull_accepts_target_version(env, home):
    entity = _make_entity()
    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    engine.apply_plan(plan.plan_id)

    cfg = home / ".cursor" / "mcp.json"
    data = json.loads(cfg.read_text())
    data["mcpServers"]["ctx"]["command"] = "hand-edited"
    cfg.write_text(json.dumps(data))

    updated = engine.pull(entity.id, "cursor")
    assert updated.data["command"] == "hand-edited"
    assert _cell(entity.id, "cursor").status == "in_sync"


# ---------------------------------------------------------------------------
# Skills: SKILL.md write + legacy marker cleanup
# ---------------------------------------------------------------------------


def test_skill_sync_writes_skill_md_and_cleans_markers(env, home):
    claude_md = home / ".claude" / "CLAUDE.md"
    claude_md.parent.mkdir(parents=True)
    claude_md.write_text(
        "# My instructions\n\nKeep this.\n"
        "<!-- OPENSYNC_SKILL:old -->\ninjected v1 skill\n<!-- /OPENSYNC_SKILL:old -->\n"
    )

    skill = store.create_entity(
        "skill",
        SkillEntity(name="pdf", description="PDFs", content="Use pdftk."),
        "global",
        None,
    )
    plan = engine.plan_sync("skill", [skill.id], ["claude_code"])
    result = engine.apply_plan(plan.plan_id)
    assert result.success

    assert (home / ".claude" / "skills" / "pdf" / "SKILL.md").is_file()
    cleaned = claude_md.read_text()
    assert "OPENSYNC_SKILL" not in cleaned
    assert "Keep this." in cleaned


# ---------------------------------------------------------------------------
# Backups
# ---------------------------------------------------------------------------


def test_apply_creates_backup_of_existing_files(env, home):
    cfg = _seed_cursor_global(home, {"old": {"command": "old"}})
    entity = _make_entity()
    plan = engine.plan_sync("mcp", [entity.id], ["cursor"])
    result = engine.apply_plan(plan.plan_id)

    assert result.backup_dir is not None
    backups = list(engine.paths.opensync_dir().glob("backups/*/*mcp.json"))
    assert backups and json.loads(backups[0].read_text())["mcpServers"]["old"]

    # The write merged rather than clobbered
    data = json.loads(cfg.read_text())
    assert set(data["mcpServers"]) == {"old", "ctx"}


def test_backup_rotation(env, home, monkeypatch):
    from opensync.engine import backup as backup_mod

    monkeypatch.setattr(backup_mod, "KEEP_RUNS", 3)
    f = home / "file.txt"
    for i in range(6):
        f.write_text(f"v{i}")
        backup_mod.create_backup_run(f"run {i}", [f])
        backup_mod.rotate(3)
    runs = list(backup_mod.backups_root().iterdir())
    assert len(runs) == 3


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------


def test_rule_sync_to_claude_md_and_cursor(env, project):
    from opensync.models import RuleEntity
    from pathlib import Path

    rule = store.create_entity(
        "rule",
        RuleEntity(name="style", description="Style", content="- Be terse"),
        "project",
        project.id,
    )
    proj = Path(project.path)
    (proj / "CLAUDE.md").write_text("# Existing project notes\n")

    plan = engine.plan_sync("rule", [rule.id], ["claude_code", "cursor", "codex"])
    assert not plan.warnings
    assert engine.apply_plan(plan.plan_id).success

    claude_md = (proj / "CLAUDE.md").read_text()
    assert "# Existing project notes" in claude_md
    assert "opensync:rule:style" in claude_md
    assert (proj / ".cursor" / "rules" / "style.mdc").is_file()
    assert "opensync:rule:style" in (proj / "AGENTS.md").read_text()

    statuses = engine.status("rule", "project", project.id)
    cells = {c.integration: c.status for c in statuses[0].cells}
    assert cells["claude_code"] == "in_sync"
    assert cells["cursor"] == "in_sync"
    assert cells["codex"] == "in_sync"
