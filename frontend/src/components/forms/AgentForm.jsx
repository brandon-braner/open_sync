import { useState } from 'react';
import { MarkdownEditor } from '../ui/MarkdownEditor';

export function AgentForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        content: initialData?.content || '',
        model: initialData?.model || '',
        tools: initialData?.tools || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ name: form.name.trim(), description: form.description.trim() || null, content: form.content, model: form.model.trim() || null, tools: form.tools.trim() || null });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="my-agent" required /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group"><label>Model</label><input value={form.model} onChange={set('model')} placeholder="e.g. gpt-4o" /></div>
            <div className="form-group"><label>Tools</label><input value={form.tools} onChange={set('tools')} placeholder="e.g. search, fetch" /></div>
            <div className="form-group full">
                <label>Content / Instructions <span className="md-label-hint">(Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder="You are a specialized agent that…"
                    rows={10}
                />
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}
