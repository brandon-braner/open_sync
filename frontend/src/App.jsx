import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import { useHashRoute } from './hooks/useHashRoute';

import { ToastContainer } from './components/ui/ToastContainer';
import { NavBar, hashToSubScope } from './components/NavBar';
import { SyncPage } from './components/sync/SyncPage';

import { GlobalRegistryPage, ProjectRegistryPage } from './pages/servers/ServerRegistryPages';
import { McpRegistryBrowserPage } from './pages/servers/McpRegistryBrowserPage';
import { GlobalSkillsPage, ProjectSkillsPage } from './pages/skills/SkillsPages';
import { GlobalWorkflowsPage, ProjectWorkflowsPage } from './pages/workflows/WorkflowsPages';
import { GlobalLlmProvidersPage, ProjectLlmProvidersPage } from './pages/llm/LlmProvidersPages';
import { GlobalAgentsPage, ProjectAgentsPage } from './pages/agents/AgentsPages';

export default function App() {
    const route = useHashRoute();
    const [projects, setProjects] = useState([]);
    const [scope, setScope] = useState('global');
    const [selectedProject, setSelectedProject] = useState(null);
    const [toasts, setToasts] = useState([]);

    let toastId = 0;
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            const p = await api.getProjects();
            setProjects(p);
        } catch (err) {
            addToast(`Failed to load projects: ${err.message}`, 'error');
        }
    }, [addToast]);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    useEffect(() => {
        const subScope = hashToSubScope(route);
        setScope(subScope);
    }, [route]);

    const handleAddProject = async (name, path) => {
        try {
            const result = await api.addProject(name, path);
            const imported = result.imported_servers || [];
            const msg = imported.length > 0
                ? `Project "${name}" added — imported ${imported.length} server${imported.length > 1 ? 's' : ''}: ${imported.join(', ')}`
                : `Project "${name}" added`;
            addToast(msg, 'success');
            await loadProjects();
            setSelectedProject(name);
        } catch (err) {
            addToast(`Failed to add project: ${err.message}`, 'error');
        }
    };

    const handleRemoveProject = async (name) => {
        try {
            await api.removeProject(name);
            addToast(`Project "${name}" removed`, 'success');
            if (selectedProject === name) setSelectedProject(null);
            await loadProjects();
        } catch (err) {
            addToast(`Failed to remove project: ${err.message}`, 'error');
        }
    };

    const sharedProjectProps = {
        projects, addToast, onAddProject: handleAddProject, onRemoveProject: handleRemoveProject,
        selectedProject, setSelectedProject, scope, setScope,
    };

    let page;
    switch (route) {
        // MCP Servers
        case '#/servers/sync': page = <SyncPage type="servers" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/servers/global': page = <GlobalRegistryPage addToast={addToast} />; break;
        case '#/servers/project': page = <ProjectRegistryPage {...sharedProjectProps} />; break;
        case '#/servers/browse': page = <McpRegistryBrowserPage addToast={addToast} projects={projects} scope={scope} setScope={setScope} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />; break;
        // Skills
        case '#/skills/sync': page = <SyncPage type="skills" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/skills/global': page = <GlobalSkillsPage addToast={addToast} projects={projects} />; break;
        case '#/skills/project': page = <ProjectSkillsPage {...sharedProjectProps} />; break;
        // Workflows
        case '#/workflows/sync': page = <SyncPage type="workflows" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/workflows/global': page = <GlobalWorkflowsPage addToast={addToast} projects={projects} />; break;
        case '#/workflows/project': page = <ProjectWorkflowsPage {...sharedProjectProps} />; break;
        // LLM Providers
        case '#/llm/sync': page = <SyncPage type="llm" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/llm/global': page = <GlobalLlmProvidersPage addToast={addToast} />; break;
        case '#/llm/project': page = <ProjectLlmProvidersPage {...sharedProjectProps} />; break;
        // Agents
        case '#/agents/sync': page = <SyncPage type="agents" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />; break;
        case '#/agents/global': page = <GlobalAgentsPage addToast={addToast} projects={projects} />; break;
        case '#/agents/project': page = <ProjectAgentsPage {...sharedProjectProps} />; break;
        // Legacy URL aliases
        case '#/registry/global': page = <GlobalRegistryPage addToast={addToast} />; break;
        case '#/registry/project': page = <ProjectRegistryPage {...sharedProjectProps} />; break;
        case '#/registry/browse': page = <McpRegistryBrowserPage addToast={addToast} projects={projects} scope={scope} setScope={setScope} selectedProject={selectedProject} setSelectedProject={setSelectedProject} />; break;
        case '#/registry/skills/global': page = <GlobalSkillsPage addToast={addToast} projects={projects} />; break;
        case '#/registry/skills/project': page = <ProjectSkillsPage {...sharedProjectProps} />; break;
        case '#/registry/workflows/global': page = <GlobalWorkflowsPage addToast={addToast} projects={projects} />; break;
        case '#/registry/workflows/project': page = <ProjectWorkflowsPage {...sharedProjectProps} />; break;
        case '#/registry/llm/global': page = <GlobalLlmProvidersPage addToast={addToast} />; break;
        case '#/registry/llm/project': page = <ProjectLlmProvidersPage {...sharedProjectProps} />; break;
        default:
            page = <SyncPage type="servers" addToast={addToast} projects={projects} selectedProject={selectedProject} setSelectedProject={setSelectedProject} onAddProject={handleAddProject} onRemoveProject={handleRemoveProject} />;
    }

    return (
        <div className="app">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <header>
                <h1>⚡ OpenSync</h1>
                <p>Sync AI Artifacts across all your AI agents & IDEs</p>
            </header>

            <NavBar currentHash={route} />

            {page}
        </div>
    );
}
