import { useState } from 'react';

const STORAGE_KEY = 'osr_connections';

function loadConnections() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

/**
 * Inline "📤 Push" button that expands to show a registry picker.
 * Props:
 *   artifactType – 'server' | 'skill' | 'workflow' | 'agent' | 'llm_provider'
 *   artifactData – the full artifact object (name, command, etc.)
 *   addToast     – toast notification function
 */
export function PushToRegistryButton({ artifactType, artifactData, addToast }) {
    const [open, setOpen] = useState(false);
    const [selectedConn, setSelectedConn] = useState('');
    const [pushing, setPushing] = useState(false);
    const connections = loadConnections();

    if (connections.length === 0) return null; // No registries configured

    const TYPE_KEY_MAP = {
        server: 'servers',
        skill: 'skills',
        workflow: 'workflows',
        agent: 'agents',
        llm_provider: 'llm_providers',
    };

    const doPush = async () => {
        const conn = connections.find(c => c.id === selectedConn);
        if (!conn) return;
        setPushing(true);
        try {
            const pluralKey = TYPE_KEY_MAP[artifactType];
            // Build a clean payload – strip internal fields
            const { id, sources, ...cleanData } = artifactData;
            const body = {
                servers: [], skills: [], workflows: [], agents: [], llm_providers: [],
                submitted_by: 'opensync',
            };
            body[pluralKey] = [cleanData];

            const res = await fetch(conn.url.replace(/\/$/, '') + '/api/sync/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${conn.apiKey}`,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error(err.detail || res.statusText);
            }
            addToast(`📤 "${artifactData.name}" pushed to ${conn.label} for approval`, 'success');
            setOpen(false);
            setSelectedConn('');
        } catch (e) {
            addToast(`Push failed: ${e.message}`, 'error');
        } finally {
            setPushing(false);
        }
    };

    if (!open) {
        return (
            <button
                className="btn btn-sm btn-ghost"
                onClick={() => setOpen(true)}
                title="Push to OpenSync Registry"
            >
                📤 Push
            </button>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <select
                value={selectedConn}
                onChange={e => setSelectedConn(e.target.value)}
                style={{
                    background: 'var(--surface2, #2a2a2a)',
                    border: '1px solid var(--border, #444)',
                    borderRadius: 5,
                    padding: '0.25rem 0.5rem',
                    color: 'var(--text, #eee)',
                    fontSize: '0.78rem',
                    minWidth: 120,
                }}
            >
                <option value="">Select registry…</option>
                {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                ))}
            </select>
            <button
                className="btn btn-sm btn-primary"
                disabled={!selectedConn || pushing}
                onClick={doPush}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem' }}
            >
                {pushing ? '⏳…' : '📤 Push'}
            </button>
            <button
                className="btn btn-sm btn-ghost"
                onClick={() => { setOpen(false); setSelectedConn(''); }}
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
            >
                ✕
            </button>
        </div>
    );
}
