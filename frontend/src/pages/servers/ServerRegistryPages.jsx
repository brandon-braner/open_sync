import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { ServerForm } from '../../components/forms/ServerForm';
import { RegistryServerCard } from '../../components/cards/RegistryServerCard';

export function GlobalRegistryPage({ addToast }) {
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getRegistry('global');
            setServers(data);
        } catch (err) {
            addToast(`Failed to load global registry: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try {
            await api.addToRegistry({ ...data, scope: 'global' });
            addToast(`Server "${data.name}" added to global registry`, 'success');
            setShowAdd(false);
            await load();
        } catch (err) {
            addToast(`Failed to add server: ${err.message}`, 'error');
        }
    };

    const handleEdit = async (data) => {
        try {
            const oldName = editing.name;
            await api.updateRegistryServer(editing.id, { ...data, scope: 'global' });
            const msg = data.name !== oldName
                ? `Server renamed "${oldName}" → "${data.name}"`
                : `Server "${oldName}" updated`;
            addToast(msg, 'success');
            setEditing(null);
            await load();
        } catch (err) {
            addToast(`Failed to update server: ${err.message}`, 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.removeFromRegistry(id, 'global');
            addToast('Server removed from global registry', 'success');
            await load();
        } catch (err) {
            addToast(`Failed to remove: ${err.message}`, 'error');
        }
    };

    if (loading) {
        return (
            <div className="registry-page">
                <div className="loading"><div className="spinner" /><div>Loading global registry…</div></div>
            </div>
        );
    }

    return (
        <div className="registry-page">
            <div className="registry-header">
                <h2>🌐 Global Registry</h2>
                <p className="registry-subtitle">MCP servers available globally across all projects</p>
            </div>

            <div className="registry-toolbar">
                <span className="registry-count">{servers.length} server{servers.length !== 1 ? 's' : ''}</span>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                    {showAdd ? '✕ Cancel' : '＋ Add Server'}
                </button>
            </div>

            {showAdd && (
                <div className="panel" style={{ marginBottom: '1rem' }}>
                    <ServerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add to Registry" />
                </div>
            )}

            {editing && (
                <div className="panel" style={{ marginBottom: '1rem' }}>
                    <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                    <ServerForm
                        initialData={editing}
                        onSave={handleEdit}
                        onCancel={() => setEditing(null)}
                        saveLabel="💾 Save Changes"
                    />
                </div>
            )}

            {servers.length === 0 && !showAdd ? (
                <div className="panel">
                    <div className="empty">
                        <div className="emoji">📭</div>
                        No servers in the global registry yet. Click "Add Server" to get started.
                    </div>
                </div>
            ) : (
                <div className="server-list">
                    {servers.map(s => (
                        <RegistryServerCard
                            key={s.name}
                            server={s}
                            onEdit={(srv) => { setEditing(srv); setShowAdd(false); }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function ProjectRegistryPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
    const [servers, setServers] = useState([]);
    const [globalServers, setGlobalServers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');

    const load = useCallback(async () => {
        if (!selectedProject) {
            setServers([]);
            return;
        }
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            setLoading(true);
            if (projectPath) {
                try {
                    const discovered = await api.scanProjectImport(projectPath);
                    if (discovered && discovered.length > 0) {
                        await api.commitProjectImport(discovered, 'project', selectedProject);
                    }
                } catch (_) { /* scan errors are non-fatal */ }
            }
            const [projData, globalData] = await Promise.all([
                api.getRegistry('project', selectedProject),
                api.getRegistry('global'),
            ]);
            setServers(projData);
            setGlobalServers(globalData);
        } catch (err) {
            addToast(`Failed to load project registry: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedProject, projects, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try {
            await api.addToRegistry({ ...data, scope: 'project', project_name: selectedProject });
            addToast(`Server "${data.name}" added to project registry`, 'success');
            setShowAdd(false);
            await load();
        } catch (err) {
            addToast(`Failed to add server: ${err.message}`, 'error');
        }
    };

    const handleEdit = async (data) => {
        try {
            const oldName = editing.name;
            await api.updateRegistryServer(editing.id, {
                ...data,
                scope: 'project',
                project_name: selectedProject,
            });
            const msg = data.name !== oldName
                ? `Server renamed "${oldName}" → "${data.name}"`
                : `Server "${oldName}" updated`;
            addToast(msg, 'success');
            setEditing(null);
            await load();
        } catch (err) {
            addToast(`Failed to update server: ${err.message}`, 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.removeFromRegistry(id, 'project', selectedProject);
            addToast('Server removed from project registry', 'success');
            await load();
        } catch (err) {
            addToast(`Failed to remove: ${err.message}`, 'error');
        }
    };

    const handleImport = async (names) => {
        try {
            for (const name of names) {
                await api.importFromGlobal(name, selectedProject);
            }
            addToast(`Imported ${names.length} server${names.length > 1 ? 's' : ''} from global registry`, 'success');
            setShowImport(false);
            await load();
        } catch (err) {
            addToast(`Import failed: ${err.message}`, 'error');
        }
    };

    const handleAddProject = (e) => {
        e.preventDefault();
        if (!newName.trim() || !newPath.trim()) return;
        onAddProject(newName.trim(), newPath.trim());
        setNewName('');
        setNewPath('');
        setShowAddProject(false);
        setSelectedProject(newName.trim());
    };

    const projectPath = projects.find(p => p.name === selectedProject)?.path;

    return (
        <div className="registry-page">
            <div className="registry-header">
                <h2>📁 Project Registry</h2>
                <p className="registry-subtitle">MCP servers scoped to a specific project</p>
            </div>

            <div className="scope-bar" style={{ marginBottom: '1rem' }}>
                <div className="project-selector" style={{ flex: 1 }}>
                    <select
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value || null)}
                        className="project-select"
                    >
                        <option value="">— Select a project —</option>
                        {projects.map((p) => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                    <button className="scope-tab" onClick={() => setShowAddProject(!showAddProject)} title="Add new project">
                        {showAddProject ? '✕' : '＋'}
                    </button>
                    {selectedProject && (
                        <button
                            className="scope-tab project-remove-btn"
                            onClick={() => {
                                onRemoveProject(selectedProject);
                                setSelectedProject(null);
                            }}
                            title="Remove project"
                        >
                            🗑️
                        </button>
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

            {selectedProject && projectPath && (
                <div className="project-path-display" style={{ marginBottom: '1rem' }}>
                    📂 {projectPath}
                </div>
            )}

            {!selectedProject ? (
                <div className="panel">
                    <div className="empty">
                        <div className="emoji">👆</div>
                        Select a project above to manage its MCP servers.
                    </div>
                </div>
            ) : loading ? (
                <div className="loading"><div className="spinner" /><div>Loading project registry…</div></div>
            ) : (
                <>
                    <div className="registry-toolbar">
                        <span className="registry-count">{servers.length} server{servers.length !== 1 ? 's' : ''}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-ghost btn-import" onClick={() => { setShowImport(true); setShowAdd(false); setEditing(null); }}>
                                📥 Import from Global
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                                {showAdd ? '✕ Cancel' : '＋ Add Server'}
                            </button>
                        </div>
                    </div>

                    {showAdd && (
                        <div className="panel" style={{ marginBottom: '1rem' }}>
                            <ServerForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add to Registry" />
                        </div>
                    )}

                    {editing && (
                        <div className="panel" style={{ marginBottom: '1rem' }}>
                            <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                            <ServerForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" />
                        </div>
                    )}

                    {servers.length === 0 && !showAdd ? (
                        <div className="panel">
                            <div className="empty">
                                <div className="emoji">📭</div>
                                No servers in this project's registry. Add one or import from global.
                            </div>
                        </div>
                    ) : (
                        <div className="server-list">
                            {servers.map(s => (
                                <RegistryServerCard
                                    key={s.name}
                                    server={s}
                                    onEdit={(srv) => { setEditing(srv); setShowAdd(false); }}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}

                    {showImport && (
                        <div className="results-overlay" onClick={() => setShowImport(false)}>
                            <div className="results-panel import-modal" onClick={e => e.stopPropagation()}>
                                <h2>📥 Import from Global Registry</h2>
                                {globalServers.filter(s => !servers.map(srv => srv.name).includes(s.name)).length === 0 ? (
                                    <div className="empty">
                                        <div className="emoji">✅</div>
                                        All global servers are already in this project.
                                    </div>
                                ) : (
                                    <div className="import-list">
                                        {globalServers.filter(s => !servers.map(srv => srv.name).includes(s.name)).map(s => (
                                            <label key={s.name} className="import-item" onClick={() => handleImport([s.name])}>
                                                <input type="checkbox" checked={false} onChange={() => { }} />
                                                <div className="import-item-info">
                                                    <div className="name">{s.name}</div>
                                                    <div className="command">{s.url || s.command || '—'}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                                <div className="form-actions" style={{ marginTop: '1rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
