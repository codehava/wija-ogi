// PATCH  /api/families/[id]/persons/[personId]  — updatePerson
// DELETE /api/families/[id]/persons/[personId]  — deletePerson

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updatePerson, deletePerson } from '@/lib/services/persons';
import { isFamilyMember } from '@/lib/services/families';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
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
        const updates = await request.json();
        await updatePerson(id, personId, updates, session.user.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update person');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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
        await deletePerson(id, personId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete person');
    }
}
