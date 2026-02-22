const BASE = '';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    return res.json();
}

function scopeParams(scope, projectPath) {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (scope === 'project' && projectPath) {
        params.set('project_path', projectPath);
    }
    return params.toString();
}

export const api = {
    // Servers (merged: discovered + registry)
    getServers: (scope = 'global', projectPath = null) =>
        request(`/api/servers?${scopeParams(scope, projectPath)}`),

    getTargets: (scope = 'global', projectPath = null) =>
        request(`/api/targets?${scopeParams(scope, projectPath)}`),

    sync: (serverNames, targetNames, scope = 'global', projectPath = null) =>
        request('/api/sync', {
            method: 'POST',
            body: JSON.stringify({
                server_names: serverNames,
                target_names: targetNames,
                scope,
                project_path: projectPath,
            }),
        }),

    removeServer: (name, targetNames, projectPath = null) => {
        const params = projectPath ? `?project_path=${encodeURIComponent(projectPath)}` : '';
        return request(`/api/servers/${encodeURIComponent(name)}${params}`, {
            method: 'DELETE',
            body: JSON.stringify({ target_names: targetNames }),
        });
    },

    // Registry (local OpenSync-managed servers)
    getRegistry: (scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry?${params}`);
    },

    addToRegistry: (data) =>
        request('/api/registry', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    removeFromRegistry: (id, scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/${encodeURIComponent(id)}?${params}`, {
            method: 'DELETE',
        });
    },

    updateRegistryServer: (id, data) =>
        request(`/api/registry/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    importFromGlobal: (serverName, projectName) =>
        request('/api/registry/import', {
            method: 'POST',
            body: JSON.stringify({ server_name: serverName, project_name: projectName }),
        }),

    // Skills
    getSkills: (scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/skills?${params}`);
    },

    addSkill: (data) =>
        request('/api/registry/skills', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    removeSkill: (id, scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/skills/${encodeURIComponent(id)}?${params}`, {
            method: 'DELETE',
        });
    },

    // Workflows
    getWorkflows: (scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/workflows?${params}`);
    },

    addWorkflow: (data) =>
        request('/api/registry/workflows', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    removeWorkflow: (id, scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/workflows/${encodeURIComponent(id)}?${params}`, {
            method: 'DELETE',
        });
    },

    // Skills sync
    getSkillTargets: () => request('/api/registry/skills/targets'),

    syncSkill: (skillId, targetIds, projectPath = null) =>
        request('/api/registry/skills/sync', {
            method: 'POST',
            body: JSON.stringify({ skill_id: skillId, target_ids: targetIds, project_path: projectPath }),
        }),

    // Workflows sync
    getWorkflowTargets: () => request('/api/registry/workflows/targets'),

    syncWorkflow: (workflowId, targetIds, projectPath = null) =>
        request('/api/registry/workflows/sync', {
            method: 'POST',
            body: JSON.stringify({ workflow_id: workflowId, target_ids: targetIds, project_path: projectPath }),
        }),

    // Import from project directory
    scanProjectImport: (projectPath) =>
        request('/api/registry/import-from-project/scan', {
            method: 'POST',
            body: JSON.stringify({ project_path: projectPath }),
        }),

    commitProjectImport: (items, scope = 'global', projectName = null) =>
        request('/api/registry/import-from-project/commit', {
            method: 'POST',
            body: JSON.stringify({ items, scope, project_name: projectName }),
        }),

    // LLM Providers
    discoverLlmProviders: () => request('/api/registry/llm-providers/discover'),


    getLlmProviderTargets: () => request('/api/registry/llm-providers/targets'),

    syncLlmProvider: (providerId, targetIds, projectPath = null) =>
        request('/api/registry/llm-providers/sync', {
            method: 'POST',
            body: JSON.stringify({ provider_id: providerId, target_ids: targetIds, project_path: projectPath }),
        }),

    getLlmProviders: (scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/llm-providers?${params}`);
    },

    addLlmProvider: (data) =>
        request('/api/registry/llm-providers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    removeLlmProvider: (id, scope = 'global', projectName = null) => {
        const params = new URLSearchParams({ scope });
        if (projectName) params.set('project_name', projectName);
        return request(`/api/registry/llm-providers/${encodeURIComponent(id)}?${params}`, {
            method: 'DELETE',
        });
    },

    // Projects
    getProjects: () => request('/api/projects'),

    addProject: (name, path) =>
        request('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ name, path }),
        }),

    removeProject: (name) =>
        request(`/api/projects/${encodeURIComponent(name)}`, {
            method: 'DELETE',
        }),

    // Directory browser
    browse: (path = '~') =>
        request(`/api/browse?path=${encodeURIComponent(path)}`),

    // Native OS folder picker
    pickDirectory: () => request('/api/pick-directory'),

    // Official MCP Registry (registry.modelcontextprotocol.io)
    searchMcpRegistry: (query = '', cursor = null, limit = 20) => {
        const params = new URLSearchParams({ q: query, limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return request(`/api/mcp-registry/search?${params}`);
    },

    importFromMcpRegistry: (serverName, scope = 'global', projectName = null) =>
        request('/api/mcp-registry/import', {
            method: 'POST',
            body: JSON.stringify({
                server_name: serverName,
                scope,
                project_name: projectName,
            }),
        }),
};
