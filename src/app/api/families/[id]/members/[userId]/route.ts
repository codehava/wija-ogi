// PATCH  /api/families/[id]/members/[userId] — updateMemberRole (admin+)
// DELETE /api/families/[id]/members/[userId] — removeFamilyMember (admin+)

import { NextRequest, NextResponse } from 'next/server';
import { updateMemberRole, removeFamilyMember } from '@/lib/services/families';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, userId } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        const { role } = await request.json();
        await updateMemberRole(id, userId, role);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update member role');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, userId } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        await removeFamilyMember(id, userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to remove member');
    }
}
