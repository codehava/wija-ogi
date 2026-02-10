// GET  /api/families/[id]/relationships — getAllRelationships
// POST /api/families/[id]/relationships — createRelationship

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllRelationships, createRelationship } from '@/lib/services/relationships';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const relationships = await getAllRelationships(id);
        return NextResponse.json(relationships);
    } catch (error: any) {
        console.error('[API] GET relationships error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const input = await request.json();
        const relationship = await createRelationship(id, input);
        return NextResponse.json(relationship, { status: 201 });
    } catch (error: any) {
        console.error('[API] POST relationships error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
