import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { useHashRoute } from './hooks/useHashRoute';
import { ENTITY_KINDS, kindByUrl } from './entityKinds';

import { ToastContainer } from './components/ui/ToastContainer';
import { Sidebar } from './components/layout/Sidebar';
import { ScopeBar } from './components/ScopeBar';
import { EntityPage } from './pages/EntityPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { McpRegistryBrowserPage } from './pages/McpRegistryBrowserPage';

export default function App() {
    const route = useHashRoute();
    const [projects, setProjects] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [scope, setScope] = useState(() => localStorage.getItem('opensync.scope') || 'global');
    const [projectId, setProjectId] = useState(() => localStorage.getItem('opensync.projectId') || null);
    const [toasts, setToasts] = useState([]);
    const toastId = useRef(0);

    useEffect(() => { localStorage.setItem('opensync.scope', scope); }, [scope]);
    useEffect(() => {
        if (projectId) localStorage.setItem('opensync.projectId', projectId);
        else localStorage.removeItem('opensync.projectId');
    }, [projectId]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + ++toastId.current;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            setProjects(await api.getProjects());
        } catch (err) {
            addToast(`Failed to load projects: ${err.message}`, 'error');
        }
    }, [addToast]);

    useEffect(() => {
        loadProjects();
        api.getIntegrations()
            .then(setIntegrations)
            .catch((err) => addToast(`Failed to load integrations: ${err.message}`, 'error'));
    }, [loadProjects, addToast]);

    const handleAddProject = async (name, path) => {
        try {
            const result = await api.addProject(name, path);
            const counts = Object.entries(result.imported || {})
                .map(([kind, names]) => `${names.length} ${kind}`)
                .join(', ');
            addToast(
                counts ? `Project "${name}" added — imported ${counts}` : `Project "${name}" added`,
                'success',
            );
            await loadProjects();
            setProjectId(result.project.id);
            setScope('project');
        } catch (err) {
            addToast(`Failed to add project: ${err.message}`, 'error');
            throw err;
        }
    };

    const handleRemoveProject = async (project) => {
        if (!window.confirm(`Remove project "${project.name}" and its registry entries?\n(Files in ${project.path} are not touched.)`)) return;
        try {
            await api.removeProject(project.id);
            addToast(`Project "${project.name}" removed`, 'success');
            if (projectId === project.id) setProjectId(null);
            await loadProjects();
        } catch (err) {
            addToast(`Failed to remove project: ${err.message}`, 'error');
        }
    };

    let page;
    const kindMatch = route.match(/^#\/k\/([a-z]+)/);
    if (kindMatch && kindByUrl(kindMatch[1])) {
        const cfg = kindByUrl(kindMatch[1]);
        page = (
            <EntityPage
                key={`${cfg.kind}-${scope}-${projectId}`}
                cfg={cfg}
                scope={scope}
                projectId={scope === 'project' ? projectId : null}
                integrations={integrations}
                addToast={addToast}
            />
        );
    } else if (route.startsWith('#/projects')) {
        page = (
            <ProjectsPage
                projects={projects}
                onAddProject={handleAddProject}
                onRemoveProject={handleRemoveProject}
            />
        );
    } else if (route.startsWith('#/browse')) {
        page = (
            <McpRegistryBrowserPage
                addToast={addToast}
                scope={scope}
                projectId={scope === 'project' ? projectId : null}
                projects={projects}
            />
        );
    } else {
        const cfg = ENTITY_KINDS[0];
        page = (
            <EntityPage
                key={`${cfg.kind}-${scope}-${projectId}`}
                cfg={cfg}
                scope={scope}
                projectId={scope === 'project' ? projectId : null}
                integrations={integrations}
                addToast={addToast}
            />
        );
    }

    return (
        <div className="app app-shell">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
            <Sidebar route={route} />
            <div className="main">
                <header className="main-header">
                    <div>
                        <h1>⚡ OpenSync</h1>
                        <p>One registry for your MCP servers, skills, commands &amp; agents</p>
                    </div>
                    <ScopeBar
                        scope={scope}
                        setScope={setScope}
                        projects={projects}
                        projectId={projectId}
                        setProjectId={setProjectId}
                    />
                </header>
                {page}
            </div>
        </div>
    );
}
