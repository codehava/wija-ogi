// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Root Error Boundary
// Catches rendering errors and shows a friendly UI
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">😵</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Terjadi Kesalahan
                </h1>
                <p className="text-gray-600 mb-6">
                    Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
                </p>
                {error.message && (
                    <p className="text-sm text-gray-400 mb-4 font-mono bg-gray-100 p-3 rounded-lg">
                        {error.message}
                    </p>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        Coba Lagi
                    </button>
                    <a
                        href="/"
                        className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Ke Beranda
                    </a>
                </div>
            </div>
        </div>
    );
}
