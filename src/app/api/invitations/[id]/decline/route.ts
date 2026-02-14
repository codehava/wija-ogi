// POST /api/invitations/[id]/decline — declineInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { declineInvitation } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        await declineInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST decline error:', error);
        return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 });
    }
}
