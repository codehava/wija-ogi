// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Person Detail Loading State
// ═══════════════════════════════════════════════════════════════════════════════

export default function PersonLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Back button skeleton */}
                <div className="h-9 w-24 bg-stone-200 rounded-lg animate-pulse mb-6" />

                {/* Person card skeleton */}
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
                    {/* Photo + name */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-20 h-20 rounded-full bg-stone-200 animate-pulse" />
                        <div className="flex-1">
                            <div className="h-6 w-40 bg-stone-200 rounded animate-pulse mb-2" />
                            <div className="h-4 w-28 bg-stone-100 rounded animate-pulse mb-1" />
                            <div className="h-3 w-32 bg-teal-100 rounded animate-pulse" />
                        </div>
                    </div>

                    {/* Detail rows skeleton */}
                    <div className="space-y-4 border-t border-stone-100 pt-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex justify-between">
                                <div className="h-4 w-24 bg-stone-100 rounded animate-pulse" />
                                <div className="h-4 w-32 bg-stone-200 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
