import { useState } from 'react';

export function ImportItemFromGlobalModal({ globalItems, projectItems, onImport, onClose, itemLabel = 'item' }) {
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
