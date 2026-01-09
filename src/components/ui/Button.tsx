// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Button Component
// ═══════════════════════════════════════════════════════════════════════════════

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95';

        const variants = {
            primary: 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 focus:ring-teal-400',
            secondary: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 focus:ring-stone-400',
            danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400',
            ghost: 'text-stone-600 hover:bg-stone-100 focus:ring-stone-400'
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-sm',
            md: 'px-4 py-2 text-base',
            lg: 'px-6 py-3 text-lg'
        };

        return (
            <button
                ref={ref}
                className={clsx(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || loading}
                {...props}
            >
                {loading ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : icon ? (
                    <span className="text-lg">{icon}</span>
                ) : null}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
