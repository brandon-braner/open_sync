const BASE = '';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        let detail;
        try { detail = JSON.parse(await res.text()).detail; } catch { /* raw */ }
        throw new Error(detail || res.statusText);
    }
    return res.json();
}

function scopeQuery(scope, projectId) {
    const params = new URLSearchParams({ scope });
    if (scope === 'project' && projectId) params.set('project_id', projectId);
    return params.toString();
}

export const api = {
    // Integrations (manifests drive every tool list in the UI)
    getIntegrations: () => request('/api/integrations'),

    // Projects
    getProjects: () => request('/api/projects'),
    addProject: (name, path) =>
        request('/api/projects', { method: 'POST', body: JSON.stringify({ name, path }) }),
    removeProject: (projectId) =>
        request(`/api/projects/${projectId}`, { method: 'DELETE' }),

    // Entities (urlKind ∈ mcp | skills | commands | subagents | llm)
    listEntities: (urlKind, scope, projectId) =>
        request(`/api/${urlKind}?${scopeQuery(scope, projectId)}`),
    createEntity: (urlKind, payload) =>
        request(`/api/${urlKind}`, { method: 'POST', body: JSON.stringify(payload) }),
    updateEntity: (urlKind, id, payload) =>
        request(`/api/${urlKind}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    deleteEntity: (urlKind, id) =>
        request(`/api/${urlKind}/${id}`, { method: 'DELETE' }),

    // Discovery / import / status
    discover: (urlKind, scope, projectId) =>
        request(`/api/${urlKind}/discover?${scopeQuery(scope, projectId)}`),
    importItems: (urlKind, items) =>
        request(`/api/${urlKind}/import`, { method: 'POST', body: JSON.stringify({ items }) }),
    getStatus: (urlKind, scope, projectId) =>
        request(`/api/${urlKind}/status?${scopeQuery(scope, projectId)}`),

    // Sync
    planSync: (kind, entityIds, integrations, force = []) =>
        request('/api/sync/plan', {
            method: 'POST',
            body: JSON.stringify({ kind, entity_ids: entityIds, integrations, force }),
        }),
    applySync: (planId) =>
        request('/api/sync/apply', { method: 'POST', body: JSON.stringify({ plan_id: planId }) }),
    pullEntity: (entityId, integration) =>
        request('/api/sync/pull', {
            method: 'POST',
            body: JSON.stringify({ entity_id: entityId, integration }),
        }),

    // Filesystem helpers
    browseDirectories: (path = '~') =>
        request(`/api/fs/browse?path=${encodeURIComponent(path)}`),
    pickDirectory: () => request('/api/fs/pick-directory'),

    // Official MCP Registry
    searchMcpRegistry: (q = '', cursor = null, limit = 20) => {
        const params = new URLSearchParams({ q, limit });
        if (cursor) params.set('cursor', cursor);
        return request(`/api/mcp-registry/search?${params}`);
    },
    importFromMcpRegistry: (serverName, scope = 'global', projectId = null) =>
        request('/api/mcp-registry/import', {
            method: 'POST',
            body: JSON.stringify({ server_name: serverName, scope, project_id: projectId }),
        }),
};
