// GET /api/invitations/family/[id] — getInvitationsForFamily

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getInvitationsForFamily } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const invitations = await getInvitationsForFamily(id);
        return NextResponse.json(invitations);
    } catch (error: any) {
        console.error('[API] GET /api/invitations/family/[id] error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
