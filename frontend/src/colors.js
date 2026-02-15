/**
 * Target colour and label mappings.
 *
 * Target names now include scope suffixes (e.g. "claude_code_global",
 * "vscode_project"). We extract the base target for colour/label lookup.
 */

const TARGET_COLORS = {
    claude_desktop: '#D97757',
    claude_code: '#D97757',
    antigravity: '#4285F4',
    vscode: '#007ACC',
    gemini_cli: '#0F9D58',
    opencode: '#FF6B6B',
    copilot_cli: '#6E40C9',
    jetbrains: '#FC801D',
};

const TARGET_LABELS = {
    claude_desktop: 'Claude Desktop',
    claude_code: 'Claude Code',
    antigravity: 'Antigravity',
    vscode: 'VS Code',
    gemini_cli: 'Gemini CLI',
    opencode: 'OpenCode',
    copilot_cli: 'Copilot CLI',
    jetbrains: 'JetBrains',
};

/** Strip _global or _project suffix to get underlying target. */
function baseTarget(name) {
    return name.replace(/_(global|project)$/, '');
}

export function colorFor(targetName) {
    return TARGET_COLORS[baseTarget(targetName)] || '#888888';
}

export function labelFor(targetName) {
    return TARGET_LABELS[baseTarget(targetName)] || targetName;
}
