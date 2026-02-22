import { useState, useRef, useMemo } from 'react';

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(md) {
    if (!md) return '';
    let html = md
        // Headings
        .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
        .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
        .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
        .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
        // Code blocks (``` fenced)
        .replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${escHtml(code.trim())}</code></pre>`)
        // Inline code
        .replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Blockquotes
        .replace(/^>\s?(.+)$/gm, '<blockquote>$1</blockquote>')
        // Unordered list items
        .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
        // Ordered list items
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Horizontal rules
        .replace(/^(-{3,}|\*{3,})$/gm, '<hr>')
        // Line breaks → paragraph breaks
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Wrap bare li elements in ul
    html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/gs, match =>
        `<ul>${match.replace(/<br>/g, '')}</ul>`);

    return `<p>${html}</p>`
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[1-6]>)/g, '$1')
        .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
        .replace(/<p>(<pre>)/g, '$1')
        .replace(/(<\/pre>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1')
        .replace(/(<\/ul>)<\/p>/g, '$1')
        .replace(/<p>(<hr>)<\/p>/g, '$1')
        .replace(/<p>(<blockquote>)/g, '$1')
        .replace(/(<\/blockquote>)<\/p>/g, '$1');
}

const TOOLBAR = [
    { label: 'B', title: 'Bold', wrap: ['**', '**'], icon: '𝐁' },
    { label: 'I', title: 'Italic', wrap: ['*', '*'], icon: '𝐼' },
    { label: 'H2', title: 'Heading 2', prefix: '## ', icon: 'H₂' },
    { label: 'H3', title: 'Heading 3', prefix: '### ', icon: 'H₃' },
    { label: '`', title: 'Inline code', wrap: ['`', '`'], icon: '`' },
    { label: '```', title: 'Code block', wrap: ['```\n', '\n```'], icon: '⟨⟩' },
    { label: '-', title: 'List item', prefix: '- ', icon: '≡' },
    { label: 'hr', title: 'Divider', insert: '\n---\n', icon: '—' },
    { label: '>', title: 'Blockquote', prefix: '> ', icon: '❝' },
];

export function MarkdownEditor({ value, onChange, placeholder, rows = 12 }) {
    const taRef = useRef(null);
    const [mode, setMode] = useState('split'); // 'write' | 'preview' | 'split'

    const applyFormat = (btn) => {
        const ta = taRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = value.slice(start, end);
        let next;

        if (btn.insert) {
            next = value.slice(0, start) + btn.insert + value.slice(end);
            ta.focus();
            setTimeout(() => {
                const p = start + btn.insert.length;
                ta.setSelectionRange(p, p);
            }, 0);
        } else if (btn.wrap) {
            const [before, after] = btn.wrap;
            next = value.slice(0, start) + before + (sel || 'text') + after + value.slice(end);
            ta.focus();
            setTimeout(() => {
                ta.setSelectionRange(start + before.length, start + before.length + (sel || 'text').length);
            }, 0);
        } else if (btn.prefix) {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            next = value.slice(0, lineStart) + btn.prefix + value.slice(lineStart);
            ta.focus();
            setTimeout(() => {
                const p = start + btn.prefix.length;
                ta.setSelectionRange(p, p);
            }, 0);
        }

        onChange({ target: { value: next } });
    };

    const preview = useMemo(() => renderMarkdown(value), [value]);

    return (
        <div className="md-editor">
            <div className="md-toolbar">
                <div className="md-toolbar-btns">
                    {TOOLBAR.map(btn => (
                        <button
                            key={btn.label}
                            type="button"
                            className="md-toolbar-btn"
                            title={btn.title}
                            onMouseDown={e => { e.preventDefault(); applyFormat(btn); }}
                        >
                            {btn.icon}
                        </button>
                    ))}
                </div>
                <div className="md-toolbar-modes">
                    {['write', 'split', 'preview'].map(m => (
                        <button
                            key={m}
                            type="button"
                            className={`md-mode-btn${mode === m ? ' active' : ''}`}
                            onClick={() => setMode(m)}
                        >
                            {m === 'write' ? '✏️' : m === 'split' ? '⬛⬜' : '👁'}
                        </button>
                    ))}
                </div>
            </div>
            <div className={`md-panes md-panes--${mode}`}>
                {mode !== 'preview' && (
                    <textarea
                        ref={taRef}
                        className="md-pane-write"
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        rows={rows}
                        spellCheck
                    />
                )}
                {mode !== 'write' && (
                    <div
                        className="md-pane-preview"
                        dangerouslySetInnerHTML={{ __html: preview || '<span class="md-empty">Nothing to preview…</span>' }}
                    />
                )}
            </div>
        </div>
    );
}
