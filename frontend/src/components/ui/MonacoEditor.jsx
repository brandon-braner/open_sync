import { useRef, useEffect, useState } from 'react';
import { monaco } from '../../monacoSetup';
import { LspClient } from '../../lspClient';

const LANGUAGE_MAP = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.json': 'json', '.jsonc': 'json',
    '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.html': 'html', '.htm': 'html', '.xml': 'xml', '.svg': 'xml',
    '.md': 'markdown', '.markdown': 'markdown',
    '.py': 'python', '.pyw': 'python',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.sql': 'sql', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp',
    '.rb': 'ruby', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
    '.toml': 'ini', '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini',
    '.txt': 'plaintext', '.env': 'plaintext',
};

// Languages served by the backend LSP bridge (pyright / bash-language-server).
const LSP_LANGUAGES = new Set(['python', 'shell']);

function languageForPath(path) {
    const ext = path.match(/\.[^.]+$/)?.[0]?.toLowerCase();
    if (ext && LANGUAGE_MAP[ext]) return LANGUAGE_MAP[ext];
    if (/^(\.env|Makefile|Dockerfile)/i.test(path)) return 'shell';
    return 'plaintext';
}

function defineDarkTheme() {
    monaco.editor.defineTheme('opensync-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#0d1117',
            'editor.foreground': '#e6edf3',
            'editorLineNumber.foreground': '#484f58',
            'editorLineNumber.activeForeground': '#8b949e',
            'editor.selectionBackground': '#264f78',
            'editor.lineHighlightBackground': '#161b22',
            'editorCursor.foreground': '#58a6ff',
            'editorWidget.background': '#161b22',
            'editorWidget.border': 'rgba(255,255,255,0.08)',
            'editorSuggestWidget.background': '#1c2333',
            'editorSuggestWidget.selectedBackground': 'rgba(88,166,255,0.15)',
            'editorHoverWidget.background': '#1c2333',
        },
    });
}

let themeDefined = false;

export function MonacoEditor({ path, value, onChange, minHeight = 360 }) {
    const containerRef = useRef(null);
    const editorRef = useRef(null);
    const modelRef = useRef(null);
    const lspRef = useRef(null);
    const changeRef = useRef(onChange);
    changeRef.current = onChange;
    // null = not an LSP language; otherwise 'connecting' | 'connected' | 'unavailable'
    const [lspStatus, setLspStatus] = useState(null);

    useEffect(() => {
        if (!themeDefined) {
            defineDarkTheme();
            themeDefined = true;
        }

        const language = languageForPath(path);
        const uri = monaco.Uri.parse(`file:///${path.replace(/[^a-zA-Z0-9._\-/]/g, '_')}`);
        const owner = `lsp-${language}`;

        // Create or reuse model
        let model = monaco.editor.getModel(uri);
        if (!model) {
            model = monaco.editor.createModel(value || '', language, uri);
        } else {
            model.setLanguage(language);
            if (model.getValue() !== (value || '')) {
                model.setValue(value || '');
            }
        }
        modelRef.current = model;

        const editor = monaco.editor.create(containerRef.current, {
            model,
            theme: 'opensync-dark',
            automaticLayout: true,
            fontSize: 13,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            lineHeight: 1.6 * 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 8 },
            lineNumbersMinChars: 3,
            tabSize: 2,
            wordWrap: 'off',
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        });
        editorRef.current = editor;

        const disposables = [];

        disposables.push(model.onDidChangeContent(() => {
            changeRef.current(model.getValue());
        }));

        // LSP integration for python/shell
        if (LSP_LANGUAGES.has(language)) {
            setLspStatus('connecting');
            const lsp = new LspClient(language);
            lspRef.current = lsp;

            lsp.onDiagnostics((params) => {
                const markers = (params.diagnostics || []).map((d) => ({
                    startLineNumber: (d.range.start.line || 0) + 1,
                    startColumn: (d.range.start.character || 0) + 1,
                    endLineNumber: (d.range.end.line || 0) + 1,
                    endColumn: (d.range.end.character || 0) + 1,
                    message: d.message,
                    severity: d.severity === 1 ? monaco.MarkerSeverity.Error
                        : d.severity === 2 ? monaco.MarkerSeverity.Warning
                        : monaco.MarkerSeverity.Info,
                }));
                monaco.editor.setModelMarkers(model, owner, markers);
            });

            lsp.connect().then(() => {
                setLspStatus('connected');
                lsp.openDocument(uri.toString(), model.getValue());

                disposables.push(model.onDidChangeContent(() => {
                    lsp.changeDocument(uri.toString(), model.getValue());
                }));

                disposables.push(monaco.languages.registerCompletionItemProvider(language, {
                    triggerCharacters: ['.', '/', '-', '$'],
                    async provideCompletionItems(model, position) {
                        const result = await lsp.completion(
                            uri.toString(),
                            position.lineNumber - 1,
                            position.column - 1,
                        );
                        if (!result) return { suggestions: [] };
                        const items = Array.isArray(result) ? result : result.items || [];
                        return {
                            suggestions: items.map((item) => ({
                                label: item.label,
                                kind: mapCompletionKind(item.kind),
                                insertText: item.insertText || item.label,
                                detail: item.detail,
                                documentation: item.documentation?.value || item.documentation,
                            })),
                        };
                    },
                }));

                disposables.push(monaco.languages.registerHoverProvider(language, {
                    async provideHover(model, position) {
                        const result = await lsp.hover(
                            uri.toString(),
                            position.lineNumber - 1,
                            position.column - 1,
                        );
                        if (!result || !result.contents) return null;
                        const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
                        return {
                            range: result.range ? {
                                startLineNumber: result.range.start.line + 1,
                                startColumn: result.range.start.character + 1,
                                endLineNumber: result.range.end.line + 1,
                                endColumn: result.range.end.character + 1,
                            } : undefined,
                            contents: contents.map((c) => ({
                                value: typeof c === 'string' ? c : (c.value || String(c)),
                            })),
                        };
                    },
                }));
            }).catch(() => {
                // Server not installed — editor still works with syntax highlighting
                setLspStatus('unavailable');
            });
        } else {
            setLspStatus(null);
        }

        return () => {
            for (const d of disposables) {
                try { d.dispose(); } catch { /* already disposed */ }
            }
            if (lspRef.current) {
                lspRef.current.dispose();
                lspRef.current = null;
            }
            monaco.editor.setModelMarkers(model, owner, []);
            editor.dispose();
            editorRef.current = null;
            modelRef.current = null;
        };
    }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync external value changes (e.g. switching files) without recreating the editor
    useEffect(() => {
        if (editorRef.current && modelRef.current && value !== undefined) {
            const current = modelRef.current.getValue();
            if (current !== value && editorRef.current.hasTextFocus() === false) {
                modelRef.current.setValue(value);
            }
        }
    }, [value]);

    return (
        <div className="monaco-wrap">
            {lspStatus && (
                <span className={`lsp-status ${lspStatus === 'connected' ? 'connected' : ''}`}>
                    <span className="lsp-dot" />
                    {lspStatus === 'connecting' && 'LSP connecting…'}
                    {lspStatus === 'connected' && 'LSP ready'}
                    {lspStatus === 'unavailable' && 'LSP server not installed'}
                </span>
            )}
            <div ref={containerRef} className="monaco-container" style={{ minHeight, height: minHeight }} />
        </div>
    );
}

function mapCompletionKind(kind) {
    const map = {
        1: monaco.languages.CompletionItemKind.Text, 2: monaco.languages.CompletionItemKind.Method,
        3: monaco.languages.CompletionItemKind.Function, 4: monaco.languages.CompletionItemKind.Constructor,
        5: monaco.languages.CompletionItemKind.Field, 6: monaco.languages.CompletionItemKind.Variable,
        7: monaco.languages.CompletionItemKind.Class, 8: monaco.languages.CompletionItemKind.Interface,
        9: monaco.languages.CompletionItemKind.Module, 10: monaco.languages.CompletionItemKind.Property,
        11: monaco.languages.CompletionItemKind.Unit, 12: monaco.languages.CompletionItemKind.Value,
        13: monaco.languages.CompletionItemKind.Enum, 14: monaco.languages.CompletionItemKind.Keyword,
        15: monaco.languages.CompletionItemKind.Snippet, 16: monaco.languages.CompletionItemKind.Color,
        17: monaco.languages.CompletionItemKind.File, 18: monaco.languages.CompletionItemKind.Reference,
    };
    return map[kind] || monaco.languages.CompletionItemKind.Variable;
}
