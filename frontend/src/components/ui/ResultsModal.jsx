import { labelFor } from '../../colors';

export function ResultsModal({ results, onClose }) {
    if (!results) return null;
    return (
        <div className="results-overlay" onClick={onClose}>
            <div className="results-panel" onClick={(e) => e.stopPropagation()}>
                <h2>🔄 Sync Results</h2>
                {results.results.map((r, i) => (
                    <div key={i} className="result-row">
                        <span className="result-icon">{r.success ? '✅' : '❌'}</span>
                        <span className="target-name">{labelFor(r.target)}</span>
                        <span className="result-msg">{r.message}</span>
                    </div>
                ))}
                <button className="btn btn-secondary close-btn" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}
