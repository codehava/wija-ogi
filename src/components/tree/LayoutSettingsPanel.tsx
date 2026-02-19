'use client';

import React, { useState, useCallback } from 'react';
import {
    LayoutConfig,
    LayoutRules,
    DEFAULT_LAYOUT_CONFIG,
    DEFAULT_LAYOUT_RULES,
} from '@/lib/layout/treeLayout';

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE & VISUAL SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export interface EdgeSettings {
    parentChildColor: string;     // E1: parent→child edge color
    parentChildWidth: number;     // E2: parent→child stroke width
    parentChildOpacity: number;   // E3: parent→child opacity
    spouseColor: string;          // E4: spouse edge color
    spouseWidth: number;          // E5: spouse stroke width
    edgeType: 'default' | 'straight' | 'step' | 'smoothstep'; // E6: edge curve type
    connectorStyle: 'individual' | 'fork' | 'elbow'; // E7: family connector style
    edgeBundling: boolean;        // E8: edge bundling
}

export const DEFAULT_EDGE_SETTINGS: EdgeSettings = {
    parentChildColor: '#0d9488',
    parentChildWidth: 1.8,
    parentChildOpacity: 0.65,
    spouseColor: '#dc2626',
    spouseWidth: 2,
    edgeType: 'default',
    connectorStyle: 'individual',
    edgeBundling: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE SVG ICONS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface SliderSetting {
    key: keyof LayoutConfig;
    label: string;
    code: string;
    min: number;
    max: number;
    step: number;
    unit?: string;
}

const SPACING_SETTINGS: SliderSetting[] = [
    { key: 'rankSep', label: 'Vertical gap (generations)', code: 'L1', min: 40, max: 300, step: 10, unit: 'px' },
    { key: 'nodeSep', label: 'Horizontal gap (siblings)', code: 'L2', min: 5, max: 100, step: 5, unit: 'px' },
    { key: 'spouseGap', label: 'Spouse gap', code: 'L3', min: 5, max: 60, step: 5, unit: 'px' },
    { key: 'margin', label: 'Canvas margin', code: 'L4', min: 10, max: 100, step: 10, unit: 'px' },
    { key: 'minGap', label: 'Min collision gap', code: 'L5', min: 5, max: 50, step: 5, unit: 'px' },
    { key: 'orphanGap', label: 'Orphan section gap', code: 'L6', min: 20, max: 200, step: 10, unit: 'px' },
    { key: 'treeGapMultiplier', label: 'Cross-lineage tree gap', code: 'L7', min: 0.5, max: 5, step: 0.1, unit: '×' },
    { key: 'groupGapMultiplier', label: 'Unrelated group gap', code: 'L8', min: 1, max: 10, step: 0.5, unit: '×' },
];

// Toggle rules (boolean)
interface ToggleRule {
    type: 'toggle';
    key: keyof LayoutRules;
    label: string;
    code: string;
    description: string;
}

// Selector rules (string enum)
interface SelectorRule {
    type: 'selector';
    key: keyof LayoutRules;
    label: string;
    code: string;
    description: string;
    options: { value: string; label: string }[];
}

type RuleSetting = ToggleRule | SelectorRule;

const RULE_SETTINGS: RuleSetting[] = [
    { type: 'toggle', key: 'spouseOrdering', label: 'Spouse ordering', code: 'R2', description: 'Husband-wife layout rules' },
    { type: 'toggle', key: 'sortByBirthDate', label: 'Sort by birth date', code: 'R3', description: 'Children ordered by age' },
    { type: 'toggle', key: 'centerParent', label: 'Center parent', code: 'R4', description: 'Parent centered above children' },
    { type: 'toggle', key: 'largestGroupFirst', label: 'Largest group first', code: 'R5', description: 'Biggest family tree placed first' },
    { type: 'toggle', key: 'overlapResolution', label: 'Overlap fix', code: 'R6', description: 'Resolve node overlap' },
    { type: 'toggle', key: 'crossLineageGrouping', label: 'Cross-lineage grouping', code: 'R7', description: 'Group related trees together' },
    { type: 'toggle', key: 'showOrphans', label: 'Show orphans', code: 'R8', description: 'Show unlinked persons in grid' },
    { type: 'toggle', key: 'normalizePositions', label: 'Normalize positions', code: 'R9', description: 'Shift tree to top-left origin' },
    { type: 'toggle', key: 'compactApportioning', label: 'Compact apportioning', code: 'R10', description: 'Proportionally fill gaps between subtrees' },
    {
        type: 'selector', key: 'cycleBreaking', label: 'Cycle breaking', code: 'R11',
        description: 'Handle cousin/family marriages',
        options: [
            { value: 'off', label: 'Off' },
            { value: 'clone', label: 'Clone Node' },
            { value: 'crosslink', label: 'Cross Link' },
        ],
    },
    {
        type: 'selector', key: 'multiSpouseMode', label: 'Multi-spouse mode', code: 'R12',
        description: 'Spouse ordering strategy',
        options: [
            { value: 'default', label: 'Default' },
            { value: 'chronological', label: 'Chronological' },
            { value: 'childCount', label: 'By Child Count' },
        ],
    },
    {
        type: 'selector', key: 'generationAlignment', label: 'Generation alignment', code: 'R13',
        description: 'Y-level alignment for same generation',
        options: [
            { value: 'strict', label: 'Strict' },
            { value: 'loose', label: 'Loose' },
        ],
    },
];

const EDGE_TYPES = [
    { value: 'default', label: 'Bezier' },
    { value: 'straight', label: 'Straight' },
    { value: 'step', label: 'Step' },
    { value: 'smoothstep', label: 'Smooth Step' },
] as const;

const CONNECTOR_STYLES = [
    { value: 'individual', label: 'Individual' },
    { value: 'fork', label: 'Fork' },
    { value: 'elbow', label: 'Elbow' },
] as const;

const COLOR_PRESETS = [
    '#0d9488', '#3b82f6', '#8b5cf6', '#6b7280', '#059669', '#d97706', '#dc2626', '#000000',
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface LayoutSettingsPanelProps {
    onApply: (config: Partial<LayoutConfig>, rules: Partial<LayoutRules>, edgeSettings: EdgeSettings) => void;
}

type TabId = 'spacing' | 'rules' | 'edges';

export default function LayoutSettingsPanel({ onApply }: LayoutSettingsPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('spacing');
    const [config, setConfig] = useState<LayoutConfig>({ ...DEFAULT_LAYOUT_CONFIG });
    const [rules, setRules] = useState<LayoutRules>({ ...DEFAULT_LAYOUT_RULES });
    const [edgeSettings, setEdgeSettings] = useState<EdgeSettings>({ ...DEFAULT_EDGE_SETTINGS });

    const handleConfigChange = useCallback((key: keyof LayoutConfig, value: number) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleRuleToggle = useCallback((key: keyof LayoutRules) => {
        setRules(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleRuleSelect = useCallback((key: keyof LayoutRules, value: string) => {
        setRules(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleEdgeChange = useCallback(<K extends keyof EdgeSettings>(key: K, value: EdgeSettings[K]) => {
        setEdgeSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleApply = useCallback(() => {
        onApply(config, rules, edgeSettings);
    }, [config, rules, edgeSettings, onApply]);

    const handleReset = useCallback(() => {
        setConfig({ ...DEFAULT_LAYOUT_CONFIG });
        setRules({ ...DEFAULT_LAYOUT_RULES });
        setEdgeSettings({ ...DEFAULT_EDGE_SETTINGS });
        onApply(DEFAULT_LAYOUT_CONFIG, DEFAULT_LAYOUT_RULES, DEFAULT_EDGE_SETTINGS);
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

    const tabs: { id: TabId; label: string; count: number }[] = [
        { id: 'spacing', label: 'Spacing', count: SPACING_SETTINGS.length },
        { id: 'rules', label: 'Rules', count: RULE_SETTINGS.length },
        { id: 'edges', label: 'Edges', count: 8 },
    ];

    return (
        <div className="fixed bottom-4 left-4 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl text-white text-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-800 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <SettingsSmallIcon />
                    <span className="font-semibold text-sm">Layout Settings</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleReset}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
                        title="Reset all to defaults"
                    >
                        <ResetIcon />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white ml-1"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-700">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50'
                                : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {tab.label}
                        <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-3 max-h-[55vh] overflow-y-auto">

                {/* ─── SPACING TAB ─── */}
                {activeTab === 'spacing' && (
                    <div className="space-y-3">
                        {SPACING_SETTINGS.map(setting => (
                            <div key={setting.key}>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-zinc-300">
                                        <span className="text-blue-400 font-mono mr-1">{setting.code}</span>
                                        {setting.label}
                                    </label>
                                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {setting.unit === '×'
                                            ? `×${(config[setting.key] as number).toFixed(1)}`
                                            : `${config[setting.key]}px`
                                        }
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={setting.min}
                                    max={setting.max}
                                    step={setting.step}
                                    value={config[setting.key]}
                                    onChange={(e) => handleConfigChange(setting.key, parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── RULES TAB ─── */}
                {activeTab === 'rules' && (
                    <div className="space-y-1.5">
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

                                {setting.type === 'toggle' ? (
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
                                ) : (
                                    <select
                                        value={rules[setting.key] as string}
                                        onChange={(e) => handleRuleSelect(setting.key, e.target.value)}
                                        className="ml-2 bg-zinc-700 border border-zinc-600 rounded-md px-2 py-1 text-xs text-zinc-200 flex-shrink-0 outline-none focus:border-blue-500"
                                    >
                                        {setting.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── EDGES TAB ─── */}
                {activeTab === 'edges' && (
                    <div className="space-y-4">
                        {/* Edge Type (E6) */}
                        <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                <span className="text-blue-400 font-mono mr-1">E6</span>Edge Type
                            </h3>
                            <div className="grid grid-cols-2 gap-1.5">
                                {EDGE_TYPES.map(et => (
                                    <button
                                        key={et.value}
                                        onClick={() => handleEdgeChange('edgeType', et.value as EdgeSettings['edgeType'])}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${edgeSettings.edgeType === et.value
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-500'
                                            }`}
                                    >
                                        {et.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Connector Style (E7) */}
                        <div className="pt-2 border-t border-zinc-700">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                <span className="text-blue-400 font-mono mr-1">E7</span>Family Connector
                            </h3>
                            <div className="grid grid-cols-3 gap-1.5">
                                {CONNECTOR_STYLES.map(cs => (
                                    <button
                                        key={cs.value}
                                        onClick={() => handleEdgeChange('connectorStyle', cs.value as EdgeSettings['connectorStyle'])}
                                        className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${edgeSettings.connectorStyle === cs.value
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-500'
                                            }`}
                                    >
                                        {cs.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Edge Bundling (E8) */}
                        <div className="pt-2 border-t border-zinc-700">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-blue-400 font-mono text-xs">E8</span>
                                        <span className="text-xs text-zinc-200">Edge Bundling</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">Merge nearby edges to reduce clutter</p>
                                </div>
                                <button
                                    onClick={() => handleEdgeChange('edgeBundling', !edgeSettings.edgeBundling)}
                                    className={`ml-2 relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${edgeSettings.edgeBundling ? 'bg-blue-500' : 'bg-zinc-600'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${edgeSettings.edgeBundling ? 'translate-x-4' : 'translate-x-0.5'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Parent-Child Edges */}
                        <div className="pt-2 border-t border-zinc-700">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Parent → Child</h3>

                            {/* Color */}
                            <div className="mb-2">
                                <label className="text-xs text-zinc-300 mb-1 block">
                                    <span className="text-blue-400 font-mono mr-1">E1</span>Color
                                </label>
                                <div className="flex gap-1.5 items-center flex-wrap">
                                    {COLOR_PRESETS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleEdgeChange('parentChildColor', color)}
                                            className={`w-5 h-5 rounded-full border-2 transition-transform ${edgeSettings.parentChildColor === color ? 'border-white scale-125' : 'border-zinc-600'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={edgeSettings.parentChildColor}
                                        onChange={(e) => handleEdgeChange('parentChildColor', e.target.value)}
                                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* Width + Opacity */}
                            <div className="mb-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-zinc-300">
                                        <span className="text-blue-400 font-mono mr-1">E2</span>Width
                                    </label>
                                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {edgeSettings.parentChildWidth.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range" min={0.5} max={5} step={0.1}
                                    value={edgeSettings.parentChildWidth}
                                    onChange={(e) => handleEdgeChange('parentChildWidth', parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-zinc-300">
                                        <span className="text-blue-400 font-mono mr-1">E3</span>Opacity
                                    </label>
                                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {(edgeSettings.parentChildOpacity * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <input
                                    type="range" min={0.05} max={1} step={0.05}
                                    value={edgeSettings.parentChildOpacity}
                                    onChange={(e) => handleEdgeChange('parentChildOpacity', parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>

                        {/* Spouse Edges */}
                        <div className="pt-2 border-t border-zinc-700">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Spouse ↔ Spouse</h3>

                            {/* Color */}
                            <div className="mb-2">
                                <label className="text-xs text-zinc-300 mb-1 block">
                                    <span className="text-blue-400 font-mono mr-1">E4</span>Color
                                </label>
                                <div className="flex gap-1.5 items-center flex-wrap">
                                    {COLOR_PRESETS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleEdgeChange('spouseColor', color)}
                                            className={`w-5 h-5 rounded-full border-2 transition-transform ${edgeSettings.spouseColor === color ? 'border-white scale-125' : 'border-zinc-600'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={edgeSettings.spouseColor}
                                        onChange={(e) => handleEdgeChange('spouseColor', e.target.value)}
                                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                                    />
                                </div>
                            </div>

                            {/* Width */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-zinc-300">
                                        <span className="text-blue-400 font-mono mr-1">E5</span>Width
                                    </label>
                                    <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {edgeSettings.spouseWidth.toFixed(1)}
                                    </span>
                                </div>
                                <input
                                    type="range" min={0.5} max={5} step={0.1}
                                    value={edgeSettings.spouseWidth}
                                    onChange={(e) => handleEdgeChange('spouseWidth', parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

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
