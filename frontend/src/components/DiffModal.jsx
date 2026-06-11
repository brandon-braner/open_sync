function DiffText({ diff }) {
    return (
        <pre className="diff-view">
            {diff.split('\n').map((line, i) => {
                let cls = '';
                if (line.startsWith('+') && !line.startsWith('+++')) cls = 'diff-add';
                else if (line.startsWith('-') && !line.startsWith('---')) cls = 'diff-del';
                else if (line.startsWith('@@')) cls = 'diff-hunk';
                return <div key={i} className={cls}>{line || ' '}</div>;
            })}
        </pre>
    );
}

export function DiffModal({
    plan,
    integrationsById,
    busy,
    onApply,
    onClose,
    onForce,   // (warning) => void — re-plan including this cell
    onPull,    // (warning|change) => void — accept the tool's version
}) {
    if (!plan) return null;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal diff-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Sync preview</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {plan.warnings.length > 0 && (
                    <div className="plan-warnings">
                        {plan.warnings.map((w, i) => (
                            <div key={i} className={`plan-warning warning-${w.status}`}>
                                <span>
                                    <strong>{w.entity_name}</strong> →{' '}
                                    {integrationsById[w.integration]?.display_name || w.integration}:{' '}
                                    {w.message}
                                </span>
                                {(w.status === 'drifted' || w.status === 'conflict') && (
                                    <span className="plan-warning-actions">
                                        {onForce && (
                                            <button className="btn btn-sm btn-secondary" disabled={busy}
                                                onClick={() => onForce(w)}>Push anyway</button>
                                        )}
                                        {onPull && (
                                            <button className="btn btn-sm btn-secondary" disabled={busy}
                                                onClick={() => onPull(w)}>Pull into registry</button>
                                        )}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {plan.changes.length === 0 ? (
                    <p className="empty">Nothing to write — everything already in sync.</p>
                ) : (
                    plan.changes.map((change, i) => (
                        <div key={i} className="plan-change">
                            <div className="plan-change-header">
                                <span
                                    className="badge"
                                    style={{ background: integrationsById[change.integration]?.color }}
                                >
                                    {integrationsById[change.integration]?.display_name || change.integration}
                                </span>
                                <code>{change.file_path}</code>
                                {change.create && <span className="badge browse-badge">new file</span>}
                            </div>
                            <DiffText diff={change.diff} />
                        </div>
                    ))
                )}

                <div className="form-actions">
                    <button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={onApply}
                        disabled={busy || plan.changes.length === 0}
                    >
                        {busy ? 'Applying…' : `✅ Apply (${plan.changes.length} file${plan.changes.length === 1 ? '' : 's'})`}
                    </button>
                </div>
            </div>
        </div>
    );
}
