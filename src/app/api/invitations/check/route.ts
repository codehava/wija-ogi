// POST /api/invitations/check — isEmailAlreadyInvited (admin+ on family)

import { NextRequest, NextResponse } from 'next/server';
import { isEmailAlreadyInvited } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

export async function POST(request: NextRequest) {
    try {
        const { familyId, email } = await request.json();
        if (!familyId || !email) {
            return NextResponse.json({ error: 'familyId and email are required' }, { status: 400 });
        }

        const authResult = await requireRole(familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        const isInvited = await isEmailAlreadyInvited(familyId, email);
        return NextResponse.json({ isInvited });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to check invitation');
    }
}
