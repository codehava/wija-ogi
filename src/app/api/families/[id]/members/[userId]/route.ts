// PATCH  /api/families/[id]/members/[userId] — updateMemberRole
// DELETE /api/families/[id]/members/[userId] — removeFamilyMember

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateMemberRole, removeFamilyMember, isFamilyMember } from '@/lib/services/families';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, userId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { role } = await request.json();
        await updateMemberRole(id, userId, role);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] PATCH /api/families/[id]/members/[userId] error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id, userId } = await params;
        const isMember = await isFamilyMember(id, session.user.id);
        if (!isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        await removeFamilyMember(id, userId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE /api/families/[id]/members/[userId] error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
