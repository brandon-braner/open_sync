import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { SkillForm } from '../../components/forms/SkillForm';
import { SkillCard } from '../../components/cards/SkillCard';
import { ImportFromProjectModal } from '../../components/modals/ImportFromProjectModal';
import { ImportItemFromGlobalModal } from '../../components/modals/ImportItemFromGlobalModal';
import { DirectoryPicker } from '../../components/ui/DirectoryPicker';

export function GlobalSkillsPage({ addToast, projects }) {
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
                    {items.map(s => <SkillCard key={s.id} item={s} onEdit={setEditing} onDelete={handleDelete} targets={skillTargets} onPush={handlePush} addToast={addToast} />)}
                </div>
            )}
        </div>
    );
}

export function ProjectSkillsPage({ projects, addToast, onAddProject, onRemoveProject, selectedProject, setSelectedProject }) {
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
                    <div style={{ flex: 1 }}>
                        <DirectoryPicker value={newPath} onChange={setNewPath} />
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
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setEditing(null); }}>{showAdd ? '✕ Cancel' : '＋ Add Skill'}</button>
                        </div>
                    </div>
                    {showAdd && <div className="panel" style={{ marginBottom: '1rem' }}><SkillForm onSave={handleAdd} onCancel={() => setShowAdd(false)} saveLabel="💾 Add" /></div>}
                    {editing && (<div className="panel" style={{ marginBottom: '1rem' }}><div className="panel-title"><span className="icon">✏️</span> Editing "{editing.name}"</div><SkillForm initialData={editing} onSave={handleEdit} onCancel={() => setEditing(null)} saveLabel="💾 Save Changes" /></div>)}
                    {items.length === 0 && !showAdd ? (
                        <div className="panel"><div className="empty"><div className="emoji">📫</div>No skills in this project's registry yet.</div></div>
                    ) : (
                        <div className="registry-grid">
                            {items.map(s => <SkillCard key={s.id} item={s} onEdit={(it) => { setEditing(it); setShowAdd(false); }} onDelete={handleDelete} targets={skillTargets} onPush={handlePush} addToast={addToast} />)}
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
