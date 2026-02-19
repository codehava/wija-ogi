'use client';

import React, { useState, useCallback } from 'react';
import {
    LayoutConfig,
    LayoutRules,
    DEFAULT_LAYOUT_CONFIG,
    DEFAULT_LAYOUT_RULES,
} from '@/lib/layout/treeLayout';

// Inline SVG icons (avoid external dependency)
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);
const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);
const SettingsSmallIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

interface LayoutSettingsPanelProps {
    onApply: (config: Partial<LayoutConfig>, rules: Partial<LayoutRules>) => void;
}

interface SliderSetting {
    key: keyof LayoutConfig;
    label: string;
    code: string;
    min: number;
    max: number;
    step: number;
}

const SPACING_SETTINGS: SliderSetting[] = [
    { key: 'rankSep', label: 'Vertical gap (generations)', code: 'L1', min: 40, max: 300, step: 10 },
    { key: 'nodeSep', label: 'Horizontal gap (siblings)', code: 'L2', min: 5, max: 100, step: 5 },
    { key: 'spouseGap', label: 'Spouse gap', code: 'L3', min: 5, max: 60, step: 5 },
    { key: 'margin', label: 'Canvas margin', code: 'L4', min: 10, max: 100, step: 10 },
    { key: 'minGap', label: 'Min collision gap', code: 'L5', min: 5, max: 50, step: 5 },
    { key: 'orphanGap', label: 'Orphan section gap', code: 'L6', min: 20, max: 200, step: 10 },
];

interface RuleSetting {
    key: keyof LayoutRules;
    label: string;
    code: string;
    description: string;
}

const RULE_SETTINGS: RuleSetting[] = [
    { key: 'spouseOrdering', label: 'Spouse ordering', code: 'R2', description: 'Husband-wife layout rules' },
    { key: 'sortByBirthDate', label: 'Sort by birth date', code: 'R3', description: 'Children ordered by age' },
    { key: 'centerParent', label: 'Center parent', code: 'R4', description: 'Parent centered above children' },
    { key: 'overlapResolution', label: 'Overlap fix', code: 'R6', description: 'Resolve node overlap' },
    { key: 'crossLineageGrouping', label: 'Cross-lineage grouping', code: 'R7', description: 'Group related trees' },
];

export default function LayoutSettingsPanel({ onApply }: LayoutSettingsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [config, setConfig] = useState<LayoutConfig>({ ...DEFAULT_LAYOUT_CONFIG });
    const [rules, setRules] = useState<LayoutRules>({ ...DEFAULT_LAYOUT_RULES });

    const handleConfigChange = useCallback((key: keyof LayoutConfig, value: number) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleRuleToggle = useCallback((key: keyof LayoutRules) => {
        setRules(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleApply = useCallback(() => {
        onApply(config, rules);
    }, [config, rules, onApply]);

    const handleReset = useCallback(() => {
        setConfig({ ...DEFAULT_LAYOUT_CONFIG });
        setRules({ ...DEFAULT_LAYOUT_RULES });
        onApply(DEFAULT_LAYOUT_CONFIG, DEFAULT_LAYOUT_RULES);
    }, [onApply]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full shadow-lg border border-zinc-600 transition-colors"
                title="Layout Settings"
            >
                <SettingsIcon />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl text-white text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <SettingsSmallIcon />
                    <span className="font-semibold">Layout Settings</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                        title="Reset to defaults"
                    >
                        <ResetIcon />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                    >
                        {isExpanded ? '▼' : '▲'}
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white ml-1"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Spacing Sliders */}
                    <div>
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Spacing (L1–L6)</h3>
                        <div className="space-y-3">
                            {SPACING_SETTINGS.map(setting => (
                                <div key={setting.key}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-zinc-300">
                                            <span className="text-blue-400 font-mono mr-1">{setting.code}</span>
                                            {setting.label}
                                        </label>
                                        <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                            {config[setting.key]}px
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={setting.min}
                                        max={setting.max}
                                        step={setting.step}
                                        value={config[setting.key]}
                                        onChange={(e) => handleConfigChange(setting.key, parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Rule Toggles */}
                    <div>
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Rules (R2–R7)</h3>
                        <div className="space-y-2">
                            {RULE_SETTINGS.map(setting => (
                                <div
                                    key={setting.key}
                                    className="flex items-center justify-between p-2 rounded-lg bg-zinc-800 hover:bg-zinc-750 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-blue-400 font-mono text-xs">{setting.code}</span>
                                            <span className="text-xs text-zinc-200 truncate">{setting.label}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">{setting.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRuleToggle(setting.key)}
                                        className={`ml-2 relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${rules[setting.key] ? 'bg-blue-500' : 'bg-zinc-600'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${rules[setting.key] ? 'translate-x-4' : 'translate-x-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Button */}
            <div className="px-4 py-3 bg-zinc-800 border-t border-zinc-700">
                <button
                    onClick={handleApply}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors"
                >
                    Apply Layout
                </button>
            </div>
        </div>
    );
}
