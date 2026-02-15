import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from './api';
import { colorFor, labelFor } from './colors';

/* ===== Toast system ===== */

function ToastContainer({ toasts, onDismiss }) {
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`toast toast-${t.type}`}
                    onClick={() => onDismiss(t.id)}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}

/* ===== Directory Picker ===== */

function DirectoryPicker({ value, onChange }) {
    const [picking, setPicking] = useState(false);

    const handlePick = async () => {
        setPicking(true);
        try {
            const result = await api.pickDirectory();
            if (result.path) {
                onChange(result.path);
            }
        } catch {
            // Picker failed or not available — user can still type manually
        } finally {
            setPicking(false);
        }
    };

    return (
        <div className="dir-picker-wrap">
            <input
                type="text"
                className="dir-path-input"
                placeholder="~/code/my-project"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handlePick}
                disabled={picking}
                title="Open folder picker"
            >
                {picking ? '⏳' : '📂'}
            </button>
        </div>
    );
}

/* ===== Scope Toggle + Project Selector ===== */

function ScopeToggle({ scope, onScopeChange, projects, selectedProject, onSelectProject, onAddProject, onRemoveProject }) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newName.trim() || !newPath.trim()) return;
        onAddProject(newName.trim(), newPath.trim());
        setNewName('');
        setNewPath('');
        setShowAddForm(false);
    };

    return (
        <div className="scope-bar-wrap">
            <div className="scope-bar">
                <div className="scope-tabs">
                    <button
                        className={`scope-tab${scope === 'global' ? ' active' : ''}`}
                        onClick={() => onScopeChange('global')}
                    >
                        🌐 Global
                    </button>
                    <button
                        className={`scope-tab${scope === 'project' ? ' active' : ''}`}
                        onClick={() => onScopeChange('project')}
                    >
                        📁 Project
                    </button>
                </div>

                {scope === 'project' && (
                    <div className="project-selector">
                        <select
                            value={selectedProject || ''}
                            onChange={(e) => onSelectProject(e.target.value)}
                            className="project-select"
                        >
                            <option value="">— Select a project —</option>
                            {projects.map((p) => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                        <button
                            className="scope-tab"
                            onClick={() => setShowAddForm(!showAddForm)}
                            title="Add new project"
                        >
                            {showAddForm ? '✕' : '＋'}
                        </button>
                        {selectedProject && (
                            <button
                                className="scope-tab project-remove-btn"
                                onClick={() => onRemoveProject(selectedProject)}
                                title="Remove project"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                )}
            </div>

            {scope === 'project' && showAddForm && (
                <form className="add-project-form" onSubmit={handleAdd}>
                    <input
                        type="text"
                        placeholder="Project name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="add-project-name"
                        required
                    />
                    <DirectoryPicker value={newPath} onChange={setNewPath} />
                    <button type="submit" className="btn btn-primary btn-sm">Add</button>
                </form>
            )}

            {scope === 'project' && selectedProject && (
                <div className="project-path-display">
                    📂 {projects.find(p => p.name === selectedProject)?.path || ''}
                </div>
            )}
        </div>
    );
}

/* ===== Server Card ===== */

function ServerCard({ server, selected, onToggle, targetPaths, onCopyPath, onDelete, onRemoveFromTarget, onAddToRegistry }) {
    const cmdLine = [server.command, ...server.args].filter(Boolean).join(' ');
    const isFromRegistry = server.sources.includes('opensync');

    const handleBadgeClick = (e, targetName) => {
        e.stopPropagation();
        if (targetName === 'opensync') return;
        const path = targetPaths[targetName];
        if (path) {
            navigator.clipboard.writeText(path).then(() => {
                onCopyPath(path, targetName);
            });
        }
    };

    const handleRemoveFromTarget = (e, targetName) => {
        e.stopPropagation();
        e.preventDefault();
        if (onRemoveFromTarget) onRemoveFromTarget(server.name, targetName);
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) onDelete(server.id || server.name);
    };

    const handleAddToRegistry = (e) => {
        e.stopPropagation();
        if (onAddToRegistry) onAddToRegistry(server);
    };

    return (
        <div
            className={`server-card${selected ? ' selected' : ''}`}
            onClick={onToggle}
        >
            <div className="check">{selected ? '✓' : ''}</div>

            <div className="name">
                {isFromRegistry && (
                    <span className="registry-dot" title="In OpenSync registry" />
                )}
                {server.name}
                {!isFromRegistry && (
                    <button
                        className="btn btn-sm btn-ghost btn-add-registry"
                        onClick={handleAddToRegistry}
                        title="Add to OpenSync registry"
                    >
                        ＋ Add to OpenSync
                    </button>
                )}
            </div>
            <div className="command">{server.url || cmdLine || '—'}</div>
            <div className="badge-group">
                {server.sources.filter((s) => s !== 'opensync').map((s) => (
                    <span
                        key={s}
                        className="badge badge-with-remove badge-clickable"
                        style={{
                            color: colorFor(s),
                            borderColor: `${colorFor(s)}44`,
                        }}
                        onClick={(e) => handleBadgeClick(e, s)}
                        title={`Click to copy path · ✕ to remove from ${labelFor(s)}`}
                    >
                        {labelFor(s)}
                        <button
                            className="badge-remove"
                            onClick={(e) => handleRemoveFromTarget(e, s)}
                            title={`Remove "${server.name}" from ${labelFor(s)}`}
                        >
                            ✕
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ===== Target Selector ===== */

function TargetSelector({ targets, selected, onToggle }) {
    const categoryMeta = {
        editor: { label: 'Editors & IDEs', icon: '🖥️' },
        desktop: { label: 'Desktop Apps', icon: '💻' },
        cli: { label: 'CLI Tools', icon: '⌨️' },
        plugin: { label: 'Editor Plugins', icon: '🧩' },
    };
    const order = ['editor', 'desktop', 'cli', 'plugin'];

    const groups = {};
    targets.forEach((t) => {
        const cat = t.category || 'editor';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(t);
    });

    return (
        <div className="target-categories">
            {order.filter((cat) => groups[cat]?.length).map((cat) => (
                <div key={cat} className="target-category-group">
                    <div className="target-category-label">
                        <span>{categoryMeta[cat]?.icon}</span>
                        <span>{categoryMeta[cat]?.label || cat}</span>
                    </div>
                    {groups[cat].map((t) => (
                        <label key={t.name} className="target-item">
                            <input
                                type="checkbox"
                                checked={selected.has(t.name)}
                                onChange={() => onToggle(t.name)}
                            />
                            <span
                                className="target-dot"
                                style={{ background: colorFor(t.name) }}
                            />
                            <div className="target-info">
                                <div className="label">{t.display_name}</div>
                                <div className="meta">
                                    {t.config_exists
                                        ? `${t.server_count} server${t.server_count !== 1 ? 's' : ''}`
                                        : 'config not found'}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            ))}
        </div>
    );
}

/* ===== Results Modal ===== */

function ResultsModal({ results, onClose }) {
    if (!results) return null;
    return (
        <div className="results-overlay" onClick={onClose}>
            <div className="results-panel" onClick={(e) => e.stopPropagation()}>
                <h2>🔄 Sync Results</h2>
                {results.results.map((r, i) => (
                    <div key={i} className="result-row">
                        <span className="result-icon">{r.success ? '✅' : '❌'}</span>
                        <span className="target-name">{labelFor(r.target)}</span>
                        <span className="result-msg">{r.message}</span>
                    </div>
                ))}
                <button className="btn btn-secondary close-btn" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}

/* ===== Server Form (Add / Edit) ===== */

function ServerForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        command: initialData?.command || '',
        args: initialData?.args ? initialData.args.join(', ') : '',
        env: initialData?.env
            ? Object.entries(initialData.env).map(([k, v]) => `${k}=${v}`).join('\n')
            : '',
        url: initialData?.url || '',
    });

    const isEdit = !!initialData?.name;

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        const data = {
            name: form.name.trim(),
            command: form.command.trim() || null,
            args: form.args
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            env: form.env
                ? Object.fromEntries(
                    form.env.split('\n').filter(Boolean).map((l) => {
                        const [k, ...v] = l.split('=');
                        return [k.trim(), v.join('=').trim()];
                    })
                )
                : {},
            url: form.url.trim() || null,
        };
        onSave(data);
    };

    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group">
                <label>Server Name *</label>
                <input
                    value={form.name}
                    onChange={set('name')}
                    placeholder="my-server"
                    required
                />
            </div>
            <div className="form-group">
                <label>Command</label>
                <input value={form.command} onChange={set('command')} placeholder="npx" />
            </div>
            <div className="form-group full">
                <label>Args (comma-separated)</label>
                <input value={form.args} onChange={set('args')} placeholder="-y, @org/package" />
            </div>
            <div className="form-group full">
                <label>URL (for remote servers)</label>
                <input value={form.url} onChange={set('url')} placeholder="https://api.example.com/mcp" />
            </div>
            <div className="form-group full">
                <label>Environment Variables (KEY=VALUE per line)</label>
                <textarea
                    value={form.env}
                    onChange={set('env')}
                    placeholder={"API_KEY=sk-...\nLOG_LEVEL=debug"}
                    rows={3}
                />
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                    {saveLabel || '💾 Save'}
                </button>
            </div>
        </form>
    );
}

/* ===== Import from Global Modal ===== */

function ImportFromGlobalModal({ globalServers, projectServers, onImport, onClose }) {
    const [selected, setSelected] = useState(new Set());
    const [importing, setImporting] = useState(false);

    const projectNames = new Set(projectServers.map(s => s.name));
    const available = globalServers.filter(s => !projectNames.has(s.name));

    const toggle = (name) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const handleImport = async () => {
        setImporting(true);
        await onImport([...selected]);
        setImporting(false);
    };

    return (
        <div className="results-overlay" onClick={onClose}>
            <div className="results-panel import-modal" onClick={(e) => e.stopPropagation()}>
                <h2>📥 Import from Global Registry</h2>
                {available.length === 0 ? (
                    <div className="empty">
                        <div className="emoji">✅</div>
                        All global servers are already in this project.
                    </div>
                ) : (
                    <div className="import-list">
                        {available.map(s => {
                            const cmdLine = [s.command, ...s.args].filter(Boolean).join(' ');
                            return (
                                <label key={s.name} className="import-item" onClick={() => toggle(s.name)}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(s.name)}
                                        onChange={() => { }}
                                    />
                                    <div className="import-item-info">
                                        <div className="name">{s.name}</div>
                                        <div className="command">{s.url || cmdLine || '—'}</div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    {available.length > 0 && (
                        <button
                            className="btn btn-primary"
                            disabled={selected.size === 0 || importing}
                            onClick={handleImport}
                        >
                            {importing ? '⏳ Importing…' : `📥 Import ${selected.size} Server${selected.size !== 1 ? 's' : ''}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ===== Registry Server Card (for registry pages) ===== */

function RegistryServerCard({ server, onEdit, onDelete }) {
    const cmdLine = [server.command, ...server.args].filter(Boolean).join(' ');

    return (
        <div className="server-card registry-card">
            <div className="name">{server.name}</div>
            <div className="command">{server.url || cmdLine || '—'}</div>
            {server.env && Object.keys(server.env).length > 0 && (
                <div className="server-env">
                    {Object.entries(server.env).map(([k, v]) => (
                        <span key={k} className="env-tag">{k}={v.length > 20 ? v.slice(0, 20) + '…' : v}</span>
                    ))}
                </div>
            )}
            <div className="server-actions">
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(server)} title="Edit configuration">
                    ✏️ Edit
                </button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(server.id)} title="Remove from registry">
                    🗑️ Delete
                </button>
            </div>
        </div>
    );
}

/* ===== Global Registry Page ===== */

function GlobalRegistryPage({ addToast }) {
    const [servers, setServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null); // server object or null

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

/* ===== Project Registry Page ===== */

function ProjectRegistryPage({ projects, addToast, onAddProject, onRemoveProject }) {
    const [selectedProject, setSelectedProject] = useState(null);
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
        try {
            setLoading(true);
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
    }, [selectedProject, addToast]);

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

            {/* Project selector */}
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
                    <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                        <ImportFromGlobalModal
                            globalServers={globalServers}
                            projectServers={servers}
                            onImport={handleImport}
                            onClose={() => setShowImport(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
}

/* ===== Dashboard Page (original sync view) ===== */

function DashboardPage({ addToast, scope, setScope, projects, selectedProject, setSelectedProject, onAddProject, onRemoveProject }) {
    const [servers, setServers] = useState([]);
    const [targets, setTargets] = useState([]);
    const [selectedServers, setSelectedServers] = useState(new Set());
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [results, setResults] = useState(null);

    const projectPath = projects.find(p => p.name === selectedProject)?.path || '';

    const load = useCallback(async () => {
        if (scope === 'project' && !projectPath) {
            setServers([]);
            setTargets([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const pp = scope === 'project' ? projectPath : null;
            const [srv, tgt] = await Promise.all([
                api.getServers(scope, pp),
                api.getTargets(scope, pp),
            ]);
            setServers(srv);
            setTargets(tgt);
        } catch (err) {
            addToast(`Failed to load: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [scope, projectPath, addToast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        setSelectedServers(new Set());
        setSelectedTargets(new Set());
    }, [scope, selectedProject]);

    const pathMap = useMemo(
        () => Object.fromEntries(targets.map((t) => [t.name, t.config_path])),
        [targets]
    );

    const toggleServer = (name) => {
        setSelectedServers((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const toggleTarget = (name) => {
        setSelectedTargets((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const selectAllServers = () => {
        if (selectedServers.size === servers.length) {
            setSelectedServers(new Set());
        } else {
            setSelectedServers(new Set(servers.map((s) => s.name)));
        }
    };

    const selectAllTargets = () => {
        const available = targets.filter((t) => t.config_exists);
        if (selectedTargets.size === available.length) {
            setSelectedTargets(new Set());
        } else {
            setSelectedTargets(new Set(available.map((t) => t.name)));
        }
    };

    const doSync = async () => {
        if (selectedServers.size === 0 || selectedTargets.size === 0) return;
        try {
            setSyncing(true);
            const pp = scope === 'project' ? projectPath.trim() : null;
            const res = await api.sync([...selectedServers], [...selectedTargets], scope, pp);
            setResults(res);
            const ok = res.results.filter((r) => r.success).length;
            const fail = res.results.length - ok;
            addToast(
                `Sync complete: ${ok} succeeded${fail ? `, ${fail} failed` : ''}`,
                fail ? 'error' : 'success'
            );
            await load();
        } catch (err) {
            addToast(`Sync failed: ${err.message}`, 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleDeleteFromRegistry = async (id) => {
        try {
            await api.removeFromRegistry(id, scope, scope === 'project' ? selectedProject : null);
            addToast('Server removed from registry', 'success');
            await load();
        } catch (err) {
            addToast(`Failed to remove: ${err.message}`, 'error');
        }
    };

    const handleRemoveFromTarget = async (serverName, targetName) => {
        try {
            const pp = scope === 'project' ? projectPath : null;
            await api.removeServer(serverName, [targetName], pp);
            addToast(`Removed "${serverName}" from ${labelFor(targetName)}`, 'success');
            await load();
        } catch (err) {
            addToast(`Failed to remove: ${err.message}`, 'error');
        }
    };

    const handleAddToRegistry = async (server) => {
        try {
            const regScope = scope === 'project' ? 'project' : 'global';
            const projectName = scope === 'project' ? selectedProject : undefined;
            await api.addToRegistry({
                name: server.name,
                command: server.command,
                args: server.args || [],
                env: server.env || {},
                url: server.url || null,
                scope: regScope,
                project_name: projectName,
            });
            addToast(
                `Server "${server.name}" added to ${regScope === 'project' ? selectedProject + ' project' : 'global'} registry`,
                'success'
            );
            await load();
        } catch (err) {
            addToast(`Failed to add to registry: ${err.message}`, 'error');
        }
    };

    if (loading) {
        return (
            <div>
                <ScopeToggle
                    scope={scope} onScopeChange={setScope} projects={projects}
                    selectedProject={selectedProject} onSelectProject={(name) => setSelectedProject(name || null)}
                    onAddProject={onAddProject} onRemoveProject={onRemoveProject}
                />
                <div className="loading"><div className="spinner" /><div>Discovering MCP servers…</div></div>
            </div>
        );
    }

    return (
        <div>
            <ScopeToggle
                scope={scope} onScopeChange={setScope} projects={projects}
                selectedProject={selectedProject} onSelectProject={(name) => setSelectedProject(name || null)}
                onAddProject={onAddProject} onRemoveProject={onRemoveProject}
            />

            <div className="grid-2">
                {/* Left: Servers */}
                <div>
                    <div className="panel">
                        <div className="panel-title">
                            <span className="icon">🔌</span>
                            MCP Servers ({servers.length})
                            <span className="scope-badge">{scope}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <button className="select-all" onClick={selectAllServers}>
                                {selectedServers.size === servers.length ? 'Deselect all' : 'Select all'}
                            </button>
                        </div>

                        {servers.length === 0 ? (
                            <div className="empty">
                                <div className="emoji">🔍</div>
                                {scope === 'project' && !projectPath.trim()
                                    ? 'Enter a project path above to scan for MCP configs.'
                                    : 'No MCP servers found. Go to a Registry page to add servers.'}
                            </div>
                        ) : (
                            <div className="server-list">
                                {servers.map((s) => (
                                    <ServerCard
                                        key={s.name}
                                        server={s}
                                        selected={selectedServers.has(s.name)}
                                        onToggle={() => toggleServer(s.name)}
                                        targetPaths={pathMap}
                                        onCopyPath={(path, tName) =>
                                            addToast(`📋 Copied ${labelFor(tName)} config path`, 'success')
                                        }
                                        onDelete={handleDeleteFromRegistry}
                                        onRemoveFromTarget={handleRemoveFromTarget}
                                        onAddToRegistry={handleAddToRegistry}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Targets */}
                <div>
                    <div className="panel">
                        <div className="panel-title">
                            <span className="icon">🎯</span>
                            Sync Targets
                            <span className="scope-badge">{scope}</span>
                        </div>

                        <button className="select-all" onClick={selectAllTargets}>
                            {selectedTargets.size === targets.filter((t) => t.config_exists).length
                                ? 'Deselect all'
                                : 'Select all available'}
                        </button>

                        <TargetSelector
                            targets={targets}
                            selected={selectedTargets}
                            onToggle={toggleTarget}
                        />
                    </div>
                </div>
            </div>

            {/* Sync bar */}
            <div className="sync-bar">
                <div className="summary">
                    <strong>{selectedServers.size}</strong> server{selectedServers.size !== 1 ? 's' : ''} →{' '}
                    <strong>{selectedTargets.size}</strong> target{selectedTargets.size !== 1 ? 's' : ''}
                </div>
                <button
                    className="btn btn-primary"
                    disabled={selectedServers.size === 0 || selectedTargets.size === 0 || syncing}
                    onClick={doSync}
                >
                    {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
                </button>
            </div>

            <ResultsModal results={results} onClose={() => setResults(null)} />
        </div>
    );
}

/* ===== Hash Router ===== */

function useHashRoute() {
    const [hash, setHash] = useState(window.location.hash || '#/');
    useEffect(() => {
        const onHashChange = () => setHash(window.location.hash || '#/');
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);
    return hash;
}

/* ===== Nav Bar ===== */

function NavBar({ currentHash }) {
    const links = [
        { hash: '#/', label: '⚡ Dashboard' },
        { hash: '#/registry/global', label: '🌐 Global Registry' },
        { hash: '#/registry/project', label: '📁 Project Registry' },
    ];

    return (
        <nav className="nav-bar">
            {links.map(l => (
                <a
                    key={l.hash}
                    href={l.hash}
                    className={`nav-link${currentHash === l.hash ? ' active' : ''}`}
                >
                    {l.label}
                </a>
            ))}
        </nav>
    );
}

/* ===== Main App ===== */

export default function App() {
    const route = useHashRoute();
    const [projects, setProjects] = useState([]);
    const [scope, setScope] = useState('global');
    const [selectedProject, setSelectedProject] = useState(null);
    const [toasts, setToasts] = useState([]);

    let toastId = 0;
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            const p = await api.getProjects();
            setProjects(p);
        } catch (err) {
            addToast(`Failed to load projects: ${err.message}`, 'error');
        }
    }, [addToast]);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    const handleAddProject = async (name, path) => {
        try {
            const result = await api.addProject(name, path);
            const imported = result.imported_servers || [];
            const msg = imported.length > 0
                ? `Project "${name}" added — imported ${imported.length} server${imported.length > 1 ? 's' : ''}: ${imported.join(', ')}`
                : `Project "${name}" added`;
            addToast(msg, 'success');
            await loadProjects();
            setSelectedProject(name);
        } catch (err) {
            addToast(`Failed to add project: ${err.message}`, 'error');
        }
    };

    const handleRemoveProject = async (name) => {
        try {
            await api.removeProject(name);
            addToast(`Project "${name}" removed`, 'success');
            if (selectedProject === name) setSelectedProject(null);
            await loadProjects();
        } catch (err) {
            addToast(`Failed to remove project: ${err.message}`, 'error');
        }
    };

    let page;
    switch (route) {
        case '#/registry/global':
            page = <GlobalRegistryPage addToast={addToast} />;
            break;
        case '#/registry/project':
            page = (
                <ProjectRegistryPage
                    projects={projects}
                    addToast={addToast}
                    onAddProject={handleAddProject}
                    onRemoveProject={handleRemoveProject}
                />
            );
            break;
        default:
            page = (
                <DashboardPage
                    addToast={addToast}
                    scope={scope}
                    setScope={setScope}
                    projects={projects}
                    selectedProject={selectedProject}
                    setSelectedProject={setSelectedProject}
                    onAddProject={handleAddProject}
                    onRemoveProject={handleRemoveProject}
                />
            );
            break;
    }

    return (
        <div className="app">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <header>
                <h1>⚡ OpenSync</h1>
                <p>Sync MCP servers across all your AI agents & IDEs</p>
            </header>

            <NavBar currentHash={route} />

            {page}
        </div>
    );
}
