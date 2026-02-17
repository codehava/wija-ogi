// PATCH  /api/families/[id]/persons/[personId]  — updatePerson (editor+)
// DELETE /api/families/[id]/persons/[personId]  — deletePerson (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { updatePerson, deletePerson } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const updates = await request.json();
        await updatePerson(id, personId, updates, authResult.userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update person');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        await deletePerson(id, personId);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to delete person');
    }
}
