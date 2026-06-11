import { ServerForm } from './components/forms/ServerForm';
import { SkillForm } from './components/forms/SkillForm';
import { CommandForm } from './components/forms/CommandForm';
import { AgentForm } from './components/forms/AgentForm';
import { LlmProviderForm } from './components/forms/LlmProviderForm';

// Per-kind UI configuration. Tool/target metadata is NOT here — it always
// comes from GET /api/integrations.
export const ENTITY_KINDS = [
    {
        kind: 'mcp',
        urlKind: 'mcp',
        label: 'MCP Servers',
        icon: '🔌',
        Form: ServerForm,
        summary: (e) =>
            e.data.url || [e.data.command, ...(e.data.args || [])].filter(Boolean).join(' '),
    },
    {
        kind: 'skill',
        urlKind: 'skills',
        label: 'Skills',
        icon: '✨',
        Form: SkillForm,
        summary: (e) => e.description,
    },
    {
        kind: 'command',
        urlKind: 'commands',
        label: 'Commands',
        icon: '⚡',
        Form: CommandForm,
        summary: (e) => e.description,
    },
    {
        kind: 'subagent',
        urlKind: 'subagents',
        label: 'Subagents',
        icon: '🤖',
        Form: AgentForm,
        summary: (e) => e.description,
    },
    {
        kind: 'llm',
        urlKind: 'llm',
        label: 'LLM Providers',
        icon: '🔑',
        Form: LlmProviderForm,
        summary: (e) => e.data.provider_type,
        readOnlySync: true,
    },
];

export const kindByUrl = (urlKind) => ENTITY_KINDS.find((k) => k.urlKind === urlKind);

// Flatten an API entity row into the flat shape the form components expect.
export const entityToForm = (e) => ({
    name: e.name,
    description: e.description,
    content: e.content,
    ...e.data,
});
