// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Modal Component
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, ReactNode } from 'react';
import { clsx } from 'clsx';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    showCloseButton?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true
}: ModalProps) {
    // Handle escape key
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
            onClose();
        }
    }, [closeOnEscape, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
        full: 'max-w-[95vw]'
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={closeOnBackdrop ? onClose : undefined}
            />

            {/* Modal Content */}
            <div
                className={clsx(
                    'relative w-full bg-white rounded-2xl shadow-2xl animate-slide-up',
                    'max-h-[90vh] overflow-hidden flex flex-col',
                    sizes[size]
                )}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-t-2xl">
                        {title && (
                            <h2 className="text-xl font-bold">{title}</h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-white/20 rounded-lg transition"
                                aria-label="Close modal"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

// Modal footer for form actions
export interface ModalFooterProps {
    children: ReactNode;
    className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
    return (
        <div className={clsx('flex gap-3 p-4 border-t border-stone-200 bg-stone-50', className)}>
            {children}
        </div>
    );
}

// Modal body wrapper
export interface ModalBodyProps {
    children: ReactNode;
    className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
    return (
        <div className={clsx('p-6', className)}>
            {children}
        </div>
    );
}
