// GET    /api/invitations/[id] — getInvitation (auth required)
// DELETE /api/invitations/[id] — revokeInvitation (admin+ of the family)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getInvitation, revokeInvitation } from '@/lib/services/invitations';
import { safeErrorResponse, requireRole } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        return NextResponse.json(invitation);
    } catch (error) {
        return safeErrorResponse(error, 'Failed to get invitation');
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;

        // Get the invitation to find which family it belongs to
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }

        // Only admin+ of the family can revoke invitations
        const authResult = await requireRole(invitation.familyId, 'admin');
        if (!authResult.ok) return authResult.response;

        await revokeInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to revoke invitation');
    }
}
