// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Home Page
// Landing page with family selection
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/contexts/ThemeContext';
import { useUserFamilies } from '@/hooks/useFirestore';
import { transliterateLatin } from '@/lib/transliteration/engine';
import { createFamily } from '@/lib/services/families';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function HomePage() {
    const router = useRouter();
    const { user, loading: authLoading, isAuthenticated, signInGoogle, signOut } = useAuth();
    const { families, loading: familiesLoading, refresh } = useUserFamilies();

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [familyName, setFamilyName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const loading = authLoading || familiesLoading;

    // Transliterate WIJA for display
    const wijaLontara = transliterateLatin('wija').lontara;

    // Handle create family
    const handleCreateFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!familyName.trim()) {
            setError('Nama keluarga wajib diisi');
            return;
        }

        if (!user) {
            setError('Anda harus login terlebih dahulu');
            return;
        }

        setCreating(true);
        try {
            const family = await createFamily(
                {
                    name: familyName.trim(),
                    displayName: displayName.trim() || undefined
                },
                user.uid
            );

            // Refresh list and navigate to new family
            await refresh?.();
            setShowCreateModal(false);
            setFamilyName('');
            setDisplayName('');
            router.push(`/family/${family.familyId}`);
        } catch (err: any) {
            console.error('Failed to create family:', err);
            setError(err.message || 'Gagal membuat keluarga. Silakan coba lagi.');
        } finally {
            setCreating(false);
        }
    };

    const handleOpenCreateModal = () => {
        setFamilyName('');
        setDisplayName('');
        setError('');
        setShowCreateModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-stone-600">Memuat...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white shadow-xl">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img
                                src="/logo.png"
                                alt="WIJA Logo"
                                className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1"
                            />
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    WIJA
                                    <span className="text-sm font-normal bg-white/20 px-2 py-0.5 rounded">v5.0</span>
                                </h1>
                                <p className="text-teal-200 text-sm">Warisan Jejak Keluarga</p>
                            </div>
                        </div>

                        {isAuthenticated && (
                            <div className="flex items-center gap-2">
                                <ThemeToggle />
                                <span className="text-teal-200 text-sm hidden sm:block">
                                    {user?.email}
                                </span>
                                <button
                                    onClick={() => signOut()}
                                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition press-effect"
                                >
                                    Keluar
                                </button>
                            </div>
                        )}
                        {!isAuthenticated && (
                            <ThemeToggle />
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
                {!isAuthenticated ? (
                    /* Login Section */
                    <div className="max-w-lg mx-auto">
                        {/* Hero Section with Large Logo */}
                        <div className="text-center mb-8 animate-fade-in">
                            <img
                                src="/logo.png"
                                alt="WIJA Logo"
                                className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-4 drop-shadow-xl"
                            />
                            <h2 className="text-3xl md:text-4xl font-bold text-stone-800 mb-2">
                                WIJA
                            </h2>
                            <p className="text-lg text-teal-700 font-medium font-lontara">
                                ᨓᨗᨍ
                            </p>
                            <p className="text-stone-600 mt-2">
                                Warisan Jejak Keluarga
                            </p>
                        </div>

                        {/* Login Card */}
                        <div className="glass rounded-xl shadow-float animate-slide-up">
                            <div className="p-4 border-b border-white/20 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-t-xl text-center">
                                <h2 className="text-xl font-bold">Selamat Datang</h2>
                                <p className="text-teal-100 text-sm mt-1">
                                    Aplikasi Pohon Keluarga Digital
                                </p>
                            </div>
                            <div className="p-4 md:p-6 space-y-4">
                                <p className="text-center text-stone-600 dark:text-stone-300 text-sm md:text-base">
                                    Silakan masuk untuk melanjutkan mengelola pohon keluarga Anda.
                                </p>

                                <button
                                    onClick={() => signInGoogle()}
                                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 hover:shadow-md transition-all press-effect"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span className="font-medium">Masuk dengan Google</span>
                                </button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-stone-200/50"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white/80 backdrop-blur text-stone-500 rounded">atau</span>
                                    </div>
                                </div>

                                <p className="text-center text-sm text-stone-500">
                                    Fitur login dengan Email akan segera hadir
                                </p>
                            </div>
                        </div>

                        {/* Features - Responsive Grid */}
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="glass-subtle rounded-xl p-4 hover-lift stagger-item">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3">
                                    <span className="text-xl">📜</span>
                                </div>
                                <h3 className="font-semibold text-stone-800">
                                    Aksara Lontara
                                </h3>
                                <p className="text-sm text-stone-600 mt-1">
                                    Dukung aksara tradisional Bugis dengan transliterasi otomatis
                                </p>
                            </div>
                            <div className="glass-subtle rounded-xl p-4 hover-lift stagger-item">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-3">
                                    <span className="text-xl">🌳</span>
                                </div>
                                <h3 className="font-semibold text-stone-800">
                                    Pohon Keluarga Dinamis
                                </h3>
                                <p className="text-sm text-stone-600 mt-1">
                                    Visualisasi pohon keluarga hingga puluhan generasi
                                </p>
                            </div>
                            <div className="glass-subtle rounded-xl p-4 hover-lift stagger-item">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center mb-3">
                                    <span className="text-xl">🔄</span>
                                </div>
                                <h3 className="font-semibold text-stone-800">
                                    Real-time Sync
                                </h3>
                                <p className="text-sm text-stone-600 mt-1">
                                    Kolaborasi dengan keluarga secara real-time
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Family Selection */
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-stone-800">Keluarga Saya</h2>
                            <Button onClick={handleOpenCreateModal} icon="➕">
                                Buat Keluarga Baru
                            </Button>
                        </div>

                        {families.length === 0 ? (
                            <div className="glass rounded-xl text-center py-12 px-6 shadow-float">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    <span className="text-4xl">🌱</span>
                                </div>
                                <h3 className="text-xl font-semibold text-stone-800 mb-2">
                                    Belum Ada Keluarga
                                </h3>
                                <p className="text-stone-600 mb-6 max-w-sm mx-auto">
                                    Mulai buat pohon keluarga pertama Anda dan lestarikan warisan keluarga
                                </p>
                                <Button onClick={handleOpenCreateModal} className="press-effect">
                                    ✨ Buat Keluarga Baru
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {families.map((family, index) => (
                                    <Link
                                        key={family.familyId}
                                        href={`/family/${family.familyId}`}
                                        className="glass rounded-xl hover-lift group stagger-item"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="font-semibold text-lg text-stone-800 group-hover:text-teal-700 transition">
                                                        {family.name}
                                                    </h3>
                                                    <p className="text-sm text-stone-500">{family.displayName}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all">
                                                    <span className="text-lg">🌳</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-sm text-stone-600">
                                                <span className="flex items-center gap-1">
                                                    <span className="text-stone-400">👥</span>
                                                    {family.stats.personCount} anggota
                                                </span>
                                                <span className="text-teal-600 font-lontara">
                                                    {transliterateLatin(family.name).lontara}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="mt-auto py-6 text-center text-stone-500 text-sm">
                <p>WIJA v5.0 - Warisan Jejak Keluarga</p>
                <p className="font-lontara text-teal-700 mt-1">
                    {wijaLontara} - ᨓᨑᨗᨔᨊ ᨍᨙᨍᨀ ᨀᨙᨒᨘᨕᨑᨁ
                </p>
            </footer>

            {/* Create Family Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="🌳 Buat Keluarga Baru"
                size="md"
            >
                <form onSubmit={handleCreateFamily}>
                    <ModalBody className="space-y-4">
                        <Input
                            label="Nama Keluarga *"
                            value={familyName}
                            onChange={(e) => setFamilyName(e.target.value)}
                            placeholder="Contoh: Keluarga Budiman"
                            error={error}
                        />

                        {familyName && (
                            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                <div className="text-sm text-teal-600">Lontara:</div>
                                <div className="font-lontara text-xl text-teal-700">
                                    {transliterateLatin(familyName).lontara}
                                </div>
                            </div>
                        )}

                        <Input
                            label="Nama Tampilan (opsional)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Contoh: Pohon Keluarga Budiman"
                            helperText="Nama yang ditampilkan di header"
                        />
                    </ModalBody>

                    <ModalFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowCreateModal(false)}
                            className="flex-1"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            loading={creating}
                            className="flex-1"
                        >
                            Buat Keluarga
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        </div>
    );
}
