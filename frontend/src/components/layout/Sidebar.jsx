import { ENTITY_KINDS } from '../../entityKinds';

export function Sidebar({ route }) {
    const isActive = (hash) => route === hash || route.startsWith(`${hash}/`);
    return (
        <nav className="sidebar">
            <div className="sidebar-section">Library</div>
            {ENTITY_KINDS.map((k) => (
                <a
                    key={k.kind}
                    href={`#/k/${k.urlKind}`}
                    className={`sidebar-link ${isActive(`#/k/${k.urlKind}`) ? 'active' : ''}`}
                >
                    <span className="sidebar-icon">{k.icon}</span> {k.label}
                </a>
            ))}
            <div className="sidebar-section">Sources</div>
            <a href="#/browse" className={`sidebar-link ${isActive('#/browse') ? 'active' : ''}`}>
                <span className="sidebar-icon">🌐</span> MCP Registry
            </a>
            <div className="sidebar-section">Settings</div>
            <a href="#/projects" className={`sidebar-link ${isActive('#/projects') ? 'active' : ''}`}>
                <span className="sidebar-icon">📁</span> Projects
            </a>
        </nav>
    );
}
