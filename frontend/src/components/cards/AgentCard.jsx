import { useState } from 'react';

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
    if (!md) return '';
    let html = md
        .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
        .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
        .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
        .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escHtml(code.trim())}</code></pre>`)
        .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/^(-{3,}|\*{3,})$/gm, '<hr>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');

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

export function AgentCard({ item, onEdit, onDelete, targets, onPush }) {
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
