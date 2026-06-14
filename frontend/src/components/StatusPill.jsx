const STATUS_META = {
    in_sync: { label: '✓', title: 'In sync', cls: 'pill-insync' },
    outdated: { label: '↑', title: 'Registry changed — push to update', cls: 'pill-outdated' },
    drifted: { label: '↓', title: 'Changed in the tool — push, pull, or skip', cls: 'pill-drifted' },
    conflict: { label: '⚠', title: 'Changed on both sides', cls: 'pill-conflict' },
    not_synced: { label: '○', title: 'Not synced', cls: 'pill-notsynced' },
    missing: { label: '✕', title: 'Removed from the tool since last sync', cls: 'pill-missing' },
    unsupported: { label: '—', title: 'Not supported by this tool', cls: 'pill-unsupported' },
};

export function StatusPill({ status, notes, onClick }) {
    const meta = STATUS_META[status] || STATUS_META.unsupported;
    const clickable = onClick && status !== 'unsupported';
    return (
        <span
            className={`status-pill ${meta.cls} ${clickable ? 'pill-clickable' : ''}`}
            title={notes ? `${meta.title}\n${notes}` : meta.title}
            onClick={clickable ? onClick : undefined}
        >
            {meta.label}
        </span>
    );
}
