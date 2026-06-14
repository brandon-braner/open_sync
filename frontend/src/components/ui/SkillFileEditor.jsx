import { useState, useMemo, useRef, useEffect } from 'react';
import { MonacoEditor } from './MonacoEditor';

function fileSize(file) {
    const bytes = file.encoding === 'base64' ? Math.round(file.data.length * 0.75) : file.data.length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function decodeText(bytes) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
}

const SKIP_DIRS = new Set(['__pycache__', '.git', 'node_modules', '.venv']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db']);
// Placeholder that keeps an empty folder alive through a save (git convention).
const GITKEEP = '.gitkeep';

function shouldSkip(rel) {
    const parts = rel.split('/');
    if (parts.some((p) => SKIP_DIRS.has(p))) return true;
    return SKIP_FILES.has(parts[parts.length - 1]);
}

// A folder containing real content no longer needs its .gitkeep — drop the
// placeholder from every ancestor directory of `filePath`. Mutates `files`.
function pruneAncestorKeeps(files, filePath) {
    const parts = filePath.split('/');
    let prefix = '';
    for (let i = 0; i < parts.length - 1; i++) {
        prefix = prefix ? `${prefix}/${parts[i]}` : parts[i];
        delete files[`${prefix}/${GITKEEP}`];
    }
}

function relativePath(file) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    if (file.webkitRelativePath && parts.length > 1) return parts.slice(1).join('/');
    return rel;
}

function buildTree(files) {
    const root = { name: '', children: {}, files: {} };
    const ensureDir = (parts) => {
        let node = root;
        for (const seg of parts) {
            if (!seg) continue;
            if (!node.children[seg]) node.children[seg] = { name: seg, children: {}, files: {} };
            node = node.children[seg];
        }
        return node;
    };
    for (const path of Object.keys(files).sort()) {
        const parts = path.split('/');
        const node = ensureDir(parts.slice(0, -1));
        const fname = parts[parts.length - 1];
        // .gitkeep keeps an otherwise-empty folder alive (so it persists on
        // save) but is hidden from the tree — the folder node is created above.
        if (fname === GITKEEP) continue;
        node.files[fname] = path;
    }
    return root;
}

function InlineNameInput({ initial, onCommit, onCancel, placeholder, folder }) {
    const [value, setValue] = useState(initial);
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) {
            ref.current.focus();
            ref.current.select();
        }
    }, []);
    return (
        <div className={`tree-inline-row ${folder ? 'folder' : 'file'}`}>
            <span className="tree-icon-inline">{folder ? '📁' : '📄'}</span>
            <input
                ref={ref}
                className="tree-inline-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onCommit(value); }
                    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                }}
                onBlur={() => onCommit(value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function TreeNode({ name, node, dirPrefix, depth, selectedPath, onSelect, selectedDir, onSelectDir, expanded, setExpanded, onDelete, onRename, renamingPath, commitRename, cancelRename, creating, commitCreate, cancelCreate }) {
    const childDirs = Object.keys(node.children).sort();
    const childFiles = Object.keys(node.files).sort();
    const isOpen = expanded.has(dirPrefix);
    const isSelected = selectedDir === dirPrefix && depth > 0;

    return (
        <li className="tree-node">
            <div
                className={`tree-folder-row ${isSelected ? 'selected' : ''}`}
                onClick={() => { onSelectDir(dirPrefix); if (!isOpen) setExpanded(dirPrefix); }}
            >
                <span
                    className="tree-caret"
                    onClick={(e) => { e.stopPropagation(); setExpanded(dirPrefix); }}
                >{isOpen ? '▾' : '▸'}</span>
                <span className="tree-folder-icon">{depth === 0 ? '📦' : '📁'}</span>
                <span className="tree-name">{name}{depth > 0 ? '/' : ''}</span>
                <span className="tree-file-count">{childDirs.length + childFiles.length}</span>
            </div>
            {isOpen && (
                <ul className="tree-children">
                    {childDirs.map((d) => {
                        const childPrefix = dirPrefix ? `${dirPrefix}/${d}` : d;
                        return (
                            <TreeNode
                                key={childPrefix}
                                name={d}
                                node={node.children[d]}
                                dirPrefix={childPrefix}
                                depth={depth + 1}
                                selectedPath={selectedPath}
                                onSelect={onSelect}
                                selectedDir={selectedDir}
                                onSelectDir={onSelectDir}
                                expanded={expanded}
                                setExpanded={setExpanded}
                                onDelete={onDelete}
                                onRename={onRename}
                                renamingPath={renamingPath}
                                commitRename={commitRename}
                                cancelRename={cancelRename}
                                creating={creating}
                                commitCreate={commitCreate}
                                cancelCreate={cancelCreate}
                            />
                        );
                    })}
                    {creating?.dir === dirPrefix && creating.type === 'folder' && (
                        <InlineNameInput
                            placeholder="folder name"
                            folder
                            onCommit={(name) => commitCreate(dirPrefix, name, true)}
                            onCancel={cancelCreate}
                        />
                    )}
                    {childFiles.map((f) => {
                        const path = node.files[f];
                        if (renamingPath === path) {
                            return (
                                <InlineNameInput
                                    key={path}
                                    initial={f}
                                    placeholder="file name"
                                    onCommit={(name) => commitRename(path, name)}
                                    onCancel={cancelRename}
                                />
                            );
                        }
                        return (
                            <li key={path} className={`tree-file-row ${selectedPath === path ? 'selected' : ''}`} onClick={() => onSelect(path)}>
                                <span className="tree-file-icon">{getFileIcon(f)}</span>
                                <span className="tree-name">{f}</span>
                                <span className="tree-actions">
                                    <button type="button" className="tree-act" title="Rename" onClick={(e) => { e.stopPropagation(); onRename(path); }}>✎</button>
                                    <button type="button" className="tree-act tree-act-del" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(path); }}>✕</button>
                                </span>
                            </li>
                        );
                    })}
                    {creating?.dir === dirPrefix && creating.type === 'file' && (
                        <InlineNameInput
                            placeholder="file name (.py, .sh, .js…)"
                            onCommit={(name) => commitCreate(dirPrefix, name, false)}
                            onCancel={cancelCreate}
                        />
                    )}
                </ul>
            )}
        </li>
    );
}

function getFileIcon(name) {
    const ext = name.match(/\.[^.]+$/)?.[0]?.toLowerCase();
    if (['.py'].includes(ext)) return '🐍';
    if (['.sh', '.bash', '.zsh'].includes(ext)) return '🔧';
    if (['.js', '.mjs', '.cjs', '.jsx'].includes(ext)) return '📜';
    if (['.ts', '.tsx'].includes(ext)) return '📜';
    if (['.json'].includes(ext)) return '⚙️';
    if (['.md', '.markdown'].includes(ext)) return '📝';
    if (['.html', '.htm'].includes(ext)) return '🌐';
    if (['.css', '.scss'].includes(ext)) return '🎨';
    return '📄';
}

export function SkillFileEditor({ files, setFiles }) {
    const [selectedPath, setSelectedPath] = useState(null);
    // The directory new files/folders are created into ('' = skill root).
    const [selectedDir, setSelectedDir] = useState('');
    const [expanded, setExpanded] = useState(new Set(['']));
    const [renamingPath, setRenamingPath] = useState(null);
    // creating is null | { dir: string, type: 'file' | 'folder' }
    const [creating, setCreating] = useState(null);
    const [reading, setReading] = useState(false);

    const tree = useMemo(() => buildTree(files), [files]);
    // Real, user-visible files (a folder's .gitkeep placeholder doesn't count).
    const sortedPaths = Object.keys(files).filter((p) => !p.endsWith(`/${GITKEEP}`)).sort();
    const selected = selectedPath ? files[selectedPath] : null;
    const isTextFile = selected && selected.encoding === 'text';

    function setExpandedFn(dirPrefix) {
        const next = new Set(expanded);
        next.has(dirPrefix) ? next.delete(dirPrefix) : next.add(dirPrefix);
        setExpanded(next);
    }

    function ensureExpanded(dir) {
        const next = new Set(expanded);
        next.add('');
        if (dir) {
            const parts = dir.split('/');
            let prefix = '';
            for (const p of parts) {
                prefix = prefix ? `${prefix}/${p}` : p;
                next.add(prefix);
            }
        }
        setExpanded(next);
    }

    function updateFile(path, updater) {
        setFiles((prev) => {
            const next = { ...prev };
            next[path] = { ...next[path], ...updater };
            return next;
        });
    }

    function selectFile(path) {
        setSelectedPath(path);
        setSelectedDir(path.includes('/') ? path.split('/').slice(0, -1).join('/') : '');
    }

    function startCreate(type) {
        const parentDir = selectedDir || '';
        ensureExpanded(parentDir);
        setCreating({ dir: parentDir, type });
    }

    function commitCreate(dir, name, isFolder) {
        name = name.trim();
        setCreating(null);
        if (!name) return;
        const fullPath = dir ? `${dir}/${name}` : name;

        if (isFolder) {
            // Drop a .gitkeep so the empty folder survives a save; it's hidden
            // in the tree and removed automatically once a real file is added.
            const keep = `${fullPath}/${GITKEEP}`;
            setFiles((prev) => (
                prev[keep] !== undefined
                    ? prev
                    : { ...prev, [keep]: { encoding: 'text', data: '', executable: false } }
            ));
            ensureExpanded(fullPath);
            setSelectedDir(fullPath); // new files now land inside the new folder
        } else {
            if (files[fullPath] !== undefined) return;
            setFiles((prev) => {
                const next = { ...prev, [fullPath]: { encoding: 'text', data: '', executable: false } };
                pruneAncestorKeeps(next, fullPath);
                return next;
            });
            ensureExpanded(dir);
            setSelectedPath(fullPath);
            setSelectedDir(dir);
        }
    }

    function cancelCreate() {
        setCreating(null);
    }

    function startRename(path) {
        setRenamingPath(path);
    }

    function commitRename(oldPath, newName) {
        newName = newName.trim();
        setRenamingPath(null);
        if (!newName) return;
        const dir = oldPath.includes('/') ? oldPath.split('/').slice(0, -1).join('/') : '';
        const newPath = dir ? `${dir}/${newName}` : newName;
        if (newPath === oldPath || files[newPath] !== undefined) return;
        setFiles((prev) => {
            const next = {};
            for (const [k, v] of Object.entries(prev)) {
                if (k === oldPath) next[newPath] = v;
                else next[k] = v;
            }
            return next;
        });
        if (selectedPath === oldPath) setSelectedPath(newPath);
    }

    function cancelRename() {
        setRenamingPath(null);
    }

    function deleteFile(path) {
        setFiles((prev) => {
            const next = { ...prev };
            delete next[path];
            return next;
        });
        if (selectedPath === path) setSelectedPath(null);
    }

    function toggleExecutable(path) {
        if (files[path].encoding === 'base64') return;
        updateFile(path, { executable: !files[path].executable });
    }

    async function onPick(e) {
        const picked = Array.from(e.target.files || []);
        e.target.value = '';
        if (!picked.length) return;
        setReading(true);
        try {
            const updates = {};
            for (const file of picked) {
                const rel = relativePath(file);
                if (shouldSkip(rel)) continue;
                const bytes = new Uint8Array(await file.arrayBuffer());
                const text = decodeText(bytes);
                if (text !== null) {
                    updates[rel] = { encoding: 'text', data: text, executable: text.startsWith('#!') };
                } else {
                    updates[rel] = { encoding: 'base64', data: bytesToBase64(bytes), executable: false };
                }
            }
            if (Object.keys(updates).length) {
                setFiles((prev) => {
                    const next = { ...prev, ...updates };
                    for (const rel of Object.keys(updates)) pruneAncestorKeeps(next, rel);
                    return next;
                });
            }
        } finally {
            setReading(false);
        }
    }

    return (
        <div className="skill-editor">
            <div className="skill-editor-sidebar">
                <div className="skill-editor-tree-header">
                    <span className="skill-editor-tree-title">Files ({sortedPaths.length})</span>
                    <button type="button" className="btn btn-secondary btn-sm" title="New file" onClick={() => startCreate('file')}>+ File</button>
                    <button type="button" className="btn btn-secondary btn-sm" title="New folder" onClick={() => startCreate('folder')}>+ Folder</button>
                    <input type="file" id="skill-file-input" multiple onChange={onPick} hidden />
                    <label htmlFor="skill-file-input" className="btn btn-secondary btn-sm">⬆ Upload</label>
                    <input type="file" id="skill-folder-input" webkitdirectory="" directory="" onChange={onPick} hidden />
                    <label htmlFor="skill-folder-input" className="btn btn-secondary btn-sm">📁</label>
                </div>

                <div className="skill-editor-tree">
                    {Object.keys(files).length === 0 && creating === null ? (
                        <div className="skill-editor-empty">
                            <p>No files yet.</p>
                            <p className="skill-editor-empty-hint">
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => startCreate('file')}>+ New File</button>
                                {' '}
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => startCreate('folder')}>+ Folder</button>
                            </p>
                        </div>
                    ) : (
                        <ul className="tree-root">
                            <TreeNode
                                name="skill"
                                node={tree}
                                dirPrefix=""
                                depth={0}
                                selectedPath={selectedPath}
                                onSelect={selectFile}
                                selectedDir={selectedDir}
                                onSelectDir={setSelectedDir}
                                expanded={expanded}
                                setExpanded={setExpandedFn}
                                onDelete={deleteFile}
                                onRename={startRename}
                                renamingPath={renamingPath}
                                commitRename={commitRename}
                                cancelRename={cancelRename}
                                creating={creating}
                                commitCreate={commitCreate}
                                cancelCreate={cancelCreate}
                            />
                        </ul>
                    )}
                </div>
            </div>

            <div className="skill-editor-main">
                {!selectedPath ? (
                    <div className="skill-editor-no-selection">
                        {sortedPaths.length === 0
                            ? 'Create or upload a file to start editing.'
                            : 'Select a file to view or edit its contents.'}
                    </div>
                ) : (
                    <div className="skill-editor-file-panel">
                        <div className="skill-editor-file-header">
                            <code className="skill-editor-file-path">{selectedPath}</code>
                            <span className="md-label-hint">
                                ({fileSize(selected)}{selected.encoding === 'base64' ? ', binary' : ''})
                            </span>
                            <label className="skill-exec-toggle" title="Keep the executable bit when synced">
                                <input
                                    type="checkbox"
                                    checked={!!selected.executable}
                                    onChange={() => toggleExecutable(selectedPath)}
                                    disabled={selected.encoding === 'base64'}
                                />{' '}exec
                            </label>
                            <span className="skill-editor-file-spacer" />
                            <button type="button" className="btn btn-ghost btn-sm" title="Rename" onClick={() => startRename(selectedPath)}>✎ Rename</button>
                            <button type="button" className="btn btn-ghost btn-sm" title="Delete" onClick={() => deleteFile(selectedPath)}>🗑 Delete</button>
                        </div>
                        {isTextFile ? (
                            <MonacoEditor
                                path={selectedPath}
                                value={selected.data}
                                onChange={(text) => updateFile(selectedPath, { data: text })}
                                minHeight={360}
                            />
                        ) : (
                            <div className="skill-editor-binary-hint">
                                Binary file ({fileSize(selected)}) — can't edit inline.
                                Toggle the exec bit, or delete and re-upload to replace.
                            </div>
                        )}
                    </div>
                )}
                {reading && <p className="md-label-hint">reading files…</p>}
            </div>
        </div>
    );
}
