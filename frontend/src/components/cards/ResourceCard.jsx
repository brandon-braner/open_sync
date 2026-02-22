import { colorFor, labelFor } from '../../colors';

export function ResourceCard({ item, selected, onToggle, onRemoveFromTarget }) {
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
