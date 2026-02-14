// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Invitation Page Loading State
// ═══════════════════════════════════════════════════════════════════════════════

export default function InviteLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-8 max-w-md w-full text-center">
                <div className="text-5xl mb-4 animate-bounce">💌</div>
                <div className="h-6 w-48 bg-stone-200 rounded animate-pulse mx-auto mb-3" />
                <div className="h-4 w-64 bg-stone-100 rounded animate-pulse mx-auto mb-6" />
                <div className="h-10 w-full bg-teal-100 rounded-lg animate-pulse" />
            </div>
        </div>
    );
}
