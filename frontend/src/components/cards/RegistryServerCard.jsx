export function RegistryServerCard({ server, onEdit, onDelete }) {
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
