// GET  /api/families/[id]/relationships — getAllRelationships
// POST /api/families/[id]/relationships — createRelationship

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAllRelationships, createRelationship } from '@/lib/services/relationships';
import { isFamilyMember } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';
import { CreateRelationshipSchema, validateInput } from '@/lib/validation';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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
        const relationships = await getAllRelationships(id);
        return NextResponse.json(relationships);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to load relationships');
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
        const raw = await request.json();
        const validated = validateInput(CreateRelationshipSchema, raw);
        if (!validated.success) {
            return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const relationship = await createRelationship(id, validated.data);
        return NextResponse.json(relationship, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create relationship');
    }
}
