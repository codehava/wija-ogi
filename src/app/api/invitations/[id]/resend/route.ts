// POST /api/invitations/[id]/resend — resendInvitation (admin+ of the family)

import { NextRequest, NextResponse } from 'next/server';
import { getInvitation, resendInvitation } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        // Need to find the invitation first to get the family
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Require admin+ on the invitation's family
        const authResult = await requireRole(invitation.familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        await resendInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to resend invitation');
    }
}
