// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Health Check Endpoint
// Used by Docker HEALTHCHECK and uptime monitoring
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '6.0.0',
    });
}
