// POST /api/families/[id]/persons/[personId]/spouse — addSpouse
// DELETE /api/families/[id]/persons/[personId]/spouse — removeSpouse

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { addSpouse, removeSpouse } from '@/lib/services/persons';
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
        const { person2Id } = await request.json();
        await addSpouse(id, personId, person2Id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST spouse error:', error);
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
        const { person2Id } = await request.json();
        await removeSpouse(id, personId, person2Id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE spouse error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
