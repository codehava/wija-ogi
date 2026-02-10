// GET    /api/invitations/[id] — getInvitation
// DELETE /api/invitations/[id] — revokeInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getInvitation, revokeInvitation } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const invitation = await getInvitation(id);
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        return NextResponse.json(invitation);
    } catch (error: any) {
        console.error('[API] GET /api/invitations/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        await revokeInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] DELETE /api/invitations/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
