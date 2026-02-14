// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Family Tree Loading State
// Shows animated skeleton while the tree page loads
// ═══════════════════════════════════════════════════════════════════════════════

export default function FamilyTreeLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 flex items-center justify-center">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                    {/* Animated tree rings */}
                    <div className="absolute inset-0 rounded-full border-4 border-teal-200 animate-ping opacity-20" />
                    <div className="absolute inset-2 rounded-full border-4 border-teal-300 animate-ping opacity-30 animation-delay-200" />
                    <div className="absolute inset-4 rounded-full border-4 border-teal-400 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center text-3xl">
                        🌳
                    </div>
                </div>
                <h2 className="text-lg font-semibold text-stone-700 mb-1">
                    Memuat Pohon Keluarga
                </h2>
                <p className="text-sm text-stone-500">
                    Menyiapkan data silsilah...
                </p>
            </div>
        </div>
    );
}
