import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { WorkflowForm } from '../../components/forms/WorkflowForm';
import { WorkflowCard } from '../../components/cards/WorkflowCard';
import { ImportFromProjectModal } from '../../components/modals/ImportFromProjectModal';
import { ImportItemFromGlobalModal } from '../../components/modals/ImportItemFromGlobalModal';

export function GlobalWorkflowsPage({ addToast, projects }) {
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

export function ProjectWorkflowsPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
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
