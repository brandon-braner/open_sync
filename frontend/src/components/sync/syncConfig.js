import { api } from '../../api';

export const SYNC_TYPE_CONFIG = {
    servers: {
        icon: '🔌', label: 'MCP Servers',
        loadItems: (scope, pp, _pn) => api.getServers(scope, pp),
        discoverItems: null,
        loadTargets: (scope, pp) => api.getTargets(scope, pp),
        getSubtitle: (item) => item.url || [item.command, ...(item.args || [])].filter(Boolean).join(' ') || '—',
        syncSelected: async (selected, items, selectedTargets, scope, pp) => {
            const res = await api.sync([...selected], [...selectedTargets], scope, pp);
            return res.results || [];
        },
    },
    skills: {
        icon: '🧠', label: 'Skills',
        loadItems: (scope, _pp, pn) => api.getSkills(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverSkills() : api.discoverSkills(projectPath),
        loadTargets: () => api.getSkillTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addSkill({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncSkill(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    workflows: {
        icon: '🔁', label: 'Workflows',
        loadItems: (scope, _pp, pn) => api.getWorkflows(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverWorkflows() : api.discoverWorkflows(projectPath),
        loadTargets: () => api.getWorkflowTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addWorkflow({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncWorkflow(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    llm: {
        icon: '🤖', label: 'LLM Providers',
        loadItems: (scope, _pp, pn) => api.getLlmProviders(scope, pn),
        discoverItems: (scope) => scope === 'global' ? api.discoverLlmProviders() : Promise.resolve([]),
        loadTargets: () => api.getLlmProviderTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addLlmProvider({ name: item?.name || name, provider_type: item?.provider_type || '', api_key: item?.api_key || '', base_url: item?.base_url || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncLlmProvider(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
    agents: {
        icon: '🕵️', label: 'Agents',
        loadItems: (scope, _pp, pn) => api.getAgents(scope, pn),
        discoverItems: (scope, projectPath) => scope === 'global' ? api.discoverAgents() : api.discoverAgents(projectPath),
        loadTargets: () => api.getAgentTargets(),
        syncSelected: async (selected, items, selectedTargets, scope, pp, selectedProject) => {
            const targetIds = [...selectedTargets];
            const allResults = [];
            for (const name of selected) {
                let item = items.find(i => i.name === name);
                try {
                    if (!item?.id) {
                        item = await api.addAgent({ name: item?.name || name, description: item?.description || '', content: item?.content || '', scope, project_name: scope === 'project' ? selectedProject : null });
                    }
                    const res = await api.syncAgent(item.id, targetIds, pp);
                    allResults.push(...(res.results || []).map(r => ({ ...r, target: `${name} → ${r.target_id}` })));
                } catch (e) { allResults.push({ target: name, success: false, message: e.message }); }
            }
            return allResults;
        },
    },
};
