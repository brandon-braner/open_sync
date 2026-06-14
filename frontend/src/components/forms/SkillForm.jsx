import { useState } from 'react';
import { MarkdownEditor } from '../ui/MarkdownEditor';
import { SkillFileEditor } from '../ui/SkillFileEditor';

// Mirror of backend slugify_skill_name: the folder name and SKILL.md
// frontmatter `name` are always this lowercase, hyphenated slug.
function slugify(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
}

export function SkillForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        content: initialData?.content || '',
    });
    // entityToForm flattens the API row's `data` blob to the top level,
    // so the bundled files live at initialData.files (not initialData.data.files).
    const [files, setFiles] = useState({ ...(initialData?.files || {}) });
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const slug = slugify(form.name);

    const submit = (e) => {
        e.preventDefault();
        if (!slug) return;
        onSave({
            name: form.name.trim(),
            description: form.description.trim() || null,
            content: form.content,
            files,
        });
    };

    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={set('name')} placeholder="my-skill" required />
                {slug && slug !== form.name.trim() && (
                    <span className="md-label-hint">Folder &amp; SKILL.md name: <code>{slug}</code></span>
                )}
            </div>
            <div className="form-group full"><label>Description</label><input value={form.description} onChange={set('description')} placeholder="Short description" /></div>
            <div className="form-group full">
                <label>Content / Instructions <span className="md-label-hint">(SKILL.md body — Markdown supported)</span></label>
                <MarkdownEditor
                    value={form.content}
                    onChange={set('content')}
                    placeholder="You are a helpful…"
                    rows={10}
                />
            </div>
            <div className="form-group full">
                <label>
                    Bundled files <span className="md-label-hint">(scripts, references, assets — edit inline or upload, synced with the skill)</span>
                </label>
                <SkillFileEditor files={files} setFiles={setFiles} />
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saveLabel || '💾 Save'}</button>
            </div>
        </form>
    );
}
