import { useState } from 'react';
import { DirectoryPicker } from '../components/ui/DirectoryPicker';

export function ProjectsPage({ projects, onAddProject, onRemoveProject }) {
    const [name, setName] = useState('');
    const [path, setPath] = useState('');
    const [adding, setAdding] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !path.trim()) return;
        setAdding(true);
        try {
            await onAddProject(name.trim(), path.trim());
            setName(''); setPath('');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="page">
            <h2>📁 Projects</h2>
            <p className="hint">
                Registering a project lets OpenSync manage its repo-level configs
                (.mcp.json, .cursor/, .claude/, .devin/, .github/, …). Anything already
                configured in the directory is imported automatically.
            </p>

            <form className="add-project-form" onSubmit={submit}>
                <input
                    className="add-project-name"
                    placeholder="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <DirectoryPicker value={path} onChange={setPath} />
                <button className="btn btn-primary" disabled={adding || !name.trim() || !path.trim()}>
                    {adding ? 'Adding…' : '＋ Add project'}
                </button>
            </form>

            {projects.length === 0 ? (
                <p className="empty">No projects yet.</p>
            ) : (
                <ul className="project-list">
                    {projects.map((p) => (
                        <li key={p.id} className="project-row">
                            <div>
                                <strong>{p.name}</strong>
                                <code className="project-path">{p.path}</code>
                            </div>
                            <button
                                className="btn btn-ghost btn-sm"
                                title="Remove project (files on disk are untouched)"
                                onClick={() => onRemoveProject(p)}
                            >
                                🗑
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
