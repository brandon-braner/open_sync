import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { LlmProviderForm, LLM_PROVIDER_TYPES } from '../../components/forms/LlmProviderForm';
import { LlmProviderCard } from '../../components/cards/LlmProviderCard';
import { ImportItemFromGlobalModal } from '../../components/modals/ImportItemFromGlobalModal';

export function GlobalLlmProvidersPage({ addToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [providerTargets, setProviderTargets] = useState([]);

    const [showImport, setShowImport] = useState(false);
    const [discovered, setDiscovered] = useState([]);
    const [discoverLoading, setDiscoverLoading] = useState(false);
    const [selectedImport, setSelectedImport] = useState(new Set());
    const [importing, setImporting] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [provs, targets] = await Promise.all([
                api.getLlmProviders('global'),
                api.getLlmProviderTargets(),
            ]);
            setItems(provs);
            setProviderTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try {
            await api.addLlmProvider({ ...data, scope: 'global' });
            addToast(`"${data.name}" added`, 'success');
            setShowAdd(false); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handleEdit = async (data) => {
        try {
            await api.addLlmProvider({ ...data, scope: 'global' });
            addToast(`"${data.name}" updated`, 'success');
            setEditing(null); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handleDelete = async (id) => {
        try {
            await api.removeLlmProvider(id, 'global');
            addToast('Removed', 'success'); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handlePush = async (providerId, targetIds) => {
        try {
            const res = await api.syncLlmProvider(providerId, targetIds);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(
                `Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`,
                fail ? 'error' : 'success'
            );
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };

    const globalTargets = providerTargets.filter(t => t.scope === 'global' || !t.scope);

    const openImport = async () => {
        setShowImport(true);
        setSelectedImport(new Set());
        setDiscoverLoading(true);
        try {
            const found = await api.discoverLlmProviders();
            setDiscovered(found);
        } catch (err) {
            addToast(`Discovery failed: ${err.message}`, 'error');
            setDiscovered([]);
        } finally {
            setDiscoverLoading(false);
        }
    };

    const toggleImport = (name) => {
        setSelectedImport(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const doImport = async () => {
        const toImport = discovered.filter(p => selectedImport.has(p.name));
        if (toImport.length === 0) return;
        setImporting(true);
        let ok = 0, fail = 0;
        for (const p of toImport) {
            try {
                await api.addLlmProvider({ ...p, scope: 'global' });
                ok++;
            } catch { fail++; }
        }
        setImporting(false);
        setShowImport(false);
        addToast(`Imported ${ok} provider${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'warn' : 'success');
        await load();
    };

    if (loading) return <div className="registry-page"><div className="loading"><div className="spinner" /><div>Loading…</div></div></div>;

    return (
        <div className="registry-page">
            <div className="registry-header"><h2>🤖 Global LLM Providers</h2><p className="registry-subtitle">LLM provider configurations available globally across all projects</p></div>
            <div className="registry-toolbar">
                <span className="registry-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                <button className="btn btn-ghost btn-sm" onClick={openImport} style={{ marginRight: '0.5rem' }}>
                    📥 Import from Config
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                    {showAdd ? '✕ Cancel' : '＋ Add Provider'}
                </button>
            </div>

            {showImport && (
                <div className="modal-overlay" onClick={() => setShowImport(false)}>
                    <div className="results-panel import-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="results-header">
                            <span>📥 Import LLM Providers from Config</span>
                            <button className="close-btn" onClick={() => setShowImport(false)}>✕</button>
                        </div>
                        <p style={{ margin: '0 0 0.75rem', opacity: 0.7, fontSize: '0.85rem' }}>
                            Providers discovered from your global AI tool configs (OpenCode, etc.)
                        </p>
                        {discoverLoading ? (
                            <div className="loading"><div className="spinner" /><div>Discovering…</div></div>
                        ) : discovered.length === 0 ? (
                            <div className="empty"><div className="emoji">🔍</div>No providers found in global configs.</div>
                        ) : (
                            <div className="import-list">
                                {discovered.map(p => (
                                    <label key={p.name} className="import-item" onClick={() => toggleImport(p.name)} style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedImport.has(p.name)}
                                            onChange={() => toggleImport(p.name)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <div className="import-item-info">
                                            <div className="import-item-name">{p.name}</div>
                                            <div className="import-item-desc">
                                                <span className="env-tag" style={{ marginRight: '0.4rem' }}>{p.provider_type}</span>
                                                {p.base_url && <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>{p.base_url}</span>}
                                                {p.api_key && <span style={{ opacity: 0.5, fontSize: '0.75rem', marginLeft: '0.4rem' }}>🔑 API key set</span>}
                                                {p.sources?.length > 0 && <span className="source-tag" style={{ marginLeft: '0.4rem' }}>📍 {p.sources[0]}</span>}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(false)}>Cancel</button>
                            <button
                                className="btn btn-primary btn-sm"
                                disabled={selectedImport.size === 0 || importing || discoverLoading}
                                onClick={doImport}
                            >
                                {importing ? '⏳ Importing…' : `📥 Import ${selectedImport.size} Provider${selectedImport.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><LlmProviderForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
            {editing && (
                <div className="panel" style={{ marginBottom: '1rem' }}>
                    <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                    <LlmProviderForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" />
                </div>
            )}
            {items.length === 0 && !showAdd ? (
                <div className="panel"><div className="empty"><div className="emoji">📭</div>No LLM providers in the global registry yet.</div></div>
            ) : (
                <div className="server-list">
                    {items.map(item => (
                        <LlmProviderCard
                            key={item.id || item.name}
                            item={item}
                            targets={globalTargets}
                            onEdit={(it) => { setEditing(it); setShowAdd(false); }}
                            onDelete={handleDelete}
                            onPush={handlePush}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function ProjectLlmProvidersPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [providerTargets, setProviderTargets] = useState([]);
    const [showImportGlobal, setShowImportGlobal] = useState(false);
    const [globalItems, setGlobalItems] = useState([]);

    const load = useCallback(async () => {
        if (!selectedProject) { setItems([]); return; }
        try {
            setLoading(true);
            const [provs, globalProvs, targets] = await Promise.all([
                api.getLlmProviders('project', selectedProject),
                api.getLlmProviders('global'),
                api.getLlmProviderTargets(),
            ]);
            setItems(provs);
            setGlobalItems(globalProvs);
            setProviderTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [selectedProject, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try {
            await api.addLlmProvider({ ...data, scope: 'project', project_name: selectedProject });
            addToast(`"${data.name}" added`, 'success');
            setShowAdd(false); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handleEdit = async (data) => {
        try {
            await api.addLlmProvider({ ...data, scope: 'project', project_name: selectedProject });
            addToast(`"${data.name}" updated`, 'success');
            setEditing(null); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handleDelete = async (id) => {
        try {
            await api.removeLlmProvider(id, 'project', selectedProject);
            addToast('Removed', 'success'); await load();
        } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };

    const handlePush = async (providerId, targetIds) => {
        try {
            const res = await api.syncLlmProvider(providerId, targetIds, projectPath);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(
                `Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`,
                fail ? 'error' : 'success'
            );
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };

    const projectTargets = providerTargets.filter(t => t.scope === 'project');

    const handleAddProject = (e) => {
        e.preventDefault();
        if (!newName.trim() || !newPath.trim()) return;
        onAddProject(newName.trim(), newPath.trim());
        setNewName(''); setNewPath(''); setShowAddProject(false);
        setSelectedProject(newName.trim());
    };

    const projectPath = projects.find(p => p.name === selectedProject)?.path;

    return (
        <div className="registry-page">
            <div className="registry-header"><h2>📁 Project LLM Providers</h2><p className="registry-subtitle">LLM provider configurations scoped to a specific project</p></div>

            <div className="scope-bar" style={{ marginBottom: '1rem' }}>
                <div className="project-selector" style={{ flex: 1 }}>
                    <select value={selectedProject || ''} onChange={(e) => setSelectedProject(e.target.value || null)} className="project-select">
                        <option value="">— Select a project —</option>
                        {projects.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <button className="scope-tab" onClick={() => setShowAddProject(!showAddProject)} title="Add new project">{showAddProject ? '✕' : '＋'}</button>
                    {selectedProject && (
                        <button className="scope-tab project-remove-btn" onClick={() => { onRemoveProject(selectedProject); setSelectedProject(null); }} title="Remove project">🗑️</button>
                    )}
                </div>
            </div>

            {showAddProject && (
                <form className="add-project-form" onSubmit={handleAddProject}>
                    <input type="text" placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} className="add-project-name" required />
                    <div className="dir-picker-wrap" style={{ flex: 1 }}>
                        <input type="text" className="dir-path-input" placeholder="~/code/my-project" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </form>
            )}

            {selectedProject && projectPath && <div className="project-path-display" style={{ marginBottom: '1rem' }}>📂 {projectPath}</div>}

            {!selectedProject ? (
                <div className="panel"><div className="empty"><div className="emoji">👆</div>Select a project above.</div></div>
            ) : loading ? (
                <div className="loading"><div className="spinner" /><div>Loading…</div></div>
            ) : (
                <>
                    <div className="registry-toolbar">
                        <span className="registry-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportGlobal(true); setShowAdd(false); setEditing(null); }}>📥 Import from Global</button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                                {showAdd ? '✕ Cancel' : '＋ Add Provider'}
                            </button>
                        </div>
                    </div>
                    {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><LlmProviderForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                    {editing && (
                        <div className="panel" style={{ marginBottom: '1rem' }}>
                            <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                            <LlmProviderForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" />
                        </div>
                    )}
                    {items.length === 0 && !showAdd ? (
                        <div className="panel"><div className="empty"><div className="emoji">📭</div>No LLM providers in this project's registry yet.</div></div>
                    ) : (
                        <div className="server-list">
                            {items.map(item => (
                                <LlmProviderCard
                                    key={item.id || item.name}
                                    item={item}
                                    targets={projectTargets}
                                    onEdit={(it) => { setEditing(it); setShowAdd(false); }}
                                    onDelete={handleDelete}
                                    onPush={handlePush}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            {showImportGlobal && (
                <ImportItemFromGlobalModal
                    globalItems={globalItems}
                    projectItems={items}
                    itemLabel="provider"
                    onClose={() => setShowImportGlobal(false)}
                    onImport={async (ids) => {
                        for (const id of ids) await api.importLlmProviderFromGlobal(id, selectedProject);
                        addToast(`Imported ${ids.length} provider${ids.length !== 1 ? 's' : ''} from global`, 'success');
                        setShowImportGlobal(false);
                        await load();
                    }}
                />
            )}
        </div>
    );
}
