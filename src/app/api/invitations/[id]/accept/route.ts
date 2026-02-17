// POST /api/invitations/[id]/accept — acceptInvitation
// M2 FIX: Verifies invitee email matches authenticated user's email

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { acceptInvitation, getInvitation } from '@/lib/services/invitations';
import { safeErrorResponse } from '@/lib/apiHelpers';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;

        // M2 FIX: Verify the invitation email matches the accepting user
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
            return NextResponse.json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
        }

        await acceptInvitation(
            id,
            session.user.id,
            session.user.name || '',
            session.user.email || '',
            session.user.image || ''
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        return safeErrorResponse(error, 'Failed to accept invitation');
    }
}
