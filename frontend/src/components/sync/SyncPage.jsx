import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { labelFor } from '../../colors';
import { TargetSelector } from './TargetSelector';
import { SYNC_TYPE_CONFIG } from './syncConfig';
import { ResultsModal } from '../ui/ResultsModal';
import { ResourceCard } from '../cards/ResourceCard';

export function SyncPage({ type, addToast, projects, selectedProject, setSelectedProject, onAddProject, onRemoveProject }) {
    const config = SYNC_TYPE_CONFIG[type];
    const [localScope, setLocalScope] = useState('global');
    const projectPath = projects.find(p => p.name === selectedProject)?.path || '';
    const pp = localScope === 'project' ? projectPath : null;
    const pn = localScope === 'project' ? selectedProject : null;

    const [items, setItems] = useState([]);
    const [targets, setTargets] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [results, setResults] = useState(null);

    const load = useCallback(async () => {
        if (localScope === 'project' && !projectPath) {
            setItems([]); setTargets([]); setLoading(false); return;
        }
        try {
            setLoading(true);
            const [registered, discovered, tgts] = await Promise.all([
                config.loadItems(localScope, pp, pn),
                config.discoverItems ? config.discoverItems(localScope, pp) : Promise.resolve([]),
                config.loadTargets(localScope, pp),
            ]);
            const map = new Map();
            for (const item of (discovered || [])) map.set(item.name, item);
            for (const item of (registered || [])) {
                const existing = map.get(item.name);
                const mergedSources = existing
                    ? [...new Set([...(existing.sources || []), ...(item.sources || [])])]
                    : (item.sources || []);
                map.set(item.name, { ...item, sources: mergedSources });
            }
            setItems([...map.values()]);
            setTargets(tgts || []);
        } catch (err) {
            addToast(`Failed to load: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [localScope, selectedProject, type]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setSelectedItems(new Set()); setSelectedTargets(new Set()); }, [localScope, selectedProject]);

    const scopedTargets = targets.filter(t =>
        t.scope === undefined || t.scope === null || t.scope === localScope
    );

    const toggleItem = (name) => setSelectedItems(prev => {
        const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
    });
    const toggleTarget = (id) => setSelectedTargets(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });
    const selectAll = () => {
        if (selectedItems.size === items.length && items.length > 0) setSelectedItems(new Set());
        else setSelectedItems(new Set(items.map(i => i.name)));
    };
    const selectAllTargets = () => {
        const available = scopedTargets.filter(t => t.config_exists !== false);
        const keys = available.map(t => t.id ?? t.name);
        if (selectedTargets.size === available.length) setSelectedTargets(new Set());
        else setSelectedTargets(new Set(keys));
    };

    const doSync = async () => {
        if (selectedItems.size === 0 || selectedTargets.size === 0) return;
        try {
            setSyncing(true);
            const allResults = await config.syncSelected(selectedItems, items, selectedTargets, localScope, pp, selectedProject);
            setResults({ results: allResults });
            const ok = allResults.filter(r => r.success).length;
            const fail = allResults.length - ok;
            addToast(`Sync complete: ${ok} succeeded${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
            await load();
        } catch (err) {
            addToast(`Sync failed: ${err.message}`, 'error');
        } finally { setSyncing(false); }
    };

    const handleRemoveFromTarget = async (item, sourceId) => {
        if (type === 'servers') {
            try {
                await api.removeServer(item.name, [sourceId], pp);
                addToast(`Removed "${item.name}" from ${labelFor(sourceId)}`, 'success');
                await load();
            } catch (err) { addToast(`Failed to remove: ${err.message}`, 'error'); }
        } else {
            addToast(`To remove "${item.name}" from ${labelFor(sourceId)}, delete the file in that agent's config directory.`, 'info');
        }
    };

    const handleAddToRegistry = async (server) => {
        if (type !== 'servers') return;
        try {
            const regScope = localScope;
            const projectName = localScope === 'project' ? selectedProject : undefined;
            await api.addToRegistry({
                name: server.name, command: server.command, args: server.args || [],
                env: server.env || {}, url: server.url || null, scope: regScope, project_name: projectName,
            });
            addToast(`"${server.name}" added to OpenSync registry`, 'success');
            await load();
        } catch (err) { addToast(`Failed to add to registry: ${err.message}`, 'error'); }
    };

    return (
        <div className="page dashboard-page">
            <div className="scope-bar">
                <button className={`scope-tab${localScope === 'global' ? ' active' : ''}`} onClick={() => setLocalScope('global')}>🌐 Global</button>
                <button className={`scope-tab${localScope === 'project' ? ' active' : ''}`} onClick={() => setLocalScope('project')}>📁 Project</button>
                {localScope === 'project' && (
                    <select
                        className="project-select"
                        value={selectedProject || ''}
                        onChange={e => setSelectedProject(e.target.value || null)}
                    >
                        <option value="">— select project —</option>
                        {projects.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                )}
            </div>

            {loading ? (
                <div className="loading"><div className="spinner" /><div>Discovering…</div></div>
            ) : (
                <div className="grid-2">
                    <div>
                        <div className="panel">
                            <div className="panel-title">
                                <span className="icon">{config.icon}</span>
                                {config.label}
                                <span className="scope-badge">{localScope}</span>
                            </div>
                            <button className="select-all" onClick={selectAll}>
                                {selectedItems.size === items.length && items.length > 0 ? 'Deselect all' : 'Select all'}
                            </button>
                            {items.length === 0 ? (
                                <div className="empty">
                                    <div className="emoji">🔍</div>
                                    {localScope === 'project' && !projectPath
                                        ? 'Select a project above to scan for items.'
                                        : `No ${config.label} found.`}
                                </div>
                            ) : (
                                <div className="server-list">
                                    {items.map(item => (
                                        <ResourceCard
                                            key={item.name}
                                            item={item}
                                            selected={selectedItems.has(item.name)}
                                            onToggle={() => toggleItem(item.name)}
                                            onRemoveFromTarget={sourceId => handleRemoveFromTarget(item, sourceId)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="panel">
                            <div className="panel-title">
                                <span className="icon">🎯</span>
                                Sync Targets
                                <span className="scope-badge">{localScope}</span>
                            </div>
                            <button className="select-all" onClick={selectAllTargets}>
                                {selectedTargets.size === scopedTargets.filter(t => t.config_exists !== false).length
                                    ? 'Deselect all' : 'Select all available'}
                            </button>
                            <TargetSelector targets={scopedTargets} selected={selectedTargets} onToggle={toggleTarget} />
                        </div>
                    </div>
                </div>
            )}

            <div className="sync-bar">
                <div className="summary">
                    <strong>{selectedItems.size}</strong> item(s) → <strong>{selectedTargets.size}</strong> target(s)
                </div>
                <button
                    className="btn btn-primary"
                    disabled={selectedItems.size === 0 || selectedTargets.size === 0 || syncing || loading}
                    onClick={doSync}
                >
                    {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
                </button>
            </div>

            {results && <ResultsModal results={results} onClose={() => setResults(null)} />}
        </div>
    );
}
