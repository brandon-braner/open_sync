import { useState } from 'react';

export function ServerForm({ initialData, onSave, onCancel, saveLabel }) {
    const [form, setForm] = useState({
        name: initialData?.name || '',
        command: initialData?.command || '',
        args: initialData?.args ? initialData.args.join(', ') : '',
        env: initialData?.env
            ? Object.entries(initialData.env).map(([k, v]) => `${k}=${v}`).join('\n')
            : '',
        url: initialData?.url || '',
    });

    const isEdit = !!initialData?.name;

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        const data = {
            name: form.name.trim(),
            command: form.command.trim() || null,
            args: form.args
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            env: form.env
                ? Object.fromEntries(
                    form.env.split('\n').filter(Boolean).map((l) => {
                        const [k, ...v] = l.split('=');
                        return [k.trim(), v.join('=').trim()];
                    })
                )
                : {},
            url: form.url.trim() || null,
        };
        onSave(data);
    };

    return (
        <form className="add-form" onSubmit={submit}>
            <div className="form-group">
                <label>Server Name *</label>
                <input
                    value={form.name}
                    onChange={set('name')}
                    placeholder="my-server"
                    required
                />
            </div>
            <div className="form-group">
                <label>Command</label>
                <input value={form.command} onChange={set('command')} placeholder="npx" />
            </div>
            <div className="form-group full">
                <label>Args (comma-separated)</label>
                <input value={form.args} onChange={set('args')} placeholder="-y, @org/package" />
            </div>
            <div className="form-group full">
                <label>URL (for remote servers)</label>
                <input value={form.url} onChange={set('url')} placeholder="https://api.example.com/mcp" />
            </div>
            <div className="form-group full">
                <label>Environment Variables (KEY=VALUE per line)</label>
                <textarea
                    value={form.env}
                    onChange={set('env')}
                    placeholder={"API_KEY=sk-...\nLOG_LEVEL=debug"}
                    rows={3}
                />
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                    {saveLabel || '💾 Save'}
                </button>
            </div>
        </form>
    );
}
