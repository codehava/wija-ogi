// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Members Page Loading State
// ═══════════════════════════════════════════════════════════════════════════════

export default function MembersLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header skeleton */}
                <div className="h-8 w-48 bg-stone-200 rounded-lg animate-pulse mb-6" />
                <div className="h-4 w-80 bg-stone-100 rounded animate-pulse mb-8" />

                {/* Member cards skeleton */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-stone-200 animate-pulse" />
                                <div className="flex-1">
                                    <div className="h-4 w-24 bg-stone-200 rounded animate-pulse mb-1" />
                                    <div className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
                                </div>
                            </div>
                            <div className="h-3 w-16 bg-teal-100 rounded-full animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
