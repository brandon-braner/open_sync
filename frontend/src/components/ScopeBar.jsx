// App-level scope switcher: one global/project toggle + project selector,
// shared by every page instead of per-page scope plumbing.
export function ScopeBar({ scope, setScope, projects, projectId, setProjectId }) {
    return (
        <div className="scope-bar">
            <div className="scope-toggle">
                <button
                    className={`scope-btn ${scope === 'global' ? 'active' : ''}`}
                    onClick={() => setScope('global')}
                >
                    🌍 Global
                </button>
                <button
                    className={`scope-btn ${scope === 'project' ? 'active' : ''}`}
                    onClick={() => setScope('project')}
                >
                    📁 Project
                </button>
            </div>
            {scope === 'project' && (
                <>
                    <select
                        className="project-select"
                        value={projectId || ''}
                        onChange={(e) => setProjectId(e.target.value || null)}
                    >
                        <option value="">Select a project…</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <a href="#/projects" className="btn btn-ghost btn-sm">Manage</a>
                </>
            )}
        </div>
    );
}
