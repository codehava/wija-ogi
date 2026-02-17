// GET /api/invitations/family/[id] — getInvitationsForFamily (admin+ required)

import { NextRequest, NextResponse } from 'next/server';
import { getInvitationsForFamily } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const authResult = await requireRole(id, 'admin');
        if (!authResult.ok) return authResult.response;

        const invitations = await getInvitationsForFamily(id);
        return NextResponse.json(invitations);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to list invitations');
    }
}
