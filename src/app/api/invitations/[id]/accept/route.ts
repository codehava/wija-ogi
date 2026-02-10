// POST /api/invitations/[id]/accept — acceptInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { acceptInvitation } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const { userId, displayName, email, photoUrl } = await request.json();
        await acceptInvitation(id, userId, displayName, email, photoUrl);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST accept error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
