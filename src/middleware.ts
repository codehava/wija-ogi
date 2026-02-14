// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - Next.js Middleware
// Rate limiting, CSRF protection, and other global protections
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rateLimit';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ─── CSRF Protection for mutations ───────────────────────────────────
    // Verify Origin/Referer matches our host on state-changing requests
    if (
        pathname.startsWith('/api/') &&
        !pathname.startsWith('/api/auth') && // NextAuth handles its own CSRF
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    ) {
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const host = request.headers.get('host');

        // Server-side requests (no origin/referer) are allowed
        if (origin || referer) {
            const requestOrigin = origin || (referer ? new URL(referer).origin : null);
            const expectedOrigin = `${request.nextUrl.protocol}//${host}`;

            if (requestOrigin && requestOrigin !== expectedOrigin) {
                return NextResponse.json(
                    { error: 'Forbidden: Cross-origin request blocked' },
                    { status: 403 }
                );
            }
        }
    }

    // ─── Rate limit auth endpoints (login/register): 10 per minute ───────
    if (pathname.startsWith('/api/auth')) {
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
