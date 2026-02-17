// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Next.js Middleware
// Rate limiting for auth endpoints and write operations
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rateLimit';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── Rate limit auth endpoints (login/register): 10 per minute ───────
    // EXCLUDE callback routes — these are OAuth return flows, not login attempts
    if (pathname.startsWith('/api/auth') && !pathname.startsWith('/api/auth/callback')) {
        const key = getRateLimitKey(request);
        const result = checkRateLimit(key, RATE_LIMITS.AUTH);

        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(result.resetIn),
                        'X-RateLimit-Limit': String(RATE_LIMITS.AUTH.limit),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(result.resetIn),
                    },
                }
            );
        }
    }

    // ─── Rate limit write endpoints (POST/PUT/PATCH/DELETE): 30 per minute
    if (
        pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/auth') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
        const key = getRateLimitKey(request);
        const result = checkRateLimit(key, RATE_LIMITS.WRITE);

        if (!result.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(result.resetIn),
                    },
                }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*'],
};
