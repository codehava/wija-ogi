// GET /api/families/[id]/activities
// Fetch activity log for a family/tree

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { activities } from '@/db/schema';
import { isFamilyMember } from '@/lib/services/families';
import { eq, desc } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: treeId } = await params;
        const isMember = await isFamilyMember(treeId, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
        const offset = parseInt(searchParams.get('offset') || '0');

        const rows = await db
            .select()
            .from(activities)
            .where(eq(activities.treeId, treeId))
            .orderBy(desc(activities.createdAt))
            .limit(limit)
            .offset(offset);

        const mapped = rows.map(row => ({
            activityId: row.id,
            familyId: row.treeId,
            action: row.action,
            description: row.description,
            targetId: row.targetId,
            targetType: row.targetType,
            performedBy: row.performedBy,
            performedByName: row.performedByName,
            createdAt: row.createdAt,
        }));

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('Failed to fetch activities:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}
