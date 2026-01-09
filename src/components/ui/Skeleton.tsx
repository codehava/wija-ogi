// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Skeleton Loading Component
// ═══════════════════════════════════════════════════════════════════════════════

import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rectangular' | 'card';
    width?: string | number;
    height?: string | number;
    lines?: number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
    ({ variant = 'rectangular', width, height, lines = 1, className, ...props }, ref) => {
        const baseStyles = 'skeleton';

        const variantStyles = {
            text: 'h-4 rounded',
            circular: 'rounded-full',
            rectangular: 'rounded-lg',
            card: 'rounded-xl'
        };

        const getSize = () => {
            const w = typeof width === 'number' ? `${width}px` : width;
            const h = typeof height === 'number' ? `${height}px` : height;
            return { width: w, height: h };
        };

        if (variant === 'text' && lines > 1) {
            return (
                <div ref={ref} className={clsx('space-y-2', className)} {...props}>
                    {Array.from({ length: lines }).map((_, i) => (
                        <div
                            key={i}
                            className={clsx(baseStyles, variantStyles.text)}
                            style={{
                                ...getSize(),
                                width: i === lines - 1 ? '75%' : width
                            }}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div
                ref={ref}
                className={clsx(baseStyles, variantStyles[variant], className)}
                style={getSize()}
                {...props}
            />
        );
    }
);

Skeleton.displayName = 'Skeleton';

// Skeleton Card - Pre-built skeleton for family cards
export const SkeletonCard = () => (
    <div className="p-5 rounded-xl glass">
        <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
                <Skeleton variant="text" width="70%" height={20} className="mb-2" />
                <Skeleton variant="text" width="50%" height={14} />
            </div>
            <Skeleton variant="circular" width={40} height={40} />
        </div>
        <div className="flex gap-4">
            <Skeleton variant="text" width={80} height={14} />
            <Skeleton variant="text" width={60} height={14} />
        </div>
    </div>
);
