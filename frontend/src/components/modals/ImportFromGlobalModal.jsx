import { useState } from 'react';
import { api } from '../../api';

export function ImportFromGlobalModal({ globalServers, projectServers, onImport, onClose }) {
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
