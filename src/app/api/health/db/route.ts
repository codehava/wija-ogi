// DB diagnostic endpoint - check connection and tables
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUrl = process.env.DATABASE_URL;

    // Check if DATABASE_URL is set (mask credentials)
    if (!dbUrl) {
        return NextResponse.json({
            status: 'error',
            dbConnected: false,
            error: 'DATABASE_URL environment variable is not set',
        }, { status: 500 });
    }

    // Mask the URL for security (show host/port/dbname only)
    let maskedUrl = 'not parseable';
    try {
        const url = new URL(dbUrl);
        maskedUrl = `${url.protocol}//*****@${url.host}${url.pathname}`;
    } catch {
        maskedUrl = dbUrl.replace(/\/\/[^@]+@/, '//*****@');
    }

    try {
        // Set a timeout for the query
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB query timeout after 5s')), 5000)
        );

        const queryPromise = db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);

        const result = await Promise.race([queryPromise, timeoutPromise]) as any[];

        const tables = result.map((r: any) => r.table_name);
        const requiredTables = ['users', 'accounts', 'sessions', 'verification_tokens', 'trees', 'tree_members', 'persons', 'relationships'];
        const missing = requiredTables.filter(t => !tables.includes(t));

        return NextResponse.json({
            status: missing.length === 0 ? 'ok' : 'missing_tables',
            dbConnected: true,
            maskedUrl,
            existingTables: tables,
            missingTables: missing,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            status: 'connection_failed',
            dbConnected: false,
            maskedUrl,
            error: message,
        }, { status: 500 });
    }
}
