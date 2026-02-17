// PATCH /api/families/[id]/persons/[personId]/lontara — setCustomLontaraName (editor+)

import { NextRequest, NextResponse } from 'next/server';
import { setCustomLontaraName } from '@/lib/services/persons';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string; personId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id, personId } = await params;
        const authResult = await requireRole(id, 'editor');
        if (!authResult.ok) return authResult.response;

        const customName = await request.json();
        await setCustomLontaraName(id, personId, customName);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to update Lontara name');
    }
}
