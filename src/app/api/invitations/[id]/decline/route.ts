// POST /api/invitations/[id]/decline — declineInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { declineInvitation, getInvitation } from '@/lib/services/invitations';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;

        // Verify invitation belongs to this user's email
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await declineInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to decline invitation');
    }
}
