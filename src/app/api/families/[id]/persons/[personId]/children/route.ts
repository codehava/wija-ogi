// POST   /api/families/[id]/persons/[personId]/children — addParentChild
// DELETE /api/families/[id]/persons/[personId]/children — removeParentChild

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { addParentChild, removeParentChild } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { childId } = await request.json();
        await addParentChild(id, personId, childId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST children error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, personId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { childId } = await request.json();
        await removeParentChild(id, personId, childId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE children error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
