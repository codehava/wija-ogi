// POST /api/invitations/[id]/decline — declineInvitation

import { NextRequest, NextResponse } from 'next/server';
import { declineInvitation } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        await declineInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST decline error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
