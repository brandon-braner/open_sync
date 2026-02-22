import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            setLoading(true);
            // Auto-scan the project directory and upsert discovered skills/workflows
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

/* ===== Official MCP Registry Browser ===== */

function McpRegistryBrowserPage({ addToast, projects }) {
    const [results, setResults] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [scope, setScope] = useState('global');
    const [selectedProject, setSelectedProject] = useState(null);
    const [importing, setImporting] = useState(new Set());
    const [imported, setImported] = useState(new Set());

    const debounceRef = useRef(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    // Initial load
    useEffect(() => {
        doSearch('', null, false);
    }, []);

    const doSearch = async (q, cursor, append) => {
        if (cursor) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        try {
            const data = await api.searchMcpRegistry(q, cursor, 20);
            const servers = data.servers || [];
            if (append) {
                setResults(prev => [...prev, ...servers]);
            } else {
                setResults(servers);
            }
            setNextCursor(data.metadata?.nextCursor || null);
        } catch (err) {
            addToast(`Registry search failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            doSearch(val, null, false);
        }, 400);
    };

    const handleLoadMore = () => {
        if (nextCursor) doSearch(query, nextCursor, true);
    };

    const handleImport = async (serverName) => {
        setImporting(prev => new Set(prev).add(serverName));
        try {
            const projName = scope === 'project' ? selectedProject : null;
            await api.importFromMcpRegistry(serverName, scope, projName);
            setImported(prev => new Set(prev).add(serverName));
            const dest = scope === 'project' ? `project "${selectedProject}"` : 'global registry';
            addToast(`Imported to ${dest} ✓`, 'success');
        } catch (err) {
            addToast(`Import failed: ${err.message}`, 'error');
        } finally {
            setImporting(prev => {
                const next = new Set(prev);
                next.delete(serverName);
                return next;
            });
        }
    };

    const typeLabel = (pkg) => {
        if (!pkg) return null;
        const rt = pkg.registryType;
        const map = { npm: '📦 npm', pypi: '🐍 PyPI', oci: '🐳 Docker', nuget: '🟣 NuGet', mcpb: '📎 MCPB' };
        return map[rt] || rt;
    };

    return (
        <div className="registry-page">
            <div className="registry-header">
                <h2>🔍 Browse MCP Registry</h2>
                <p className="registry-subtitle">
                    Discover servers from the <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noreferrer">official MCP Registry</a> and import them with one click
                </p>
            </div>

            {/* Scope selector */}
            <div className="browse-scope-bar">
                <label className="browse-scope-label">Import to:</label>
                <select
                    className="project-select"
                    value={scope}
                    onChange={(e) => { setScope(e.target.value); setImported(new Set()); }}
                >
                    <option value="global">🌐 Global Registry</option>
                    {projects.map(p => (
                        <option key={p.name} value="project">{`📁 ${p.name}`}</option>
                    ))}
                </select>
                {scope === 'project' && (
                    <select
                        className="project-select"
                        value={selectedProject || ''}
                        onChange={(e) => setSelectedProject(e.target.value || null)}
                    >
                        <option value="">— Select project —</option>
                        {projects.map(p => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Search */}
            <div className="browse-search-bar">
                <input
                    type="text"
                    className="browse-search-input"
                    placeholder="Search MCP servers… (e.g. filesystem, github, slack)"
                    value={query}
                    onChange={handleQueryChange}
                />
                {loading && <div className="spinner browse-spinner" />}
            </div>

            {/* Results */}
            {!loading && results.length === 0 && (
                <div className="panel">
                    <div className="empty">
                        <div className="emoji">🔍</div>
                        {query ? 'No servers found. Try a different search.' : 'Loading servers…'}
                    </div>
                </div>
            )}

            <div className="browse-results">
                {results.map((entry) => {
                    const srv = entry.server || entry;
                    const meta = entry._meta?.['io.modelcontextprotocol.registry/official'] || {};
                    const pkg = (srv.packages || [])[0];
                    const remote = (srv.remotes || [])[0];
                    const repo = srv.repository?.url;
                    const isImporting = importing.has(srv.name);
                    const isImported = imported.has(srv.name);
                    const transport = pkg?.transport?.type || remote?.type || '—';

                    return (
                        <div key={`${srv.name}:${srv.version}`} className="browse-card">
                            <div className="browse-card-header">
                                <div className="browse-card-title">
                                    {srv.title || srv.name.split('/').pop()}
                                </div>
                                <div className="browse-card-badges">
                                    {pkg && (
                                        <span className="browse-badge browse-badge-type">
                                            {typeLabel(pkg)}
                                        </span>
                                    )}
                                    <span className="browse-badge browse-badge-transport">
                                        {transport}
                                    </span>
                                    {srv.version && (
                                        <span className="browse-badge browse-badge-version">
                                            v{srv.version}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="browse-card-name">{srv.name}</div>
                            <div className="browse-card-desc">{srv.description}</div>
                            {repo && (
                                <a className="browse-card-repo" href={repo} target="_blank" rel="noreferrer">
                                    🔗 {repo.replace('https://github.com/', '')}
                                </a>
                            )}
                            <div className="browse-card-actions">
                                <button
                                    className={`btn btn-primary btn-sm browse-import-btn${isImported ? ' imported' : ''}`}
                                    disabled={isImporting || isImported || (scope === 'project' && !selectedProject)}
                                    onClick={() => handleImport(srv.name)}
                                >
                                    {isImported ? '✓ Imported' : isImporting ? '⏳ Importing…' : '⚡ Import'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {nextCursor && (
                <div className="browse-load-more">
                    <button
                        className="btn btn-secondary"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                    >
                        {loadingMore ? '⏳ Loading…' : '↓ Load More'}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ===== Dashboard Page (original sync view) ===== */

function DashboardPage({ addToast, scope, setScope, projects, selectedProject, setSelectedProject, onAddProject, onRemoveProject }) {
    const [activeTab, setActiveTab] = useState('servers');
    const [servers, setServers] = useState([]);
    const [skills, setSkills] = useState([]);
    const [workflows, setWorkflows] = useState([]);
    const [llms, setLlms] = useState([]);
    const [targets, setTargets] = useState([]);
    const [selectedServers, setSelectedServers] = useState(new Set());
    const [selectedSkills, setSelectedSkills] = useState(new Set());
    const [selectedWorkflows, setSelectedWorkflows] = useState(new Set());
    const [selectedLlms, setSelectedLlms] = useState(new Set());
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [results, setResults] = useState(null);

    const projectPath = projects.find(p => p.name === selectedProject)?.path || '';

    const load = useCallback(async () => {
        if (scope === 'project' && !projectPath) {
            setServers([]);
            setSkills([]);
            setWorkflows([]);
            setLlms([]);
            setTargets([]);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const pp = scope === 'project' ? projectPath : null;
            const [srv, tgt, sk, wf, lm] = await Promise.all([
                api.getServers(scope, pp),
                api.getTargets(scope, pp),
                api.getSkills(scope, pp),
                api.getWorkflows(scope, pp),
                api.getLlmProviders(scope, pp)
            ]);
            setServers(srv);
            setTargets(tgt);
            setSkills(sk);
            setWorkflows(wf);
            setLlms(lm);
        } catch (err) {
            addToast(`Failed to load: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [scope, projectPath, addToast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        setSelectedServers(new Set());
        setSelectedSkills(new Set());
        setSelectedWorkflows(new Set());
        setSelectedLlms(new Set());
        setSelectedTargets(new Set());
    }, [scope, selectedProject]);

    const pathMap = useMemo(
        () => Object.fromEntries(targets.map((t) => [t.name, t.config_path])),
        [targets]
    );

    const toggleItem = (name, setSelection) => {
        setSelection((prev) => {
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

    const selectAllItems = (items, selected, setSelection) => {
        if (selected.size === items.length) {
            setSelection(new Set());
        } else {
            setSelection(new Set(items.map((i) => i.name)));
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
        // Since we only fully support servers syncing right now, we can pass them along.
        // To be fully functional for skills, we would update api.sync
        if (selectedServers.size === 0 && selectedSkills.size === 0 && selectedWorkflows.size === 0 && selectedLlms.size === 0) return;
        if (selectedTargets.size === 0) return;
        try {
            setSyncing(true);
            const pp = scope === 'project' ? projectPath.trim() : null;
            // Provide all selected resource names to the sync endpoint. 
            // Currently api.js expects: sync(serverNames, targetNames, scope, projectPath)
            // As a stub for future, we still call the same endpoint.
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
                <div className="loading"><div className="spinner" /><div>Discovering Resources…</div></div>
            </div>
        );
    }

    const TABS = [
        { id: 'servers', label: '🔌 MCP Servers', items: servers, selected: selectedServers, setSelection: setSelectedServers },
        { id: 'skills', label: '🧠 Skills', items: skills, selected: selectedSkills, setSelection: setSelectedSkills },
        { id: 'workflows', label: '🔄 Workflows', items: workflows, selected: selectedWorkflows, setSelection: setSelectedWorkflows },
        { id: 'llms', label: '🤖 LLM Providers', items: llms, selected: selectedLlms, setSelection: setSelectedLlms },
    ];

    const currentTabData = TABS.find(t => t.id === activeTab);

    return (
        <div>
            <ScopeToggle
                scope={scope} onScopeChange={setScope} projects={projects}
                selectedProject={selectedProject} onSelectProject={(name) => setSelectedProject(name || null)}
                onAddProject={onAddProject} onRemoveProject={onRemoveProject}
            />

            <div className="scope-tabs" style={{ marginBottom: '1rem', borderBottom: '1px solid #333' }}>
                {TABS.map(t => (
                    <button
                        key={t.id}
                        className={`scope-tab${activeTab === t.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                        style={{ borderBottom: activeTab === t.id ? '2px solid #fff' : 'none', borderRadius: 0, paddingBottom: '0.5rem' }}
                    >
                        {t.label} ({t.items.length})
                    </button>
                ))}
            </div>

            <div className="grid-2">
                {/* Left: Resources */}
                <div>
                    <div className="panel">
                        <div className="panel-title">
                            <span className="icon">{currentTabData.label.split(' ')[0]}</span>
                            {currentTabData.label.split(' ').slice(1).join(' ')}
                            <span className="scope-badge">{scope}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <button className="select-all" onClick={() => selectAllItems(currentTabData.items, currentTabData.selected, currentTabData.setSelection)}>
                                {currentTabData.selected.size === currentTabData.items.length && currentTabData.items.length > 0 ? 'Deselect all' : 'Select all'}
                            </button>
                        </div>

                        {currentTabData.items.length === 0 ? (
                            <div className="empty">
                                <div className="emoji">🔍</div>
                                {scope === 'project' && !projectPath.trim()
                                    ? `Enter a project path above to scan for ${currentTabData.label}.`
                                    : `No ${currentTabData.label} found. Add them to sync.`}
                            </div>
                        ) : (
                            <div className="server-list">
                                {currentTabData.items.map((item) => (
                                    <div
                                        key={item.name}
                                        className={`server-card${currentTabData.selected.has(item.name) ? ' selected' : ''}`}
                                        onClick={() => toggleItem(item.name, currentTabData.setSelection)}
                                    >
                                        <div className="check">{currentTabData.selected.has(item.name) ? '✓' : ''}</div>
                                        <div className="name">
                                            {item.name}
                                        </div>
                                        <div className="command">{item.description || item.command || item.provider_type || '—'}</div>
                                    </div>
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
                    <strong>{selectedServers.size + selectedSkills.size + selectedWorkflows.size + selectedLlms.size}</strong> item(s) →{' '}
                    <strong>{selectedTargets.size}</strong> target(s)
                </div>
                <button
                    className="btn btn-primary"
                    disabled={(selectedServers.size === 0 && selectedSkills.size === 0 && selectedWorkflows.size === 0 && selectedLlms.size === 0) || selectedTargets.size === 0 || syncing}
                    onClick={doSync}
                >
                    {syncing ? '⏳ Syncing…' : '🔄 Sync Now'}
                </button>
            </div>

            <ResultsModal results={results} onClose={() => setResults(null)} />
        </div>
    );
}

/* ===== Generic Registry Page helpers ===== */

function SkillForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        content: initialData?.content || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ name: form.name.trim(), description: form.description.trim() || null, content: form.content });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-skill" required /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group full"><label>Content / Instructions</label><textarea value={form.content} onChange={set('content')} placeholder="You are a helpful…" rows={5} /></div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}

function WorkflowForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        steps: initialData?.steps ? initialData.steps.join('\n') : '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        const steps = form.steps.split('\n').map(s => s.trim()).filter(Boolean);
        onSave({ name: form.name.trim(), description: form.description.trim() || null, steps });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-workflow" required /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group full"><label>Steps (one per line)</label><textarea value={form.steps} onChange={set('steps')} placeholder="Step 1\nStep 2\nStep 3" rows={5} /></div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}

const LLM_PROVIDER_TYPES = ['openai', 'anthropic', 'ollama', 'gemini', 'custom'];

function LlmProviderForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        provider_type: initialData?.provider_type || 'openai',
        api_key: initialData?.api_key || '',
        base_url: initialData?.base_url || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ name: form.name.trim(), provider_type: form.provider_type, api_key: form.api_key.trim() || null, base_url: form.base_url.trim() || null });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-openai" required /></div>
            <div className="form-group">
                <label>Provider Type</label>
                <select value={form.provider_type} onChange={set('provider_type')} className="project-select">
                    {LLM_PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="form-group full"><label>API Key</label><input type="password" value={form.api_key} onChange={set('api_key')} placeholder="sk-…" /></div>
            <div className="form-group full"><label>Base URL (optional)</label><input value={form.base_url} onChange={set('base_url')} placeholder="https://api.openai.com/v1" /></div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}

function SkillCard({ item, onEdit, onDelete, targets, onPush }) {
    const [showPush, setShowPush] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [pushing, setPushing] = useState(false);

    const toggleTarget = (id) => {
        setSelectedTargets(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const doPush = async () => {
        if (selectedTargets.size === 0 || !item.id) return;
        setPushing(true);
        await onPush(item.id, [...selectedTargets]);
        setPushing(false);
        setShowPush(false);
        setSelectedTargets(new Set());
    };

    return (
        <div className="server-card registry-card">
            <div className="name">{item.name}</div>
            <div className="command">{item.description || '—'}</div>
            {item.content && <div className="command" style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '0.25rem' }}>{item.content.slice(0, 80)}{item.content.length > 80 ? '…' : ''}</div>}
            <div className="server-actions">
                {targets && targets.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Push to agent configs">
                        📤 Push to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Push to agent configs:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {targets.map(t => (
                            <label
                                key={t.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '0.25rem 0.6rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.82rem',
                                    background: selectedTargets.has(t.id) ? t.color || '#555' : 'rgba(255,255,255,0.08)',
                                    border: `1px solid ${t.color || '#555'}`,
                                    opacity: selectedTargets.has(t.id) ? 1 : 0.65,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <input type="checkbox" checked={selectedTargets.has(t.id)} onChange={() => toggleTarget(t.id)} style={{ display: 'none' }} />
                                {selectedTargets.has(t.id) ? '✓ ' : ''}{t.display_name}
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowPush(false)}>Cancel</button>
                        <button className="btn btn-primary btn-sm" disabled={selectedTargets.size === 0 || pushing} onClick={doPush}>
                            {pushing ? '⏳ Pushing…' : `📤 Push to ${selectedTargets.size}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function WorkflowCard({ item, onEdit, onDelete, targets, onPush }) {
    const [showPush, setShowPush] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [pushing, setPushing] = useState(false);

    const toggleTarget = (id) => {
        setSelectedTargets(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const doPush = async () => {
        if (selectedTargets.size === 0 || !item.id) return;
        setPushing(true);
        await onPush(item.id, [...selectedTargets]);
        setPushing(false);
        setShowPush(false);
        setSelectedTargets(new Set());
    };

    return (
        <div className="server-card registry-card">
            <div className="name">{item.name}</div>
            <div className="command">{item.description || '—'}</div>
            {item.steps?.length > 0 && <div className="command" style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '0.25rem' }}>{item.steps.length} step{item.steps.length !== 1 ? 's' : ''}</div>}
            <div className="server-actions">
                {targets && targets.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Push to agent configs">
                        📤 Push to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Push to agent configs:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {targets.map(t => (
                            <label
                                key={t.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '0.25rem 0.6rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.82rem',
                                    background: selectedTargets.has(t.id) ? t.color || '#555' : 'rgba(255,255,255,0.08)',
                                    border: `1px solid ${t.color || '#555'}`,
                                    opacity: selectedTargets.has(t.id) ? 1 : 0.65,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <input type="checkbox" checked={selectedTargets.has(t.id)} onChange={() => toggleTarget(t.id)} style={{ display: 'none' }} />
                                {selectedTargets.has(t.id) ? '✓ ' : ''}{t.display_name}
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowPush(false)}>Cancel</button>
                        <button className="btn btn-primary btn-sm" disabled={selectedTargets.size === 0 || pushing} onClick={doPush}>
                            {pushing ? '⏳ Pushing…' : `📤 Push to ${selectedTargets.size}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function LlmProviderCard({ item, onEdit, onDelete, targets, onPush }) {
    const [showPush, setShowPush] = useState(false);
    const [selectedTargets, setSelectedTargets] = useState(new Set());
    const [pushing, setPushing] = useState(false);

    const toggleTarget = (id) => {
        setSelectedTargets(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const doPush = async () => {
        if (selectedTargets.size === 0 || !item.id) return;
        setPushing(true);
        await onPush(item.id, [...selectedTargets]);
        setPushing(false);
        setShowPush(false);
        setSelectedTargets(new Set());
    };

    return (
        <div className="server-card registry-card">
            <div className="name">{item.name}</div>
            <div className="command">
                <span className="env-tag" style={{ marginRight: '0.5rem' }}>{item.provider_type}</span>
                {item.base_url && <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{item.base_url}</span>}
            </div>
            {item.api_key && <div className="command" style={{ opacity: 0.5, fontSize: '0.75rem' }}>API key: ••••••••</div>}
            <div className="server-actions">
                {targets && targets.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Push to agent configs">
                        📤 Push to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Push to agent configs:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {targets.map(t => (
                            <label
                                key={t.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '0.25rem 0.6rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.82rem',
                                    background: selectedTargets.has(t.id) ? t.color || '#555' : 'rgba(255,255,255,0.08)',
                                    border: `1px solid ${t.color || '#555'}`,
                                    opacity: selectedTargets.has(t.id) ? 1 : 0.65,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTargets.has(t.id)}
                                    onChange={() => toggleTarget(t.id)}
                                    style={{ display: 'none' }}
                                />
                                {selectedTargets.has(t.id) ? '✓ ' : ''}{t.display_name}
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowPush(false)}>Cancel</button>
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={selectedTargets.size === 0 || pushing}
                            onClick={doPush}
                        >
                            {pushing ? '⏳ Pushing…' : `📤 Push to ${selectedTargets.size}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===== Generic scoped registry page factory ===== */

function makeGlobalRegistryPage({ title, subtitle, emptyMsg, addLabel, FormComponent, CardComponent, getItems, addItem, removeItem, updateItem }) {
    return function GenericGlobalPage({ addToast }) {
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const [showAdd, setShowAdd] = useState(false);
        const [editing, setEditing] = useState(null);

        const load = useCallback(async () => {
            try {
                setLoading(true);
                setItems(await getItems('global'));
            } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
            finally { setLoading(false); }
        }, [addToast]);

        useEffect(() => { load(); }, [load]);

        const handleAdd = async (data) => {
            try {
                await addItem({ ...data, scope: 'global' });
                addToast(`"${data.name}" added`, 'success');
                setShowAdd(false); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

        const handleEdit = async (data) => {
            try {
                await updateItem(editing.id, { ...data, scope: 'global' });
                addToast(`"${data.name}" updated`, 'success');
                setEditing(null); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

        const handleDelete = async (id) => {
            try {
                await removeItem(id, 'global');
                addToast('Removed', 'success'); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

        if (loading) return <div className="registry-page"><div className="loading"><div className="spinner" /><div>Loading…</div></div></div>;

        return (
            <div className="registry-page">
                <div className="registry-header"><h2>{title}</h2><p className="registry-subtitle">{subtitle}</p></div>
                <div className="registry-toolbar">
                    <span className="registry-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                        {showAdd ? '✕ Cancel' : `＋ ${addLabel}`}
                    </button>
                </div>
                {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><FormComponent onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                {editing && (
                    <div className="panel" style={{ marginBottom: '1rem' }}>
                        <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                        <FormComponent initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" />
                    </div>
                )}
                {items.length === 0 && !showAdd ? (
                    <div className="panel"><div className="empty"><div className="emoji">📭</div>{emptyMsg}</div></div>
                ) : (
                    <div className="server-list">
                        {items.map(item => (
                            <CardComponent key={item.id || item.name} item={item} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>
        );
    };
}

function makeProjectRegistryPage({ title, subtitle, emptyMsg, addLabel, FormComponent, CardComponent, getItems, addItem, removeItem, updateItem }) {
    return function GenericProjectPage({ projects, addToast, onAddProject, onRemoveProject }) {
        const [selectedProject, setSelectedProject] = useState(null);
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(false);
        const [showAdd, setShowAdd] = useState(false);
        const [editing, setEditing] = useState(null);
        const [showAddProject, setShowAddProject] = useState(false);
        const [newName, setNewName] = useState('');
        const [newPath, setNewPath] = useState('');

        const load = useCallback(async () => {
            if (!selectedProject) { setItems([]); return; }
            try {
                setLoading(true);
                setItems(await getItems('project', selectedProject));
            } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
            finally { setLoading(false); }
        }, [selectedProject, addToast]);

        useEffect(() => { load(); }, [load]);

        const handleAdd = async (data) => {
            try {
                await addItem({ ...data, scope: 'project', project_name: selectedProject });
                addToast(`"${data.name}" added`, 'success');
                setShowAdd(false); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

        const handleEdit = async (data) => {
            try {
                await updateItem(editing.id, { ...data, scope: 'project', project_name: selectedProject });
                addToast(`"${data.name}" updated`, 'success');
                setEditing(null); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

        const handleDelete = async (id) => {
            try {
                await removeItem(id, 'project', selectedProject);
                addToast('Removed', 'success'); await load();
            } catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
        };

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
                <div className="registry-header"><h2>{title}</h2><p className="registry-subtitle">{subtitle}</p></div>

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
                        <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                                {showAdd ? '✕ Cancel' : `＋ ${addLabel}`}
                            </button>
                        </div>
                        {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><FormComponent onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                        {editing && (
                            <div className="panel" style={{ marginBottom: '1rem' }}>
                                <div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div>
                                <FormComponent initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" />
                            </div>
                        )}
                        {items.length === 0 && !showAdd ? (
                            <div className="panel"><div className="empty"><div className="emoji">📭</div>{emptyMsg}</div></div>
                        ) : (
                            <div className="server-list">
                                {items.map(item => (
                                    <CardComponent key={item.id || item.name} item={item} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };
}

/* ===== Import From Project Modal ===== */

const SOURCE_COLORS = {
    'Antigravity (.agent/workflows)': '#7c3aed',
    'Antigravity (.agent/skills)': '#7c3aed',
    'Antigravity (.agent/rules)': '#7c3aed',
    'Cursor (.cursor/rules)': '#0ea5e9',
    'Claude Code (CLAUDE.md)': '#d97706',
    'GitHub Copilot (.github/copilot-instructions.md)': '#16a34a',
    'Windsurf (.windsurfrules)': '#0891b2',
    'OpenCode (opencode.json)': '#dc2626',
    'OpenCode (opencode.json scripts)': '#dc2626',
    'Continue (.continue/config)': '#7c3aed',
    'Continue (.continue/config rules)': '#7c3aed',
    'Aider (.aider.system.prompt.md)': '#059669',
    'Aider (.aider.conf.yml)': '#059669',
};

function ImportFromProjectModal({ onClose, onImported, addToast }) {
    const [projectPath, setProjectPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [artifacts, setArtifacts] = useState(null); // null = not scanned yet
    const [selected, setSelected] = useState(new Set());
    const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'skill' | 'workflow'
    const [importing, setImporting] = useState(false);

    const handleScan = async () => {
        if (!projectPath.trim()) return;
        setScanning(true);
        setArtifacts(null);
        setSelected(new Set());
        try {
            const found = await api.scanProjectImport(projectPath.trim());
            setArtifacts(found);
            if (found.length === 0) addToast('No recognisable artifacts found in that directory.', 'warn');
        } catch (err) {
            addToast(`Scan failed: ${err.message}`, 'error');
        } finally {
            setScanning(false);
        }
    };

    const visible = (artifacts || []).filter(a => typeFilter === 'all' || a.type === typeFilter);

    const toggleAll = () => {
        if (selected.size === visible.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(visible.map((_, i) => i)));
        }
    };

    const toggle = (idx) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const handleImport = async () => {
        const toImport = [...selected].map(i => visible[i]).map(a => ({
            name: a.name,
            type: a.type,
            description: a.description,
            content: a.content,
            steps: a.steps,
        }));
        if (toImport.length === 0) return;
        setImporting(true);
        try {
            const res = await api.commitProjectImport(toImport, 'global');
            const ok = res.imported;
            const errs = res.errors || [];
            addToast(
                `Imported ${ok} artifact${ok !== 1 ? 's' : ''}${errs.length ? `, ${errs.length} error(s)` : ''}`,
                errs.length > 0 ? 'error' : 'success',
            );
            onImported();
            onClose();
        } catch (err) {
            addToast(`Import failed: ${err.message}`, 'error');
        } finally {
            setImporting(false);
        }
    };

    // Group by source for display
    const grouped = {};
    visible.forEach((a, i) => {
        if (!grouped[a.source]) grouped[a.source] = [];
        grouped[a.source].push({ ...a, _idx: i });
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
            <div style={{
                background: 'var(--surface, #1e1e2e)', borderRadius: '1rem', width: '100%', maxWidth: '760px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⬇️ Import from Project</h3>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.6, fontSize: '0.82rem' }}>Scan any project directory for agent artifacts and import them into the registry.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.4rem', opacity: 0.6, lineHeight: 1 }}>✕</button>
                </div>

                {/* Directory picker + scan */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.35rem' }}>Project Path</label>
                        <DirectoryPicker value={projectPath} onChange={setProjectPath} />
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleScan}
                        disabled={!projectPath.trim() || scanning}
                        style={{ whiteSpace: 'nowrap', minWidth: '100px' }}
                    >
                        {scanning ? '⏳ Scanning…' : '🔍 Scan'}
                    </button>
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1.5rem' }}>
                    {artifacts === null && !scanning && (
                        <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.4 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
                            <div>Choose a project directory and click Scan</div>
                        </div>
                    )}
                    {artifacts !== null && artifacts.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.4 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤷</div>
                            <div>No recognisable artifacts found in that directory.</div>
                        </div>
                    )}
                    {artifacts !== null && artifacts.length > 0 && (
                        <>
                            {/* Type filter + select-all */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''} found</span>
                                <div style={{ display: 'flex', gap: '0.35rem', marginLeft: 'auto' }}>
                                    {['all', 'skill', 'workflow'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => { setTypeFilter(t); setSelected(new Set()); }}
                                            style={{
                                                padding: '0.2rem 0.6rem', borderRadius: '0.75rem', fontSize: '0.78rem', cursor: 'pointer',
                                                background: typeFilter === t ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                                                border: '1px solid rgba(255,255,255,0.15)', color: 'inherit',
                                            }}
                                        >
                                            {t === 'all' ? '📋 All' : t === 'skill' ? '🧠 Skills' : '🔁 Workflows'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={toggleAll}
                                    style={{ padding: '0.2rem 0.6rem', borderRadius: '0.75rem', fontSize: '0.78rem', cursor: 'pointer', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'inherit' }}
                                >
                                    {selected.size === visible.length && visible.length > 0 ? 'Deselect all' : 'Select all'}
                                </button>
                            </div>

                            {/* Results grouped by source */}
                            {Object.entries(grouped).map(([source, items]) => (
                                <div key={source} style={{ marginBottom: '1rem' }}>
                                    <div style={{
                                        fontSize: '0.75rem', fontWeight: 600, opacity: 0.7, marginBottom: '0.35rem',
                                        paddingLeft: '0.5rem', borderLeft: `3px solid ${SOURCE_COLORS[source] || '#555'}`,
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                    }}>
                                        {source}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {items.map(a => (
                                            <label key={a._idx} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                                                padding: '0.5rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
                                                background: selected.has(a._idx) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${selected.has(a._idx) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                                                transition: 'all 0.1s',
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(a._idx)}
                                                    onChange={() => toggle(a._idx)}
                                                    style={{ marginTop: '0.15rem', flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{a.name}</span>
                                                        <span style={{
                                                            fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: '0.5rem',
                                                            background: a.type === 'skill' ? 'rgba(124,58,237,0.3)' : 'rgba(220,38,38,0.3)',
                                                            border: `1px solid ${a.type === 'skill' ? '#7c3aed' : '#dc2626'}`,
                                                        }}>
                                                            {a.type === 'skill' ? '🧠 Skill' : '🔁 Workflow'}
                                                        </span>
                                                    </div>
                                                    {a.description && <div style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}</div>}
                                                    {a.type === 'workflow' && a.steps?.length > 0 && (
                                                        <div style={{ fontSize: '0.72rem', opacity: 0.45, marginTop: '0.1rem' }}>{a.steps.length} step{a.steps.length !== 1 ? 's' : ''}</div>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>
                        {selected.size > 0 ? `${selected.size} item${selected.size !== 1 ? 's' : ''} selected` : 'Select items to import'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={selected.size === 0 || importing}
                            onClick={handleImport}
                        >
                            {importing ? '⏳ Importing…' : `⬇️ Import ${selected.size || ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ===== Concrete registry pages ===== */

function GlobalSkillsPage({ addToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [skillTargets, setSkillTargets] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [skills, targets] = await Promise.all([api.getSkills('global'), api.getSkillTargets()]);
            setItems(skills);
            setSkillTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addSkill({ ...data, scope: 'global' }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addSkill({ ...data, scope: 'global' }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeSkill(id, 'global'); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (skillId, targetIds) => {
        try {
            const res = await api.syncSkill(skillId, targetIds);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(`Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };

    if (loading) return <div className="registry-page"><div className="loading"><div className="spinner" /><div>Loading…</div></div></div>;
    return (
        <div className="registry-page">
            {showImport && <ImportFromProjectModal onClose={() => setShowImport(false)} onImported={load} addToast={addToast} />}
            <div className="registry-header"><h2>🧠 Global Skills</h2><p className="registry-subtitle">AI skills and system prompts available globally across all projects</p></div>
            <div className="registry-toolbar">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>⬇️ Import from Project</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add Skill'}</button>
            </div>
            {showAdd && <SkillForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="Add Skill" />}
            {editing && <SkillForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="Save Changes" />}
            {items.length === 0 && !showAdd ? <div className="empty-state">No skills in the global registry yet.</div> : (
                <div className="registry-grid">
                    {items.map(s => <SkillCard key={s.id} item={s} onEdit={setEditing} onDelete={handleDelete} targets={skillTargets} onPush={handlePush} />)}
                </div>
            )}
        </div>
    );
}

function ProjectSkillsPage({ projects, addToast, onAddProject, onRemoveProject }) {
    const [selectedProject, setSelectedProject] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [skillTargets, setSkillTargets] = useState([]);

    const load = useCallback(async () => {
        if (!selectedProject) { setItems([]); return; }
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            setLoading(true);
            // Auto-scan the project directory and upsert discovered skills/workflows
            if (projectPath) {
                try {
                    const discovered = await api.scanProjectImport(projectPath);
                    if (discovered && discovered.length > 0) {
                        await api.commitProjectImport(discovered, 'project', selectedProject);
                    }
                } catch (_) { /* scan errors are non-fatal */ }
            }
            const [skills, targets] = await Promise.all([api.getSkills('project', selectedProject), api.getSkillTargets()]);
            setItems(skills);
            setSkillTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [selectedProject, projects, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addSkill({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addSkill({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeSkill(id, 'project', selectedProject); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (skillId, targetIds) => {
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            const res = await api.syncSkill(skillId, targetIds, projectPath);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(`Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };
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
            <div className="registry-header"><h2>📁 Project Skills</h2><p className="registry-subtitle">AI skills scoped to a specific project</p></div>
            <div className="scope-bar" style={{ marginBottom: '1rem' }}>
                <div className="project-selector" style={{ flex: 1 }}>
                    <select value={selectedProject || ''} onChange={(e) => setSelectedProject(e.target.value || null)} className="project-select">
                        <option value="">— Select a project —</option>
                        {projects.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <button className="scope-tab" onClick={() => setShowAddProject(!showAddProject)} title="Add new project">{showAddProject ? '✕' : '＋'}</button>
                    {selectedProject && (<button className="scope-tab project-remove-btn" onClick={() => { onRemoveProject(selectedProject); setSelectedProject(null); }} title="Remove project">🗑️</button>)}
                </div>
            </div>
            {showAddProject && (
                <form className="add-project-form" onSubmit={handleAddProject}>
                    <input type="text" placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} className="add-project-name" required />
                    <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Skill'}</button>
                    </div>
                    {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><SkillForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                    {editing && (<div className="panel" style={{ marginBottom: '1rem' }}><div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div><SkillForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" /></div>)}
                    {items.length === 0 && !showAdd ? (
                        <div className="panel"><div className="empty"><div className="emoji">📫</div>No skills in this project's registry yet.</div></div>
                    ) : (
                        <div className="registry-grid">
                            {items.map(s => <SkillCard key={s.id} item={s} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} targets={skillTargets} onPush={handlePush} />)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function GlobalWorkflowsPage({ addToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [workflowTargets, setWorkflowTargets] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [workflows, targets] = await Promise.all([api.getWorkflows('global'), api.getWorkflowTargets()]);
            setItems(workflows);
            setWorkflowTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addWorkflow({ ...data, scope: 'global' }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addWorkflow({ ...data, scope: 'global' }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeWorkflow(id, 'global'); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (workflowId, targetIds) => {
        try {
            const res = await api.syncWorkflow(workflowId, targetIds);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(`Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };

    if (loading) return <div className="registry-page"><div className="loading"><div className="spinner" /><div>Loading…</div></div></div>;
    return (
        <div className="registry-page">
            {showImport && <ImportFromProjectModal onClose={() => setShowImport(false)} onImported={load} addToast={addToast} />}
            <div className="registry-header"><h2>🔁 Global Workflows</h2><p className="registry-subtitle">Reusable multi-step workflows available globally</p></div>
            <div className="registry-toolbar">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>⬇️ Import from Project</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add Workflow'}</button>
            </div>
            {showAdd && <WorkflowForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="Add Workflow" />}
            {editing && <WorkflowForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="Save Changes" />}
            {items.length === 0 && !showAdd ? <div className="empty-state">No workflows in the global registry yet.</div> : (
                <div className="registry-grid">
                    {items.map(w => <WorkflowCard key={w.id} item={w} onEdit={setEditing} onDelete={handleDelete} targets={workflowTargets} onPush={handlePush} />)}
                </div>
            )}
        </div>
    );
}

function ProjectWorkflowsPage({ projects, addToast, onAddProject, onRemoveProject }) {
    const [selectedProject, setSelectedProject] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [workflowTargets, setWorkflowTargets] = useState([]);

    const load = useCallback(async () => {
        if (!selectedProject) { setItems([]); return; }
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            setLoading(true);
            // Auto-scan the project directory and upsert discovered skills/workflows
            if (projectPath) {
                try {
                    const discovered = await api.scanProjectImport(projectPath);
                    if (discovered && discovered.length > 0) {
                        await api.commitProjectImport(discovered, 'project', selectedProject);
                    }
                } catch (_) { /* scan errors are non-fatal */ }
            }
            const [workflows, targets] = await Promise.all([api.getWorkflows('project', selectedProject), api.getWorkflowTargets()]);
            setItems(workflows);
            setWorkflowTargets(targets);
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [selectedProject, projects, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addWorkflow({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addWorkflow({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeWorkflow(id, 'project', selectedProject); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (workflowId, targetIds) => {
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            const res = await api.syncWorkflow(workflowId, targetIds, projectPath);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(`Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };
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
            <div className="registry-header"><h2>📁 Project Workflows</h2><p className="registry-subtitle">Workflows scoped to a specific project</p></div>
            <div className="scope-bar" style={{ marginBottom: '1rem' }}>
                <div className="project-selector" style={{ flex: 1 }}>
                    <select value={selectedProject || ''} onChange={(e) => setSelectedProject(e.target.value || null)} className="project-select">
                        <option value="">— Select a project —</option>
                        {projects.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    <button className="scope-tab" onClick={() => setShowAddProject(!showAddProject)} title="Add new project">{showAddProject ? '✕' : '＋'}</button>
                    {selectedProject && (<button className="scope-tab project-remove-btn" onClick={() => { onRemoveProject(selectedProject); setSelectedProject(null); }} title="Remove project">🗑️</button>)}
                </div>
            </div>
            {showAddProject && (
                <form className="add-project-form" onSubmit={handleAddProject}>
                    <input type="text" placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} className="add-project-name" required />
                    <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Workflow'}</button>
                    </div>
                    {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><WorkflowForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                    {editing && (<div className="panel" style={{ marginBottom: '1rem' }}><div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div><WorkflowForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" /></div>)}
                    {items.length === 0 && !showAdd ? (
                        <div className="panel"><div className="empty"><div className="emoji">📫</div>No workflows in this project's registry yet.</div></div>
                    ) : (
                        <div className="registry-grid">
                            {items.map(w => <WorkflowCard key={w.id} item={w} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} targets={workflowTargets} onPush={handlePush} />)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function GlobalLlmProvidersPage({ addToast }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [providerTargets, setProviderTargets] = useState([]);

    // Import from Config state
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

    // Only show global-scoped targets on the global page
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

            {/* Import from Config modal */}
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


function ProjectLlmProvidersPage({ projects, addToast, onAddProject, onRemoveProject }) {
    const [selectedProject, setSelectedProject] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [providerTargets, setProviderTargets] = useState([]);

    const load = useCallback(async () => {
        if (!selectedProject) { setItems([]); return; }
        try {
            setLoading(true);
            const [provs, targets] = await Promise.all([
                api.getLlmProviders('project', selectedProject),
                api.getLlmProviderTargets(),
            ]);
            setItems(provs);
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

    // Show all targets on the project page — global-scope agents (Continue, Aider, etc.)
    // write to user-level configs regardless of project, and project_path is passed
    // to handlePush so project-specific targets (opencode_project) still resolve correctly.
    const projectTargets = providerTargets;

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
                    <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>
                            {showAdd ? '✕ Cancel' : '＋ Add Provider'}
                        </button>
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

const NAV_SECTIONS = [
    { id: 'dashboard', label: '⚡ Dashboard', defaultHash: '#/' },
    {
        id: 'servers',
        label: '🔌 MCP Servers',
        defaultHash: '#/registry/global',
        links: [
            { hash: '#/registry/global', label: '🌐 Global' },
            { hash: '#/registry/project', label: '📁 Project' },
            { hash: '#/registry/browse', label: '🔍 Browse MCP' },
        ],
    },
    {
        id: 'skills',
        label: '🧠 Skills',
        defaultHash: '#/registry/skills/global',
        links: [
            { hash: '#/registry/skills/global', label: '🌐 Global' },
            { hash: '#/registry/skills/project', label: '📁 Project' },
        ],
    },
    {
        id: 'workflows',
        label: '🔁 Workflows',
        defaultHash: '#/registry/workflows/global',
        links: [
            { hash: '#/registry/workflows/global', label: '🌐 Global' },
            { hash: '#/registry/workflows/project', label: '📁 Project' },
        ],
    },
    {
        id: 'llm',
        label: '🤖 LLM Providers',
        defaultHash: '#/registry/llm/global',
        links: [
            { hash: '#/registry/llm/global', label: '🌐 Global' },
            { hash: '#/registry/llm/project', label: '📁 Project' },
        ],
    },
];

function hashToSection(hash) {
    if (hash === '#/' || hash === '') return 'dashboard';
    if (hash.startsWith('#/registry/skills')) return 'skills';
    if (hash.startsWith('#/registry/workflows')) return 'workflows';
    if (hash.startsWith('#/registry/llm')) return 'llm';
    if (hash.startsWith('#/registry')) return 'servers';
    return 'dashboard';
}

function NavBar({ currentHash }) {
    const activeSection = hashToSection(currentHash);
    const section = NAV_SECTIONS.find(s => s.id === activeSection);

    return (
        <nav className="nav-bar">
            {/* Top tier — section selector */}
            <div className="nav-tier nav-tier-top">
                {NAV_SECTIONS.map(s => (
                    <a
                        key={s.id}
                        href={s.defaultHash}
                        className={`nav-section-tab${activeSection === s.id ? ' active' : ''}`}
                    >
                        {s.label}
                    </a>
                ))}
            </div>

            {/* Bottom tier — sub-links (hidden for Dashboard) */}
            {section?.links && (
                <div className="nav-tier nav-tier-sub">
                    {section.links.map(l => (
                        <a
                            key={l.hash}
                            href={l.hash}
                            className={`nav-sub-link${currentHash === l.hash ? ' active' : ''}`}
                        >
                            {l.label}
                        </a>
                    ))}
                </div>
            )}
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

    const sharedProjectProps = { projects, addToast, onAddProject: handleAddProject, onRemoveProject: handleRemoveProject };

    let page;
    switch (route) {
        case '#/registry/global':
            page = <GlobalRegistryPage addToast={addToast} />;
            break;
        case '#/registry/project':
            page = <ProjectRegistryPage {...sharedProjectProps} />;
            break;
        case '#/registry/browse':
            page = <McpRegistryBrowserPage addToast={addToast} projects={projects} />;
            break;
        case '#/registry/skills/global':
            page = <GlobalSkillsPage addToast={addToast} />;
            break;
        case '#/registry/skills/project':
            page = <ProjectSkillsPage {...sharedProjectProps} />;
            break;
        case '#/registry/workflows/global':
            page = <GlobalWorkflowsPage addToast={addToast} />;
            break;
        case '#/registry/workflows/project':
            page = <ProjectWorkflowsPage {...sharedProjectProps} />;
            break;
        case '#/registry/llm/global':
            page = <GlobalLlmProvidersPage addToast={addToast} />;
            break;
        case '#/registry/llm/project':
            page = <ProjectLlmProvidersPage {...sharedProjectProps} />;
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
