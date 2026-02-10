// POST /api/invitations/[id]/resend — resendInvitation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resendInvitation } from '@/lib/services/invitations';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        await resendInvitation(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API] POST resend error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
