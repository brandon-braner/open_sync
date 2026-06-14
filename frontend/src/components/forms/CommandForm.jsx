import { useState } from 'react';
import { MarkdownEditor } from '../ui/MarkdownEditor';

export function CommandForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        content: initialData?.content || '',
        argument_hint: initialData?.argument_hint || '',
    });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({
            name: form.name.trim(),
            description: form.description.trim(),
            content: form.content,
            argument_hint: form.argument_hint.trim(),
        });
    };
    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group"><label>Name *</label><input value={form.name} onChange={set('name')} placeholder="review-pr" required /></div>
            <div className="form-group"><label>Argument hint</label><input value={form.argument_hint} onChange={set('argument_hint')} placeholder="[pr-number]" /></div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group full">
                <label>Prompt / Steps <span className="md-label-hint">(Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder={'1. Look at the diff\n2. …'}
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
