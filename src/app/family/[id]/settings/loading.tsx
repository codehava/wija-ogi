// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Settings Page Loading State
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 p-6">
            <div className="max-w-2xl mx-auto">
                <div className="h-8 w-32 bg-stone-200 rounded-lg animate-pulse mb-6" />

                <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                            <div className="h-5 w-36 bg-stone-200 rounded animate-pulse mb-3" />
                            <div className="h-4 w-full bg-stone-100 rounded animate-pulse mb-2" />
                            <div className="h-10 w-full bg-stone-50 rounded-lg border border-stone-200 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
