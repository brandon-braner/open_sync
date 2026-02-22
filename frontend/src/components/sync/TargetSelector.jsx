import { colorFor, labelFor } from '../../colors';

export function TargetSelector({ targets, selected, onToggle }) {
    const hasCategoryField = targets.some((t) => t.category);
    const hasNativeField = targets.some((t) => t.native !== undefined);

    const categoryMeta = {
        editor: { label: 'Editors & IDEs', icon: '🖥️' },
        desktop: { label: 'Desktop Apps', icon: '💻' },
        cli: { label: 'CLI Tools', icon: '⌨️' },
        plugin: { label: 'Editor Plugins', icon: '🧩' },
    };
    const categoryOrder = ['editor', 'desktop', 'cli', 'plugin'];

    const nativeMeta = {
        native: { label: 'Native Support', icon: '⭐' },
        embedded: { label: 'Embedded in Config', icon: '📝' },
    };
    const nativeOrder = ['native', 'embedded'];

    const renderItem = (t) => {
        const key = t.id ?? t.name;
        const disabled = t.config_exists === false;
        return (
            <label key={key} className={`target-item${disabled ? ' disabled' : ''}`}>
                <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => onToggle(key)}
                    disabled={disabled}
                />
                <span
                    className="target-dot"
                    style={{ background: t.color || colorFor(t.name || t.id) }}
                />
                <div className="target-info">
                    <div className="label">{t.display_name}</div>
                    <div className="meta">
                        {t.config_exists !== undefined
                            ? (t.config_exists
                                ? `${t.server_count} item${t.server_count !== 1 ? 's' : ''}`
                                : 'config not found')
                            : (t.config_path || '')}
                    </div>
                </div>
            </label>
        );
    };

    if (hasCategoryField) {
        const groups = {};
        targets.forEach((t) => {
            const cat = t.category || 'editor';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(t);
        });
        return (
            <div className="target-categories">
                {categoryOrder.filter((cat) => groups[cat]?.length).map((cat) => (
                    <div key={cat} className="target-category-group">
                        <div className="target-category-label">
                            <span>{categoryMeta[cat]?.icon}</span>
                            <span>{categoryMeta[cat]?.label || cat}</span>
                        </div>
                        {groups[cat].map(renderItem)}
                    </div>
                ))}
            </div>
        );
    }

    if (hasNativeField) {
        const groups = { native: [], embedded: [] };
        targets.forEach((t) => {
            const isNative = t.native === 'true' || t.native === true;
            groups[isNative ? 'native' : 'embedded'].push(t);
        });
        return (
            <div className="target-categories">
                {nativeOrder.filter((g) => groups[g]?.length).map((g) => (
                    <div key={g} className="target-category-group">
                        <div className="target-category-label">
                            <span>{nativeMeta[g].icon}</span>
                            <span>{nativeMeta[g].label}</span>
                        </div>
                        {groups[g].map(renderItem)}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="target-categories">
            <div className="target-category-group">
                {targets.map(renderItem)}
            </div>
        </div>
    );
}
