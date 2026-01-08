// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Searchable Select Component
// Dropdown with search/filter capability
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

export interface SearchableSelectOption {
    value: string;
    label: string;
}

export interface SearchableSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    error?: string;
}

export function SearchableSelect({
    label,
    value,
    onChange,
    options,
    placeholder = 'Pilih atau ketik untuk mencari...',
    disabled = false,
    error
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get selected option label
    const selectedOption = options.find(o => o.value === value);

    // Filter options based on search
    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    // Sort options alphabetically
    const sortedOptions = [...filteredOptions].sort((a, b) =>
        a.label.localeCompare(b.label, 'id')
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearch('');
    };

    const handleInputFocus = () => {
        setIsOpen(true);
        setSearch('');
    };

    return (
        <div ref={containerRef} className="relative">
            {label && (
                <label className="block text-sm font-medium text-stone-700 mb-1">
                    {label}
                </label>
            )}

            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? search : (selectedOption?.label || '')}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={clsx(
                        'w-full px-4 py-2.5 pr-10 rounded-lg border bg-white text-stone-800',
                        'focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none',
                        'transition-all duration-200',
                        error ? 'border-red-300' : 'border-stone-300',
                        disabled && 'bg-stone-50 cursor-not-allowed'
                    )}
                />

                {/* Dropdown arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {/* Clear button */}
                {value && !isOpen && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {sortedOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-stone-500 text-center">
                            Tidak ditemukan
                        </div>
                    ) : (
                        sortedOptions.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={clsx(
                                    'w-full px-4 py-2.5 text-left text-sm hover:bg-teal-50 transition',
                                    option.value === value && 'bg-teal-100 text-teal-700 font-medium'
                                )}
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>
            )}

            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
}

export default SearchableSelect;
