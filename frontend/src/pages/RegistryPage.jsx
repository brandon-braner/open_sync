import { useState, useEffect, useCallback } from 'react';

const ADMIN_BASE = (url) => url.replace(/\/$/, '');

async function registryRequest(baseUrl, apiKey, path, opts = {}) {
    const res = await fetch(ADMIN_BASE(baseUrl) + '/api/sync' + path, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...opts.headers,
        },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
    }
    return res.json();
}

// Use relative URLs so requests go through the Vite dev server proxy,
// which correctly forwards to the backend bypassing the StaticFiles catch-all.
const SYNC_API = '';

async function localRequest(path, opts = {}) {
    const res = await fetch(SYNC_API + path, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
    }
    return res.json();
}

// ── Local storage for registry connections ───────────────────────────────────
const STORAGE_KEY = 'osr_connections';
function loadConnections() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function saveConnections(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Sub-view: Connect ─────────────────────────────────────────────────────────
function ConnectView({ addToast }) {
    const [connections, setConnections] = useState(loadConnections);
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [label, setLabel] = useState('');
    const [testing, setTesting] = useState(null);

    const persist = (list) => { setConnections(list); saveConnections(list); };

    const add = () => {
        if (!url.trim() || !apiKey.trim()) return;
        const conn = { id: Date.now().toString(), label: label || url, url: url.trim(), apiKey: apiKey.trim() };
        persist([...connections, conn]);
        setUrl(''); setApiKey(''); setLabel('');
        addToast('Registry connection saved', 'success');
    };

    const remove = (id) => persist(connections.filter(c => c.id !== id));

    const test = async (conn) => {
        setTesting(conn.id);
        try {
            await registryRequest(conn.url, conn.apiKey, '/catalog');
            addToast(`✅ Connected to ${conn.label}`, 'success');
        } catch (e) {
            addToast(`❌ ${conn.label}: ${e.message}`, 'error');
        } finally {
            setTesting(null);
        }
    };

    return (
        <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.25rem', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Add Registry Connection</h3>
                <div className="add-form">
                    <div className="form-group">
                        <label>Label (optional)</label>
                        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="My Company Registry" />
                    </div>
                    <div className="form-group">
                        <label>Registry URL *</label>
                        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://registry.example.com" />
                    </div>
                    <div className="form-group full">
                        <label>API Key *</label>
                        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="osr_…" />
                    </div>
                    <div className="form-actions">
                        <button className="btn btn-primary" onClick={add} disabled={!url.trim() || !apiKey.trim()}>
                            🔗 Add Connection
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Saved Connections</h3>
                {connections.length === 0 ? (
                    <div className="empty">
                        <div className="emoji">🏛️</div>
                        <p>No registry connections yet. Add one above to get started.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Label</th>
                                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>URL</th>
                                <th style={{ textAlign: 'left', padding: '0.6rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {connections.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem 0.7rem', color: 'var(--text-primary)', fontWeight: 500 }}>{c.label}</td>
                                    <td style={{ padding: '0.75rem 0.7rem', color: 'var(--text-secondary)', fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: '0.8rem' }}>{c.url}</td>
                                    <td style={{ padding: '0.75rem 0.7rem' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                                                onClick={() => test(c)} disabled={testing === c.id}>
                                                {testing === c.id ? '⏳ Testing…' : '🔍 Test'}
                                            </button>
                                            <button className="btn btn-secondary btn-delete" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}
                                                onClick={() => remove(c.id)}>
                                                🗑️ Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ── Sub-view: Browse & Pull ───────────────────────────────────────────────────
function BrowseView({ addToast }) {
    const [connections, setConnections] = useState(loadConnections);
    const [selectedConn, setSelectedConn] = useState('');
    const [catalog, setCatalog] = useState(null);
    const [loading, setLoading] = useState(false);
    const [typeFilter, setTypeFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [pulling, setPulling] = useState({});

    const conn = connections.find(c => c.id === selectedConn);

    const fetchCatalog = async () => {
        if (!conn) return;
        try {
            setLoading(true);
            const data = await registryRequest(conn.url, conn.apiKey, '/catalog');
            setCatalog(data);
        } catch (e) {
            addToast(`Failed: ${e.message}`, 'error');
            setCatalog(null);
        } finally {
            setLoading(false);
        }
    };

    // Map registry artifact_type → { endpoint, body builder }
    // All open_sync API routes live under /api (APIRouter prefix)
    const PULL_CONFIG = {
        server: {
            endpoint: '/api/registry',
            body: (p) => ({
                name: p.name,
                command: p.command ?? null,
                args: p.args ?? [],
                env: p.env ?? {},
                url: p.url ?? null,
                scope: 'global',
            }),
        },
        skill: {
            endpoint: '/api/registry/skills',
            body: (p) => ({ name: p.name, description: p.description ?? null, content: p.content ?? '', scope: 'global' }),
        },
        workflow: {
            endpoint: '/api/registry/workflows',
            body: (p) => ({ name: p.name, description: p.description ?? null, content: p.content ?? '', scope: 'global' }),
        },
        agent: {
            endpoint: '/api/registry/agents',
            body: (p) => ({ name: p.name, description: p.description ?? null, content: p.content ?? '', model: p.model ?? null, tools: p.tools ?? null, scope: 'global' }),
        },
        llm_provider: {
            endpoint: '/api/registry/llm-providers',
            body: (p) => ({ name: p.name, provider_type: p.provider_type ?? 'openai', api_key: p.api_key ?? null, base_url: p.base_url ?? null, scope: 'global' }),
        },
    };

    const pull = async (artifact) => {
        setPulling(p => ({ ...p, [artifact.id]: true }));
        try {
            const { artifact_type, name, payload } = artifact;
            const cfg = PULL_CONFIG[artifact_type];
            if (!cfg) throw new Error(`Unsupported artifact type: ${artifact_type}`);
            await localRequest(cfg.endpoint, { method: 'POST', body: cfg.body(payload ?? artifact) });
            addToast(`✅ "${name}" pulled into local OpenSync`, 'success');
        } catch (e) {
            addToast(`Pull failed: ${e.message}`, 'error');
        } finally {
            setPulling(p => ({ ...p, [artifact.id]: false }));
        }
    };

    const allArtifacts = catalog ? [
        ...(catalog.servers ?? []).map(a => ({ ...a, artifact_type: 'server' })),
        ...(catalog.skills ?? []).map(a => ({ ...a, artifact_type: 'skill' })),
        ...(catalog.workflows ?? []).map(a => ({ ...a, artifact_type: 'workflow' })),
        ...(catalog.agents ?? []).map(a => ({ ...a, artifact_type: 'agent' })),
        ...(catalog.llm_providers ?? []).map(a => ({ ...a, artifact_type: 'llm_provider' })),
    ] : [];

    const visible = allArtifacts
        .filter(a => typeFilter === 'all' || a.artifact_type === typeFilter)
        .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()));

    const types = ['all', ...new Set(allArtifacts.map(a => a.artifact_type))];

    return (
        <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Registry</label>
                    <select
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem' }}
                        value={selectedConn}
                        onChange={e => { setSelectedConn(e.target.value); setCatalog(null); }}
                    >
                        <option value="">Select a registry…</option>
                        {connections.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>
                <button className="btn btn-primary" onClick={fetchCatalog} disabled={!conn || loading}>
                    {loading ? 'Fetching…' : 'Fetch Catalog'}
                </button>
            </div>

            {catalog && (
                <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {types.map(t => (
                            <button
                                key={t}
                                onClick={() => setTypeFilter(t)}
                                style={{ padding: '0.35rem 0.85rem', borderRadius: 99, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: typeFilter === t ? 'var(--accent)' : 'var(--border)', background: typeFilter === t ? 'var(--accent-glow)' : 'transparent', color: typeFilter === t ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 180ms ease' }}
                            >
                                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                        <input
                            style={{ marginLeft: 'auto', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.75rem', color: 'var(--text)', fontSize: '0.85rem', maxWidth: 200 }}
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        {visible.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No artifacts match your filter.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        {['Name', 'Type', 'Action'].map(h => (
                                            <th key={h} style={{ textAlign: 'left', padding: '0.6rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map(art => (
                                        <tr key={art.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text)', fontWeight: 500 }}>{art.name}</td>
                                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{art.artifact_type}</td>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <button
                                                    onClick={() => pull(art)}
                                                    disabled={pulling[art.id]}
                                                    style={{ padding: '0.3rem 0.75rem', borderRadius: 5, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)', transition: 'all 180ms ease' }}
                                                >
                                                    {pulling[art.id] ? 'Pulling…' : '↓ Pull'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RegistryPage({ addToast }) {
    const [tab, setTab] = useState('connect');

    return (
        <div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Registry</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
                    Connect to an OpenSync Registry and pull approved artifacts
                </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                {[['connect', 'Connect'], ['browse', 'Browse & Pull']].map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        style={{ padding: '0.4rem 1rem', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: tab === id ? 'var(--accent)' : 'transparent', color: tab === id ? '#fff' : 'var(--text-muted)', transition: 'all 180ms ease' }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'connect' && <ConnectView addToast={addToast} />}
            {tab === 'browse' && <BrowseView addToast={addToast} />}
        </div>
    );
}
