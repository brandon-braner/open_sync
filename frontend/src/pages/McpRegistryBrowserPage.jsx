import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export function McpRegistryBrowserPage({ addToast, scope, projectId, projects }) {
    const [results, setResults] = useState([]);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [importing, setImporting] = useState(new Set());
    const [imported, setImported] = useState(new Set());

    const debounceRef = useRef(null);
    const projectName = projects.find((p) => p.id === projectId)?.name;

    useEffect(() => () => clearTimeout(debounceRef.current), []);
    useEffect(() => { doSearch('', null, false); }, []);

    const doSearch = async (q, cursor, append) => {
        cursor ? setLoadingMore(true) : setLoading(true);
        try {
            const data = await api.searchMcpRegistry(q, cursor, 20);
            const servers = data.servers || [];
            setResults((prev) => (append ? [...prev, ...servers] : servers));
            setNextCursor(data.metadata?.nextCursor || null);
        } catch (err) {
            addToast(`Registry search failed: ${err.message}`, 'error');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleQueryChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val, null, false), 400);
    };

    const handleImport = async (serverName) => {
        setImporting((prev) => new Set(prev).add(serverName));
        try {
            await api.importFromMcpRegistry(serverName, scope, projectId);
            setImported((prev) => new Set(prev).add(serverName));
            const dest = scope === 'project' ? `project "${projectName}"` : 'global registry';
            addToast(`Imported to ${dest} ✓`, 'success');
        } catch (err) {
            addToast(`Import failed: ${err.message}`, 'error');
        } finally {
            setImporting((prev) => {
                const next = new Set(prev);
                next.delete(serverName);
                return next;
            });
        }
    };

    const typeLabel = (pkg) => {
        if (!pkg) return null;
        const map = { npm: '📦 npm', pypi: '🐍 PyPI', oci: '🐳 Docker', nuget: '🟣 NuGet', mcpb: '📎 MCPB' };
        return map[pkg.registryType] || pkg.registryType;
    };

    const importBlocked = scope === 'project' && !projectId;

    return (
        <div className="page registry-page">
            <div className="registry-header">
                <h2>🌐 Browse MCP Registry</h2>
                <p className="registry-subtitle">
                    Discover servers from the <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noreferrer">official MCP Registry</a> and
                    import them into the {scope === 'project' ? `"${projectName || '…'}" project` : 'global'} registry
                </p>
            </div>

            {importBlocked && (
                <p className="hint">Select a project in the scope bar above to import at project scope.</p>
            )}

            <div className="browse-search-bar">
                <input
                    type="text"
                    className="browse-search-input"
                    placeholder="Search MCP servers… (e.g. filesystem, github, slack)"
                    value={query}
                    onChange={handleQueryChange}
                />
                {loading && <div className="spinner browse-spinner" />}
            </div>

            {!loading && results.length === 0 && (
                <div className="panel">
                    <div className="empty">
                        <div className="emoji">🔍</div>
                        {query ? 'No servers found. Try a different search.' : 'Loading servers…'}
                    </div>
                </div>
            )}

            <div className="browse-results">
                {results.map((entry) => {
                    const srv = entry.server || entry;
                    const pkg = (srv.packages || [])[0];
                    const remote = (srv.remotes || [])[0];
                    const repo = srv.repository?.url;
                    const isImporting = importing.has(srv.name);
                    const isImported = imported.has(srv.name);
                    const transport = pkg?.transport?.type || remote?.type || '—';

                    return (
                        <div key={`${srv.name}:${srv.version}`} className="browse-card">
                            <div className="browse-card-header">
                                <div className="browse-card-title">
                                    {srv.title || srv.name.split('/').pop()}
                                </div>
                                <div className="browse-card-badges">
                                    {pkg && <span className="browse-badge browse-badge-type">{typeLabel(pkg)}</span>}
                                    <span className="browse-badge browse-badge-transport">{transport}</span>
                                    {srv.version && <span className="browse-badge browse-badge-version">v{srv.version}</span>}
                                </div>
                            </div>
                            <div className="browse-card-name">{srv.name}</div>
                            <div className="browse-card-desc">{srv.description}</div>
                            {repo && (
                                <a className="browse-card-repo" href={repo} target="_blank" rel="noreferrer">
                                    🔗 {repo.replace('https://github.com/', '')}
                                </a>
                            )}
                            <div className="browse-card-actions">
                                <button
                                    className={`btn btn-primary btn-sm browse-import-btn${isImported ? ' imported' : ''}`}
                                    disabled={isImporting || isImported || importBlocked}
                                    onClick={() => handleImport(srv.name)}
                                >
                                    {isImported ? '✓ Imported' : isImporting ? '⏳ Importing…' : '⚡ Import'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {nextCursor && (
                <div className="browse-load-more">
                    <button className="btn btn-secondary" onClick={() => doSearch(query, nextCursor, true)} disabled={loadingMore}>
                        {loadingMore ? '⏳ Loading…' : '↓ Load More'}
                    </button>
                </div>
            )}
        </div>
    );
}
