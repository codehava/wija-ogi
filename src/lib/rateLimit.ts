// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - In-memory Rate Limiter
// Simple sliding window rate limiter for API routes (no Redis needed)
// ═══════════════════════════════════════════════════════════════════════════════

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store) {
        if (now > entry.resetTime) {
            store.delete(key);
        }
    }
}

export interface RateLimitConfig {
    /** Maximum requests per window */
    limit: number;
    /** Window size in seconds */
    windowSeconds: number;
}

// Preset configurations
export const RATE_LIMITS = {
    /** Auth endpoints: 10 requests per minute */
    AUTH: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
    /** Write operations: 30 per minute */
    WRITE: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
    /** Read operations: 100 per minute */
    READ: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
    /** File uploads: 5 per minute */
    UPLOAD: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
    /** Sensitive operations (rebuild, import): 3 per minute */
    SENSITIVE: { limit: 3, windowSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * Check rate limit for a given key.
 * Returns { allowed: true, remaining, resetIn } or { allowed: false, remaining: 0, resetIn }.
 */
export function checkRateLimit(
    key: string,
    config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
    cleanup();

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetTime) {
        // New window
        store.set(key, {
            count: 1,
            resetTime: now + config.windowSeconds * 1000,
        });
        return { allowed: true, remaining: config.limit - 1, resetIn: config.windowSeconds };
    }

    if (entry.count >= config.limit) {
        const resetIn = Math.ceil((entry.resetTime - now) / 1000);
        return { allowed: false, remaining: 0, resetIn };
    }

    entry.count++;
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: true, remaining: config.limit - entry.count, resetIn };
}

/**
 * Build a rate limit key from IP + optional identifier
 */
export function getRateLimitKey(
    request: Request,
    identifier?: string
): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const path = new URL(request.url).pathname;
    return `${ip}:${path}${identifier ? ':' + identifier : ''}`;
}
