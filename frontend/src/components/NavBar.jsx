const NAV_SECTIONS = [
    {
        id: 'agents',
        label: '🕵️ Agents',
        defaultHash: '#/agents/sync',
        links: [
            { hash: '#/agents/sync', label: '🔄 Sync' },
            { hash: '#/agents/global', label: '🌐 Global' },
            { hash: '#/agents/project', label: '📁 Project' },
        ],
    },
    {
        id: 'llm',
        label: '🤖 LLM Providers',
        defaultHash: '#/llm/sync',
        links: [
            { hash: '#/llm/sync', label: '🔄 Sync' },
            { hash: '#/llm/global', label: '🌐 Global' },
            { hash: '#/llm/project', label: '📁 Project' },
        ],
    },
    {
        id: 'servers',
        label: '🔌 MCP Servers',
        defaultHash: '#/servers/sync',
        links: [
            { hash: '#/servers/sync', label: '🔄 Sync' },
            { hash: '#/servers/global', label: '🌐 Global' },
            { hash: '#/servers/project', label: '📁 Project' },
            { hash: '#/servers/browse', label: '🔍 Browse MCP' },
        ],
    },
    {
        id: 'skills',
        label: '🧠 Skills',
        defaultHash: '#/skills/sync',
        links: [
            { hash: '#/skills/sync', label: '🔄 Sync' },
            { hash: '#/skills/global', label: '🌐 Global' },
            { hash: '#/skills/project', label: '📁 Project' },
        ],
    },
    {
        id: 'workflows',
        label: '🔁 Workflows',
        defaultHash: '#/workflows/sync',
        links: [
            { hash: '#/workflows/sync', label: '🔄 Sync' },
            { hash: '#/workflows/global', label: '🌐 Global' },
            { hash: '#/workflows/project', label: '📁 Project' },
        ],
    },
    {
        id: 'os-registry',
        label: '🏛️ Registry',
        defaultHash: '#/os-registry',
        links: [],
    },
];

export function hashToSection(hash) {
    if (hash.startsWith('#/skills')) return 'skills';
    if (hash.startsWith('#/workflows')) return 'workflows';
    if (hash.startsWith('#/llm')) return 'llm';
    if (hash.startsWith('#/agents')) return 'agents';
    if (hash.startsWith('#/os-registry')) return 'os-registry';
    return 'servers'; // default
}

export function hashToSubScope(hash) {
    if (hash.endsWith('/project')) return 'project';
    if (hash.endsWith('/sync')) return 'sync';
    return 'global';
}

export function NavBar({ currentHash }) {
    const activeSection = hashToSection(currentHash);
    const subScope = hashToSubScope(currentHash);
    const section = NAV_SECTIONS.find(s => s.id === activeSection);

    const getDestHash = (s) => {
        if (!s.links) return s.defaultHash;
        const match = s.links.find(l => l.hash.endsWith('/' + subScope));
        return match ? match.hash : s.defaultHash;
    };

    return (
        <nav className="nav-bar">
            <div className="nav-tier nav-tier-top">
                {NAV_SECTIONS.map(s => (
                    <a
                        key={s.id}
                        href={getDestHash(s)}
                        className={`nav-section-tab${activeSection === s.id ? ' active' : ''}`}
                    >
                        {s.label}
                    </a>
                ))}
            </div>

            {section?.links && (
                <div className="nav-tier nav-tier-sub">
                    {section.links.map(l => (
                        <a
                            key={l.hash}
                            href={l.hash}
                            className={`nav-sub-link${currentHash === l.hash ? ' active' : ''}`}
                        >
                            {l.label}
                        </a>
                    ))}
                </div>
            )}
        </nav>
    );
}
