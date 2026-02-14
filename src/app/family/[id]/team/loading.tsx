// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Team Page Loading State
// ═══════════════════════════════════════════════════════════════════════════════

export default function TeamLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="h-8 w-28 bg-stone-200 rounded-lg animate-pulse mb-6" />
                <div className="h-4 w-64 bg-stone-100 rounded animate-pulse mb-8" />

                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-stone-200 animate-pulse" />
                            <div className="flex-1">
                                <div className="h-4 w-28 bg-stone-200 rounded animate-pulse mb-1" />
                                <div className="h-3 w-40 bg-stone-100 rounded animate-pulse" />
                            </div>
                            <div className="h-6 w-16 bg-teal-100 rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
