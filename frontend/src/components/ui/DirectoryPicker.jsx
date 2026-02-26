import { useState } from 'react';
import { api } from '../../api';

export function DirectoryPicker({ value, onChange }) {
    const [picking, setPicking] = useState(false);

    const handlePick = async () => {
        setPicking(true);
        try {
            const result = await api.pickDirectory();
            if (result.path) {
                onChange(result.path);
            }
        } catch {
            // Picker failed or not available — user can still type manually
        } finally {
            setPicking(false);
        }
    };

    return (
        <div className="dir-picker-wrap">
            <input
                type="text"
                className="dir-path-input"
                placeholder="~/code/my-project"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handlePick}
                disabled={picking}
                title="Open folder picker"
            >
                {picking ? '⏳' : '📂'}
            </button>
        </div>
    );
}
