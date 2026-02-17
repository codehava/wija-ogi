// POST /api/invitations — createInvitation (admin+ of the target family)

import { NextRequest, NextResponse } from 'next/server';
import { createInvitation } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

export async function POST(request: NextRequest) {
    try {
        const input = await request.json();

        // C2 FIX: Caller must be admin+ of the target family
        if (!input.familyId) {
            return NextResponse.json({ error: 'familyId is required' }, { status: 400 });
        }
        const authResult = await requireRole(input.familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        const invitation = await createInvitation(input);
        return NextResponse.json(invitation, { status: 201 });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to create invitation');
    }
}
