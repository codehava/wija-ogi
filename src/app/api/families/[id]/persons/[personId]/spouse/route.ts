// POST /api/families/[id]/persons/[personId]/spouse — addSpouse (editor+)
// DELETE /api/families/[id]/persons/[personId]/spouse — removeSpouse (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { addSpouse, removeSpouse } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const { person2Id } = await request.json();
        await addSpouse(id, personId, person2Id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to add spouse');
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const { person2Id } = await request.json();
        await removeSpouse(id, personId, person2Id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to remove spouse');
    }
}
