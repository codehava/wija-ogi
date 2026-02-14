// ═══════════════════════════════════════════════════════════════════════════════
// WIJA - API Error & Rate Limit Helpers
// Centralized utilities for safe error responses and rate limiting in routes
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { checkRateLimit, getRateLimitKey, type RateLimitConfig } from '@/lib/rateLimit';

/**
 * M4 FIX: Return a safe error response that never leaks internal details.
 * In development, includes the full error message for debugging.
 */
export function safeErrorResponse(
    error: unknown,
    fallbackMessage: string = 'Internal server error',
    status: number = 500
): NextResponse {
    const isDev = process.env.NODE_ENV === 'development';
    const message = isDev && error instanceof Error ? error.message : fallbackMessage;

    // Always log the full error server-side
    if (error instanceof Error) {
        console.error(`[API Error] ${fallbackMessage}:`, error.message);
    }

    return NextResponse.json({ error: message }, { status });
}

/**
 * Apply rate limiting to a request. Returns a 429 response if limit exceeded.
 * Returns null if the request is within limits (proceed normally).
 */
export function applyRateLimit(
    request: Request,
    config: RateLimitConfig,
    identifier?: string
): NextResponse | null {
    const key = getRateLimitKey(request, identifier);
    const result = checkRateLimit(key, config);

    if (!result.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.resetIn),
                    'X-RateLimit-Limit': String(config.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(result.resetIn),
                },
            }
        );
    }

    return null;
}
