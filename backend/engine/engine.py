"""The sync engine: discover, import, status, plan, apply, pull.

All flows are driven by the integration manifests. Writes only ever happen
in `apply`, from a previously computed plan — handlers themselves are pure.

Conflict policy: a default sync only writes cells that are not_synced,
outdated, or missing. Cells where the target file changed underneath us
(drifted / conflict) are excluded and reported as warnings unless the
caller explicitly forces them.
"""

from __future__ import annotations

import difflib
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

import store
from engine import backup, paths
from engine.handlers import HANDLERS, FileChange
from engine.handlers.base import read_text_or_none
from engine.hash import item_hash
from integrations import ALL_INTEGRATIONS, get_integration
from models import (
    ApplyResult,
    CellStatus,
    DiscoveredItem,
    Entity,
    EntityStatus,
    PlanChange,
    PlanWarning,
    SyncPlan,
    split_canonical,
)

# v1 OpenSync injected skills/workflows into instruction files between these
# marker comments; they are stripped when a skill sync touches the target.
_MARKER_RE = re.compile(
    r"\n?<!--\s*OPENSYNC_(SKILL|WORKFLOW):[^>]*-->.*?<!--\s*/OPENSYNC_\1:[^>]*-->\n?",
    re.DOTALL,
)

_WRITABLE_CAPABILITIES = {"native", "fallback", "legacy"}

_PLAN_TTL_SECONDS = 600


@dataclass
class _CachedPlan:
    created: float
    label: str
    changes: list[FileChange]
    state_updates: list[tuple[str, str, str, Optional[str], str, str]]
    # (entity_id, integration, scope, project_id, target_path, hash)
    plan: SyncPlan = field(default=None)


_PLAN_CACHE: dict[str, _CachedPlan] = {}


def _project_dir(project_id: Optional[str]) -> Optional[str]:
    if not project_id:
        return None
    project = store.get_project(project_id)
    return project.path if project else None


def _read_target(integration, target, project_dir) -> dict[str, BaseModel]:
    """Read the primary write path of a target (drift detection)."""
    handler = HANDLERS[target.handler]
    try:
        return handler.read(paths.resolve(target, project_dir), target.options)
    except Exception:
        return {}


def _read_all_paths(integration, target, project_dir) -> dict[str, BaseModel]:
    """Read primary + read_paths (discovery). First occurrence wins."""
    handler = HANDLERS[target.handler]
    merged: dict[str, BaseModel] = {}
    for path in paths.resolve_read_paths(target, project_dir):
        try:
            found = handler.read(path, target.options)
        except Exception:
            continue
        for name, model in found.items():
            merged.setdefault(name, model)
    return merged


# ---------------------------------------------------------------------------
# Discover & import
# ---------------------------------------------------------------------------


def discover(
    kind: str, scope: str, project_id: Optional[str] = None
) -> list[DiscoveredItem]:
    project_dir = _project_dir(project_id)
    if scope == "project" and not project_dir:
        return []
    registry = {e.name: e for e in store.list_entities(kind, scope, project_id)}

    merged: dict[str, DiscoveredItem] = {}
    for integration in ALL_INTEGRATIONS:
        target = integration.target_for(kind, scope)
        if target is None:
            continue
        for name, model in _read_all_paths(integration, target, project_dir).items():
            if name in merged:
                if integration.id not in merged[name].sources:
                    merged[name].sources.append(integration.id)
                continue
            item_name, description, content, data = split_canonical(model)
            item = DiscoveredItem(
                kind=kind,
                name=item_name,
                scope=scope,
                sources=[integration.id],
                data=data,
                description=description,
                content=content,
            )
            entity = registry.get(name)
            if entity is not None:
                item.already_imported = True
                item.differs_from_registry = item_hash(model) != item_hash(
                    store.canonical_of(entity)
                )
            merged[name] = item
    return list(merged.values())


def import_items(
    kind: str,
    items: list[dict],
) -> list[Entity]:
    """Import discovered items into the registry.

    items: [{name, integration, scope, project_id}]
    """
    imported: list[Entity] = []
    for spec in items:
        integration = get_integration(spec["integration"])
        if integration is None:
            continue
        scope = spec["scope"]
        project_id = spec.get("project_id")
        target = integration.target_for(kind, scope)
        if target is None:
            continue
        project_dir = _project_dir(project_id)
        found = _read_all_paths(integration, target, project_dir)
        model = found.get(spec["name"])
        if model is None:
            continue
        entity = store.upsert_entity(kind, model, scope, project_id)
        store.set_sync_state(
            entity.id,
            integration.id,
            scope,
            project_id,
            str(paths.resolve(target, project_dir)),
            item_hash(model),
        )
        imported.append(entity)
    return imported


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


def _cell_status(
    reg_hash: str,
    synced_hash: Optional[str],
    target_hash: Optional[str],
) -> str:
    if target_hash == reg_hash and target_hash is not None:
        return "in_sync"
    if synced_hash is None:
        return "not_synced"
    if target_hash is None:
        return "missing"
    if reg_hash != synced_hash and target_hash == synced_hash:
        return "outdated"
    if reg_hash == synced_hash and target_hash != synced_hash:
        return "drifted"
    return "conflict"


def status(
    kind: str, scope: str, project_id: Optional[str] = None
) -> list[EntityStatus]:
    entities = store.list_entities(kind, scope, project_id)
    sync_states = store.get_sync_states([e.id for e in entities])
    project_dir = _project_dir(project_id)

    columns: list[tuple] = []  # (integration, target, target_items)
    for integration in ALL_INTEGRATIONS:
        target = integration.target_for(kind, scope)
        if target is None:
            continue
        items = _read_target(integration, target, project_dir)
        columns.append((integration, target, items))

    result: list[EntityStatus] = []
    for entity in entities:
        reg_hash = item_hash(store.canonical_of(entity))
        cells: list[CellStatus] = []
        for integration, target, target_items in columns:
            resolved = str(paths.resolve(target, project_dir))
            if target.capability == "read_only":
                cells.append(
                    CellStatus(
                        integration=integration.id,
                        status="unsupported",
                        capability="read_only",
                        target_path=resolved,
                        notes=target.notes,
                    )
                )
                continue
            state = sync_states.get((entity.id, integration.id))
            target_item = target_items.get(entity.name)
            cells.append(
                CellStatus(
                    integration=integration.id,
                    status=_cell_status(
                        reg_hash,
                        state["synced_hash"] if state else None,
                        item_hash(target_item) if target_item else None,
                    ),
                    capability=target.capability,
                    target_path=resolved,
                    notes=target.notes,
                )
            )
        result.append(EntityStatus(entity_id=entity.id, name=entity.name, cells=cells))
    return result


# ---------------------------------------------------------------------------
# Plan & apply
# ---------------------------------------------------------------------------


def _legacy_marker_changes(target, project_dir) -> list[FileChange]:
    changes = []
    for raw in target.legacy_marker_paths:
        path = paths._expand(raw, project_dir)
        text = read_text_or_none(path)
        if text is None:
            continue
        stripped = _MARKER_RE.sub("\n", text)
        if stripped != text:
            changes.append(FileChange(path=path, before=text, after=stripped))
    return changes


def plan_sync(
    kind: str,
    entity_ids: list[str],
    integration_ids: list[str],
    force: Optional[list[dict]] = None,
) -> SyncPlan:
    """Compute a dry-run plan syncing the given entities to the given tools.

    force: [{entity_id, integration}] cells to write even when drifted.
    """
    force_pairs = {(f["entity_id"], f["integration"]) for f in (force or [])}
    entities = [e for eid in entity_ids if (e := store.get_entity(eid))]
    sync_states = store.get_sync_states([e.id for e in entities])

    warnings: list[PlanWarning] = []
    all_changes: list[FileChange] = []
    plan_changes: list[PlanChange] = []
    state_updates: list[tuple] = []

    # Group entities by (integration, scope, project) — one handler call per
    # target file/dir so multi-item files are written once.
    groups: dict[tuple, list[Entity]] = {}
    for integration_id in integration_ids:
        integration = get_integration(integration_id)
        if integration is None:
            continue
        for entity in entities:
            target = integration.target_for(kind, entity.scope)
            if target is None:
                warnings.append(
                    PlanWarning(
                        entity_id=entity.id,
                        entity_name=entity.name,
                        integration=integration_id,
                        status="unsupported",
                        message=f"{integration.display_name} does not support "
                        f"{kind} at {entity.scope} scope",
                    )
                )
                continue
            if target.capability not in _WRITABLE_CAPABILITIES:
                warnings.append(
                    PlanWarning(
                        entity_id=entity.id,
                        entity_name=entity.name,
                        integration=integration_id,
                        status="read_only",
                        message=f"{integration.display_name} target is read-only",
                    )
                )
                continue
            groups.setdefault(
                (integration_id, entity.scope, entity.project_id), []
            ).append(entity)

    for (integration_id, scope, project_id), group in groups.items():
        integration = get_integration(integration_id)
        target = integration.target_for(kind, scope)
        project_dir = _project_dir(project_id)
        if scope == "project" and not project_dir:
            for entity in group:
                warnings.append(
                    PlanWarning(
                        entity_id=entity.id,
                        entity_name=entity.name,
                        integration=integration_id,
                        status="error",
                        message="Project path is unknown",
                    )
                )
            continue

        root = paths.resolve(target, project_dir)
        target_items = _read_target(integration, target, project_dir)

        included: list[Entity] = []
        for entity in group:
            reg_hash = item_hash(store.canonical_of(entity))
            state = sync_states.get((entity.id, integration_id))
            target_item = target_items.get(entity.name)
            cell = _cell_status(
                reg_hash,
                state["synced_hash"] if state else None,
                item_hash(target_item) if target_item else None,
            )
            if cell in ("drifted", "conflict") and (
                (entity.id, integration_id) not in force_pairs
            ):
                warnings.append(
                    PlanWarning(
                        entity_id=entity.id,
                        entity_name=entity.name,
                        integration=integration_id,
                        status=cell,
                        message=f"'{entity.name}' was modified in "
                        f"{integration.display_name} since the last sync — "
                        "push (force), pull, or skip",
                    )
                )
                continue
            included.append(entity)

        if not included:
            continue

        handler = HANDLERS[target.handler]
        models = [store.canonical_of(e) for e in included]
        try:
            changes = handler.plan_write(root, models, target.options)
        except Exception as exc:
            for entity in included:
                warnings.append(
                    PlanWarning(
                        entity_id=entity.id,
                        entity_name=entity.name,
                        integration=integration_id,
                        status="error",
                        message=str(exc),
                    )
                )
            continue
        if kind == "skill":
            changes += _legacy_marker_changes(target, project_dir)
        changes = [c for c in changes if not c.is_noop]

        for change in changes:
            diff = "".join(
                difflib.unified_diff(
                    (change.before or "").splitlines(keepends=True),
                    (change.after or "").splitlines(keepends=True),
                    fromfile=str(change.path),
                    tofile=str(change.path),
                )
            )
            plan_changes.append(
                PlanChange(
                    integration=integration_id,
                    scope=scope,
                    project_id=project_id,
                    file_path=str(change.path),
                    diff=diff,
                    items=[e.name for e in included],
                    create=change.before is None,
                )
            )
        all_changes += changes

        for entity in included:
            state_updates.append(
                (
                    entity.id,
                    integration_id,
                    scope,
                    project_id,
                    str(root),
                    item_hash(store.canonical_of(entity)),
                )
            )

    plan = SyncPlan(
        plan_id=str(uuid.uuid4()), changes=plan_changes, warnings=warnings
    )
    _PLAN_CACHE[plan.plan_id] = _CachedPlan(
        created=time.time(),
        label=f"sync {kind} ({len(entities)} item(s))",
        changes=all_changes,
        state_updates=state_updates,
        plan=plan,
    )
    _prune_plan_cache()
    return plan


def _prune_plan_cache() -> None:
    cutoff = time.time() - _PLAN_TTL_SECONDS
    for plan_id in [p for p, c in _PLAN_CACHE.items() if c.created < cutoff]:
        del _PLAN_CACHE[plan_id]


def _write_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".opensync-tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def apply_plan(plan_id: str) -> ApplyResult:
    cached = _PLAN_CACHE.pop(plan_id, None)
    if cached is None or cached.created < time.time() - _PLAN_TTL_SECONDS:
        return ApplyResult(
            success=False, message="Plan expired or unknown — please re-plan"
        )

    backup_run = backup.create_backup_run(
        cached.label, [c.path for c in cached.changes]
    )
    backup_dir = None
    if backup_run is not None:
        run_id, run_dir = backup_run
        backup_dir = str(run_dir)
        store.record_backup(run_id, cached.label, backup_dir)
        store.prune_backup_records(backup.rotate())

    written: list[str] = []
    for change in cached.changes:
        if change.after is None:
            change.path.unlink(missing_ok=True)
        else:
            _write_atomic(change.path, change.after)
        written.append(str(change.path))

    for entity_id, integration, scope, project_id, target_path, h in (
        cached.state_updates
    ):
        store.set_sync_state(
            entity_id, integration, scope, project_id, target_path, h
        )

    return ApplyResult(
        success=True,
        files_written=written,
        backup_dir=backup_dir,
        message=f"Wrote {len(written)} file(s)",
    )


# ---------------------------------------------------------------------------
# Pull (accept what's in the tool back into the registry)
# ---------------------------------------------------------------------------


def pull(entity_id: str, integration_id: str) -> Optional[Entity]:
    entity = store.get_entity(entity_id)
    integration = get_integration(integration_id)
    if entity is None or integration is None:
        return None
    target = integration.target_for(entity.kind, entity.scope)
    if target is None:
        return None
    project_dir = _project_dir(entity.project_id)
    found = _read_all_paths(integration, target, project_dir)
    model = found.get(entity.name)
    if model is None:
        return None
    updated = store.update_entity(entity.id, model)
    store.set_sync_state(
        entity.id,
        integration_id,
        entity.scope,
        entity.project_id,
        str(paths.resolve(target, project_dir)),
        item_hash(model),
    )
    return updated
