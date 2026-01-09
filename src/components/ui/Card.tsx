// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Card Component
// ═══════════════════════════════════════════════════════════════════════════════

import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'outlined' | 'elevated' | 'glass';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ variant = 'default', className, children, ...props }, ref) => {
        const variants = {
            default: 'bg-white border border-stone-200 shadow-md',
            outlined: 'bg-white border-2 border-stone-300',
            elevated: 'bg-white shadow-xl',
            glass: 'glass hover-lift'
        };

        return (
            <div
                ref={ref}
                className={clsx('rounded-xl', variants[variant], className)}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';

// Card Header
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
    gradient?: boolean;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ gradient = false, className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx(
                    'p-4 border-b rounded-t-xl',
                    gradient
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white border-transparent'
                        : 'bg-stone-50 border-stone-200',
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CardHeader.displayName = 'CardHeader';

// Card Body
export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx('p-4', className)}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CardBody.displayName = 'CardBody';

// Card Footer
export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={clsx('p-4 border-t border-stone-200 bg-stone-50 rounded-b-xl', className)}
                {...props}
            >
                {children}
            </div>
        );
    }
);

CardFooter.displayName = 'CardFooter';
