import { api } from '../../api';
import { colorFor, labelFor } from '../../colors';

export function ServerCard({ server, selected, onToggle, targetPaths, onCopyPath, onDelete, onRemoveFromTarget, onAddToRegistry }) {
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
