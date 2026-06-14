/**
 * Lightweight LSP client over WebSocket.
 *
 * Connects to the backend language server bridge, sends/receives JSON-RPC,
 * and translates LSP notifications/responses into Monaco editor features:
 *   - textDocument/publishDiagnostics  →  Monaco markers
 *   - textDocument/completion          →  Monaco completions
 *   - textDocument/hover               →  Monaco hover
 *
 * One connection per language. Files are synced via didOpen / didChange.
 */

let nextRequestId = 1;

export class LspClient {
    constructor(language) {
        this.language = language;
        this.ws = null;
        this.connected = false;
        this.pending = new Map(); // request id → {resolve, reject}
        this.documents = new Map(); // uri → version
        this.handlers = {
            diagnostics: null,
        };
    }

    connect() {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${proto}://${location.host}/ws/lsp/${this.language}`;
        this.ws = new WebSocket(url);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('LSP connection timeout')), 8000);
            this.ws.onopen = () => {
                clearTimeout(timeout);
                this.connected = true;
                this._sendInitialize().then(() => {
                    // Re-open any documents registered before connect
                    for (const [uri, version] of this.documents.entries()) {
                        this._sendDidOpen(uri, version);
                    }
                    resolve();
                }).catch(reject);
            };
            this.ws.onerror = (e) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error connecting to ${language} language server`));
            };
            this.ws.onmessage = (e) => this._onMessage(e.data);
            this.ws.onclose = () => {
                this.connected = false;
                // The server may close without answering `initialize` (e.g. the
                // language server isn't installed). Reject everything still in
                // flight — including this connect() — so callers get feedback
                // instead of a promise that never settles.
                clearTimeout(timeout);
                const err = new Error(`${this.language} language server unavailable`);
                for (const { reject: rej } of this.pending.values()) rej(err);
                this.pending.clear();
                reject(err); // no-op if connect() already resolved
            };
        });
    }

    onDiagnostics(cb) { this.handlers.diagnostics = cb; }

    _send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    _request(method, params) {
        const id = nextRequestId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this._send({ jsonrpc: '2.0', id, method, params });
        });
    }

    _onMessage(data) {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }

        if (msg.id !== undefined && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
            return;
        }

        if (msg.method === 'textDocument/publishDiagnostics' && this.handlers.diagnostics) {
            this.handlers.diagnostics(msg.params);
        }
    }

    async _sendInitialize() {
        await this._request('initialize', {
            processId: null,
            rootUri: null,
            capabilities: {
                textDocument: {
                    synchronization: { didOpen: true, didChange: true, willSave: false },
                    completion: { completionItem: { snippetSupport: false } },
                    hover: { contentFormat: ['markdown', 'plaintext'] },
                    publishDiagnostics: { relatedInformation: false },
                },
                workspace: { workspaceEdit: false, configuration: false },
            },
        });
        this._send({ jsonrpc: '2.0', method: 'initialized', params: {} });
    }

    _sendDidOpen(uri, version, text) {
        this.documents.set(uri, version);
        this._send({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
                textDocument: { uri, languageId: this.language, version, text },
            },
        });
    }

    openDocument(uri, text) {
        this._sendDidOpen(uri, 1, text);
    }

    changeDocument(uri, text) {
        const version = (this.documents.get(uri) || 0) + 1;
        this.documents.set(uri, version);
        this._send({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: { uri, version },
                contentChanges: [{ text }],
            },
        });
    }

    async completion(uri, line, character) {
        return this._request('textDocument/completion', {
            textDocument: { uri },
            position: { line, character },
        });
    }

    async hover(uri, line, character) {
        return this._request('textDocument/hover', {
            textDocument: { uri },
            position: { line, character },
        });
    }

    dispose() {
        this.pending.clear();
        this.documents.clear();
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
}
