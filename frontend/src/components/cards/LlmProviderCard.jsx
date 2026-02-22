import { useState } from 'react';

export function LlmProviderCard({ item, onEdit, onDelete, targets, onPush }) {
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
