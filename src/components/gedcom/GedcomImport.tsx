'use client';

import { useState, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ValidationSummary {
    totalRecords: number;
    persons: number;
    families: number;
    sources: number;
}

interface ImportResult {
    message: string;
    treeId: string;
    personsCount: number;
    familiesCount: number;
    relationshipsCount: number;
}

type ImportStep = 'select' | 'validating' | 'preview' | 'importing' | 'done' | 'error';

interface GedcomImportProps {
    treeId?: string;        // If provided, import into existing tree
    treeName?: string;      // Default name for new tree
    onImportComplete?: (result: ImportResult) => void;
    onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

export default function GedcomImport({ treeId, treeName, onImportComplete, onClose }: GedcomImportProps) {
    const [step, setStep] = useState<ImportStep>('select');
    const [file, setFile] = useState<File | null>(null);
    const [summary, setSummary] = useState<ValidationSummary | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string>('');
    const [newTreeName, setNewTreeName] = useState(treeName || '');
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── File selection ──
    const handleFileSelect = useCallback(async (selectedFile: File) => {
        if (!selectedFile.name.toLowerCase().endsWith('.ged')) {
            setError('Please select a .ged file');
            setStep('error');
            return;
        }

        setFile(selectedFile);
        setStep('validating');
        setError('');

        // Auto-set tree name from filename
        if (!newTreeName) {
            setNewTreeName(selectedFile.name.replace(/\.ged$/i, ''));
        }

        // Validate the file
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const res = await fetch('/api/gedcom/validate', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.valid) {
                setSummary(data.summary);
                setStep('preview');
            } else {
                setError(data.error || 'Invalid GEDCOM file');
                setStep('error');
            }
        } catch {
            setError('Failed to validate file');
            setStep('error');
        }
    }, [newTreeName]);

    // ── Drag & Drop ──
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    }, [handleFileSelect]);

    // ── Import ──
    const handleImport = useCallback(async () => {
        if (!file) return;

        setStep('importing');
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('treeName', newTreeName || 'Imported Tree');
            if (treeId) {
                formData.append('treeId', treeId);
            }

            const res = await fetch('/api/gedcom/import', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Import failed');
            }

            const data: ImportResult = await res.json();
            setResult(data);
            setStep('done');
            onImportComplete?.(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
            setStep('error');
        }
    }, [file, newTreeName, treeId, onImportComplete]);

    // ── Reset ──
    const handleReset = useCallback(() => {
        setStep('select');
        setFile(null);
        setSummary(null);
        setResult(null);
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    // ── Render ──
    return (
        <div className="gedcom-import">
            <div className="gedcom-import__header">
                <h3>Import GEDCOM File</h3>
                {onClose && (
                    <button
                        className="gedcom-import__close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Step 1: File Selection */}
            {step === 'select' && (
                <div
                    className={`gedcom-import__dropzone ${isDragging ? 'gedcom-import__dropzone--active' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="gedcom-import__dropzone-icon">📁</div>
                    <p className="gedcom-import__dropzone-text">
                        Drag & drop your <strong>.ged</strong> file here
                    </p>
                    <p className="gedcom-import__dropzone-subtext">
                        or click to browse
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".ged"
                        onChange={handleInputChange}
                        className="gedcom-import__file-input"
                    />
                </div>
            )}

            {/* Step 2: Validating */}
            {step === 'validating' && (
                <div className="gedcom-import__status">
                    <div className="gedcom-import__spinner" />
                    <p>Validating GEDCOM file...</p>
                </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && summary && (
                <div className="gedcom-import__preview">
                    <div className="gedcom-import__file-info">
                        <span className="gedcom-import__file-icon">📄</span>
                        <span className="gedcom-import__file-name">{file?.name}</span>
                    </div>

                    <div className="gedcom-import__summary">
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{summary.persons}</span>
                            <span className="gedcom-import__stat-label">Persons</span>
                        </div>
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{summary.families}</span>
                            <span className="gedcom-import__stat-label">Families</span>
                        </div>
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{summary.sources}</span>
                            <span className="gedcom-import__stat-label">Sources</span>
                        </div>
                    </div>

                    {!treeId && (
                        <div className="gedcom-import__name-field">
                            <label htmlFor="treeName">Tree Name</label>
                            <input
                                id="treeName"
                                type="text"
                                value={newTreeName}
                                onChange={(e) => setNewTreeName(e.target.value)}
                                placeholder="Enter a name for this family tree"
                            />
                        </div>
                    )}

                    <div className="gedcom-import__actions">
                        <button
                            className="gedcom-import__btn gedcom-import__btn--secondary"
                            onClick={handleReset}
                        >
                            Cancel
                        </button>
                        <button
                            className="gedcom-import__btn gedcom-import__btn--primary"
                            onClick={handleImport}
                        >
                            Import {summary.persons} Persons
                        </button>
                    </div>
                </div>
            )}

            {/* Step 4: Importing */}
            {step === 'importing' && (
                <div className="gedcom-import__status">
                    <div className="gedcom-import__spinner" />
                    <p>Importing GEDCOM data...</p>
                    <p className="gedcom-import__status-sub">
                        This may take a moment for large files.
                    </p>
                </div>
            )}

            {/* Step 5: Done */}
            {step === 'done' && result && (
                <div className="gedcom-import__result">
                    <div className="gedcom-import__result-icon">✅</div>
                    <h4>Import Complete!</h4>
                    <div className="gedcom-import__summary">
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{result.personsCount}</span>
                            <span className="gedcom-import__stat-label">Persons</span>
                        </div>
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{result.familiesCount}</span>
                            <span className="gedcom-import__stat-label">Families</span>
                        </div>
                        <div className="gedcom-import__stat">
                            <span className="gedcom-import__stat-value">{result.relationshipsCount}</span>
                            <span className="gedcom-import__stat-label">Relationships</span>
                        </div>
                    </div>
                    <button
                        className="gedcom-import__btn gedcom-import__btn--primary"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            )}

            {/* Error State */}
            {step === 'error' && (
                <div className="gedcom-import__error">
                    <div className="gedcom-import__error-icon">⚠️</div>
                    <p>{error}</p>
                    <button
                        className="gedcom-import__btn gedcom-import__btn--secondary"
                        onClick={handleReset}
                    >
                        Try Again
                    </button>
                </div>
            )}

            <style jsx>{`
                .gedcom-import {
                    background: var(--bg-surface, #fff);
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 480px;
                    width: 100%;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                }
                .gedcom-import__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .gedcom-import__header h3 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 600;
                }
                .gedcom-import__close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1.2rem;
                    color: var(--text-secondary, #666);
                    padding: 4px 8px;
                    border-radius: 6px;
                }
                .gedcom-import__close:hover {
                    background: var(--bg-hover, #f0f0f0);
                }
                .gedcom-import__dropzone {
                    border: 2px dashed var(--border-color, #d0d0d0);
                    border-radius: 12px;
                    padding: 48px 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .gedcom-import__dropzone:hover,
                .gedcom-import__dropzone--active {
                    border-color: var(--primary, #3b82f6);
                    background: var(--bg-primary-light, rgba(59, 130, 246, 0.04));
                }
                .gedcom-import__dropzone-icon {
                    font-size: 2.5rem;
                    margin-bottom: 12px;
                }
                .gedcom-import__dropzone-text {
                    margin: 0 0 4px;
                    font-size: 1rem;
                    color: var(--text-primary, #333);
                }
                .gedcom-import__dropzone-subtext {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--text-secondary, #888);
                }
                .gedcom-import__file-input {
                    display: none;
                }
                .gedcom-import__status {
                    text-align: center;
                    padding: 32px;
                }
                .gedcom-import__spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid var(--border-color, #e0e0e0);
                    border-top-color: var(--primary, #3b82f6);
                    border-radius: 50%;
                    margin: 0 auto 16px;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .gedcom-import__status-sub {
                    font-size: 0.85rem;
                    color: var(--text-secondary, #888);
                }
                .gedcom-import__preview {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .gedcom-import__file-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 14px;
                    background: var(--bg-muted, #f5f5f5);
                    border-radius: 8px;
                    font-size: 0.9rem;
                }
                .gedcom-import__file-icon {
                    font-size: 1.3rem;
                }
                .gedcom-import__file-name {
                    font-weight: 500;
                    word-break: break-all;
                }
                .gedcom-import__summary {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                .gedcom-import__stat {
                    text-align: center;
                    padding: 12px;
                    background: var(--bg-muted, #f8f8f8);
                    border-radius: 8px;
                }
                .gedcom-import__stat-value {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--primary, #3b82f6);
                }
                .gedcom-import__stat-label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-secondary, #888);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-top: 2px;
                }
                .gedcom-import__name-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .gedcom-import__name-field label {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text-secondary, #666);
                }
                .gedcom-import__name-field input {
                    padding: 10px 14px;
                    border: 1px solid var(--border-color, #d0d0d0);
                    border-radius: 8px;
                    font-size: 0.95rem;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .gedcom-import__name-field input:focus {
                    border-color: var(--primary, #3b82f6);
                }
                .gedcom-import__actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                .gedcom-import__btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .gedcom-import__btn--primary {
                    background: var(--primary, #3b82f6);
                    color: #fff;
                }
                .gedcom-import__btn--primary:hover {
                    background: var(--primary-dark, #2563eb);
                }
                .gedcom-import__btn--secondary {
                    background: var(--bg-muted, #f0f0f0);
                    color: var(--text-primary, #333);
                }
                .gedcom-import__btn--secondary:hover {
                    background: var(--bg-hover, #e0e0e0);
                }
                .gedcom-import__result {
                    text-align: center;
                    padding: 16px 0;
                }
                .gedcom-import__result-icon {
                    font-size: 2.5rem;
                    margin-bottom: 8px;
                }
                .gedcom-import__result h4 {
                    margin: 0 0 16px;
                    font-size: 1.1rem;
                }
                .gedcom-import__error {
                    text-align: center;
                    padding: 24px;
                }
                .gedcom-import__error-icon {
                    font-size: 2rem;
                    margin-bottom: 8px;
                }
                .gedcom-import__error p {
                    color: var(--text-error, #dc2626);
                    margin: 0 0 16px;
                }
            `}</style>
        </div>
    );
}
