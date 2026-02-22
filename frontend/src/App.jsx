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
    // MCP targets use a `category` field; skill/workflow/LLM targets use a `native` field.
    // Detect which grouping mode to use.
    const hasCategoryField = targets.some((t) => t.category);
    const hasNativeField = targets.some((t) => t.native !== undefined);

    // ---- MCP grouping (by category) ----
    const categoryMeta = {
        editor: { label: 'Editors & IDEs', icon: '🖥️' },
        desktop: { label: 'Desktop Apps', icon: '💻' },
        cli: { label: 'CLI Tools', icon: '⌨️' },
        plugin: { label: 'Editor Plugins', icon: '🧩' },
    };
    const categoryOrder = ['editor', 'desktop', 'cli', 'plugin'];

    // ---- Skill/Workflow/LLM grouping (by native flag) ----
    const nativeMeta = {
        native: { label: 'Native Support', icon: '⭐' },
        embedded: { label: 'Embedded in Config', icon: '📝' },
    };
    const nativeOrder = ['native', 'embedded'];

    const renderItem = (t) => {
        const key = t.id ?? t.name;
        const disabled = t.config_exists === false;
        return (
            <label key={key} className={`target-item${disabled ? ' disabled' : ''}`}>
                <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => onToggle(key)}
                    disabled={disabled}
                />
                <span
                    className="target-dot"
                    style={{ background: t.color || colorFor(t.name || t.id) }}
                />
                <div className="target-info">
                    <div className="label">{t.display_name}</div>
                    <div className="meta">
                        {t.config_exists !== undefined
                            ? (t.config_exists
                                ? `${t.server_count} item${t.server_count !== 1 ? 's' : ''}`
                                : 'config not found')
                            : (t.config_path || '')}
                    </div>
                </div>
            </label>
        );
    };

    if (hasCategoryField) {
        const groups = {};
        targets.forEach((t) => {
            const cat = t.category || 'editor';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });
        return (
            <div className="target-categories">
                {categoryOrder.filter((cat) => groups[cat]?.length).map((cat) => (
                    <div key={cat} className="target-category-group">
                        <div className="target-category-label">
                            <span>{categoryMeta[cat]?.icon}</span>
                            <span>{categoryMeta[cat]?.label || cat}</span>
                        </div>
                        {groups[cat].map(renderItem)}
                    </div>
                ))}
            </div>
        );
    }

    if (hasNativeField) {
        const groups = { native: [], embedded: [] };
        targets.forEach((t) => {
            const isNative = t.native === 'true' || t.native === true;
            groups[isNative ? 'native' : 'embedded'].push(t);
        });
        return (
            <div className="target-categories">
                {nativeOrder.filter((g) => groups[g]?.length).map((g) => (
                    <div key={g} className="target-category-group">
                        <div className="target-category-label">
                            <span>{nativeMeta[g].icon}</span>
                            <span>{nativeMeta[g].label}</span>
                        </div>
                        {groups[g].map(renderItem)}
                    </div>
                ))}
            </div>
        );
    }

    // Fallback: flat list
    return (
        <div className="target-categories">
            <div className="target-category-group">
                {targets.map(renderItem)}
            </div>
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

function ProjectRegistryPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
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

function McpRegistryBrowserPage({ addToast, projects, scope, setScope, selectedProject, setSelectedProject }) {
    const [results, setResults] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
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

/* ===== Resource Card — generic dashboard item card with source pills ===== */

function ResourceCard({ item, selected, onToggle, onRemoveFromTarget }) {
    const sources = item.sources || [];
    const subtitle = item.description || item.url
        || (item.command ? [item.command, ...(item.args || [])].filter(Boolean).join(' ') : null)
        || item.provider_type || '—';

    return (
        <div className={`server-card${selected ? ' selected' : ''}`} onClick={onToggle}>
            <div className="check">{selected ? '✓' : ''}</div>
            <div className="name">{item.name}</div>
            <div className="command">{subtitle}</div>
            {sources.filter(s => s !== 'opensync').length > 0 && (
                <div className="badge-group">
                    {sources.filter(s => s !== 'opensync').map(s => (
                        <span
                            key={s}
                            className="badge badge-with-remove badge-clickable"
                            style={{ color: colorFor(s), borderColor: `${colorFor(s)}44` }}
                            title={`Synced to ${labelFor(s)} · ✕ to remove`}
                            onClick={e => e.stopPropagation()}
                        >
                            {labelFor(s)}
                            <button
                                className="badge-remove"
                                onClick={e => { e.stopPropagation(); e.preventDefault(); onRemoveFromTarget?.(s); }}
                                title={`Remove "${item.name}" from ${labelFor(s)}`}
                            >✕</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ===== Sync Type Config — per-artifact-type data/sync strategy ===== */

const SYNC_TYPE_CONFIG = {
    servers: {
        icon: '🔌', label: 'MCP Servers',
        loadItems: (scope, pp, _pn) => api.getServers(scope, pp),
        discoverItems: null,
        loadTargets: (scope, pp) => api.getTargets(scope, pp),
        getSubtitle: (item) => item.url || [item.command, ...(item.args || [])].filter(Boolean).join(' ') || '—',
        syncSelected: async (selected, items, selectedTargets, scope, pp) => {
            const res = await api.sync([...selected], [...selectedTargets], scope, pp);
            return res.results || [];
        },
    },
    skills: {
        icon: '🧠', label: 'Skills',
        loadItems: (scope, _pp, pn) => api.getSkills(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverSkills() : api.discoverSkills(projectPath),
        loadTargets: () => api.getSkillTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addSkill({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncSkill(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    workflows: {
        icon: '🔁', label: 'Workflows',
        loadItems: (scope, _pp, pn) => api.getWorkflows(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverWorkflows() : api.discoverWorkflows(projectPath),
        loadTargets: () => api.getWorkflowTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addWorkflow({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncWorkflow(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    llm: {
        icon: '🤖', label: 'LLM Providers',
        loadItems: (scope, _pp, pn) => api.getLlmProviders(scope, pn),
        discoverItems: (scope) => scope === 'global' ? api.discoverLlmProviders() : Promise.resolve([]),
        loadTargets: () => api.getLlmProviderTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addLlmProvider({ name: item?.name || name, provider_type: item?.provider_type || '', api_key: item?.api_key || '', base_url: item?.base_url || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncLlmProvider(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    agents: {
        icon: '🕵️', label: 'Agents',
        loadItems: (scope, _pp, pn) => api.getAgents(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverAgents() : api.discoverAgents(projectPath),
        loadTargets: () => api.getAgentTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addAgent({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncAgent(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
};

/* ===== SyncPage — per-artifact-type discover + push page ===== */

function SyncPage({ type, addToast, projects, selectedProject, setSelectedProject, onAddProject, onRemoveProject }) {
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
            // Merge: registry items (with IDs) win, but union sources from both
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

    // Filter targets to only those matching the current scope.
    // Targets without a `scope` field (e.g. MCP server targets) are always shown.
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
            {/* Scope toggle */}
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
                    {/* Left: items */}
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

                    {/* Right: targets */}
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

            {/* Sync bar */}
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

function ImportFromProjectModal({ onClose, onImported, addToast, projects = [], defaultTypeFilter = 'all' }) {
    const [projectPath, setProjectPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [artifacts, setArtifacts] = useState(null); // null = not scanned yet
    const [selected, setSelected] = useState(new Set());
    const [typeFilter, setTypeFilter] = useState(defaultTypeFilter); // 'all' | 'skill' | 'workflow'
    const [importing, setImporting] = useState(false);

    const handleSelectProject = async (projectName) => {
        if (!projectName) { setProjectPath(''); return; }
        const proj = projects.find(p => p.name === projectName);
        if (!proj) return;
        setProjectPath(proj.path);
        // Auto-scan when a configured project is picked
        setScanning(true);
        setArtifacts(null);
        setSelected(new Set());
        try {
            const found = await api.scanProjectImport(proj.path);
            setArtifacts(found);
            if (found.length === 0) addToast('No recognisable artifacts found in that project.', 'warn');
        } catch (err) {
            addToast(`Scan failed: ${err.message}`, 'error');
        } finally {
            setScanning(false);
        }
    };
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

                {/* Configured projects dropdown */}
                {projects.length > 0 && (
                    <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.35rem' }}>Pick a configured project</label>
                        <select
                            className="project-select"
                            defaultValue=""
                            onChange={(e) => handleSelectProject(e.target.value)}
                            style={{ width: '100%' }}
                        >
                            <option value="">— Select a project —</option>
                            {projects.map(p => (
                                <option key={p.name} value={p.name}>{p.name} ({p.path})</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Directory picker + scan */}
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.35rem' }}>Or enter a custom path</label>
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
                                <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>{visible.length} artifact{visible.length !== 1 ? 's' : ''} found{typeFilter !== 'all' ? ` (${artifacts.length} total)` : ''}</span>
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

/* ===== Import from Global modal (Skills / Workflows / LLM Providers) ===== */

function ImportItemFromGlobalModal({ globalItems, projectItems, onImport, onClose, itemLabel = 'item' }) {
    const projectIds = new Set(projectItems.map(i => i.name));
    const importable = globalItems.filter(i => !projectIds.has(i.name));
    const [selected, setSelected] = useState(new Set());
    const [importing, setImporting] = useState(false);

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleImport = async () => {
        setImporting(true);
        try { await onImport([...selected]); }
        finally { setImporting(false); }
    };

    return (
        <div className="results-overlay" onClick={onClose}>
            <div className="results-panel import-modal" onClick={e => e.stopPropagation()}>
                <h2>📥 Import from Global Registry</h2>
                {importable.length === 0 ? (
                    <div className="empty"><div className="emoji">✅</div>All global {itemLabel}s are already in this project.</div>
                ) : (
                    <div className="import-list">
                        {importable.map(item => (
                            <label key={item.id} className="import-item" onClick={() => toggle(item.id)}>
                                <input type="checkbox" checked={selected.has(item.id)} onChange={() => { }} />
                                <div className="import-item-info">
                                    <div className="name">{item.name}</div>
                                    <div className="command">{item.description || item.provider_type || '—'}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
                <div className="form-actions" style={{ marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    {importable.length > 0 && (
                        <button className="btn btn-primary" disabled={selected.size === 0 || importing} onClick={handleImport}>
                            {importing ? '⏳ Importing…' : `📥 Import ${selected.size} ${itemLabel}${selected.size !== 1 ? 's' : ''}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ===== Concrete registry pages ===== */



/* ===== Markdown helpers ===== */

function renderMarkdown(md) {
    if (!md) return '';
    let html = md
        // Headings
        .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
        .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
        .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
        // Code blocks (``` fenced)
        .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escHtml(code.trim())}</code></pre>`)
        // Inline code
        .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Blockquotes
        .replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>')
        // Unordered list items
        .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
        // Ordered list items
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Horizontal rules
        .replace(/^(-{3,}|\*{3,})$/gm, '<hr>')
        // Line breaks → paragraph breaks
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Wrap bare li elements in ul
    html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/gs, match =>
        `<ul>${match.replace(/<br>/g, '')}</ul>`);

    return `<p>${html}</p>`
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[1-6]>)/g, '$1')
        .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
        .replace(/<p>(<pre>)/g, '$1')
        .replace(/(<\/pre>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1')
        .replace(/(<\/ul>)<\/p>/g, '$1')
        .replace(/<p>(<hr>)<\/p>/g, '$1')
        .replace(/<p>(<blockquote>)/g, '$1')
        .replace(/(<\/blockquote>)<\/p>/g, '$1');
}

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TOOLBAR = [
    { label: 'B', title: 'Bold', wrap: ['**', '**'], icon: '𝐁' },
    { label: 'I', title: 'Italic', wrap: ['*', '*'], icon: '𝐼' },
    { label: 'H2', title: 'Heading 2', prefix: '## ', icon: 'H₂' },
    { label: 'H3', title: 'Heading 3', prefix: '### ', icon: 'H₃' },
    { label: '`', title: 'Inline code', wrap: ['`', '`'], icon: '`' },
    { label: '```', title: 'Code block', wrap: ['```\n', '\n```'], icon: '⟨⟩' },
    { label: '-', title: 'List item', prefix: '- ', icon: '≡' },
    { label: 'hr', title: 'Divider', insert: '\n---\n', icon: '—' },
    { label: '>', title: 'Blockquote', prefix: '> ', icon: '❝' },
];

function MarkdownEditor({ value, onChange, placeholder, rows = 12 }) {
    const taRef = useRef(null);
    const [mode, setMode] = useState('split'); // 'write' | 'preview' | 'split'

    const applyFormat = (btn) => {
        const ta = taRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = value.slice(start, end);
        let next;

        if (btn.insert) {
            next = value.slice(0, start) + btn.insert + value.slice(end);
            ta.focus();
            setTimeout(() => {
                const p = start + btn.insert.length;
                ta.setSelectionRange(p, p);
            }, 0);
        } else if (btn.wrap) {
            const [before, after] = btn.wrap;
            next = value.slice(0, start) + before + (sel || 'text') + after + value.slice(end);
            ta.focus();
            setTimeout(() => {
                ta.setSelectionRange(start + before.length, start + before.length + (sel || 'text').length);
            }, 0);
        } else if (btn.prefix) {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            next = value.slice(0, lineStart) + btn.prefix + value.slice(lineStart);
            ta.focus();
            setTimeout(() => {
                const p = start + btn.prefix.length;
                ta.setSelectionRange(p, p);
            }, 0);
        }

        onChange({ target: { value: next } });
    };

    const preview = useMemo(() => renderMarkdown(value), [value]);

    return (
        <div className="md-editor">
            <div className="md-toolbar">
                <div className="md-toolbar-btns">
                    {TOOLBAR.map(btn => (
                        <button
                            key={btn.label}
                            type="button"
                            className="md-toolbar-btn"
                            title={btn.title}
                            onMouseDown={e => { e.preventDefault(); applyFormat(btn); }}
                        >
                            {btn.icon}
                        </button>
                    ))}
                </div>
                <div className="md-toolbar-modes">
                    {['write', 'split', 'preview'].map(m => (
                        <button
                            key={m}
                            type="button"
                            className={`md-mode-btn${mode === m ? ' active' : ''}`}
                            onClick={() => setMode(m)}
                        >
                            {m === 'write' ? '✏️' : m === 'split' ? '⬛⬜' : '👁'}
                        </button>
                    ))}
                </div>
            </div>
            <div className={`md-panes md-panes--${mode}`}>
                {mode !== 'preview' && (
                    <textarea
                        ref={taRef}
                        className="md-pane-write"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        rows={rows}
                        spellCheck
                    />
                )}
                {mode !== 'write' && (
                    <div
                        className="md-pane-preview"
                        dangerouslySetInnerHTML={{ __html: preview || '<span class="md-empty">Nothing to preview…</span>' }}
                    />
                )}
            </div>
        </div>
    );
}

/* ===== Generic Registry Page helpers ===== */


/* ===== Skill / Workflow / LLM forms and cards ===== */

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
            <div className="form-group full">
                <label>Content / Instructions <span className="md-label-hint">(Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder="You are a helpful…"
                    rows={10}
                />
            </div>
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
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-workflow" required /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group full">
                <label>Steps <span className="md-label-hint">(Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder="## Step 1\nDo the first thing...\n\n## Step 2\nDo the second thing..."
                    rows={10}
                />
            </div>
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
            {item.content && (
                <div
                    className="md-card-preview"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content.slice(0, 300) + (item.content.length > 300 ? '…' : '')) }}
                />
            )}
            <div className="server-actions">
                {targets && targets.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Sync to agent configs">
                        🔄 Sync to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Sync to agent configs:</div>
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
                            {pushing ? '⏳ Syncing…' : `🔄 Sync to ${selectedTargets.size}`}
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
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Sync to agent configs">
                        🔄 Sync to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Sync to agent configs:</div>
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
                            {pushing ? '⏳ Syncing…' : `🔄 Sync to ${selectedTargets.size}`}
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
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Sync to agent configs">
                        🔄 Sync to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Sync to agent configs:</div>
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
                            {pushing ? '⏳ Syncing…' : `🔄 Sync to ${selectedTargets.size}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function AgentForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        content: initialData?.content || '',
        model: initialData?.model || '',
        tools: initialData?.tools || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ name: form.name.trim(), description: form.description.trim() || null, content: form.content, model: form.model.trim() || null, tools: form.tools.trim() || null });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-agent" required /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group"><label>Model</label><input value={form.model} onChange={set('model')} placeholder="e.g. gpt-4o" /></div>
            <div className="form-group"><label>Tools</label><input value={form.tools} onChange={set('tools')} placeholder="e.g. search, fetch" /></div>
            <div className="form-group full">
                <label>Content / Instructions <span className="md-label-hint">(Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder="You are a specialized agent that…"
                    rows={10}
                />
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}

function AgentCard({ item, onEdit, onDelete, targets, onPush }) {
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
            {item.model && <div style={{ fontSize: '0.78rem', opacity: 0.6, marginBottom: '0.3rem' }}>🧠 Model: {item.model}</div>}
            {item.tools && <div style={{ fontSize: '0.78rem', opacity: 0.6, marginBottom: '0.3rem' }}>🔧 Tools: {item.tools}</div>}
            {item.content && (
                <div
                    className="md-card-preview"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content.slice(0, 300) + (item.content.length > 300 ? '…' : '')) }}
                />
            )}
            <div className="server-actions">
                {targets && targets.length > 0 && (
                    <button className="btn btn-sm btn-ghost" onClick={() => { setShowPush(!showPush); setSelectedTargets(new Set()); }} title="Sync to agent configs">
                        🔄 Sync to…
                    </button>
                )}
                <button className="btn btn-sm btn-ghost btn-edit" onClick={() => onEdit(item)}>✏️ Edit</button>
                <button className="btn btn-sm btn-ghost btn-delete" onClick={() => onDelete(item.id)}>🗑️ Delete</button>
            </div>
            {showPush && targets && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>Sync to agent configs:</div>
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
                            {pushing ? '⏳ Syncing…' : `🔄 Sync to ${selectedTargets.size}`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ===== Generic scoped registry page factory ===== */


function GlobalSkillsPage({ addToast, projects }) {
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
            setSkillTargets(targets.filter(t => t.scope === 'global' || !t.scope));
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
            {showImport && <ImportFromProjectModal onClose={() => setShowImport(false)} onImported={load} addToast={addToast} projects={projects} defaultTypeFilter="skill" />}
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

function ProjectSkillsPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [skillTargets, setSkillTargets] = useState([]);
    const [showImportGlobal, setShowImportGlobal] = useState(false);
    const [globalItems, setGlobalItems] = useState([]);

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
            const [skills, globalSkills, targets] = await Promise.all([
                api.getSkills('project', selectedProject),
                api.getSkills('global'),
                api.getSkillTargets(),
            ]);
            setItems(skills);
            setGlobalItems(globalSkills);
            setSkillTargets(targets.filter(t => t.scope === 'project'));
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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportGlobal(true); setShowAdd(false); setEditing(null); }}>📥 Import from Global</button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Skill'}</button>
                        </div>
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
            {showImportGlobal && (
                <ImportItemFromGlobalModal
                    globalItems={globalItems}
                    projectItems={items}
                    itemLabel="skill"
                    onClose={() => setShowImportGlobal(false)}
                    onImport={async (ids) => {
                        for (const id of ids) await api.importSkillFromGlobal(id, selectedProject);
                        addToast(`Imported ${ids.length} skill${ids.length !== 1 ? 's' : ''} from global`, 'success');
                        setShowImportGlobal(false);
                        await load();
                    }}
                />
            )}
        </div>
    );
}

function GlobalWorkflowsPage({ addToast, projects }) {
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
            setWorkflowTargets(targets.filter(t => t.scope === 'global' || !t.scope));
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
            {showImport && <ImportFromProjectModal onClose={() => setShowImport(false)} onImported={load} addToast={addToast} projects={projects} defaultTypeFilter="workflow" />}
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

function ProjectWorkflowsPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [workflowTargets, setWorkflowTargets] = useState([]);
    const [showImportGlobal, setShowImportGlobal] = useState(false);
    const [globalItems, setGlobalItems] = useState([]);

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
            const [workflows, globalWorkflows, targets] = await Promise.all([
                api.getWorkflows('project', selectedProject),
                api.getWorkflows('global'),
                api.getWorkflowTargets(),
            ]);
            setItems(workflows);
            setGlobalItems(globalWorkflows);
            setWorkflowTargets(targets.filter(t => t.scope === 'project'));
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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportGlobal(true); setShowAdd(false); setEditing(null); }}>📥 Import from Global</button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Workflow'}</button>
                        </div>
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
            {showImportGlobal && (
                <ImportItemFromGlobalModal
                    globalItems={globalItems}
                    projectItems={items}
                    itemLabel="workflow"
                    onClose={() => setShowImportGlobal(false)}
                    onImport={async (ids) => {
                        for (const id of ids) await api.importWorkflowFromGlobal(id, selectedProject);
                        addToast(`Imported ${ids.length} workflow${ids.length !== 1 ? 's' : ''} from global`, 'success');
                        setShowImportGlobal(false);
                        await load();
                    }}
                />
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


function ProjectLlmProvidersPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
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

    // Only show project-scoped targets on the project page.
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

function GlobalAgentsPage({ addToast, projects }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showImport, setShowImport] = useState(false);
    const [agentTargets, setAgentTargets] = useState([]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [agents, targets] = await Promise.all([api.getAgents('global'), api.getAgentTargets()]);
            setItems(agents);
            setAgentTargets(targets.filter(t => t.scope === 'global' || !t.scope));
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addAgent({ ...data, scope: 'global' }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addAgent({ ...data, scope: 'global' }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeAgent(id, 'global'); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (agentId, targetIds) => {
        try {
            const res = await api.syncAgent(agentId, targetIds);
            const ok = res.results.filter(r => r.success).length;
            const fail = res.results.length - ok;
            addToast(`Pushed to ${ok} target${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`, fail ? 'error' : 'success');
        } catch (err) { addToast(`Push failed: ${err.message}`, 'error'); }
    };

    if (loading) return <div className="registry-page"><div className="loading"><div className="spinner" /><div>Loading…</div></div></div>;
    return (
        <div className="registry-page">
            {showImport && <ImportFromProjectModal onClose={() => setShowImport(false)} onImported={load} addToast={addToast} projects={projects} defaultTypeFilter="agent" />}
            <div className="registry-header"><h2>🕵️ Global Agents</h2><p className="registry-subtitle">Reusable agent configurations available globally</p></div>
            <div className="registry-toolbar">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>⬇️ Import from Project</button>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add Agent'}</button>
            </div>
            {showAdd && <AgentForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="Add Agent" />}
            {editing && <AgentForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="Save Changes" />}
            {items.length === 0 && !showAdd ? <div className="empty-state">No agents in the global registry yet.</div> : (
                <div className="registry-grid">
                    {items.map(a => <AgentCard key={a.id} item={a} onEdit={setEditing} onDelete={handleDelete} targets={agentTargets} onPush={handlePush} />)}
                </div>
            )}
        </div>
    );
}

function ProjectAgentsPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState(null);
    const [showAddProject, setShowAddProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPath, setNewPath] = useState('');
    const [agentTargets, setAgentTargets] = useState([]);
    const [showImportGlobal, setShowImportGlobal] = useState(false);
    const [globalItems, setGlobalItems] = useState([]);

    const load = useCallback(async () => {
        if (!selectedProject) { setItems([]); return; }
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            setLoading(true);
            const [agents, globalAgents, targets] = await Promise.all([
                api.getAgents('project', selectedProject),
                api.getAgents('global'),
                api.getAgentTargets(),
            ]);
            setItems(agents);
            setGlobalItems(globalAgents);
            setAgentTargets(targets.filter(t => t.scope === 'project'));
        } catch (err) { addToast(`Failed to load: ${err.message}`, 'error'); }
        finally { setLoading(false); }
    }, [selectedProject, projects, addToast]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (data) => {
        try { await api.addAgent({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" added`, 'success'); setShowAdd(false); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleEdit = async (data) => {
        try { await api.addAgent({ ...data, scope: 'project', project_name: selectedProject }); addToast(`"${data.name}" updated`, 'success'); setEditing(null); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handleDelete = async (id) => {
        try { await api.removeAgent(id, 'project', selectedProject); addToast('Removed', 'success'); await load(); }
        catch (err) { addToast(`Failed: ${err.message}`, 'error'); }
    };
    const handlePush = async (agentId, targetIds) => {
        const projectPath = projects.find(p => p.name === selectedProject)?.path;
        try {
            const res = await api.syncAgent(agentId, targetIds, projectPath);
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
            <div className="registry-header"><h2>📁 Project Agents</h2><p className="registry-subtitle">Agents scoped to a specific project</p></div>
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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowImportGlobal(true); setShowAdd(false); setEditing(null); }}>📥 Import from Global</button>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Agent'}</button>
                        </div>
                    </div>
                    {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><AgentForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                    {editing && (<div className="panel" style={{ marginBottom: '1rem' }}><div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div><AgentForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" /></div>)}
                    {items.length === 0 && !showAdd ? (
                        <div className="panel"><div className="empty"><div className="emoji">📫</div>No agents in this project's registry yet.</div></div>
                    ) : (
                        <div className="registry-grid">
                            {items.map(a => <AgentCard key={a.id} item={a} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} targets={agentTargets} onPush={handlePush} />)}
                        </div>
                    )}
                </>
            )}
            {showImportGlobal && (
                <ImportItemFromGlobalModal
                    globalItems={globalItems}
                    projectItems={items}
                    itemLabel="agent"
                    onClose={() => setShowImportGlobal(false)}
                    onImport={async (ids) => {
                        for (const id of ids) await api.importAgentFromGlobal(id, selectedProject);
                        addToast(`Imported ${ids.length} agent${ids.length !== 1 ? 's' : ''} from global`, 'success');
                        setShowImportGlobal(false);
                        await load();
                    }}
                />
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
    {
        id: 'servers',
        label: '🔌 MCP Servers',
        defaultHash: '#/servers/sync',
        links: [
            { hash: '#/servers/sync', label: '🔄 Sync' },
            { hash: '#/servers/global', label: '🌐 Global' },
            { hash: '#/servers/project', label: '📁 Project' },
            { hash: '#/servers/browse', label: '🔍 Browse MCP' },
        ],
    },
    {
        id: 'skills',
        label: '🧠 Skills',
        defaultHash: '#/skills/sync',
        links: [
            { hash: '#/skills/sync', label: '🔄 Sync' },
            { hash: '#/skills/global', label: '🌐 Global' },
            { hash: '#/skills/project', label: '📁 Project' },
        ],
    },
    {
        id: 'workflows',
        label: '🔁 Workflows',
        defaultHash: '#/workflows/sync',
        links: [
            { hash: '#/workflows/sync', label: '🔄 Sync' },
            { hash: '#/workflows/global', label: '🌐 Global' },
            { hash: '#/workflows/project', label: '📁 Project' },
        ],
    },
    {
        id: 'llm',
        label: '🤖 LLM Providers',
        defaultHash: '#/llm/sync',
        links: [
            { hash: '#/llm/sync', label: '🔄 Sync' },
            { hash: '#/llm/global', label: '🌐 Global' },
            { hash: '#/llm/project', label: '📁 Project' },
        ],
    },
    {
        id: 'agents',
        label: '🕵️ Agents',
        defaultHash: '#/agents/sync',
        links: [
            { hash: '#/agents/sync', label: '🔄 Sync' },
            { hash: '#/agents/global', label: '🌐 Global' },
            { hash: '#/agents/project', label: '📁 Project' },
        ],
    },
];

function hashToSection(hash) {
    if (hash.startsWith('#/skills')) return 'skills';
    if (hash.startsWith('#/workflows')) return 'workflows';
    if (hash.startsWith('#/llm')) return 'llm';
    if (hash.startsWith('#/agents')) return 'agents';
    return 'servers'; // default
}

function hashToSubScope(hash) {
    if (hash.endsWith('/project')) return 'project';
    if (hash.endsWith('/sync')) return 'sync';
    return 'global';
}

function NavBar({ currentHash }) {
    const activeSection = hashToSection(currentHash);
    const subScope = hashToSubScope(currentHash); // 'global' or 'project'
    const section = NAV_SECTIONS.find(s => s.id === activeSection);

    // When clicking a section tab, preserve the current global/project sub-scope
    const getDestHash = (s) => {
        if (!s.links) return s.defaultHash;
        // Find a link matching the current sub-scope
        const match = s.links.find(l => l.hash.endsWith('/' + subScope));
        return match ? match.hash : s.defaultHash;
    };

    return (
        <nav className="nav-bar">
            {/* Top tier — section selector */}
            <div className="nav-tier nav-tier-top">
                {NAV_SECTIONS.map(s => (
                    <a
                        key={s.id}
                        href={getDestHash(s)}
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

    // Keep scope in sync with the URL — navigating to a /project URL sets scope to project
    useEffect(() => {
        const subScope = hashToSubScope(route);
        setScope(subScope);
    }, [route]);

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

    const sharedProjectProps = {
        projects, addToast, onAddProject: handleAddProject, onRemoveProject: handleRemoveProject,
        selectedProject, setSelectedProject, scope, setScope,
    };

    let page;
    switch (route) {
        // MCP Servers
        case '#/servers/sync': page = <SyncPage type="servers" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/servers/global': page = <GlobalRegistryPage addToast={addToast} />; break;
        case '#/servers/project': page = <ProjectRegistryPage {...sharedProjectProps} />; break;
        case '#/servers/browse': page = <McpRegistryBrowserPage addToast={addToast} projects={projects} scope={scope} setScope={setScope} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />; break;
        // Skills
        case '#/skills/sync': page = <SyncPage type="skills" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/skills/global': page = <GlobalSkillsPage addToast={addToast} projects={projects} />; break;
        case '#/skills/project': page = <ProjectSkillsPage {...sharedProjectProps} />; break;
        // Workflows
        case '#/workflows/sync': page = <SyncPage type="workflows" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/workflows/global': page = <GlobalWorkflowsPage addToast={addToast} projects={projects} />; break;
        case '#/workflows/project': page = <ProjectWorkflowsPage {...sharedProjectProps} />; break;
        // LLM Providers
        case '#/llm/sync': page = <SyncPage type="llm" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/llm/global': page = <GlobalLlmProvidersPage addToast={addToast} />; break;
        case '#/llm/project': page = <ProjectLlmProvidersPage {...sharedProjectProps} />; break;
        // Agents
        case '#/agents/sync': page = <SyncPage type="agents" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/agents/global': page = <GlobalAgentsPage addToast={addToast} projects={projects} />; break;
        case '#/agents/project': page = <ProjectAgentsPage {...sharedProjectProps} />; break;
        // Legacy URL aliases (old routes still work)
        case '#/registry/global': page = <GlobalRegistryPage addToast={addToast} />; break;
        case '#/registry/project': page = <ProjectRegistryPage {...sharedProjectProps} />; break;
        case '#/registry/browse': page = <McpRegistryBrowserPage addToast={addToast} projects={projects} scope={scope} setScope={setScope} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />; break;
        case '#/registry/skills/global': page = <GlobalSkillsPage addToast={addToast} projects={projects} />; break;
        case '#/registry/skills/project': page = <ProjectSkillsPage {...sharedProjectProps} />; break;
        case '#/registry/workflows/global': page = <GlobalWorkflowsPage addToast={addToast} projects={projects} />; break;
        case '#/registry/workflows/project': page = <ProjectWorkflowsPage {...sharedProjectProps} />; break;
        case '#/registry/llm/global': page = <GlobalLlmProvidersPage addToast={addToast} />; break;
        case '#/registry/llm/project': page = <ProjectLlmProvidersPage {...sharedProjectProps} />; break;
        default:
            page = <SyncPage type="servers" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />;
    }

    return (
        <div className="app">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <header>
                <h1>⚡ OpenSync</h1>
                <p>Sync AI Artifacts across all your AI agents & IDEs</p>
            </header>

            <NavBar currentHash={route} />

            {page}
        </div>
    );
}
