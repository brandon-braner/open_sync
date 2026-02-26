import { useState } from 'react';
import { api } from '../../api';
import { DirectoryPicker } from '../ui/DirectoryPicker';

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

export { SOURCE_COLORS };

export function ImportFromProjectModal({ onClose, onImported, addToast, projects = [], defaultTypeFilter = 'all' }) {
    const [projectPath, setProjectPath] = useState('');
    const [scanning, setScanning] = useState(false);
    const [artifacts, setArtifacts] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [typeFilter, setTypeFilter] = useState(defaultTypeFilter);
    const [importing, setImporting] = useState(false);

    const handleSelectProject = async (projectName) => {
        if (!projectName) { setProjectPath(''); return; }
        const proj = projects.find(p => p.name === projectName);
        if (!proj) return;
        setProjectPath(proj.path);
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
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⬇️ Import from Project</h3>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.6, fontSize: '0.82rem' }}>Scan any project directory for agent artifacts and import them into the registry.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.4rem', opacity: 0.6, lineHeight: 1 }}>✕</button>
                </div>

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
