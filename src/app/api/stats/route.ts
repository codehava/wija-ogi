// GET /api/stats
// Public endpoint: returns total person and family counts

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { persons, trees } from '@/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        const [personResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(persons);

        const [familyResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(trees);

        return NextResponse.json({
            totalPersons: personResult?.count ?? 0,
            totalFamilies: familyResult?.count ?? 0,
        });
    } catch (error) {
        console.error('Stats API error:', error);
        return NextResponse.json(
            { totalPersons: 0, totalFamilies: 0 },
            { status: 200 }
        );
    }
}
