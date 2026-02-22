import { useState } from 'react';

export const LLM_PROVIDER_TYPES = ['openai', 'anthropic', 'ollama', 'gemini', 'custom'];

export function LlmProviderForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        provider_type: initialData?.provider_type || 'openai',
        api_key: initialData?.api_key || '',
        base_url: initialData?.base_url || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ name: form.name.trim(), provider_type: form.provider_type, api_key: form.api_key.trim() || null, base_url: form.base_url.trim() || null });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-openai" required /></div>
            <div className="form-group">
                <label>Provider Type</label>
                <select value={form.provider_type} onChange={set('provider_type')} className="project-select">
                    {LLM_PROVIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="form-group full"><label>API Key</label><input type="password" value={form.api_key} onChange={set('api_key')} placeholder="sk-…" /></div>
            <div className="form-group full"><label>Base URL (optional)</label><input value={form.base_url} onChange={set('base_url')} placeholder="https://api.openai.com/v1" /></div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}
