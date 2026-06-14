import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import { entityToForm } from '../entityKinds';
import { StatusPill } from '../components/StatusPill';
import { DiffModal } from '../components/DiffModal';

export function EntityPage({ cfg, scope, projectId, integrations, addToast }) {
    const [entities, setEntities] = useState([]);
    const [statusRows, setStatusRows] = useState({});
    const [discovered, setDiscovered] = useState(null);
    const [tab, setTab] = useState('registry');
    const [editing, setEditing] = useState(null); // null | 'new' | entity
    const [selected, setSelected] = useState(new Set());
    const [selectedImports, setSelectedImports] = useState(new Set());
    const [targets, setTargets] = useState(new Set());
    const [plan, setPlan] = useState(null);
    const [planContext, setPlanContext] = useState(null); // {entityIds, integrations, force}
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);

    const needsProject = scope === 'project' && !projectId;

    // Tools that can hold this kind at this scope, straight from manifests.
    const columns = useMemo(
        () => integrations.filter((i) => i.targets[cfg.kind]?.[scope]),
        [integrations, cfg.kind, scope],
    );
    const writableColumns = useMemo(
        () => columns.filter((i) => i.targets[cfg.kind][scope].capability !== 'read_only'),
        [columns, cfg.kind, scope],
    );
    const integrationsById = useMemo(
        () => Object.fromEntries(integrations.map((i) => [i.id, i])),
        [integrations],
    );

    const load = useCallback(async () => {
        if (needsProject) { setEntities([]); setStatusRows({}); setLoading(false); return; }
        setLoading(true);
        try {
            const [list, statuses] = await Promise.all([
                api.listEntities(cfg.urlKind, scope, projectId),
                api.getStatus(cfg.urlKind, scope, projectId),
            ]);
            setEntities(list);
            setStatusRows(Object.fromEntries(
                statuses.map((s) => [s.entity_id, Object.fromEntries(s.cells.map((c) => [c.integration, c]))]),
            ));
        } catch (err) {
            addToast(`Failed to load ${cfg.label}: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [cfg, scope, projectId, needsProject, addToast]);

    const loadDiscovered = useCallback(async () => {
        if (needsProject) { setDiscovered([]); return; }
        try {
            setDiscovered(await api.discover(cfg.urlKind, scope, projectId));
        } catch (err) {
            addToast(`Discovery failed: ${err.message}`, 'error');
            setDiscovered([]);
        }
    }, [cfg, scope, projectId, needsProject, addToast]);

    useEffect(() => {
        // Scope/project changed: drop all selections and any pending plan so we
        // never try to sync stale entities/targets to tools that may not even
        // support the new scope.
        setSelected(new Set()); setSelectedImports(new Set());
        setTargets(new Set());
        setPlan(null); setPlanContext(null);
        setDiscovered(null); setTab('registry'); setEditing(null);
        load();
    }, [load]);

    useEffect(() => {
        if (tab === 'import' && discovered === null) loadDiscovered();
    }, [tab, discovered, loadDiscovered]);

    // ---- CRUD -----------------------------------------------------------

    const handleSave = async (formData) => {
        try {
            if (editing === 'new') {
                await api.createEntity(cfg.urlKind, { ...formData, scope, project_id: projectId });
                addToast(`Added '${formData.name}'`, 'success');
            } else {
                await api.updateEntity(cfg.urlKind, editing.id, formData);
                addToast(`Updated '${formData.name}'`, 'success');
            }
            setEditing(null);
            await load();
        } catch (err) {
            addToast(`Save failed: ${err.message}`, 'error');
        }
    };

    const handleDelete = async (entity) => {
        if (!window.confirm(`Delete '${entity.name}' from the OpenSync registry?\n(Agent config files are not touched.)`)) return;
        try {
            await api.deleteEntity(cfg.urlKind, entity.id);
            addToast(`Deleted '${entity.name}'`, 'success');
            await load();
        } catch (err) {
            addToast(`Delete failed: ${err.message}`, 'error');
        }
    };

    // ---- Sync -----------------------------------------------------------

    const runPlan = async (entityIds, integrationIds, force = []) => {
        setBusy(true);
        try {
            const result = await api.planSync(cfg.kind, entityIds, integrationIds, force);
            setPlan(result);
            setPlanContext({ entityIds, integrations: integrationIds, force });
        } catch (err) {
            addToast(`Plan failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const handlePreviewSync = () => {
        if (selected.size === 0 || targets.size === 0) return;
        runPlan([...selected], [...targets]);
    };

    const handleApply = async () => {
        setBusy(true);
        try {
            const result = await api.applySync(plan.plan_id);
            addToast(`${result.message}${result.backup_dir ? ' (backup saved)' : ''}`, 'success');
            setPlan(null); setPlanContext(null);
            await load();
        } catch (err) {
            addToast(`Apply failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleForce = (warning) => {
        const force = [...(planContext?.force || []),
            { entity_id: warning.entity_id, integration: warning.integration }];
        runPlan(planContext.entityIds, planContext.integrations, force);
    };

    const handlePull = async (warning) => {
        setBusy(true);
        try {
            await api.pullEntity(warning.entity_id, warning.integration);
            addToast(`Pulled '${warning.entity_name}' from ${integrationsById[warning.integration]?.display_name}`, 'success');
            setPlan(null); setPlanContext(null);
            await load();
        } catch (err) {
            addToast(`Pull failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleCellClick = (entity, integrationId, cell) => {
        if (cfg.readOnlySync || cell.status === 'unsupported') return;
        // Single-cell plan; force so drifted/conflict cells show their diff.
        runPlan([entity.id], [integrationId],
            [{ entity_id: entity.id, integration: integrationId }]);
    };

    // ---- Import ---------------------------------------------------------

    const importable = (discovered || []).filter((d) => !d.already_imported || d.differs_from_registry);

    const handleImport = async () => {
        const items = importable
            .filter((d) => selectedImports.has(d.name))
            .map((d) => ({
                name: d.name,
                integration: d.sources[0],
                scope,
                project_id: projectId,
            }));
        if (items.length === 0) return;
        setBusy(true);
        try {
            const result = await api.importItems(cfg.urlKind, items);
            addToast(`Imported ${result.imported.length} item(s)`, 'success');
            setSelectedImports(new Set());
            setDiscovered(null);
            await load();
            setTab('registry');
        } catch (err) {
            addToast(`Import failed: ${err.message}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggle = (set, setter) => (key) => {
        const next = new Set(set);
        next.has(key) ? next.delete(key) : next.add(key);
        setter(next);
    };
    const toggleSelected = toggle(selected, setSelected);
    const toggleImport = toggle(selectedImports, setSelectedImports);
    const toggleTarget = toggle(targets, setTargets);

    // ---- Render ---------------------------------------------------------

    if (needsProject) {
        return (
            <div className="page">
                <h2>{cfg.icon} {cfg.label}</h2>
                <p className="empty">Select a project above, or <a href="#/projects">add one</a>.</p>
            </div>
        );
    }

    const FormComponent = cfg.Form;

    return (
        <div className="page">
            <div className="page-header">
                <h2>{cfg.icon} {cfg.label}</h2>
                <div className="page-tabs">
                    <button className={`tab-btn ${tab === 'registry' ? 'active' : ''}`} onClick={() => setTab('registry')}>
                        Registry ({entities.length})
                    </button>
                    <button className={`tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
                        Import from tools{discovered ? ` (${importable.length})` : ''}
                    </button>
                </div>
                {tab === 'registry' && (
                    <button className="btn btn-primary" onClick={() => setEditing('new')}>＋ Add</button>
                )}
            </div>

            {editing && (
                <div className="editor-panel">
                    <h3>{editing === 'new' ? `New ${cfg.label.replace(/s$/, '')}` : `Edit '${editing.name}'`}</h3>
                    <FormComponent
                        initialData={editing === 'new' ? null : entityToForm(editing)}
                        onSave={handleSave}
                        onCancel={() => setEditing(null)}
                    />
                </div>
            )}

            {tab === 'registry' && (
                <>
                    {!cfg.readOnlySync && writableColumns.length > 0 && (
                        <div className="sync-toolbar">
                            <span className="sync-toolbar-label">
                                Sync {selected.size > 0 ? `${selected.size} selected` : '…'} to:
                            </span>
                            {writableColumns.map((i) => (
                                <label key={i.id} className="target-check" style={{ borderColor: i.color }}>
                                    <input
                                        type="checkbox"
                                        checked={targets.has(i.id)}
                                        onChange={() => toggleTarget(i.id)}
                                    />
                                    {i.display_name}
                                </label>
                            ))}
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={busy || selected.size === 0 || targets.size === 0}
                                onClick={handlePreviewSync}
                            >
                                👁 Preview sync
                            </button>
                        </div>
                    )}

                    {loading ? <p className="loading">Loading…</p> : entities.length === 0 ? (
                        <p className="empty">
                            No {cfg.label.toLowerCase()} in the registry yet — add one or import from your tools.
                        </p>
                    ) : (
                        <div className="matrix-wrap">
                            <table className="sync-matrix">
                                <thead>
                                    <tr>
                                        {!cfg.readOnlySync && <th className="col-check"></th>}
                                        <th>Name</th>
                                        <th className="col-summary">Details</th>
                                        {columns.map((i) => (
                                            <th key={i.id} className="col-pill" title={i.display_name}>
                                                <span className="col-dot" style={{ background: i.color }} />
                                                {i.display_name}
                                            </th>
                                        ))}
                                        <th className="col-actions"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entities.map((e) => (
                                        <tr key={e.id}>
                                            {!cfg.readOnlySync && (
                                                <td className="col-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(e.id)}
                                                        onChange={() => toggleSelected(e.id)}
                                                    />
                                                </td>
                                            )}
                                            <td className="col-name">{e.name}</td>
                                            <td className="col-summary">{cfg.summary(e)}</td>
                                            {columns.map((i) => {
                                                const cell = statusRows[e.id]?.[i.id];
                                                return (
                                                    <td key={i.id} className="col-pill">
                                                        {cell ? (
                                                            <StatusPill
                                                                status={cell.status}
                                                                notes={cell.notes}
                                                                onClick={() => handleCellClick(e, i.id, cell)}
                                                            />
                                                        ) : <StatusPill status="unsupported" />}
                                                    </td>
                                                );
                                            })}
                                            <td className="col-actions">
                                                <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setEditing(e)}>✏️</button>
                                                <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => handleDelete(e)}>🗑</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {cfg.readOnlySync && (
                        <p className="hint">
                            Provider configs are discovery-only for now — formats differ too much
                            across tools to write back safely.
                        </p>
                    )}
                </>
            )}

            {tab === 'import' && (
                <div className="import-panel">
                    {discovered === null ? <p className="loading">Scanning tool configs…</p> :
                        importable.length === 0 ? (
                            <p className="empty">Nothing new found in your tools at {scope} scope.</p>
                        ) : (
                            <>
                                <div className="import-toolbar">
                                    <button className="btn btn-ghost btn-sm" onClick={() =>
                                        setSelectedImports(new Set(importable.map((d) => d.name)))}>
                                        Select all
                                    </button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={busy || selectedImports.size === 0}
                                        onClick={handleImport}
                                    >
                                        ⬇ Import {selectedImports.size > 0 ? `${selectedImports.size} item(s)` : ''}
                                    </button>
                                </div>
                                <ul className="import-list">
                                    {importable.map((d) => (
                                        <li key={d.name} className="import-item">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedImports.has(d.name)}
                                                    onChange={() => toggleImport(d.name)}
                                                />
                                                <span className="import-item-info">
                                                    <strong>{d.name}</strong>
                                                    {d.description && <span className="import-desc"> — {d.description}</span>}
                                                    {d.differs_from_registry && (
                                                        <span className="badge badge-warn">differs from registry</span>
                                                    )}
                                                </span>
                                            </label>
                                            <span className="badge-group">
                                                {d.sources.map((s) => (
                                                    <span key={s} className="badge" style={{ background: integrationsById[s]?.color }}>
                                                        {integrationsById[s]?.display_name || s}
                                                    </span>
                                                ))}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                </div>
            )}

            <DiffModal
                plan={plan}
                integrationsById={integrationsById}
                busy={busy}
                onApply={handleApply}
                onClose={() => { setPlan(null); setPlanContext(null); }}
                onForce={planContext ? handleForce : null}
                onPull={handlePull}
            />
        </div>
    );
}
