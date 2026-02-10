// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - 404 Not Found Page
// ═══════════════════════════════════════════════════════════════════════════════

import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center max-w-md">
                <div className="text-8xl font-bold text-gray-200 mb-4">404</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Halaman Tidak Ditemukan
                </h1>
                <p className="text-gray-600 mb-6">
                    Halaman yang Anda cari tidak ada atau telah dipindahkan.
                </p>
                <Link
                    href="/"
                    className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
