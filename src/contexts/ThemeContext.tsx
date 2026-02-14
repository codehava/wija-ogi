// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Theme Context
// Provides visual theme switching (Klasik / Nusantara)
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'klasik' | 'nusantara';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('klasik');

    // Load theme from localStorage on mount — sets attribute immediately
    useEffect(() => {
        const savedTheme = localStorage.getItem('wija-theme') as Theme | null;
        if (savedTheme && (savedTheme === 'klasik' || savedTheme === 'nusantara')) {
            setThemeState(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            document.documentElement.setAttribute('data-theme', 'klasik');
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('wija-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    // IMPORTANT: Always render children — never return null.
    // Returning null would unmount QueryProvider/AuthProvider and lose all cached data.
    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

// Theme Selector Component — pill-style switcher
export function ThemeSelector({ className = '' }: { className?: string }) {
    const { theme, setTheme } = useTheme();

    return (
        <div className={`flex gap-1 bg-white/10 rounded-lg p-1 ${className}`}>
            <button
                onClick={() => setTheme('klasik')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${theme === 'klasik'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
            >
                🎨 Klasik
            </button>
            <button
                onClick={() => setTheme('nusantara')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${theme === 'nusantara'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
            >
                ✨ Nusantara
            </button>
        </div>
    );
}
